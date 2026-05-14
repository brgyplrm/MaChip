const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { sendPayrollEmail } = require("../utils/emailService");
const { generatePayslipPDF } = require("../utils/pdfGenerator");
const { generatePayslipPassword } = require("../utils/payslipPassword");
const { generateDTRPDF } = require("../utils/dtrGenerator");
const { decrypt } = require("../utils/encryption");
const { saveFileToArchive } = require("../utils/fileStorage");

// ... (rest of imports remains similar)
const { getAttendanceReportInternal } = require("./attendance.controller");
const { logAudit, logTransaction } = require("../utils/logger");
const { computeMonthlyShares, computePeriodTax } = require("../utils/govtDeductions");
const { generatePayrollSummaryPDF } = require("../utils/payrollSummaryGenerator");
const archiver = require("archiver");
archiver.registerFormat("zip-encryptable", require("archiver-zip-encryptable"));

// ── Download Batch ZIP ────────────────────────────────────────────────────────
/**
 * Generates a password-protected ZIP containing password-protected PDFs.
 * Double Protection: ZIP Password + Unique PDF Password per employee.
 */
exports.downloadBatchZip = async (req, res) => {
  const { period_Start, period_End, zipPassword } = req.query;
  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const payrolls = await sequelize.query(
      `SELECT p.*, u."user_FirstName", u."user_LastName", b."account_Number"
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       WHERE p."period_Start" = :period_Start AND p."period_End" = :period_End
       ORDER BY u."user_Id" ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );

    if (payrolls.length === 0) {
      return res.status(404).json({ error: "No payroll records found for this period." });
    }

    // Set headers
    const filename = `Batch_Payslips_${period_Start}_${period_End}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip-encryptable", {
      zlib: { level: 9 },
      forceZip64: false,
      password: zipPassword || null // Protect the ZIP itself if password provided
    });

    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    for (const p of payrolls) {
      const fullStats = { ...p, accountNo: decrypt(p.account_Number) || "—" };
      const pdfPassword = generatePayslipPassword({
        period_Start: p.period_Start,
        period_End: p.period_End,
        user_LastName: p.user_LastName,
        user_Id: p.user_Id
      });

      const pdfBuffer = await generatePayslipPDF(fullStats, pdfPassword);
      const pdfFilename = `Payslip_${p.user_LastName}_${p.user_Id}.pdf`;
      archive.append(pdfBuffer, { name: pdfFilename });
    }

    await archive.finalize();
  } catch (error) {
    console.error("[BATCH ZIP ERROR]:", error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

/** Helper for consistent month folder naming (e.g., "05_May") */
const formatMonthFolder = (date) => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const name = d.toLocaleString('default', { month: 'long' });
  return `${m}_${name}`;
};

/** Helper for short period folder naming (e.g., "01_15" or "16_31") */
const getPeriodFolder = (start, end) => {
  const s = new Date(start).getDate();
  const e = new Date(end).getDate();
  return `${String(s).padStart(2, '0')}_${String(e).padStart(2, '0')}`;
};


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

    // Handle Non-Holiday Scheduled Days
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const isSunday = dateObj.getUTCDay() === 0;
    if (isSunday) continue;

    if (isLeave) {
      if (approvedLeaveDaysMap.get(dateStr)) paidLeave_Days++;
      else unpaidLeave_Days++;
      continue;
    }

    // Rule #1: Absence logic for normal days
    if (!isFuture) {
      // If already explicitly marked as Absent in logs, count it regardless of time
      if (isAbsentStatus) {
        absence_Days++;
      } 
      // If no logs at all, count as absent only if it's a past day OR if today is past the shift cutoff
      else if (!log) {
        const isAfterCutoff = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 30);
        if (!isToday || isAfterCutoff) {
          absence_Days++;
        }
      }
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
async function calculatePayrollStats(user_Id, period_Start, period_End, customDailyRate = null, customAllowance = 0, customIncentives = 0) {
  const stats = await computePeriodStats(user_Id, period_Start, period_End);
  
  // Get user's current daily rate and gov't shares if not provided
  let dailyRate = customDailyRate;
  let sss_Share = 0, philhealth_Share = 0, hdmf_Share = 0, tax_Share = 0;
  let SSS_Ded_ER = 0, Philhealth_Ded_ER = 0, HDMF_Ded_ER = 0;
  let hCard = 0, sLoan = 0, hLoan = 0, cLoan = 0, advAmnt = 0, gDed = 0, mpSave = 0, ewLoan = 0;

  const user = await sequelize.query(
    `SELECT u."dailyRate", u."previousDailyRate",
            d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."tax_Share",
            d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
            d."advances_Amnt", d."globe_Deduction", d."multiPurposeSavings", d."eastwest_Loan"
     FROM "User" u
     LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
     WHERE u."user_Id" = :user_Id`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );

  if (dailyRate === null) dailyRate = user[0]?.dailyRate || 0;
  const previousDailyRate = user[0]?.previousDailyRate || 0;
  
  // Calculate Employer Shares based on daily rate
  const govtShares = computeMonthlyShares(dailyRate);
  SSS_Ded_ER = govtShares.employer_sss;
  Philhealth_Ded_ER = govtShares.employer_ph;
  HDMF_Ded_ER = govtShares.employer_hdmf;

  sss_Share = user[0]?.sss_Share || 0;
  philhealth_Share = user[0]?.philhealth_Share || 0;
  hdmf_Share = user[0]?.hdmf_Share || 0;
  tax_Share = user[0]?.tax_Share || 0;

  hCard = user[0]?.healthCard_Amnt || 0;

  // ── Cash Advance Override Check ─────────────────────────────────────────────
  try {
   const caRecord = await sequelize.query(
     `SELECT "amount" FROM "Payroll_Cash_Advances"
      WHERE "user_Id" = :user_Id AND "date" = :period_End LIMIT 1`,
     { replacements: { user_Id, period_End }, type: QueryTypes.SELECT }
   );
   if (caRecord.length > 0) {
     advAmnt = caRecord[0].amount;
   } else {
     advAmnt = user[0]?.advances_Amnt || 0;
   }
  } catch (err) {
   advAmnt = user[0]?.advances_Amnt || 0;
  }

  // ── Eastwest Loan Override Check ───────────────────────────────────────────
  try {
    const ewRecord = await sequelize.query(
      `SELECT "amount" FROM "Payroll_Eastwest"
       WHERE "user_Id" = :user_Id AND "date" = :period_End LIMIT 1`,
      { replacements: { user_Id, period_End }, type: QueryTypes.SELECT }
    );
    if (ewRecord.length > 0) {
      ewLoan = ewRecord[0].amount;
    } else {
      ewLoan = user[0]?.eastwest_Loan || 0;
    }
  } catch (err) {
    ewLoan = user[0]?.eastwest_Loan || 0;
  }
  // ── Maxicare Override Check ─────────────────────────────────────────────────
  try {
    const maxicareRecord = await sequelize.query(
      `SELECT "amount" FROM "Payroll_maxicare" 
       WHERE "user_Id" = :user_Id 
       AND EXTRACT(MONTH FROM "max_Month") = EXTRACT(MONTH FROM :period_End::date)
       AND EXTRACT(YEAR FROM "max_Month") = EXTRACT(YEAR FROM :period_End::date)
       LIMIT 1`,
      { replacements: { user_Id, period_End }, type: QueryTypes.SELECT }
    );
    if (maxicareRecord.length > 0) {
      hCard = maxicareRecord[0].amount;
    } else {
      // ── Maxicare Schedule Check (Fallback) ──────────────────────────────────
      const settings = await sequelize.query(
        `SELECT "maxicareDates" FROM "SystemSettings" LIMIT 1`,
        { type: QueryTypes.SELECT }
      );
      if (settings.length > 0 && settings[0].maxicareDates) {
        let schedule = settings[0].maxicareDates;
        // Ensure schedule is an array even if stored as a stringified JSON in some environments
        if (typeof schedule === 'string') {
          try { schedule = JSON.parse(schedule); } catch (e) { schedule = []; }
        }

        // Handle both array and object format ( { dates: [], configs: {} } )
        let dateArray = [];
        if (Array.isArray(schedule)) {
          dateArray = schedule;
        } else if (schedule && typeof schedule === 'object' && Array.isArray(schedule.dates)) {
          dateArray = schedule.dates;
        }

        if (dateArray.length > 0) {
          const periodEndStr = typeof period_End === 'string' ? period_End : period_End.toISOString().split('T')[0];
          const isScheduled = dateArray.some(d => {
            try {
              const d1 = new Date(d).toISOString().split('T')[0];
              const d2 = new Date(periodEndStr).toISOString().split('T')[0];
              return d1 === d2;
            } catch (e) { return false; }
          });
          if (!isScheduled) hCard = 0;
        } else {
          hCard = 0; // If it's not an array or has no dates, treat as not scheduled
        }
      }
    }
  } catch (err) {
    console.error("[MAXICARE CHECK ERROR]:", err.message);
  }

  // ── Government Loans Ledger Override Check ──────────────────────────────────
  try {
    const govLoanRecords = await sequelize.query(
      `SELECT "government_type", "amount" FROM "Payroll_GovernmentLoans"
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { user_Id, period_End }, type: QueryTypes.SELECT }
    );

    // Default to User table values first
    sLoan = user[0]?.SSS_Loan || 0;
    hLoan = user[0]?.HDMF_Loan || 0;
    cLoan = user[0]?.calamityLoan_Amnt || 0;
    mpSave = user[0]?.multiPurposeSavings || 0;

    // Apply overrides from ledger if they exist for this specific period
    govLoanRecords.forEach(record => {
      if (record.government_type === 'SSS') sLoan = record.amount;
      if (record.government_type === 'Pag-IBIG') hLoan = record.amount;
      if (record.government_type === 'Calamity') cLoan = record.amount;
      if (record.government_type === 'Multi-Purpose') mpSave = record.amount;
    });
  } catch (err) {
    console.error("[GOV LOAN LEDGER CHECK ERROR]:", err.message);
    sLoan = user[0]?.SSS_Loan || 0;
    hLoan = user[0]?.HDMF_Loan || 0;
    cLoan = user[0]?.calamityLoan_Amnt || 0;
    mpSave = user[0]?.multiPurposeSavings || 0;
  }
  // ────────────────────────────────────────────────────────────────────────────

  gDed = user[0]?.globe_Deduction || 0;

  const ratePerHr = dailyRate / WORK_HRS_PER_DAY;
  const ratePerMin = ratePerHr / 60;

  // 1. Basic Pay (Based on Worked Days + Paid Leaves)
  // stats.NoDays_Worked already includes Regular Holidays not worked (Rule #2)
  const totalPaidDays = stats.NoDays_Worked + stats.paidLeave_Days;
  const basicPay = totalPaidDays * dailyRate;

  // 2. Holiday Premiums
  const legalHol_Amnt = (stats.legalHol_Days * dailyRate);
  const specialHol_Amnt = (stats.specialHol_Days * dailyRate * 0.25);

  // 3. OT
  const OT_Amnt = stats.OT_Hrs * ratePerHr * 1.25;
  
  // 4. Attendance Deductions
  // Since we only pay for worked days, absence and unpaid leave amounts are 0
  const absence_Amnt = 0; 
  const tardiness_Amnt = stats.tardiness_Mins * ratePerMin;
  const unpaidLeave_Amnt = 0;
  const specialHol_Adj = 0; // Naturally excluded from basicPay if not worked

  const incentives = customIncentives; 
  const allowance = customAllowance;

  let totalEarnings = basicPay + legalHol_Amnt + specialHol_Amnt + OT_Amnt + incentives - specialHol_Adj;
  if (totalEarnings < 0) totalEarnings = 0;

  // 5. Government Deductions (Standard Shares)
  const govtTotal = totalEarnings > 0 ? (parseFloat(sss_Share) + parseFloat(philhealth_Share) + parseFloat(hdmf_Share)) : 0;
  
  // 6. Other Deductions (Excluding EastWest Loan as it is deducted from Net Pay for deposit)
  const otherTotal = totalEarnings > 0 ? (parseFloat(hCard) + parseFloat(sLoan) + parseFloat(hLoan) + parseFloat(cLoan) + parseFloat(advAmnt) + parseFloat(gDed) + parseFloat(mpSave)) : 0;

  // Tax is now pulled from user template
  const Tax_Ded_Final = totalEarnings > 0 ? (parseFloat(tax_Share) || 0) : 0; 

  // Net Pay = (Gross - Attendance Deds - Govt) - Other (including Tax) + Allowance
  // Taxable Income = Gross - Attendance Deds - Govt
  const taxableIncome = totalEarnings - (absence_Amnt + tardiness_Amnt + unpaidLeave_Amnt) - govtTotal;
  const netPay = taxableIncome - (otherTotal + Tax_Ded_Final) + allowance;

  const totalDeductions = absence_Amnt + tardiness_Amnt + unpaidLeave_Amnt + govtTotal + otherTotal + Tax_Ded_Final + parseFloat(ewLoan);

  return {
    ...stats,
    NoDays_Worked: totalPaidDays, 
    absence_Hrs: stats.absence_Days * 8,
    dailyRate,
    previousDailyRate,
    ratePerHr,
    basicPay,
    legalHol_Amnt,
    specialHol_Amnt,
    specialHol_Adj,
    OT_Amnt,
    incentives,
    allowance,
    absence_Amnt,
    tardiness_Amnt,
    unpaidLeave_Amnt,
    SSS_Ded: sss_Share,
    Philhealth_Ded: philhealth_Share,
    HDMF_Ded: hdmf_Share,
    SSS_Ded_ER: SSS_Ded_ER,
    Philhealth_Ded_ER: Philhealth_Ded_ER,
    HDMF_Ded_ER: HDMF_Ded_ER,
    healthCard_Amnt: hCard,
    profileHealthCard: user[0]?.healthCard_Amnt || 0,
    SSS_Loan: sLoan,
    HDMF_Loan: hLoan,
    calamityLoan_Amnt: cLoan,
    advances_Amnt: advAmnt,
    globe_Deduction: gDed,
    eastwest_Loan: ewLoan,
    multiPurposeSavings: mpSave,
    Tax_Ded: tax_Share,
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
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."user_Email", u."dailyRate", 
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", b."account_Number" 
       FROM "User" u
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       WHERE u."deletedAt" IS NULL AND u."dailyRate" > 0
       ORDER BY u."user_Id" ASC`, 
      { type: QueryTypes.SELECT }
    );

    let processedCount = 0;
    let skippedCount = 0;
    const newPayrollsForEmail = [];

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
          ("user_Id", "periodId", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked", "totalScheduledDays",
           "dailyRate", "previousDailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
           "holidaysTotal", "holidaysRegularWorked", "holidaysSpecialWorked",
           "status", "createdAt", "updatedAt")
         VALUES
          (:user_Id, :periodId, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked, :totalScheduledDays,
           :dailyRate, :previousDailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDed, :netPay,
           :holidaysTotal, :holidaysRegularWorked, :holidaysSpecialWorked,
           2, :now, :now)
         RETURNING "payrollId"`,
        {
          replacements: {
            user_Id: emp.user_Id, periodId, period_Start, period_End,
            NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
            totalScheduledDays: fullStats.totalScheduledDays,
            dailyRate: fullStats.dailyRate, previousDailyRate: fullStats.previousDailyRate,
            ratePerHr: fullStats.ratePerHr,
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
        `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "legalHol_Amnt", "specialHol_Amnt", "specialHol_Adj")
         VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :legalHol_Amnt, :specialHol_Amnt, :specialHol_Adj)`,
        { replacements: { 
            payrollId, user_Id: emp.user_Id, 
            OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
            legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt,
            specialHol_Adj: fullStats.specialHol_Adj
          }, type: QueryTypes.INSERT }
      );

      await sequelize.query(
        `INSERT INTO "Payroll_Deductions"
          ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", 
           "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days",
           "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "Tax_Ded",
           "SSS_Ded_ER", "Philhealth_Ded_ER", "HDMF_Ded_ER",
           "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", 
           "multiPurposeSavings", "advances_Amnt", "globe_Deduction", "eastwest_Loan")
         VALUES
          (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, 
           :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days,
           :sss, :ph, :hd, :tax,
           :sssER, :phER, :hdER,
           :hc, :sl, :hl, :cl, :ms, :aa, :gd, :el)`,
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
            sssER: fullStats.SSS_Ded_ER,
            phER: fullStats.Philhealth_Ded_ER,
            hdER: fullStats.HDMF_Ded_ER,
            hc: fullStats.healthCard_Amnt,
            sl: fullStats.SSS_Loan,
            hl: fullStats.HDMF_Loan,
            cl: fullStats.calamityLoan_Amnt,
            ms: fullStats.multiPurposeSavings,
            aa: fullStats.advances_Amnt,
            gd: fullStats.globe_Deduction,
            el: fullStats.eastwest_Loan
          },
          type: QueryTypes.INSERT,
        }
      );

      // ── Auto-record to Maxicare Table ─────────────────────────────────────
      if (fullStats.healthCard_Amnt > 0) {
        await sequelize.query(
          `INSERT INTO "Payroll_maxicare" ("user_Id", "max_Month", "amount", "maxi_status", "createdAt", "updatedAt")
           VALUES (:user_Id, :date, :amount, 'paid', :now, :now)
           ON CONFLICT ("user_Id", "max_Month") DO UPDATE
           SET "amount" = EXCLUDED."amount", "maxi_status" = 'paid', "updatedAt" = EXCLUDED."updatedAt"`,
          { replacements: { user_Id: emp.user_Id, date: period_End, amount: fullStats.healthCard_Amnt, now: nowStr }, type: QueryTypes.INSERT }
        );
      }
      // ──────────────────────────────────────────────────────────────────────

      // Collect data for background email dispatch
      newPayrollsForEmail.push({
        emp,
        payrollId,
        fullStats
      });

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

    // ── Background Email Dispatch ───────────────────────────────────────────
    if (newPayrollsForEmail.length > 0) {
      console.log(`[BATCH EMAIL] Starting background dispatch for ${newPayrollsForEmail.length} emails...`);
      (async () => {
        for (const item of newPayrollsForEmail) {
          try {
            const { emp, fullStats } = item;
            const dtrData = await getAttendanceReportInternal(period_Start, period_End, emp.user_Id);
            
            const payrollDataForPass = {
              period_Start,
              period_End,
              user_LastName: emp.user_LastName,
              user_Id: emp.user_Id
            };
            const pdfPassword = generatePayslipPassword(payrollDataForPass);

            const payslipBuffer = await generatePayslipPDF({
              ...fullStats,
              user_FirstName: emp.user_FirstName,
              user_LastName: emp.user_LastName,
              period_Start,
              period_End,
              accountNo: decrypt(emp.account_Number) || "—"
            }, pdfPassword);

            const dtrBuffer = await generateDTRPDF({
              employee: emp,
              dtrData,
              period_Start,
              period_End,
              netPay: fullStats.netPay
            });

            // ── Archive to PC Drive ──────────────────────────────────────────
            const dateObj = new Date(period_End);
            const archiveOpts = {
              year: dateObj.getFullYear(),
              month: formatMonthFolder(dateObj),
              subFolder: getPeriodFolder(period_Start, period_End)
            };

            await saveFileToArchive(payslipBuffer, `Payslip_${emp.user_LastName}_${emp.user_Id}.pdf`, archiveOpts);
            await saveFileToArchive(dtrBuffer, `DTR_${emp.user_LastName}_${emp.user_Id}.pdf`, archiveOpts);
            // ──────────────────────────────────────────────────────────────────

            await sendPayrollEmail({
              email: emp.user_Email,
              name: `${emp.user_FirstName} ${emp.user_LastName}`,
              period: `${period_Start} to ${period_End}`,
              netPay: fullStats.netPay,
              attachments: [
                { filename: `Payslip_${emp.user_LastName}.pdf`, content: payslipBuffer },
                { filename: `DTR_${emp.user_LastName}.pdf`, content: dtrBuffer }
              ]
            });
          } catch (emailErr) {
            console.error(`[BATCH EMAIL ERROR] for ${item.emp.user_Email}:`, emailErr.message);
          }
        }
        console.log(`[BATCH EMAIL] Background dispatch completed.`);

        // ── Automatically Archive Summary Report ─────────────────────────────
        try {
          console.log(`[BATCH ARCHIVE] Generating period summary and secure ZIP archive...`);
          
          const dateObj = new Date(period_End);
          const archiveOpts = {
            year: dateObj.getFullYear(),
            month: formatMonthFolder(dateObj),
            subFolder: getPeriodFolder(period_Start, period_End)
          };

          // 1. Generate and Save Summary PDF
          const payrollRows = newPayrollsForEmail.map(item => ({
            ...item.fullStats,
            user_FirstName: item.emp.user_FirstName,
            user_LastName: item.emp.user_LastName,
            sss_Share: item.emp.sss_Share,
            philhealth_Share: item.emp.philhealth_Share,
            hdmf_Share: item.emp.hdmf_Share,
            previousDailyRate: item.emp.previousDailyRate,
            accountNo: decrypt(item.emp.account_Number)
          }));

          const start = new Date(period_Start + "T00:00:00");
          const end   = new Date(period_End   + "T00:00:00");
          const month = start.toLocaleString("en-PH", { month: "long" });
          const periodLabel = `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
          const summaryPDF = await generatePayrollSummaryPDF(payrollRows, periodLabel);
          await saveFileToArchive(summaryPDF, `SummaryReport_${period_Start}_${period_End}.pdf`, archiveOpts);

          // 2. Create and Save Password-Protected ZIP of all individual files
          // ZIP Password format: MaChip_{PeriodDigits}{MonthName}{Year}
          const periodDigits = `${String(start.getDate()).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`;
          const archiveZipPassword = `MaChip_${periodDigits}${month}${start.getFullYear()}`;
          
          const fs = require('fs');
          const path = require('path');
          const settings = await require('../config/sequelize').SystemSettings.findOne();
          
          if (settings && settings.storageRootPath) {
            const zipFileName = `Batch_Archive_${period_Start}_${period_End}.zip`;
            const zipPath = path.join(settings.storageRootPath, String(archiveOpts.year), archiveOpts.month, archiveOpts.subFolder, zipFileName);
            
            const output = fs.createWriteStream(zipPath);
            const archive = archiver("zip-encryptable", {
              zlib: { level: 9 },
              password: archiveZipPassword
            });

            archive.pipe(output);

            for (const item of newPayrollsForEmail) {
              const { emp, fullStats } = item;
              const pdfPassword = generatePayslipPassword({
                period_Start,
                period_End,
                user_LastName: emp.user_LastName,
                user_Id: emp.user_Id
              });

              const payslipBuffer = await generatePayslipPDF({
                ...fullStats,
                user_FirstName: emp.user_FirstName,
                user_LastName: emp.user_LastName,
                period_Start,
                period_End,
                accountNo: decrypt(emp.account_Number) || "—"
              }, pdfPassword);

              archive.append(payslipBuffer, { name: `Payslip_${emp.user_LastName}_${emp.user_Id}.pdf` });
            }

            await archive.finalize();
            console.log(`[BATCH ARCHIVE] Secure ZIP archived successfully at: ${zipPath}`);
          }
        } catch (summaryErr) {
          console.error(`[BATCH ARCHIVE ERROR] Archival failed:`, summaryErr.message);
        }
        // ──────────────────────────────────────────────────────────────────
      })();
    }

    res.status(201).json({ message: "Batch payroll generated and emails are being sent.", processed: processedCount, skipped: skippedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Recalculate Payroll (Internal) ───────────────────────────────────────────
/**
 * Forces a recalculation of an existing payroll record's stats.
 * Used when attendance logs are updated/auto-marked as absent.
 */
async function recalculatePayrollInternal(payrollId) {
  try {
    const payroll = await sequelize.query(
      `SELECT * FROM "Payroll" WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );
    if (!payroll[0]) return;

    const { user_Id, period_Start, period_End } = payroll[0];

    // Fetch existing earnings to preserve incentives/allowances during auto-recalc
    const earnings = await sequelize.query(
      `SELECT "incentives", "allowance" FROM "Payroll_Earnings" WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );
    const existingIncentives = earnings[0]?.incentives || 0;
    const existingAllowance = earnings[0]?.allowance || 0;

    const fullStats = await calculatePayrollStats(user_Id, period_Start, period_End, null, existingAllowance, existingIncentives);

    // Update Earning Adjustments
    await sequelize.query(
      `UPDATE "Payroll_Earnings" 
       SET "OT_Hrs" = :OT_Hrs, "OT_Amnt" = :OT_Amnt,
           "legalHol_Amnt" = :legalHol_Amnt, "specialHol_Amnt" = :specialHol_Amnt,
           "specialHol_Adj" = :specialHol_Adj
       WHERE "payrollId" = :payrollId`,
      { replacements: { 
          payrollId, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt,
          specialHol_Adj: fullStats.specialHol_Adj
        }, type: QueryTypes.UPDATE }
    );

    // Update Deductions
    await sequelize.query(
      `UPDATE "Payroll_Deductions"
       SET "absence_Hrs" = :absence_Hrs, "absence_Amnt" = :absence_Amnt,
           "tardiness_Mins" = :tardiness_Mins, "tardiness_Amnt" = :tardiness_Amnt,
           "unpaidLeave_Days" = :unpaidLeave_Days, "unpaidLeave_Amnt" = :unpaidLeave_Amnt,
           "paidLeave_Days" = :paidLeave_Days, "SSS_Ded" = :sss, "Philhealth_Ded" = :ph,
           "HDMF_Ded" = :hd, "Tax_Ded" = :tax, 
           "SSS_Ded_ER" = :sssER, "Philhealth_Ded_ER" = :phER, "HDMF_Ded_ER" = :hdER,
           "healthCard_Amnt" = :hc,
           "SSS_Loan" = :sl, "HDMF_Loan" = :hl, "calamityLoan_Amnt" = :cl,
           "multiPurposeSavings" = :ms, "advances_Amnt" = :aa, "globe_Deduction" = :gd,
           "eastwest_Loan" = :el
       WHERE "payrollId" = :payrollId`,
      { replacements: {
          payrollId,
          absence_Hrs: (fullStats.absence_Days) * 8,
          absence_Amnt: fullStats.absence_Amnt,
          tardiness_Mins: fullStats.tardiness_Mins,
          tardiness_Amnt: fullStats.tardiness_Amnt,
          unpaidLeave_Days: fullStats.unpaidLeave_Days,
          unpaidLeave_Amnt: fullStats.unpaidLeave_Amnt,
          paidLeave_Days: fullStats.paidLeave_Days,
          sss: fullStats.SSS_Ded, ph: fullStats.Philhealth_Ded, hd: fullStats.HDMF_Ded, tax: fullStats.Tax_Ded,
          sssER: fullStats.SSS_Ded_ER, phER: fullStats.Philhealth_Ded_ER, hdER: fullStats.HDMF_Ded_ER,
          hc: fullStats.healthCard_Amnt, sl: fullStats.SSS_Loan, hl: fullStats.HDMF_Loan,
          cl: fullStats.calamityLoan_Amnt, ms: fullStats.multiPurposeSavings,
          aa: fullStats.advances_Amnt, gd: fullStats.globe_Deduction,
          el: fullStats.eastwest_Loan
        }, type: QueryTypes.UPDATE }
    );

    // Update Master Payroll Record
    await sequelize.query(
      `UPDATE "Payroll"
       SET "NoDays_Worked" = :NoDays_Worked, "NoHrs_Worked" = :NoHrs_Worked,
           "basicPay" = :basicPay, "totalEarnings" = :totalEarnings, 
           "totalDeductions" = :totalDed, "netPay" = :netPay, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "payrollId" = :payrollId`,
      { replacements: {
          payrollId,
          NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
          basicPay: fullStats.basicPay, totalEarnings: fullStats.totalEarnings, 
          totalDed: fullStats.totalDeductions, netPay: fullStats.netPay
        }, type: QueryTypes.UPDATE }
    );
  } catch (error) {
    console.error("[ERROR] recalculatePayrollInternal:", error.message);
  }
}

exports.recalculatePayrollInternal = recalculatePayrollInternal;

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
        ("user_Id", "period_Start", "period_End", "NoDays_Worked", "NoHrs_Worked", "totalScheduledDays",
         "dailyRate", "previousDailyRate", "ratePerHr", "basicPay", "totalEarnings", "totalDeductions", "netPay",
         "status", "createdAt", "updatedAt")
       VALUES
        (:user_Id, :period_Start, :period_End, :NoDays_Worked, :NoHrs_Worked, :totalScheduledDays,
         :dailyRate, :previousDailyRate, :ratePerHr, :basicPay, :totalEarnings, :totalDed, :netPay,
         2, :now, :now)
       RETURNING "payrollId"`,
      {
        replacements: {
          user_Id, period_Start, period_End,
          NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
          totalScheduledDays: fullStats.totalScheduledDays,
          dailyRate: fullStats.dailyRate, previousDailyRate: fullStats.previousDailyRate,
          ratePerHr: fullStats.ratePerHr,
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
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "legalHol_Amnt", "specialHol_Amnt", "specialHol_Adj")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :legalHol_Amnt, :specialHol_Amnt, :specialHol_Adj)`,
      { replacements: { 
          payrollId, user_Id, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt,
          specialHol_Adj: fullStats.specialHol_Adj
        }, type: QueryTypes.INSERT }
    );

    await sequelize.query(
      `INSERT INTO "Payroll_Deductions"
        ("payrollId", "absence_Hrs", "absence_Amnt", "tardiness_Mins", "tardiness_Amnt", 
         "unpaidLeave_Days", "unpaidLeave_Amnt", "paidLeave_Days",
         "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "Tax_Ded",
         "SSS_Ded_ER", "Philhealth_Ded_ER", "HDMF_Ded_ER",
         "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", "calamityLoan_Amnt", 
         "multiPurposeSavings", "advances_Amnt", "globe_Deduction", "eastwest_Loan")
         VALUES
         (:payrollId, :absence_Hrs, :absence_Amnt, :tardiness_Mins, :tardiness_Amnt, 
         :unpaidLeave_Days, :unpaidLeave_Amnt, :paidLeave_Days,
         :sss, :ph, :hd, :tax,
         :sssER, :phER, :hdER,
         :hc, :sl, :hl, :cl, :ms, :aa, :gd, :el)`,
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
          sssER: fullStats.SSS_Ded_ER,
          phER: fullStats.Philhealth_Ded_ER,
          hdER: fullStats.HDMF_Ded_ER,
          hc: fullStats.healthCard_Amnt,
          sl: fullStats.SSS_Loan,
          hl: fullStats.HDMF_Loan,
          cl: fullStats.calamityLoan_Amnt,
          ms: fullStats.multiPurposeSavings,
          aa: fullStats.advances_Amnt,
          gd: fullStats.globe_Deduction,
          el: fullStats.eastwest_Loan
         },
         type: QueryTypes.INSERT,
         }    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "PAYROLL_GEN", `Generated payroll for user ${user_Id} for period ${period_Start} to ${period_End}`, { payrollId }, req);

    // ── Send Email ──────────────────────────────────────────────────────────
    try {
      const empRow = await sequelize.query(
        `SELECT u."user_FirstName", u."user_LastName", u."user_Email", b."account_Number" 
         FROM "User" u
         LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
         WHERE u."user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.SELECT }
      );
      if (empRow.length > 0) {
        const emp = empRow[0];
        const dtrData = await getAttendanceReportInternal(period_Start, period_End, user_Id);
        
        const pdfPassword = generatePayslipPassword({
          period_Start,
          period_End,
          user_LastName: emp.user_LastName,
          user_Id
        });

        const payslipBuffer = await generatePayslipPDF({
          ...fullStats,
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          period_Start,
          period_End,
          accountNo: decrypt(emp.account_Number) || "—"
        }, pdfPassword);

        const dtrBuffer = await generateDTRPDF({
          employee: { user_Id, ...emp },
          dtrData,
          period_Start,
          period_End,
          netPay: fullStats.netPay
        });

        // ── Archive to PC Drive ──────────────────────────────────────────
        const dateObj = new Date(period_End);
        const archiveOpts = {
          year: dateObj.getFullYear(),
          month: formatMonthFolder(dateObj),
          subFolder: getPeriodFolder(period_Start, period_End)
        };

        await saveFileToArchive(payslipBuffer, `Payslip_${emp.user_LastName}_${user_Id}.pdf`, archiveOpts);
        await saveFileToArchive(dtrBuffer, `DTR_${emp.user_LastName}_${user_Id}.pdf`, archiveOpts);
        // ──────────────────────────────────────────────────────────────────

        await sendPayrollEmail({
          email: emp.user_Email,
          name: `${emp.user_FirstName} ${emp.user_LastName}`,
          period: `${period_Start} to ${period_End}`,
          netPay: fullStats.netPay,
          attachments: [
            { filename: `Payslip_${emp.user_LastName}.pdf`, content: payslipBuffer },
            { filename: `DTR_${emp.user_LastName}.pdf`, content: dtrBuffer }
          ]
        });
      }
    } catch (emailErr) {
      console.error(`[PAYROLL EMAIL ERROR] for user ${user_Id}:`, emailErr.message);
    }
    // ──────────────────────────────────────────────────────────────────────

    // ── Auto-record/link to Ledger Tables ─────────────────────────────────
    // 1. Cash Advance Link
    await sequelize.query(
      `UPDATE "Payroll_Cash_Advances" SET "payrollId" = :payrollId
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { payrollId, user_Id, period_End }, type: QueryTypes.UPDATE }
    );

    // 2. Maxicare Auto-record
    if (fullStats.healthCard_Amnt > 0) {
      await sequelize.query(
        `INSERT INTO "Payroll_maxicare" ("user_Id", "max_Month", "amount", "maxi_status", "createdAt", "updatedAt")
         VALUES (:user_Id, :date, :amount, 'paid', :now, :now)
         ON CONFLICT ("user_Id", "max_Month") DO UPDATE
         SET "amount" = EXCLUDED."amount", "maxi_status" = 'paid', "updatedAt" = EXCLUDED."updatedAt"`,
        { replacements: { user_Id, date: period_End, amount: fullStats.healthCard_Amnt, now: nowStr }, type: QueryTypes.INSERT }
      );
    }
    // ──────────────────────────────────────────────────────────────────────

    res.status(201).json({ message: "Payroll generated successfully.", payrollId, netPay: fullStats.netPay });
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

    // Reset User advances_Amnt since it's already deducted in this released payroll
    const payroll = await sequelize.query(
      `SELECT "user_Id" FROM "Payroll" WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );
    if (payroll.length > 0) {
      await sequelize.query(
        `UPDATE "User_Deduction_Profile" SET "advances_Amnt" = 0, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id: payroll[0].user_Id, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "PAYROLL_RELEASE", `Released payroll ID ${payrollId}`, { payrollId }, req);

    res.status(200).json({ message: "Payroll released successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Resend Payroll Email ──────────────────────────────────────────────────────
exports.resendPayrollEmail = async (req, res) => {
  const { payrollId } = req.params;
  try {
    const payrolls = await sequelize.query(
      `SELECT p.*, u."user_FirstName", u."user_LastName", u."user_Email", b."account_Number"
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       WHERE p."payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );

    if (payrolls.length === 0) {
      return res.status(404).json({ error: "Payroll record not found." });
    }

    const payroll = payrolls[0];

    // Need to fetch full stats from Payroll_Earnings and Payroll_Deductions for the PDF
    const earnings = await sequelize.query(
      `SELECT * FROM "Payroll_Earnings" WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );
    const deductions = await sequelize.query(
      `SELECT * FROM "Payroll_Deductions" WHERE "payrollId" = :payrollId`,
      { replacements: { payrollId }, type: QueryTypes.SELECT }
    );

    const fullStats = {
      ...payroll,
      ...(earnings[0] || {}),
      ...(deductions[0] || {})
    };

    const dtrData = await getAttendanceReportInternal(payroll.period_Start, payroll.period_End, payroll.user_Id);
    
    const pdfPassword = generatePayslipPassword({
      period_Start: payroll.period_Start,
      period_End: payroll.period_End,
      user_LastName: payroll.user_LastName,
      user_Id: payroll.user_Id
    });

    const [payslipBuffer, dtrBuffer] = await Promise.all([
      generatePayslipPDF({
        ...fullStats,
        user_FirstName: payroll.user_FirstName,
        user_LastName: payroll.user_LastName,
        accountNo: decrypt(payroll.account_Number) || "—"
      }, pdfPassword),
      generateDTRPDF({
        employee: payroll,
        dtrData,
        period_Start: payroll.period_Start,
        period_End: payroll.period_End,
        netPay: payroll.netPay
      })
    ]);

    await sendPayrollEmail({
      email: payroll.user_Email,
      name: `${payroll.user_FirstName} ${payroll.user_LastName}`,
      period: `${payroll.period_Start} to ${payroll.period_End}`,
      netPay: payroll.netPay,
      attachments: [
        { filename: `Payslip_${payroll.user_LastName}.pdf`, content: payslipBuffer },
        { filename: `DTR_${payroll.user_LastName}.pdf`, content: dtrBuffer }
      ]
    });

    res.status(200).json({ message: "Payroll email resent successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
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
         e."specialHol_Adj", e."incentives", e."allowance",
         d.*,
         (COALESCE(d."healthCard_Amnt",0) +
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",         u."user_FirstName", u."user_LastName",
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
         e."specialHol_Adj", e."incentives", e."allowance",
         d.*,
         (COALESCE(d."healthCard_Amnt",0) +
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",         u."user_FirstName", u."user_LastName",
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
        u."user_FirstName", u."user_LastName", h."user_MachipId",
        ps."PaystatusName" AS "statusName",
        d.*,
        (COALESCE(d."healthCard_Amnt",0) +
         COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
         COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0) +
         COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",
        e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt", 
        e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
        e."specialHol_Adj", e."incentives", e."allowance"
      FROM "Payroll" p
      LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
      LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
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

    query += ` ORDER BY u."user_Id" ASC`;

    const payrolls = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── ADDITIONS FOR GOVT + OTHER DEDUCTIONS ───────────────────────────────────

// ── Get Government Deductions Preview ────────────────────────────────────────
exports.getGovtDeductionsPreview = async (req, res) => {
  const { grossPay, user_Id } = req.query;
  if (!grossPay || !user_Id) return res.status(400).json({ error: "grossPay and user_Id required." });

  try {
    // Calculate based on the provided gross pay (assuming it's a monthly estimate for template purposes)
    // For template editing, we assume grossPay is roughly Monthly Salary
    const dailyRate = parseFloat(grossPay) / 26; 
    const shares = computeMonthlyShares(dailyRate);

    // Tax is now manual input ("hardcoded") per user request, but we can suggest 0
    const tax = 0;

    res.status(200).json({ 
      SSS_Ded: shares.sss_Share, 
      Philhealth_Ded: shares.philhealth_Share, 
      HDMF_Ded: shares.hdmf_Share, 
      Tax_Ded: tax 
    });
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

    // 1. Try to get saved payroll records
    let payrollRows = await sequelize.query(
      `SELECT p.*,
              u."user_FirstName", u."user_LastName", b."account_Number" AS "accountNo",
              h."user_MachipId", u."department", u."position", u."taxStatus", u."hireDate",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."healthCard_Amnt" AS "profileHealthCard", u."previousDailyRate",
              pe.*, pd.*
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId"
       WHERE p."period_Start" = :period_Start AND p."period_End" = :period_End
       ORDER BY u."user_Id" ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );

    // 2. If no saved records (Draft mode), perform live calculations for PDF
    if (payrollRows.length === 0) {
      const employees = await sequelize.query(
        `SELECT u."user_Id", u."user_FirstName", u."user_LastName", h."user_MachipId", 
                u."department", u."position", u."taxStatus", u."hireDate",
                d."sss_Share", d."philhealth_Share", d."hdmf_Share", b."account_Number", u."previousDailyRate"
         FROM "User" u
         LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
         LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
         LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
         WHERE u."dailyRate" > 0 AND u."deletedAt" IS NULL
         ORDER BY u."user_Id" ASC`,
        { type: QueryTypes.SELECT }
      );

      const { decrypt } = require("../utils/encryption");
      for (const emp of employees) {
        const preview = await calculatePayrollStats(emp.user_Id, period_Start, period_End);
        payrollRows.push({
          ...preview,
          user_Id: emp.user_Id,
          period_Start,
          period_End,
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          user_MachipId: emp.user_MachipId,
          department: emp.department,
          position: emp.position,
          taxStatus: emp.taxStatus,
          hireDate: emp.hireDate,
          sss_Share: emp.sss_Share,
          philhealth_Share: emp.philhealth_Share,
          hdmf_Share: emp.hdmf_Share,
          previousDailyRate: emp.previousDailyRate,
          accountNo: decrypt(emp.account_Number)
        });
      }
    }

    if (payrollRows.length === 0) return res.status(404).json({ error: "No records found for this period." });

    const start = new Date(period_Start + "T00:00:00");
    const end   = new Date(period_End   + "T00:00:00");
    const month = start.toLocaleString("en-PH", { month: "long" });
    const periodLabel = `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;

    const pdfBuffer = await generatePayrollSummaryPDF(payrollRows, periodLabel);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Summary_${period_Start}_${period_End}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) { 
    console.error("[DOWNLOAD SUMMARY ERROR]:", error);
    res.status(500).json({ error: error.message }); 
  }
};
// ── Get Payroll Summary Preview (HTML) ────────────────────────────────────────
exports.getPayrollSummaryPreview = async (req, res) => {
  let { period_Start, period_End } = req.query;
  try {
    // 1. Try to get saved payroll records
    let payrollRows = await sequelize.query(
      `SELECT p.*, 
              u."user_FirstName", u."user_LastName", b."account_Number" AS "accountNo", 
              h."user_MachipId", u."department", u."position", u."taxStatus", u."hireDate",
              d."sss_Share", d."philhealth_Share", d."hdmf_Share", d."healthCard_Amnt" AS "profileHealthCard", u."previousDailyRate",
              pe.*, pd.*
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId"
       WHERE p."period_Start" = :period_Start AND p."period_End" = :period_End
       ORDER BY u."user_Id" ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );

    // 2. If no saved records (Draft mode), perform live calculations for preview
    if (payrollRows.length === 0) {
      const employees = await sequelize.query(
        `SELECT u."user_Id", u."user_FirstName", u."user_LastName", h."user_MachipId", 
                u."department", u."position", u."taxStatus", u."hireDate",
                d."sss_Share", d."philhealth_Share", d."hdmf_Share", b."account_Number", u."previousDailyRate"
         FROM "User" u
         LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
         LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
         LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
         WHERE u."dailyRate" > 0 AND u."deletedAt" IS NULL
         ORDER BY u."user_Id" ASC`,
        { type: QueryTypes.SELECT }
      );
      
      payrollRows = [];
      const { decrypt } = require("../utils/encryption");
      for (const emp of employees) {
        const preview = await calculatePayrollStats(emp.user_Id, period_Start, period_End);
        payrollRows.push({
          ...preview,
          user_Id: emp.user_Id,
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          user_MachipId: emp.user_MachipId,
          department: emp.department,
          position: emp.position,
          taxStatus: emp.taxStatus,
          hireDate: emp.hireDate,
          sss_Share: emp.sss_Share,
          philhealth_Share: emp.philhealth_Share,
          hdmf_Share: emp.hdmf_Share,
          previousDailyRate: emp.previousDailyRate,
          accountNo: decrypt(emp.account_Number)
        });
      }
    }

    if (payrollRows.length === 0) return res.status(404).send("<h1>No eligible employees found for this period.</h1>");

    const start = new Date(period_Start + "T00:00:00");
    const end   = new Date(period_End   + "T00:00:00");
    const month = start.toLocaleString("en-PH", { month: "long" });
    const periodLabel = `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()} (DRAFT PREVIEW)`;

    const { build8PageReportHTML } = require("../utils/payrollSummaryGenerator");
    const html = build8PageReportHTML(payrollRows, periodLabel);
    res.send(html);
  } catch (error) { 
    console.error("[PREVIEW ERROR]:", error);
    res.status(500).send("Error generating preview: " + error.message); 
  }
};

// ── UPDATE Payroll (extended) ─────────────────
exports.updatePayrollFull = async (req, res) => {
  const { payrollId } = req.params;
  const {
    dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, status,
    OT_Hrs, OT_Amnt, legalHol_Amnt, specialHol_Amnt, specialHol_Adj, incentives, allowance,
    absence_Days, absence_Amnt, tardiness_Mins, tardiness_Amnt, unpaidLeave_Days, unpaidLeave_Amnt, paidLeave_Days,
    SSS_Ded, Philhealth_Ded, HDMF_Ded, Tax_Ded,
    SSS_Ded_ER, Philhealth_Ded_ER, HDMF_Ded_ER,
    healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt, multiPurposeSavings, advances_Amnt, globe_Deduction,
  } = req.body;

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const oldPayroll = await sequelize.query(`SELECT p.*, pe.*, pd.* FROM "Payroll" p LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId" LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId" WHERE p."payrollId" = :payrollId LIMIT 1`, { replacements: { payrollId }, type: QueryTypes.SELECT });
    if (oldPayroll.length === 0) return res.status(404).json({ error: "Not found." });

    const govtTotal  = (parseFloat(SSS_Ded || 0) + parseFloat(Philhealth_Ded || 0) + parseFloat(HDMF_Ded || 0));
    const taxTotal   = parseFloat(Tax_Ded || 0);
    const otherTotal = (parseFloat(healthCard_Amnt || 0) + parseFloat(SSS_Loan || 0) + parseFloat(HDMF_Loan || 0) + parseFloat(calamityLoan_Amnt || 0) + parseFloat(multiPurposeSavings || 0) + parseFloat(advances_Amnt || 0) + parseFloat(globe_Deduction || 0));
    const attendanceDed = (parseFloat(absence_Amnt || 0) + parseFloat(tardiness_Amnt || 0) + parseFloat(unpaidLeave_Amnt || 0));
    
    // Net Pay = (Taxable Income) - (Other + Tax) + Allowance
    const taxableIncome = parseFloat(totalEarnings || 0) - attendanceDed - govtTotal;
    const computedNet = taxableIncome - (otherTotal + taxTotal) + parseFloat(allowance || 0);

    const computedTotalDed = govtTotal + taxTotal + otherTotal + attendanceDed + parseFloat(req.body.eastwest_Loan || 0);

    await sequelize.query(`UPDATE "Payroll" SET "dailyRate"=:dailyRate, "ratePerHr"=:ratePerHr, "NoDays_Worked"=:NoDays_Worked, "NoHrs_Worked"=:NoHrs_Worked, "basicPay"=:basicPay, "totalEarnings"=:totalEarnings, "totalDeductions"=:totalDed, "netPay"=:netPay, "status"=:status, "updatedAt"=:now WHERE "payrollId" = :payrollId`, { replacements: { payrollId, dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDed: computedTotalDed, netPay: computedNet, status, now: nowStr }, type: QueryTypes.UPDATE });
    
    await sequelize.query(`UPDATE "Payroll_Earnings" SET "OT_Hrs"=:OT_Hrs, "OT_Amnt"=:OT_Amnt, "legalHol_Amnt"=:legalHol_Amnt, "specialHol_Amnt"=:specialHol_Amnt, "specialHol_Adj"=:specialHol_Adj, "incentives"=:incentives, "allowance"=:allowance WHERE "payrollId" = :payrollId`, { replacements: { payrollId, OT_Hrs, OT_Amnt, legalHol_Amnt, specialHol_Amnt, specialHol_Adj, incentives, allowance }, type: QueryTypes.UPDATE });
    
    await sequelize.query(`UPDATE "Payroll_Deductions" SET "absence_Hrs"=:absence_Hrs, "absence_Amnt"=:absence_Amnt, "tardiness_Mins"=:tardiness_Mins, "tardiness_Amnt"=:tardiness_Amnt, "unpaidLeave_Days"=:unpaidLeave_Days, "unpaidLeave_Amnt"=:unpaidLeave_Amnt, "paidLeave_Days"=:paidLeave_Days, "SSS_Ded"=:SSS_Ded, "Philhealth_Ded"=:Philhealth_Ded, "HDMF_Ded"=:HDMF_Ded, "Tax_Ded"=:Tax_Ded, "SSS_Ded_ER"=:SSS_Ded_ER, "Philhealth_Ded_ER"=:Philhealth_Ded_ER, "HDMF_Ded_ER"=:HDMF_Ded_ER, "healthCard_Amnt"=:healthCard_Amnt, "SSS_Loan"=:SSS_Loan, "HDMF_Loan"=:HDMF_Loan, "calamityLoan_Amnt"=:calamityLoan_Amnt, "multiPurposeSavings"=:multiPurposeSavings, "advances_Amnt"=:advances_Amnt, "globe_Deduction"=:globe_Deduction, "eastwest_Loan"=:eastwest_Loan WHERE "payrollId" = :payrollId`, { replacements: { payrollId, absence_Hrs:(parseFloat(absence_Days||0)*8), absence_Amnt, tardiness_Mins, tardiness_Amnt, unpaidLeave_Days, unpaidLeave_Amnt, paidLeave_Days, SSS_Ded, Philhealth_Ded, HDMF_Ded, Tax_Ded, SSS_Ded_ER, Philhealth_Ded_ER, HDMF_Ded_ER, healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt, multiPurposeSavings, advances_Amnt, globe_Deduction, eastwest_Loan: (req.body.eastwest_Loan || 0) }, type: QueryTypes.UPDATE });

    const newPayroll = await sequelize.query(`SELECT p.*, pe.*, pd.* FROM "Payroll" p LEFT JOIN "Payroll_Earnings" pe ON pe."payrollId" = p."payrollId" LEFT JOIN "Payroll_Deductions" pd ON pd."payrollId" = p."payrollId" WHERE p."payrollId" = :payrollId LIMIT 1`, { replacements: { payrollId }, type: QueryTypes.SELECT });
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "Payroll", "UPDATE_PAYROLL_FULL", "Payroll", payrollId, oldPayroll[0], newPayroll[0]);
    res.status(200).json({ message: "Updated successfully.", netPay: computedNet, totalDeductions: computedTotalDed });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Sync Maxicare History from Matrix ─────────────────────────────────────────
exports.syncMaxicareHistory = async (req, res) => {
  const { updates } = req.body;
  console.log(`[DEBUG_MAXICARE_SYNC] Received ${updates?.length || 0} updates.`);
  
  if (!Array.isArray(updates)) return res.status(400).json({ error: "Updates array required." });

  try {
    const { Payroll_maxicare } = require("../config/sequelize.js");
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    for (const item of updates) {
      const { date, user_Id, amount, status: explicitStatus } = item;
      try {
        const isPast = date <= nowStr.split(' ')[0];
        const status = explicitStatus || (isPast ? 'paid' : 'estimated');
        
        console.log(`[DEBUG_UPSERT] User: ${user_Id}, Date: ${date}, Status: ${status}, Amount: ${amount}`);

        await Payroll_maxicare.upsert({
          user_Id,
          max_Month: date,
          amount,
          maxi_status: status,
          updatedAt: now
        });

        // 1.5 Update User_Deduction_Profile table only if amount > 0 and it was previously 0
        // This ensures the "Subscribed" status propagates without accidentally clearing profiles on partial skips
        if (amount > 0) {
          await sequelize.query(
            `UPDATE "User_Deduction_Profile"
             SET "healthCard_Amnt" = :amount, "updatedAt" = :now
             WHERE "user_Id" = :user_Id
             AND ("healthCard_Amnt" = 0 OR "healthCard_Amnt" IS NULL)`,
            { replacements: { amount, user_Id, now: nowStr }, type: QueryTypes.UPDATE }
          );
        }

        // 2. If it's a past record, also update existing Payroll records
        if (isPast) {
          await sequelize.query(
            `UPDATE "Payroll_Deductions"
             SET "healthCard_Amnt" = :amount
             FROM "Payroll" p
             WHERE p."payrollId" = "Payroll_Deductions"."payrollId"
             AND p."user_Id" = :user_Id
             AND p."period_End" = :date`,
            { replacements: { amount, user_Id, date }, type: QueryTypes.UPDATE }
          );
          await sequelize.query(
            `UPDATE "Payroll" p
             SET "totalDeductions" = (
               SELECT (COALESCE(pd."absence_Amnt", 0) + COALESCE(pd."tardiness_Amnt", 0) + COALESCE(pd."unpaidLeave_Amnt", 0) + COALESCE(pd."SSS_Ded", 0) + COALESCE(pd."Philhealth_Ded", 0) + COALESCE(pd."HDMF_Ded", 0) + COALESCE(pd."Tax_Ded", 0) + COALESCE(pd."healthCard_Amnt", 0) + COALESCE(pd."SSS_Loan", 0) + COALESCE(pd."HDMF_Loan", 0) + COALESCE(pd."calamityLoan_Amnt", 0) + COALESCE(pd."multiPurposeSavings", 0) + COALESCE(pd."advances_Amnt", 0) + COALESCE(pd."globe_Deduction", 0) + COALESCE(pd."eastwest_Loan", 0))
               FROM "Payroll_Deductions" pd WHERE pd."payrollId" = p."payrollId"
             ),
             "netPay" = p."totalEarnings" - (
               SELECT (COALESCE(pd."absence_Amnt", 0) + COALESCE(pd."tardiness_Amnt", 0) + COALESCE(pd."unpaidLeave_Amnt", 0) + COALESCE(pd."SSS_Ded", 0) + COALESCE(pd."Philhealth_Ded", 0) + COALESCE(pd."HDMF_Ded", 0) + COALESCE(pd."Tax_Ded", 0) + COALESCE(pd."healthCard_Amnt", 0) + COALESCE(pd."SSS_Loan", 0) + COALESCE(pd."HDMF_Loan", 0) + COALESCE(pd."calamityLoan_Amnt", 0) + COALESCE(pd."multiPurposeSavings", 0) + COALESCE(pd."advances_Amnt", 0) + COALESCE(pd."globe_Deduction", 0) + COALESCE(pd."eastwest_Loan", 0))
               FROM "Payroll_Deductions" pd WHERE pd."payrollId" = p."payrollId"
             )
             WHERE p."user_Id" = :user_Id AND p."period_End" = :date`,
            { replacements: { user_Id, date }, type: QueryTypes.UPDATE }
          );
        }
      } catch (itemErr) {
        console.error(`[ERROR_SYNC_ITEM] Failed for User ${user_Id} on ${date}:`, itemErr.message);
      }
    }
    res.status(200).json({ message: "Maxicare history synced successfully." });
  } catch (error) {
    console.error("[FATAL_MAXICARE_SYNC_ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ── Loan Management Helpers ──────────────────────────────────────────────────
const loanTypeMapper = {
  "Cash Advance": { dbType: "cash_advance", dedCol: "advances_Amnt" },
  "SSS Loan": { dbType: "sss_loan", dedCol: "SSS_Loan", govType: "SSS" },
  "Pag-IBIG Loan": { dbType: "hdmf_loan", dedCol: "HDMF_Loan", govType: "Pag-IBIG" },
  "Calamity Loan": { dbType: "calamity", dedCol: "calamityLoan_Amnt", govType: "Calamity" },
  "Multi-Purpose": { dbType: "multipurpose", dedCol: "multiPurposeSavings", govType: "Multi-Purpose" },
  "Eastwest Loan": { dbType: "eastwest", dedCol: "eastwest_Loan" }
};

// ── Get Loan History for Matrix ──────────────────────────────────────────────
exports.getLoanHistory = async (req, res) => {
  const { type } = req.query;
  const config = loanTypeMapper[type];
  if (!config) return res.status(400).json({ error: "Invalid loan type." });

  try {
    // 1. Dedicated Ledger Tables
    if (type === "Cash Advance") {
      const history = await sequelize.query(
        `SELECT "date", "user_Id", "amount" FROM "Payroll_Cash_Advances" ORDER BY "date" ASC`,
        { type: QueryTypes.SELECT }
      );
      return res.status(200).json(history);
    }

    if (type === "Eastwest Loan") {
      const history = await sequelize.query(
        `SELECT "date", "user_Id", "amount" FROM "Payroll_Eastwest" ORDER BY "date" ASC`,
        { type: QueryTypes.SELECT }
      );
      return res.status(200).json(history);
    }

    // 2. Government Loan Ledger
    if (config.govType) {
      const history = await sequelize.query(
        `SELECT "date", "user_Id", "amount" FROM "Payroll_GovernmentLoans" WHERE "government_type" = :govType ORDER BY "date" ASC`,
        { replacements: { govType: config.govType }, type: QueryTypes.SELECT }
      );

      // Fallback for transition period: pull from Payroll_Deductions if ledger is empty
      if (history.length === 0) {
         const legacyHistory = await sequelize.query(
          `SELECT p."period_End" as date, p."user_Id", pd."${config.dedCol}" as amount
           FROM "Payroll" p
           JOIN "Payroll_Deductions" pd ON p."payrollId" = pd."payrollId"
           WHERE pd."${config.dedCol}" > 0
           ORDER BY p."period_End" ASC`,
          { type: QueryTypes.SELECT }
        );
        return res.status(200).json(legacyHistory);
      }
      return res.status(200).json(history);
    }

    return res.status(400).json({ error: "Loan type not supported by ledger." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Sync Loan History from Matrix ─────────────────────────────────────────────
exports.syncLoanHistory = async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: "Updates array required." });

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    let totalUpdated = 0;
    for (const item of updates) {
      const { date, user_Id, amount, type } = item;
      const config = loanTypeMapper[type];
      if (!config) continue;

      // 1. Update Ledger (Source of Truth)
      if (type === "Cash Advance") {
        await sequelize.query(
          `INSERT INTO "Payroll_Cash_Advances" ("user_Id", "date", "amount", "createdAt", "updatedAt")
           VALUES (:user_Id, :date, :amount, :now, :now)
           ON CONFLICT ("user_Id", "date") DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = EXCLUDED."updatedAt"`,
          { replacements: { user_Id, date, amount, now: nowStr } }
        );
        await sequelize.query(
          `UPDATE "User_Deduction_Profile" SET "advances_Amnt" = :amount, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { amount, user_Id, now: nowStr }, type: QueryTypes.UPDATE }
        );
        totalUpdated++;
      }
      else if (type === "Eastwest Loan") {
        await sequelize.query(
          `INSERT INTO "Payroll_Eastwest" ("user_Id", "date", "amount", "createdAt", "updatedAt")
           VALUES (:user_Id, :date, :amount, :now, :now)
           ON CONFLICT ("user_Id", "date") DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = EXCLUDED."updatedAt"`,
          { replacements: { user_Id, date, amount, now: nowStr } }
        );
        await sequelize.query(
          `UPDATE "User_Deduction_Profile" SET "eastwest_Loan" = :amount, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { amount, user_Id, now: nowStr }, type: QueryTypes.UPDATE }
        );
        totalUpdated++;
      }
      else if (config.govType) {
        await sequelize.query(
          `INSERT INTO "Payroll_GovernmentLoans" ("user_Id", "government_type", "date", "amount", "createdAt", "updatedAt")
           VALUES (:user_Id, :govType, :date, :amount, :now, :now)
           ON CONFLICT ("user_Id", "date", "government_type") DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = EXCLUDED."updatedAt"`,
          { replacements: { user_Id, govType: config.govType, date, amount, now: nowStr } }
        );
        totalUpdated++;
      }

      // 2. Update Payroll_Deductions (if payroll record already exists)
      const [_, metadata] = await sequelize.query(
        `UPDATE "Payroll_Deductions" pd
         SET "${config.dedCol}" = :amount
         FROM "Payroll" p
         WHERE p."payrollId" = pd."payrollId"
         AND p."user_Id" = :user_Id
         AND p."period_End" = :date`,
        { replacements: { amount, user_Id, date }, type: QueryTypes.UPDATE }
      );

      const rowsAffected = metadata?.rowCount || 0;

      // 3. Recalculate Payroll totals (if payroll record already exists)
      if (rowsAffected > 0) {
        await sequelize.query(
          `UPDATE "Payroll" p
           SET "totalDeductions" = (
             SELECT (COALESCE(pd."absence_Amnt", 0) + COALESCE(pd."tardiness_Amnt", 0) + COALESCE(pd."unpaidLeave_Amnt", 0) + COALESCE(pd."SSS_Ded", 0) + COALESCE(pd."Philhealth_Ded", 0) + COALESCE(pd."HDMF_Ded", 0) + COALESCE(pd."Tax_Ded", 0) + COALESCE(pd."healthCard_Amnt", 0) + COALESCE(pd."SSS_Loan", 0) + COALESCE(pd."HDMF_Loan", 0) + COALESCE(pd."calamityLoan_Amnt", 0) + COALESCE(pd."multiPurposeSavings", 0) + COALESCE(pd."advances_Amnt", 0) + COALESCE(pd."globe_Deduction", 0) + COALESCE(pd."eastwest_Loan", 0))
             FROM "Payroll_Deductions" pd WHERE pd."payrollId" = p."payrollId"
           ),
           "netPay" = p."totalEarnings" - (
             SELECT (COALESCE(pd."absence_Amnt", 0) + COALESCE(pd."tardiness_Amnt", 0) + COALESCE(pd."unpaidLeave_Amnt", 0) + COALESCE(pd."SSS_Ded", 0) + COALESCE(pd."Philhealth_Ded", 0) + COALESCE(pd."HDMF_Ded", 0) + COALESCE(pd."Tax_Ded", 0) + COALESCE(pd."healthCard_Amnt", 0) + COALESCE(pd."SSS_Loan", 0) + COALESCE(pd."HDMF_Loan", 0) + COALESCE(pd."calamityLoan_Amnt", 0) + COALESCE(pd."multiPurposeSavings", 0) + COALESCE(pd."advances_Amnt", 0) + COALESCE(pd."globe_Deduction", 0) + COALESCE(pd."eastwest_Loan", 0))
             FROM "Payroll_Deductions" pd WHERE pd."payrollId" = p."payrollId"
           )
           WHERE p."user_Id" = :user_Id AND p."period_End" = :date`,
          { replacements: { user_Id, date }, type: QueryTypes.UPDATE }
        );
      }
    }

    res.status(200).json({ message: "History synced successfully.", updatedCount: totalUpdated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ── Get Maxicare History for Matrix ──────────────────────────────────────────
exports.getMaxicareHistory = async (req, res) => {
  try {
    const history = await sequelize.query(
      `SELECT 
         "max_Month" as date,
         "user_Id",
         "amount",
         "maxi_status" as status
       FROM "Payroll_maxicare"
       ORDER BY "max_Month" ASC`,
      { type: QueryTypes.SELECT }
    );

    const employees = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", d."healthCard_Amnt"
       FROM "User" u
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       WHERE u."dailyRate" > 0 AND u."deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json({ history, employees });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
