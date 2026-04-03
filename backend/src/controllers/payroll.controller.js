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
  const now = await getSystemTime();
  const yearNow = now.getFullYear();
  const monthNow = String(now.getMonth() + 1).padStart(2, "0");
  const dayNow = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yearNow}-${monthNow}-${dayNow}`;

  // 1. Get all dates in period
  const allDaysResult = await sequelize.query(
    `SELECT generate_series(
       :period_Start::date,
       :period_End::date,
       '1 day'::interval
     )::date::text AS work_date`,
    { replacements: { period_Start, period_End }, type: QueryTypes.SELECT },
  );
  const allDays = allDaysResult.map(d => d.work_date);

  // Define totalScheduledDays (exclude Sundays)
  const totalScheduledDays = allDays.filter(dateStr => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return dateObj.getUTCDay() !== 0; // 0 = Sunday
  }).length;

  // 2. Get holidays in period
  const holidays = await sequelize.query(
    `SELECT *, "date"::text FROM "Holiday" WHERE "date" BETWEEN :period_Start AND :period_End`,
    { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
  );
  const holidayMap = {};
  holidays.forEach(h => { 
    const dStr = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
    holidayMap[dStr] = h; 
  });

  // 3. Get attendance logs
  const logs = await sequelize.query(
    `SELECT
       DATE("log_Date")::text AS log_date,
       MIN(CASE WHEN "logged_StatusId" = 1 THEN "time_Logged" END) AS first_in,
       MAX(CASE WHEN "logged_StatusId" IN (2, 6) THEN "time_Logged" END) AS last_out,
       MAX("attendance_StatusId") AS att_status
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

  // 4. Get approved leaves
  const approvedLeaveDaysMap = new Map(); 
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

  // 5. Get On-Field Work
  const onfieldDays = await sequelize.query(
    `SELECT ow."DateonField"::text FROM "Onfield_Work" ow
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
  let legalHol_Days = 0;     // Regular Holiday Worked
  let specialHol_Days = 0;   // Special Holiday Worked
  let legalHol_NotWorked = 0; // Regular Holiday Not Worked (Paid 100%)
  let specialHol_NotWorked = 0; // Special Holiday Not Worked (Unpaid)
  let actual_Worked_Days = 0; // Days with logs or on-field
  let actual_Worked_Hrs = 0;

  for (let i = 0; i < allDays.length; i++) {
    const dateStr = allDays[i];
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    const holiday = holidayMap[dateStr];
    const log = logMap[dateStr];
    const isOnField = onfieldMap.has(dateStr);
    
    // A day is "worked" only if there's a log that isn't an "Absent" status (3), or it's On-Field
    const isAbsentStatus = log && log.att_status === 3;
    const worked = (!!log && !isAbsentStatus) || isOnField;
    const isLeave = approvedLeaveDaysMap.has(dateStr);

    // Skip future days unless they have an approved leave
    if (isFuture && !isLeave) continue;

    // ── Handle Worked Days (Normal or Holiday) ──────────────────────────
    if (worked) {
      actual_Worked_Days++;
      let dailyTardiness = 0;
      if (log && log.first_in) {
        const [gh, gm] = GRACE_END.split(":").map(Number);
        const [lh, lm] = log.first_in.split(":").map(Number);
        const graceMinutes = gh * 60 + gm;
        const loginMinutes = lh * 60 + lm;
        if (loginMinutes > graceMinutes) {
          dailyTardiness = loginMinutes - graceMinutes;
          tardiness_Mins += dailyTardiness;
        }
      }
      actual_Worked_Hrs += (WORK_HRS_PER_DAY - (dailyTardiness / 60));

      if (holiday) {
        if (holiday.type === "Regular Holiday") legalHol_Days++;
        else specialHol_Days++;
      }
      continue; // Move to next day
    }

    // ── Handle Holidays Not Worked ──────────────────────────────────────
    if (holiday) {
      if (!isFuture) {
        if (holiday.type === "Regular Holiday") {
          // Rule #2: Absent on Regular Holiday = No Deduction + Count as Worked Day
          actual_Worked_Days++;
          actual_Worked_Hrs += WORK_HRS_PER_DAY;
          legalHol_NotWorked++;
        } else {
          // Rule #3: Absent on Special Holiday = Deduction
          specialHol_NotWorked++;
        }
      }
      continue;
    }

    // ── Handle Non-Holiday Scheduled Days ────────────────────────────────
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const isSunday = dateObj.getUTCDay() === 0;
    if (isSunday) continue;

    if (isLeave) {
      if (approvedLeaveDaysMap.get(dateStr)) paidLeave_Days++;
      else unpaidLeave_Days++;
      continue;
    }

    // Rule #1: Absence logic for normal days (not worked, not holiday, not leave)
    const isAfterCutoff = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 30);
    if (!isFuture && (!isToday || isAfterCutoff)) {
      absence_Days++;
    }
  }

  // 6. Get approved OT and verify presence
  // ... (keeping OT logic)
  const overtimeRequests = await sequelize.query(
    `SELECT ot.* FROM "Overtime_Request" ot
     JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
     WHERE ot."user_Id" = :user_Id
     AND ot."OT_DateOf" BETWEEN :period_Start AND :period_End
     AND er."emp_reqStatusId" = 2`,
    { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT },
  );

  let verified_OT_Hrs = 0;
  for (const req of overtimeRequests) {
    const dateStr = typeof req.OT_DateOf === 'string' ? req.OT_DateOf : req.OT_DateOf.toISOString().split('T')[0];
    
    // Find any log that proves they were working after the OT start time
    const presenceLog = await sequelize.query(
      `SELECT "time_Logged" FROM "user_logging"
       WHERE "user_id" = :user_Id AND "log_Date" = :dateStr
       AND "logged_StatusId" IN (2, 6)
       AND "time_Logged" > :otStart
       ORDER BY "time_Logged" DESC
       LIMIT 1`,
      { 
        replacements: { 
          user_Id, 
          dateStr, 
          otStart: req.HrFrom 
        }, 
        type: QueryTypes.SELECT 
      }
    );

    if (presenceLog.length > 0) {
      verified_OT_Hrs += parseFloat(req.Total_Hrs);
    }
  }

  return {
    NoDays_Worked: actual_Worked_Days,
    NoHrs_Worked: Math.round(actual_Worked_Hrs * 100) / 100,
    totalScheduledDays,
    absence_Days,
    paidLeave_Days,
    unpaidLeave_Days,
    tardiness_Mins,
    legalHol_Days,
    specialHol_Days,
    legalHol_NotWorked,
    specialHol_NotWorked,
    holidaysTotal: holidays.length,
    OT_Hrs: verified_OT_Hrs,
    workedHolidays: { regular: legalHol_Days, special: specialHol_Days },
  };
}

// ── Internal Helper: Calculate Full Payroll Stats ─────────────────────────────
async function calculatePayrollStats(user_Id, period_Start, period_End, customDailyRate = null) {
  const stats = await computePeriodStats(user_Id, period_Start, period_End);
  
  // Get user's current daily rate if not provided
  let dailyRate = customDailyRate;
  if (dailyRate === null) {
    const user = await sequelize.query(
      `SELECT "dailyRate" FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    dailyRate = user[0]?.dailyRate || 0;
  }

  const ratePerHr = dailyRate / WORK_HRS_PER_DAY;
  const ratePerMin = ratePerHr / 60;

  // 1. Basic Pay (Top-down: Full scheduled period)
  const basicPay = stats.totalScheduledDays * dailyRate;

  // 2. Holiday Premiums (Extra pay)
  const legalHol_Amnt = (stats.legalHol_Days * dailyRate);
  const specialHol_Amnt = (stats.specialHol_Days * dailyRate * 0.3);

  // 3. Other Earnings
  const OT_Amnt = stats.OT_Hrs * ratePerHr;
  
  // 4. Deductions
  const absence_Amnt = stats.absence_Days * dailyRate;
  const tardiness_Amnt = stats.tardiness_Mins * ratePerMin;
  const unpaidLeave_Amnt = stats.unpaidLeave_Days * dailyRate;
  const specialHol_Ded = stats.specialHol_NotWorked * dailyRate;

  const totalEarnings = basicPay + legalHol_Amnt + specialHol_Amnt + OT_Amnt;
  const totalDeductions = absence_Amnt + tardiness_Amnt + unpaidLeave_Amnt + specialHol_Ded;
  const netPay = totalEarnings - totalDeductions;

  return {
    ...stats,
    dailyRate,
    ratePerHr,
    basicPay,
    legalHol_Amnt,
    specialHol_Amnt,
    OT_Amnt,
    absence_Amnt,
    tardiness_Amnt,
    unpaidLeave_Amnt,
    totalEarnings,
    totalDeductions,
    netPay
  };
}

// ── Get Payroll Preview ───────────────────────────────────────────────────────
exports.getPayrollPreview = async (req, res) => {
  const { user_Id, period_Start, period_End } = req.query;
  if (!user_Id || !period_Start || !period_End) {
    return res.status(400).json({ error: "user_Id, period_Start, and period_End are required." });
  }

  try {
    const fullStats = await calculatePayrollStats(user_Id, period_Start, period_End);
    res.status(200).json(fullStats);
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
    absence_Days, paidLeave_Days, unpaidLeave_Days, tardiness_Mins,
    legalHol_Amnt, specialHol_Amnt
  } = req.body;

  if (!user_Id || !period_Start || !period_End || !ratePerHr) {
    return res.status(400).json({ error: "user_Id, period_Start, period_End, ratePerHr are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const periodRow = await sequelize.query(
        `SELECT "periodId" FROM "PayrollPeriod" 
         WHERE "startDate" = :period_Start AND "endDate" = :period_End LIMIT 1`,
        { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
      );
    const periodId = periodRow.length > 0 ? periodRow[0].periodId : null;

    let finalStats = { 
        NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDeductions, netPay,
        OT_Hrs, OT_Amnt, absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt,
        absence_Days, paidLeave_Days, unpaidLeave_Days, tardiness_Mins,
        legalHol_Amnt, specialHol_Amnt
    };

    if (NoDays_Worked === undefined) {
        finalStats = await calculatePayrollStats(user_Id, period_Start, period_End, dailyRate);
    }

    const payrollResult = await sequelize.query(
      `INSERT INTO "Payroll"
        ("user_Id", "periodId", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
         "dailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
         "holidaysTotal", "holidaysRegularWorked", "holidaysSpecialWorked",
         "status", "createdAt", "updatedAt")
       VALUES
        (:user_Id, :periodId, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
         :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDeductions, :netPay,
         :holidaysTotal, :holidaysRegularWorked, :holidaysSpecialWorked,
         1, :now, :now)
       RETURNING *`,
      {
        replacements: {
          user_Id, periodId, period_Start, period_End, 
          NoDays_Worked: finalStats.NoDays_Worked, NoHrs_Worked: finalStats.NoHrs_Worked,
          dailyRate: dailyRate || 0, ratePerHr,
          basicPay: finalStats.basicPay, totalEarnings: finalStats.totalEarnings, 
          totalDeductions: finalStats.totalDeductions, netPay: finalStats.netPay,
          holidaysTotal: finalStats.holidaysTotal || 0,
          holidaysRegularWorked: finalStats.holidaysRegularWorked || 0,
          holidaysSpecialWorked: finalStats.holidaysSpecialWorked || 0,
          now: nowStr
        },
        type: QueryTypes.INSERT,
      },
    );

    const payrollId = payrollResult[0][0]?.payrollId || payrollResult[0].payrollId || payrollResult[0][0];

    await sequelize.query(
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "legalHol_Amnt", "specialHol_Amnt")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :legalHol_Amnt, :specialHol_Amnt)`,
      { replacements: { 
          payrollId, user_Id, 
          OT_Hrs: finalStats.OT_Hrs, OT_Amnt: finalStats.OT_Amnt,
          legalHol_Amnt: finalStats.legalHol_Amnt, specialHol_Amnt: finalStats.specialHol_Amnt 
        }, type: QueryTypes.INSERT }
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
          unpaidLeave_Amnt: finalStats.unpaidLeave_Amnt,
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
  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const periodRow = await sequelize.query(
      `SELECT "periodId" FROM "PayrollPeriod" 
       WHERE "startDate" = :period_Start AND "endDate" = :period_End LIMIT 1`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );
    const periodId = periodRow.length > 0 ? periodRow[0].periodId : null;

    const employees = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email", "dailyRate" FROM "User" 
        WHERE "deletedAt" IS NULL AND "dailyRate" > 0`, 
      { type: QueryTypes.SELECT }
    );

    let processedCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      const existing = await sequelize.query(
        `SELECT "payrollId" FROM "Payroll" 
         WHERE "user_Id" = :user_Id 
         AND (("period_Start" = :period_Start AND "period_End" = :period_End) OR ("periodId" = :periodId))`,
        { replacements: { user_Id: emp.user_Id, period_Start, period_End, periodId: periodId || -1 }, type: QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      const fullStats = await calculatePayrollStats(emp.user_Id, period_Start, period_End, emp.dailyRate);

      const payrollResult = await sequelize.query(
        `INSERT INTO "Payroll"
          ("user_Id", "periodId", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
           "dailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
           "holidaysTotal", "holidaysRegularWorked", "holidaysSpecialWorked",
           "status", "createdAt", "updatedAt")
         VALUES
          (:user_Id, :periodId, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
           :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDeductions, :netPay,
           :holidaysTotal, :holidaysRegularWorked, :holidaysSpecialWorked,
           2, :now, :now)
         RETURNING "payrollId"`,
        {
          replacements: {
            user_Id: emp.user_Id, periodId, period_Start, period_End,
            NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
            dailyRate: fullStats.dailyRate, ratePerHr: fullStats.ratePerHr,
            basicPay: fullStats.basicPay, totalEarnings: fullStats.totalEarnings, 
            totalDeductions: fullStats.totalDeductions, netPay: fullStats.netPay,
            holidaysTotal: fullStats.holidaysTotal || 0,
            holidaysRegularWorked: fullStats.legalHol_Days || 0,
            holidaysSpecialWorked: fullStats.specialHol_Days || 0,
            now: nowStr
          },
          type: QueryTypes.INSERT
        }
      );

      let payrollId = payrollResult[0][0]?.payrollId || payrollResult[0].payrollId || payrollResult[0][0];

      await sequelize.query(
        `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "legalHol_Amnt", "specialHol_Amnt")
         VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :legalHol_Amnt, :specialHol_Amnt)`,
        { replacements: { 
            payrollId, user_Id: emp.user_Id, 
            OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt, 
            legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt 
          }, type: QueryTypes.INSERT }
      );

      await sequelize.query(
        `INSERT INTO "Payroll_Deductions"
          ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days")
         VALUES
          (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days)`,
        {
          replacements: {
            payrollId,
            absence_Hrs: fullStats.absence_Days * WORK_HRS_PER_DAY,
            absence_Amnt: fullStats.absence_Amnt,
            tardiness_Mins: fullStats.tardiness_Mins,
            tardiness_Amnt: fullStats.tardiness_Amnt,
            unpaidLeave_Days: fullStats.unpaidLeave_Days,
            unpaidLeave_Amnt: fullStats.unpaidLeave_Amnt,
            paidLeave_Days: fullStats.paidLeave_Days
          },
          type: QueryTypes.INSERT
        }
      );

      // Send Email after generation
      if (emp.user_Email) {
        const emailData = {
          ...fullStats,
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          payrollId,
          period_Start,
          period_End
        };
        
        generatePayslipPDF(emailData).then(pdfBuffer => {
          return sendPayrollEmail({
            email: emp.user_Email,
            name: `${emp.user_FirstName} ${emp.user_LastName}`,
            period: `${period_Start} to ${period_End}`,
            netPay: fullStats.netPay,
            attachments: [{
              filename: `Payslip_${emp.user_LastName}_${payrollId}.pdf`,
              content: pdfBuffer
            }]
          });
        }).catch(err => console.error(`[BATCH EMAIL FAILED] user ${emp.user_Id}:`, err.message));
      }

      processedCount++;
    }

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
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", 
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."incentives", e."allowance",
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
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", 
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."incentives", e."allowance",
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