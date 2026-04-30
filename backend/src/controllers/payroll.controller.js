const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { sendPayrollEmail } = require("../utils/emailService");
const { generatePayslipPDF, generateDtrPDF } = require("../utils/pdfGenerator");
const { generateDTRPDF } = require("../utils/dtrGenerator");
const { getAttendanceReportInternal } = require("./attendance.controller");
const { logAudit, logTransaction } = require("../utils/logger");


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

  // 3. Get attendance logs from the reporting table (which stores AM/PM breakdown)
  const logs = await sequelize.query(
    `SELECT
       "log_Date"::text AS log_date,
       "time_Logged_inArr",
       "time_Logged_outArr",
       "attendance_StatusId" as att_status
     FROM "employee_Logging_report"
     WHERE "user_id" = :user_Id
     AND "log_Date" BETWEEN :period_Start AND :period_End`,
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
    
    const isAbsentStatus = log && log.att_status === 3;
    const worked = (!!log && !isAbsentStatus) || isOnField;
    const isLeave = approvedLeaveDaysMap.has(dateStr);

    // ── Handle Worked Days (Normal or Holiday) ──────────────────────────
    if (worked) {
      actual_Worked_Days++;
      let dailyHrs = 0;

      if (isOnField) {
        dailyHrs = 8.0;
      } else if (log) {
        const inArr = JSON.parse(log.time_Logged_inArr || "[]");
        
        // Time-based slotting (same as report logic)
        const SLOT_MIDPOINT = "12:30";
        const morningIn = inArr.find(t => t.substring(0, 5) < SLOT_MIDPOINT);
        const afternoonIn = inArr.find(t => t.substring(0, 5) >= "12:00" && t.substring(0, 5) < "17:30");

        // Morning Session (Fixed 4.0 - tardiness)
        if (morningIn && morningIn !== "—") {
          dailyHrs += 4.0;
          const [lh, lm] = morningIn.split(":").map(Number);
          const loginMinutes = lh * 60 + lm;
          const graceMinutes = 8 * 60 + 35; // 8:35 AM

          if (loginMinutes > graceMinutes) {
            const minsLate = Math.max(0, loginMinutes - graceMinutes);
            tardiness_Mins += minsLate;
            dailyHrs = Math.max(0, dailyHrs - (minsLate / 60));
          }
        }

        // Afternoon Session (Fixed 4.0)
        if (afternoonIn && afternoonIn !== "—") {
          dailyHrs += 4.0;
        }
      }
      
      actual_Worked_Hrs += dailyHrs;

      if (holiday) {
        if (holiday.type === "Regular Holiday") legalHol_Days++;
        else specialHol_Days++;
      }
      continue; 
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
       WHERE "user_id" = :user_Id AND "log_Date"::date = :dateStr::date
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
  
  // Get user's current daily rate and gov't shares if not provided
  let dailyRate = customDailyRate;
  let sss_Share = 0, philhealth_Share = 0, hdmf_Share = 0, tax_Share = 0;
  let hCard = 0, sLoan = 0, hLoan = 0, cLoan = 0, advAmnt = 0, gDed = 0, mpSave = 0;
  
  const user = await sequelize.query(
    `SELECT "dailyRate", "sss_Share", "philhealth_Share", "hdmf_Share", "tax_Share",
            "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", 
            "advances_Amnt", "globe_Deduction", "multiPurposeSavings"
     FROM "User" WHERE "user_Id" = :user_Id`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );

  if (dailyRate === null) dailyRate = user[0]?.dailyRate || 0;
  sss_Share = user[0]?.sss_Share || 0;
  philhealth_Share = user[0]?.philhealth_Share || 0;
  hdmf_Share = user[0]?.hdmf_Share || 0;
  tax_Share = user[0]?.tax_Share || 0;
  
  hCard = user[0]?.healthCard_Amnt || 0;
  sLoan = user[0]?.SSS_Loan || 0;
  hLoan = user[0]?.HDMF_Loan || 0;
  cLoan = user[0]?.calamityLoan_Amnt || 0;
  advAmnt = user[0]?.advances_Amnt || 0;
  gDed = user[0]?.globe_Deduction || 0;
  mpSave = user[0]?.multiPurposeSavings || 0;

  const ratePerHr = dailyRate / WORK_HRS_PER_DAY;
  const ratePerMin = ratePerHr / 60;

  // 1. Basic Pay
  const basicPay = stats.totalScheduledDays * dailyRate;

  // 2. Holiday Premiums
  const legalHol_Amnt = (stats.legalHol_Days * dailyRate);
  const specialHol_Amnt = (stats.specialHol_Days * dailyRate * 0.25);

  // 3. OT
  const OT_Amnt = stats.OT_Hrs * ratePerHr * 1.25;
  
  // 4. Attendance Deductions
  const absence_Amnt = stats.absence_Days * dailyRate;
  const tardiness_Amnt = stats.tardiness_Mins * ratePerMin;
  const unpaidLeave_Amnt = stats.unpaidLeave_Days * dailyRate;
  const specialHol_Ded = stats.specialHol_NotWorked * dailyRate;

  // 5. Government Deductions (Standard Shares)
  const govtTotal = parseFloat(sss_Share) + parseFloat(philhealth_Share) + parseFloat(hdmf_Share);
  
  // 6. Other Deductions
  const otherTotal = parseFloat(hCard) + parseFloat(sLoan) + parseFloat(hLoan) + parseFloat(cLoan) + parseFloat(advAmnt) + parseFloat(gDed) + parseFloat(mpSave);

  const totalEarnings = basicPay + legalHol_Amnt + specialHol_Amnt + OT_Amnt;
  // Tax is now pulled from user template
  const Tax_Ded = parseFloat(tax_Share) || 0; 

  const totalDeductions = absence_Amnt + tardiness_Amnt + unpaidLeave_Amnt + specialHol_Ded + govtTotal + otherTotal + Tax_Ded;
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
    SSS_Ded: sss_Share,
    Philhealth_Ded: philhealth_Share,
    HDMF_Ded: hdmf_Share,
    healthCard_Amnt: hCard,
    SSS_Loan: sLoan,
    HDMF_Loan: hLoan,
    calamityLoan_Amnt: cLoan,
    advances_Amnt: advAmnt,
    globe_Deduction: gDed,
    multiPurposeSavings: mpSave,
    Tax_Ded,
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
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email", "dailyRate", 
              "sss_Share", "philhealth_Share", "hdmf_Share" 
       FROM "User" 
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
           :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDed, :netPay,
           :holidaysTotal, :holidaysRegularWorked, :holidaysSpecialWorked,
           2, :now, :now)
         RETURNING "payrollId"`,
        {
          replacements: {
            user_Id: emp.user_Id, periodId, period_Start, period_End,
            NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
            dailyRate: fullStats.dailyRate, ratePerHr: fullStats.ratePerHr,
            basicPay: fullStats.basicPay, totalEarnings: fullStats.totalEarnings, 
            totalDed: fullStats.totalDeductions, netPay: fullStats.netPay,
            holidaysTotal: fullStats.holidaysTotal || 0,
            holidaysRegularWorked: fullStats.legalHol_Days || 0,
            holidaysSpecialWorked: fullStats.specialHol_Days || 0,
            now: nowStr
          },
          type: QueryTypes.INSERT
        }
      );

      const payrollId = payrollResult[0][0].payrollId;

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
          ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", 
           "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days",
           "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "Tax_Ded",
           "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", 
           "multiPurposeSavings", "advances_Amnt", "globe_Deduction")
         VALUES
          (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, 
           :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days,
           :sss, :ph, :hd, :tax,
           :hc, :sl, :hl, :cl, :ms, :aa, :gd)`,
        {
          replacements: {
            payrollId,
            absence_Hrs: (fullStats.absence_Days) * 8,
            absence_Amnt: fullStats.absence_Amnt,
            tardiness_Mins: fullStats.tardiness_Mins,
            tardiness_Amnt: fullStats.tardiness_Amnt,
            unpaidLeave_Days: fullStats.unpaidLeave_Days,
            unpaidLeave_Amnt: fullStats.unpaidLeave_Amnt,
            paidLeave_Days: fullStats.paidLeave_Days,
            sss: fullStats.SSS_Ded,
            ph: fullStats.Philhealth_Ded,
            hd: fullStats.HDMF_Ded,
            tax: fullStats.Tax_Ded,
            hc: fullStats.healthCard_Amnt,
            sl: fullStats.SSS_Loan,
            hl: fullStats.HDMF_Loan,
            cl: fullStats.calamityLoan_Amnt,
            ms: fullStats.multiPurposeSavings,
            aa: fullStats.advances_Amnt,
            gd: fullStats.globe_Deduction
          },
          type: QueryTypes.INSERT,
        }
      );
      processedCount++;
    }

    if (periodId) {
      await sequelize.query(
        `UPDATE "PayrollPeriod" SET "status" = 'Released', "updatedAt" = :now WHERE "periodId" = :periodId`,
        { replacements: { periodId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "BATCH_PAYROLL_GEN", `Generated batch payroll for period ${period_Start} to ${period_End}`, { processedCount, periodId }, req);

    res.status(201).json({ message: "Batch payroll generated successfully.", processed: processedCount, skipped: skippedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Generate Single Payroll ──────────────────────────────────────────────────
exports.generatePayroll = async (req, res) => {
  const { user_Id, period_Start, period_End } = req.body;
  if (!user_Id || !period_Start || !period_End) {
    return res.status(400).json({ error: "user_Id, period_Start, and period_End are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // 1. Check if payroll already exists
    const existing = await sequelize.query(
      `SELECT "payrollId" FROM "Payroll" 
       WHERE "user_Id" = :user_Id AND "period_Start" = :period_Start AND "period_End" = :period_End LIMIT 1`,
      { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT }
    );
    if (existing.length > 0) return res.status(400).json({ error: "Payroll already exists for this period." });

    // 2. Calculate stats
    const fullStats = await calculatePayrollStats(user_Id, period_Start, period_End);

    // 3. Insert into Payroll
    const payrollResult = await sequelize.query(
      `INSERT INTO "Payroll"
        ("user_Id", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked",
         "dailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
         "status", "createdAt", "updatedAt")
       VALUES
        (:user_Id, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked,
         :dailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDed, :netPay,
         2, :now, :now)
       RETURNING "payrollId"`,
      {
        replacements: {
          user_Id, period_Start, period_End,
          NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
          dailyRate: fullStats.dailyRate, ratePerHr: fullStats.ratePerHr,
          basicPay: fullStats.basicPay, totalEarnings: fullStats.totalEarnings, 
          totalDed: fullStats.totalDeductions, netPay: fullStats.netPay,
          now: nowStr
        },
        type: QueryTypes.INSERT
      }
    );

    const payrollId = payrollResult[0][0].payrollId;

    // 4. Insert Earnings and Deductions
    await sequelize.query(
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "legalHol_Amnt", "specialHol_Amnt")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :legalHol_Amnt, :specialHol_Amnt)`,
      { replacements: { 
          payrollId, user_Id, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt 
        }, type: QueryTypes.INSERT }
    );

    await sequelize.query(
      `INSERT INTO "Payroll_Deductions"
        ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", 
         "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days",
         "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "Tax_Ded",
         "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", 
         "multiPurposeSavings", "advances_Amnt", "globe_Deduction")
       VALUES
        (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, 
         :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days,
         :sss, :ph, :hd, :tax,
         :hc, :sl, :hl, :cl, :ms, :aa, :gd)`,
      {
        replacements: {
          payrollId,
          absence_Hrs: (fullStats.absence_Days) * 8,
          absence_Amnt: fullStats.absence_Amnt,
          tardiness_Mins: fullStats.tardiness_Mins,
          tardiness_Amnt: fullStats.tardiness_Amnt,
          unpaidLeave_Days: fullStats.unpaidLeave_Days,
          unpaidLeave_Amnt: fullStats.unpaidLeave_Amnt,
          paidLeave_Days: fullStats.paidLeave_Days,
          sss: fullStats.SSS_Ded,
          ph: fullStats.Philhealth_Ded,
          hd: fullStats.HDMF_Ded,
          tax: fullStats.Tax_Ded,
          hc: fullStats.healthCard_Amnt,
          sl: fullStats.SSS_Loan,
          hl: fullStats.HDMF_Loan,
          cl: fullStats.calamityLoan_Amnt,
          ms: fullStats.multiPurposeSavings,
          aa: fullStats.advances_Amnt,
          gd: fullStats.globe_Deduction
        },
        type: QueryTypes.INSERT,
      }
    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "PAYROLL_GEN", `Generated payroll for user ${user_Id} for period ${period_Start} to ${period_End}`, { payrollId }, req);

    res.status(201).json({ message: "Payroll generated successfully.", payrollId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Eligible Employees Count ──────────────────────────────────────────────
exports.getEligibleEmployeesCount = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT COUNT(*) as count FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0`, 
      { type: QueryTypes.SELECT }
    );
    res.status(200).json({ count: parseInt(result[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get All Payrolls ──────────────────────────────────────────────────────────
exports.getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await sequelize.query(
      `SELECT p.*, u."user_FirstName", u."user_LastName", ps."PaystatusName" 
       FROM "Payroll" p 
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id" 
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       ORDER BY p."period_Start" DESC, u."user_LastName" ASC`, 
      { type: QueryTypes.SELECT }
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

    const [updated] = await sequelize.query(
      `UPDATE "Payroll" SET "status" = 3, "updatedAt" = :now WHERE "payrollId" = :payrollId`, 
      { replacements: { payrollId, now: nowStr }, type: QueryTypes.UPDATE }
    );

    if (updated === 0) return res.status(404).json({ error: "Payroll not found." });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "PAYROLL_RELEASE", `Released payroll ID ${payrollId}`, { payrollId }, req);

    res.status(200).json({ message: "Payroll released successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Update Payroll (Basic) ────────────────────────────────────────────────────
exports.updatePayroll = async (req, res) => {
  const { payrollId } = req.params;
  const { status, netPay, totalEarnings, totalDeductions } = req.body;
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    let query = 'UPDATE "Payroll" SET "updatedAt" = :now';
    const replacements = { payrollId, now: nowStr };

    if (status !== undefined) { query += ', "status" = :status'; replacements.status = status; }
    if (netPay !== undefined) { query += ', "netPay" = :netPay'; replacements.netPay = netPay; }
    if (totalEarnings !== undefined) { query += ', "totalEarnings" = :totalEarnings'; replacements.totalEarnings = totalEarnings; }
    if (totalDeductions !== undefined) { query += ', "totalDeductions" = :totalDeductions'; replacements.totalDeductions = totalDeductions; }

    query += ' WHERE "payrollId" = :payrollId';

    const [updated] = await sequelize.query(query, { replacements, type: QueryTypes.UPDATE });
    if (updated === 0) return res.status(404).json({ error: "Payroll not found." });

    res.status(200).json({ message: "Payroll updated successfully." });
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
         d.*,
         (COALESCE(d."healthCard_Amnt",0) + 
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) + 
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0)) AS "Other_Deductions",
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

// ── View Payroll by ID ────────────────────────────────────────────────────────
exports.getPayrollById = async (req, res) => {
  const { payrollId } = req.params;
  if (isNaN(parseInt(payrollId))) return res.status(400).json({ error: "Invalid ID" });

  try {
    const payroll = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", 
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."incentives", e."allowance",
         d.*,
         (COALESCE(d."healthCard_Amnt",0) + 
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) + 
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0)) AS "Other_Deductions",
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
    if (payroll.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(200).json(payroll[0]);
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
        ps."PaystatusName" AS "statusName",
        d.*,
        (COALESCE(d."healthCard_Amnt",0) + 
         COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) + 
         COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0)) AS "Other_Deductions",
        e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", 
        e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
        e."incentives", e."allowance"
      FROM "Payroll" p
      LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
      LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
      LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
      LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
      WHERE p."period_Start" >= :startDate AND p."period_End" <= :endDate
    `;

    const replacements = { startDate, endDate };
    if (user_Id && user_Id !== "All Employees") {
      query += ` AND p."user_Id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    const payrolls = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── ADDITIONS FOR GOVT + OTHER DEDUCTIONS ───────────────────────────────────
const { generatePayrollSummaryPDF } = require("../utils/payrollSummaryGenerator");

// ── Get Government Deductions Preview ────────────────────────────────────────
exports.getGovtDeductionsPreview = async (req, res) => {
  const { grossPay, user_Id } = req.query;
  if (!grossPay || !user_Id) return res.status(400).json({ error: "grossPay and user_Id required." });
  
  try {
    const { computePeriodTax } = require("../utils/govtDeductions");
    const user = await sequelize.query(`SELECT "sss_Share", "philhealth_Share", "hdmf_Share" FROM "User" WHERE "user_Id" = :user_Id`, { replacements: { user_Id }, type: QueryTypes.SELECT });
    if (user.length === 0) return res.status(404).json({ error: "User not found." });

    const shares = user[0];
    
    // Tax is now manual input ("hardcoded") per user request.
    const tax = 0;

    res.status(200).json({ SSS_Ded: shares.sss_Share || 0, Philhealth_Ded: shares.philhealth_Share || 0, HDMF_Ded: shares.hdmf_Share || 0, Tax_Ded: tax });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Download Payroll Summary PDF ──────────────────────────────────────────────
exports.downloadPayrollSummaryPDF = async (req, res) => {
  let { period_Start, period_End, periodId } = req.query;
  try {
    // If periodId is provided, fetch start/end dates first
    if (periodId && (!period_Start || !period_End)) {
      const periodRow = await sequelize.query(
        `SELECT "startDate", "endDate" FROM "PayrollPeriod" WHERE "periodId" = :periodId LIMIT 1`,
        { replacements: { periodId }, type: QueryTypes.SELECT }
      );
      if (periodRow.length > 0) {
        period_Start = periodRow[0].startDate;
        period_End = periodRow[0].endDate;
      }
    }

    if (!period_Start || !period_End) {
      return res.status(400).json({ error: "Missing period parameters." });
    }

    const payrollRows = await sequelize.query(
      `SELECT p.*, u."user_FirstName", u."user_LastName", u."account_Number" AS "accountNo", pe.*, pd.*
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId"
       WHERE p."period_Start" = :period_Start AND p."period_End" = :period_End
       ORDER BY u."user_LastName" ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );
    if (payrollRows.length === 0) return res.status(404).json({ error: "No records found." });

    const start = new Date(period_Start + "T00:00:00");
    const end   = new Date(period_End   + "T00:00:00");
    const month = start.toLocaleString("en-PH", { month: "long" });
    const periodLabel = `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;

    const pdfBuffer = await generatePayrollSummaryPDF(payrollRows, periodLabel);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Summary_${period_Start}_${period_End}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── UPDATE Payroll (extended) ─────────────────
exports.updatePayrollFull = async (req, res) => {
  const { payrollId } = req.params;
  const {
    dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, status,
    OT_Hrs, OT_Amnt, legalHol_Amnt, specialHol_Amnt, incentives, allowance,
    absence_Days, absence_Amnt, tardiness_Mins, tardiness_Amnt, unpaidLeave_Days, unpaidLeave_Amnt, paidLeave_Days,
    SSS_Ded, Philhealth_Ded, HDMF_Ded, Tax_Ded,
    healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt, multiPurposeSavings, advances_Amnt, globe_Deduction,
  } = req.body;

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const oldPayroll = await sequelize.query(`SELECT p.*, pe.*, pd.* FROM "Payroll" p LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId" LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId" WHERE p."payrollId" = :payrollId LIMIT 1`, { replacements: { payrollId }, type: QueryTypes.SELECT });
    if (oldPayroll.length === 0) return res.status(404).json({ error: "Not found." });

    const govtTotal  = (parseFloat(SSS_Ded || 0) + parseFloat(Philhealth_Ded || 0) + parseFloat(HDMF_Ded || 0) + parseFloat(Tax_Ded || 0));
    const otherTotal = (parseFloat(healthCard_Amnt || 0) + parseFloat(SSS_Loan || 0) + parseFloat(HDMF_Loan || 0) + parseFloat(calamityLoan_Amnt || 0) + parseFloat(multiPurposeSavings || 0) + parseFloat(advances_Amnt || 0) + parseFloat(globe_Deduction || 0));
    const attendanceDed = (parseFloat(absence_Amnt || 0) + parseFloat(tardiness_Amnt || 0) + parseFloat(unpaidLeave_Amnt || 0));
    const computedTotalDed = govtTotal + otherTotal + attendanceDed;
    const computedNet = parseFloat(totalEarnings || 0) - computedTotalDed;

    await sequelize.query(`UPDATE "Payroll" SET "dailyRate"=:dailyRate, "ratePerHr"=:ratePerHr, "NoDays_Worked"=:NoDays_Worked, "NoHrs_Worked"=:NoHrs_Worked, "basicPay"=:basicPay, "totalEarnings"=:totalEarnings, "totalDeductions"=:totalDed, "netPay"=:netPay, "status"=:status, "updatedAt"=:now WHERE "payrollId" = :payrollId`, { replacements: { payrollId, dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDed: computedTotalDed, netPay: computedNet, status, now: nowStr }, type: QueryTypes.UPDATE });
    await sequelize.query(`UPDATE "Payroll_Earnings" SET "OT_Hrs"=:OT_Hrs, "OT_Amnt"=:OT_Amnt, "legalHol_Amnt"=:legalHol_Amnt, "specialHol_Amnt"=:specialHol_Amnt, "incentives"=:incentives, "allowance"=:allowance WHERE "payrollId" = :payrollId`, { replacements: { payrollId, OT_Hrs, OT_Amnt, legalHol_Amnt, specialHol_Amnt, incentives, allowance }, type: QueryTypes.UPDATE });
    await sequelize.query(`UPDATE "Payroll_Deductions" SET "absence_Hrs"=:absence_Hrs, "absence_Amnt"=:absence_Amnt, "tardiness_Mins"=:tardiness_Mins, "tardiness_Amnt"=:tardiness_Amnt, "unpaidLeave_Days"=:unpaidLeave_Days, "unpaidLeave_Amnt"=:unpaidLeave_Amnt, "paidLeave_Days"=:paidLeave_Days, "SSS_Ded"=:SSS_Ded, "Philhealth_Ded"=:Philhealth_Ded, "HDMF_Ded"=:HDMF_Ded, "Tax_Ded"=:Tax_Ded, "healthCard_Amnt"=:healthCard_Amnt, "SSS_Loan"=:SSS_Loan, "HDMF_Loan"=:HDMF_Loan, "calamityLoan_Amnt"=:calamityLoan_Amnt, "multiPurposeSavings"=:multiPurposeSavings, "advances_Amnt"=:advances_Amnt, "globe_Deduction"=:globe_Deduction WHERE "payrollId" = :payrollId`, { replacements: { payrollId, absence_Hrs:(parseFloat(absence_Days||0)*8), absence_Amnt, tardiness_Mins, tardiness_Amnt, unpaidLeave_Days, unpaidLeave_Amnt, paidLeave_Days, SSS_Ded, Philhealth_Ded, HDMF_Ded, Tax_Ded, healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt, multiPurposeSavings, advances_Amnt, globe_Deduction }, type: QueryTypes.UPDATE });

    const newPayroll = await sequelize.query(`SELECT p.*, pe.*, pd.* FROM "Payroll" p LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId" LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId" WHERE p."payrollId" = :payrollId LIMIT 1`, { replacements: { payrollId }, type: QueryTypes.SELECT });
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "Payroll", "UPDATE_PAYROLL_FULL", "Payroll", payrollId, oldPayroll[0], newPayroll[0]);
    res.status(200).json({ message: "Updated successfully.", netPay: computedNet, totalDeductions: computedTotalDed });
  } catch (error) { res.status(500).json({ error: error.message }); }
};
