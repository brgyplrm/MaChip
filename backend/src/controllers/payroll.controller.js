const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { sendPayrollEmail } = require("../utils/emailService");
const { generatePayslipPDF } = require("../utils/pdfGenerator");


// ── Constants ─────────────────────────────────────────────────────────────────
const WORK_START = "08:30:00"; // official start
const GRACE_END = "08:35:00"; // 5 min grace period
const WORK_HRS_PER_DAY = 8; // standard hours per day

// ── Internal Helper: Compute Period Stats ─────────────────────────────────────
async function computePeriodStats(user_Id, period_Start, period_End) {
  // 1. Get all working days (Mon–Sat)
  const workingDays = await sequelize.query(
    `SELECT generate_series(
       :period_Start::date,
       :period_End::date,
       '1 day'::interval
     )::date AS work_date`,
    { replacements: { period_Start, period_End }, type: QueryTypes.SELECT },
  );

  const validWorkDays = workingDays.filter((d) => {
    // Robust Sunday exclusion: Parse as UTC to avoid local timezone shifts
    const [y, m, day] = d.work_date.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, day));
    return dateObj.getUTCDay() !== 0; // 0 = Sunday
  });

  const totalScheduledDays = validWorkDays.length;

  // 2. Get attendance logs (from user_logging for exact timings)
  const logs = await sequelize.query(
    `SELECT
       DATE("log_Date") AS log_date,
       MIN(CASE WHEN "logged_StatusId" = 1 THEN "time_Logged" END) AS first_in
     FROM "user_logging"
     WHERE "user_id" = :user_Id
     AND DATE("log_Date") BETWEEN :period_Start AND :period_End
     GROUP BY DATE("log_Date")`,
    { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT },
  );

  const logMap = {};
  logs.forEach((l) => { 
    const dateStr = typeof l.log_date === 'string' ? l.log_date : l.log_date.toISOString().split('T')[0];
    logMap[dateStr] = l; 
  });

  // 3. Get approved leaves (unpaid and paid)
  const approvedLeaveDaysMap = new Map(); // date -> { withPay: boolean }
  
  const leaveRecords = await sequelize.query(
    `SELECT "StartDate", "EndDate", "WithPayID" FROM "Vacation_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)
     UNION
     SELECT "StartDate", "EndDate", "WithPayID" FROM "Sick_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );

  leaveRecords.forEach(lr => {
    let curr = new Date(lr.StartDate);
    let end = new Date(lr.EndDate);
    while(curr <= end) {
      approvedLeaveDaysMap.set(curr.toISOString().split('T')[0], lr.WithPayID === 1);
      curr.setDate(curr.getDate() + 1);
    }
  });

  // 4. Get explicit statuses from employee_Logging_report (including Absent status 3)
  const reports = await sequelize.query(
    `SELECT "log_Date", "attendance_StatusId" 
     FROM "employee_Logging_report"
     WHERE "user_id" = :user_Id
     AND "log_Date" BETWEEN :period_Start AND :period_End`,
    { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT }
  );
  
  const reportMap = {};
  reports.forEach(r => {
    const dateStr = typeof r.log_Date === 'string' ? r.log_Date : r.log_Date.toISOString().split('T')[0];
    reportMap[dateStr] = r;
  });

  // 4.5 Get On-Field Work assignments
  const onfieldDays = await sequelize.query(
    `SELECT ow."DateonField" FROM "Onfield_Work" ow
     JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
     WHERE er."user_Id" = :user_Id AND er."emp_reqStatusId" = 2
     AND ow."DateonField" BETWEEN :period_Start AND :period_End`,
    { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT }
  );
  const onfieldMap = new Set(onfieldDays.map(d => d.DateonField));

  let absence_Days = 0; 
  let tardiness_Mins = 0;
  let paidLeave_Days = 0;
  let unpaidLeave_Days = 0;

  for (const day of validWorkDays) {
    const dateStr = day.work_date; // Assuming it's already YYYY-MM-DD from Postgres
    
    if (approvedLeaveDaysMap.has(dateStr)) {
      if (approvedLeaveDaysMap.get(dateStr)) paidLeave_Days++;
      else unpaidLeave_Days++;
      continue;
    }

    // Skip absence check if it was an On-Field day
    if (onfieldMap.has(dateStr)) {
      continue;
    }

    const report = reportMap[dateStr];
    const log = logMap[dateStr];

    // Check if explicitly marked Absent (3) in report OR no logs/first_in
    if ((report && report.attendance_StatusId === 3)) {
      absence_Days++;
    } else if (log && log.first_in) {
      const [gh, gm] = GRACE_END.split(":").map(Number);
      const [lh, lm] = log.first_in.split(":").map(Number);
      const graceMinutes = gh * 60 + gm;
      const loginMinutes = lh * 60 + lm;
      if (loginMinutes > graceMinutes) {
        tardiness_Mins += loginMinutes - graceMinutes;

        console.log(`Tardiness of user ${user_Id}: ${tardiness_Mins} minutes`);
      }
    }
  }

  // 5. Get approved OT
  const overtimeResult = await sequelize.query(
    `SELECT COALESCE(SUM(ot."Total_Hrs"), 0) AS "total_OT_hrs"
     FROM "Overtime_Request" ot
     JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
     WHERE ot."user_Id" = :user_Id
     AND ot."OT_DateOf" BETWEEN :period_Start AND :period_End
     AND er."emp_reqStatusId" = 2`,
    { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT },
  );

  return {
    totalScheduledDays,
    absence_Days, 
    paidLeave_Days,
    unpaidLeave_Days,
    tardiness_Mins,
    OT_Hrs: parseFloat(overtimeResult[0].total_OT_hrs) || 0
  };
}

// ── Get Payroll Preview ───────────────────────────────────────────────────────
exports.getPayrollPreview = async (req, res) => {
  const { user_Id, period_Start, period_End } = req.query;
  if (!user_Id || !period_Start || !period_End) {
    return res.status(400).json({ error: "user_Id, period_Start, and period_End are required." });
  }

  try {
    const stats = await computePeriodStats(user_Id, period_Start, period_End);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Generate Payroll ──────────────────────────────────────────────────────────
exports.generatePayroll = async (req, res) => {
  const { 
    user_Id, period_Start, period_End, dailyRate, ratePerHr,
    // Allow frontend to send manual values
    NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDeductions, netPay,
    OT_Hrs, OT_Amnt, absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt,
    absence_Days, paidLeave_Days, unpaidLeave_Days, tardiness_Mins
  } = req.body;

  if (!user_Id || !period_Start || !period_End || !ratePerHr) {
    return res.status(400).json({ error: "user_Id, period_Start, period_End, ratePerHr are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Find the corresponding PayrollPeriod ID
    const periodRow = await sequelize.query(
        `SELECT "periodId" FROM "PayrollPeriod" 
         WHERE "startDate" = :period_Start AND "endDate" = :period_End LIMIT 1`,
        { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
      );
    const periodId = periodRow.length > 0 ? periodRow[0].periodId : null;

    // If frontend didn't send calculations, compute them (fallback)
    let finalStats = { 
        NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDeductions, netPay,
        OT_Hrs, OT_Amnt, absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt,
        absence_Days, paidLeave_Days, unpaidLeave_Days, tardiness_Mins
    };

    if (NoDays_Worked === undefined) {
        const stats = await computePeriodStats(user_Id, period_Start, period_End);
        const ratePerDay = ratePerHr * WORK_HRS_PER_DAY;
        const ratePerMin = ratePerHr / 60;

        // Initial logic: Combined absences (true absences + unpaid leaves)
        const combined_Absences = stats.absence_Days + stats.unpaidLeave_Days;

        const calculated_NoDays = stats.totalScheduledDays - combined_Absences;
        const calculated_NoHrs = calculated_NoDays * WORK_HRS_PER_DAY;
        const calculated_Basic = calculated_NoHrs * ratePerHr;

        // Total deduction amount for combined absences
        const calculated_AbsAmnt = combined_Absences * ratePerDay;
        const calculated_TardAmnt = stats.tardiness_Mins * ratePerMin;
        const calculated_OTAmnt = stats.OT_Hrs * ratePerHr;

        const calculated_Ded = calculated_AbsAmnt + calculated_TardAmnt;
        const calculated_Earn = calculated_Basic + calculated_OTAmnt;
        const calculated_Net = calculated_Earn - calculated_Ded;

        finalStats = {
            NoDays_Worked: calculated_NoDays,
            NoHrs_Worked: calculated_NoHrs,
            basicPay: calculated_Basic,
            totalEarnings: calculated_Earn,
            totalDeductions: calculated_Ded,
            netPay: calculated_Net,
            OT_Hrs: stats.OT_Hrs,
            OT_Amnt: calculated_OTAmnt,
            absence_Amnt: calculated_AbsAmnt,
            tardiness_Amnt: calculated_TardAmnt,
            unpaidLeave_Amnt: 0, // Bundled into absence_Amnt
            absence_Days: combined_Absences,
            paidLeave_Days: stats.paidLeave_Days,
            unpaidLeave_Days: stats.unpaidLeave_Days,
            tardiness_Mins: stats.tardiness_Mins
        };
    }

    const payrollResult = await sequelize.query(
      `INSERT INTO "Payroll"
        ("user_Id", "periodId", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
         "dailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
         "status", "createdAt", "updatedAt")
       VALUES
        (:user_Id, :periodId, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
         :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDeductions, :netPay,
         1, :now, :now)
       RETURNING *`,
      {
        replacements: {
          user_Id, 
          periodId,
          period_Start, period_End, 
          NoDays_Worked: finalStats.NoDays_Worked, 
          NoHrs_Worked: finalStats.NoHrs_Worked,
          dailyRate: dailyRate || 0, 
          ratePerHr,
          basicPay: finalStats.basicPay, 
          totalEarnings: finalStats.totalEarnings, 
          totalDeductions: finalStats.totalDeductions, 
          netPay: finalStats.netPay,
          now: nowStr
        },
        type: QueryTypes.INSERT,
      },
    );

    const payrollId = payrollResult[0][0]?.payrollId || payrollResult[0].payrollId || payrollResult[0][0];

    await sequelize.query(
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt)`,
      { replacements: { payrollId, user_Id, OT_Hrs: finalStats.OT_Hrs, OT_Amnt: finalStats.OT_Amnt }, type: QueryTypes.INSERT }
    );

    await sequelize.query(
      `INSERT INTO "Payroll_Deductions"
        ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days")
       VALUES
        (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days)`,
      {
        replacements: {
          payrollId,
          absence_Hrs: (finalStats.absence_Days) * WORK_HRS_PER_DAY,
          absence_Amnt: finalStats.absence_Amnt,
          tardiness_Mins: finalStats.tardiness_Mins,
          tardiness_Amnt: finalStats.tardiness_Amnt,
          unpaidLeave_Days: finalStats.unpaidLeave_Days,
          unpaidLeave_Amnt: 0, // Already included in absence_Amnt
          paidLeave_Days: finalStats.paidLeave_Days
        },
        type: QueryTypes.INSERT,
      }
    );
    return res.status(201).json({ message: "Payroll generated successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Generate Batch Payroll ──────────────────────────────────────────────────
exports.generateBatchPayroll = async (req, res) => {
  const { period_Start, period_End } = req.body;
  console.log(`[DEBUG] generateBatchPayroll: start=${period_Start}, end=${period_End}`);

  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // 0. Find the corresponding PayrollPeriod ID
    const periodRow = await sequelize.query(
      `SELECT "periodId" FROM "PayrollPeriod" 
       WHERE "startDate" = :period_Start AND "endDate" = :period_End LIMIT 1`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );
    const periodId = periodRow.length > 0 ? periodRow[0].periodId : null;
    console.log(`[DEBUG] Found periodId: ${periodId}`);

    // 1. Get all active employees (not deleted and have a dailyRate > 0)
    const employees = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email", "dailyRate" FROM "User" 
       WHERE "deletedAt" IS NULL AND "dailyRate" > 0`,
      { type: QueryTypes.SELECT }
    );
    console.log(`[DEBUG] Found eligible employees: ${employees.length}`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      // 2. Check if payroll already exists for this user and period
      // We check by period dates AND periodId if available
      const existing = await sequelize.query(
        `SELECT "payrollId" FROM "Payroll" 
         WHERE "user_Id" = :user_Id 
         AND (("period_Start" = :period_Start AND "period_End" = :period_End) OR ("periodId" = :periodId))`,
        { 
          replacements: { 
            user_Id: emp.user_Id, 
            period_Start, 
            period_End,
            periodId: periodId || -1 // avoid null comparison issues
          }, 
          type: QueryTypes.SELECT 
        }
      );

      if (existing.length > 0) {
        console.log(`[DEBUG] Skipping user ${emp.user_FirstName} (${emp.user_Id}) - payroll exists.`);
        skippedCount++;
        continue;
      }

      console.log(`[DEBUG] Processing user ${emp.user_FirstName} (${emp.user_Id})...`);
      // 3. Compute stats
      const stats = await computePeriodStats(emp.user_Id, period_Start, period_End);
      const dailyRate = emp.dailyRate;
      const ratePerHr = dailyRate / WORK_HRS_PER_DAY;
      const ratePerMin = ratePerHr / 60;

      const combined_Absences = stats.absence_Days + stats.unpaidLeave_Days;
      const calculated_NoDays = stats.totalScheduledDays - combined_Absences;
      const calculated_NoHrs = calculated_NoDays * WORK_HRS_PER_DAY;
      const calculated_Basic = calculated_NoHrs * ratePerHr;

      const calculated_AbsAmnt = combined_Absences * dailyRate;
      const calculated_TardAmnt = stats.tardiness_Mins * ratePerMin;
      const calculated_OTAmnt = stats.OT_Hrs * ratePerHr;

      const calculated_Ded = calculated_AbsAmnt + calculated_TardAmnt;
      const calculated_Earn = calculated_Basic + calculated_OTAmnt;
      const calculated_Net = calculated_Earn - calculated_Ded;

      // 4. Insert into Payroll
      const payrollResult = await sequelize.query(
        `INSERT INTO "Payroll"
          ("user_Id", "periodId", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
           "dailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
           "status", "createdAt", "updatedAt")
         VALUES
          (:user_Id, :periodId, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
           :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDeductions, :netPay,
           2, :now, :now)
         RETURNING "payrollId"`,
        {
          replacements: {
            user_Id: emp.user_Id, 
            periodId,
            period_Start, period_End,
            NoDays_Worked: calculated_NoDays,
            NoHrs_Worked: calculated_NoHrs,
            dailyRate, ratePerHr,
            basicPay: calculated_Basic,
            totalEarnings: calculated_Earn,
            totalDeductions: calculated_Ded,
            netPay: calculated_Net,
            now: nowStr
          },
          type: QueryTypes.INSERT
        }
      );

      // Handle different return formats from INSERT ... RETURNING in different environments
      let payrollId;
      if (Array.isArray(payrollResult) && payrollResult[0]) {
          if (Array.isArray(payrollResult[0]) && payrollResult[0][0]) {
              payrollId = payrollResult[0][0].payrollId || payrollResult[0][0];
          } else {
              payrollId = payrollResult[0].payrollId || payrollResult[0];
          }
      }
      
      if (!payrollId) {
          console.error(`[ERROR] Failed to get payrollId for user ${emp.user_Id}`);
          throw new Error(`Failed to generate payrollId for user ${emp.user_Id}`);
      }

      console.log(`[DEBUG] Generated payrollId: ${payrollId}`);

      // 5. Insert Earnings & Deductions
      await sequelize.query(
        `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt")
         VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt)`,
        { replacements: { payrollId, user_Id: emp.user_Id, OT_Hrs: stats.OT_Hrs, OT_Amnt: calculated_OTAmnt }, type: QueryTypes.INSERT }
      );

      await sequelize.query(
        `INSERT INTO "Payroll_Deductions"
          ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days")
         VALUES
          (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days)`,
        {
          replacements: {
            payrollId,
            absence_Hrs: combined_Absences * WORK_HRS_PER_DAY,
            absence_Amnt: calculated_AbsAmnt,
            tardiness_Mins: stats.tardiness_Mins,
            tardiness_Amnt: calculated_TardAmnt,
            unpaidLeave_Days: stats.unpaidLeave_Days,
            unpaidLeave_Amnt: 0,
            paidLeave_Days: stats.paidLeave_Days
          },
          type: QueryTypes.INSERT
        }
      );

      // 6. Send notification email with PDF attachment asynchronously
      if (emp.user_Email) {
        const payrollDataForPDF = {
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          period_Start,
          period_End,
          NoDays_Worked: calculated_NoDays,
          NoHrs_Worked: calculated_NoHrs,
          basicPay: calculated_Basic,
          OT_Hrs: stats.OT_Hrs,
          OT_Amnt: calculated_OTAmnt,
          absence_Hrs: combined_Absences * WORK_HRS_PER_DAY,
          absence_Amnt: calculated_AbsAmnt,
          tardiness_Mins: stats.tardiness_Mins,
          tardiness_Amnt: calculated_TardAmnt,
          totalEarnings: calculated_Earn,
          totalDeductions: calculated_Ded,
          netPay: calculated_Net
        };

        generatePayslipPDF(payrollDataForPDF).then(pdfBuffer => {
          return sendPayrollEmail({
            email: emp.user_Email,
            name: `${emp.user_FirstName} ${emp.user_LastName}`,
            period: `${period_Start} to ${period_End}`,
            netPay: calculated_Net,
            attachments: [{
              filename: `Payslip_${emp.user_LastName}_${period_Start}.pdf`,
              content: pdfBuffer
            }]
          });
        }).catch(err => console.error(`[BATCH EMAIL/PDF FAILED] user ${emp.user_Id}:`, err.message));
      }

      processedCount++;
    }

    // 7. Update the PayrollPeriod status to 'Released'
    if (periodId) {
      await sequelize.query(
        `UPDATE "PayrollPeriod" SET "status" = 'Released', "updatedAt" = :now WHERE "periodId" = :periodId`,
        { replacements: { periodId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }

    res.status(201).json({ 
      message: "Batch payroll generated successfully.",
      processed: processedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error("[ERROR] generateBatchPayroll:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Get Eligible Employees Count ─────────────────────────────────────────────
exports.getEligibleEmployeesCount = async (req, res) => {
  const { period_Start, period_End } = req.query;

  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const result = await sequelize.query(
      `SELECT COUNT("user_Id") AS "count" FROM "User" 
       WHERE "deletedAt" IS NULL AND "dailyRate" > 0
       AND "user_Id" NOT IN (
         SELECT "user_Id" FROM "Payroll" 
         WHERE "period_Start" = :period_Start AND "period_End" = :period_End
       )`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );
    res.status(200).json({ count: parseInt(result[0].count) || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Payroll Periods Summary ─────────────────────────────────────────────
exports.getPayrollPeriods = async (req, res) => {
  try {
    const periods = await sequelize.query(
      `SELECT 
        "period_Start", 
        "period_End",
        COUNT("user_Id") AS "employeeCount",
        SUM("netPay") AS "totalAmount",
        MAX("createdAt") AS "processedDate",
        CASE 
          WHEN MIN("status") = 1 THEN 'Draft'
          ELSE 'Released'
        END AS "status"
       FROM "Payroll"
       GROUP BY "period_Start", "period_End"
       ORDER BY "period_Start" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(periods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View Payroll by User ──────────────────────────────────────────────────────
exports.getPayrollByUser = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const payrolls = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt",
         d."absence_Hrs", d."absence_Amnt",
         d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         u."user_FirstName", u."user_LastName",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE p."user_Id" = :user_Id
       ORDER BY p."period_Start" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );
    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View All Payrolls ─────────────────────────────────────────────────────────
exports.getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await sequelize.query(
      `SELECT
         p.*,
         u."user_FirstName", u."user_LastName", u."user_MachipId",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       ORDER BY p."createdAt" DESC`,
      { type: QueryTypes.SELECT },
    );
    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Release Payroll ───────────────────────────────────────────────────────────
exports.releasePayroll = async (req, res) => {
  const { payrollId } = req.params;
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Fetch payroll details and user email before releasing
    const payrollInfo = await sequelize.query(
      `SELECT 
         p.*, 
         u."user_Email", u."user_FirstName", u."user_LastName",
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", e."nightDiff_Hrs", e."nightDiff_Amnt",
         e."specialHol_Hrs", e."specialHol_Amnt", e."incentives", e."allowance", e."Bonus", e."Other_Earnings",
         d."absence_Hrs", d."absence_Amnt", d."tardiness_Mins", d."tardiness_Amnt", d."unpaidLeave_Days", 
         d."unpaidLeave_Amnt", d."paidLeave_Days", d."SSS_Ded", d."Philhealth_Ded", d."HDMF_Ded", d."Tax_Ded",
         d."SSS_Loan", d."HDMF_Loan", d."Other_Deductions"
       FROM "Payroll" p
       JOIN "User" u ON p."user_Id" = u."user_Id"
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       WHERE p."payrollId" = :payrollId LIMIT 1`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );

    await sequelize.query(
      `UPDATE "Payroll" SET "status" = 2, "updatedAt" = :now WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId, now: nowStr }, type: QueryTypes.UPDATE },
    );

    if (payrollInfo.length > 0 && payrollInfo[0].user_Email) {
      const p = payrollInfo[0];
      
      generatePayslipPDF(p).then(pdfBuffer => {
        return sendPayrollEmail({
          email: p.user_Email,
          name: `${p.user_FirstName} ${p.user_LastName}`,
          period: `${p.period_Start} to ${p.period_End}`,
          netPay: p.netPay,
          attachments: [{
            filename: `Payslip_${p.user_LastName}_${p.payrollId}.pdf`,
            content: pdfBuffer
          }]
        });
      }).catch(err => console.error(`[RELEASE EMAIL/PDF FAILED] payroll ${payrollId}:`, err.message));
    }

    res.status(200).json({ message: "Payroll released successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View Payroll by ID ────────────────────────────────────────────────────────
exports.getPayrollById = async (req, res) => {
  const { payrollId } = req.params;
  
  // Safety check for non-numeric IDs (like 'preview-X')
  if (isNaN(parseInt(payrollId))) {
    return res.status(400).json({ error: "Invalid payroll ID format." });
  }

  try {
    const payroll = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt",
         d."absence_Hrs", d."absence_Amnt",
         d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         u."user_FirstName", u."user_LastName",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE p."payrollId" = :payrollId
       LIMIT 1`,
      { replacements: { payrollId }, type: QueryTypes.SELECT },
    );
    if (payroll.length === 0) return res.status(404).json({ error: "Payroll not found" });
    res.status(200).json(payroll[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Update Payroll ────────────────────────────────────────────────────────────
exports.updatePayroll = async (req, res) => {
  const { payrollId } = req.params;
  const { 
    dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked,
    basicPay, totalEarnings, totalDeductions, netPay, status,
    OT_Hrs, OT_Amnt, absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt, paidLeave_Days,
    absence_Days // Add this if needed
  } = req.body;

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    await sequelize.query(
      `UPDATE "Payroll"
       SET "dailyRate" = :dailyRate, "ratePerHr" = :ratePerHr, "NoDays_Worked" = :NoDays_Worked,
           "NoHrs_Worked" = :NoHrs_Worked, "basicPay" = :basicPay, "totalEarnings" = :totalEarnings,
           "totalDeductions" = :totalDeductions, "netPay" = :netPay, "status" = :status, "updatedAt" = :now
       WHERE "payrollId" = :payrollId`,
      {
        replacements: { payrollId, dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDeductions, netPay, status, now: nowStr },
        type: QueryTypes.UPDATE
      }
    );

    await sequelize.query(
      `UPDATE "Payroll_Earnings" SET "OT_Hrs" = :OT_Hrs, "OT_Amnt" = :OT_Amnt WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId, OT_Hrs, OT_Amnt }, type: QueryTypes.UPDATE }
    );

    await sequelize.query(
      `UPDATE "Payroll_Deductions"
       SET "absence_Amnt" = :absence_Amnt, "tardiness_Amnt" = :tardiness_Amnt, "unpaidLeave_Amnt" = :unpaidLeave_Amnt, "paidLeave_Days" = :paidLeave_Days,
           "absence_Hrs" = :absence_Hrs
       WHERE "payrollId" = :payrollId`,
      { replacements: { 
          payrollId, 
          absence_Amnt, 
          tardiness_Amnt, 
          unpaidLeave_Amnt, 
          paidLeave_Days,
          absence_Hrs: (parseFloat(absence_Days) || 0) * 8
        }, type: QueryTypes.UPDATE }
    );

    res.status(200).json({ message: "Payroll updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Payroll Report ────────────────────────────────────────────────────────
exports.getPayrollReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    let query = `
      SELECT
        p.*,
        u."user_FirstName", u."user_LastName", u."user_MachipId",
        ps."PaystatusName" AS "statusName"
      FROM "Payroll" p
      LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
      LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
      WHERE p."period_Start" >= :startDate AND p."period_End" <= :endDate
    `;

    const replacements = { startDate, endDate };
    if (user_Id && user_Id !== "All Employees") {
      query += ` AND p."user_Id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    query += ` ORDER BY p."period_Start" DESC, u."user_LastName" ASC`;

    const payrolls = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

