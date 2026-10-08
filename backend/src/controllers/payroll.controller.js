const { sequelize, SystemSettings } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { 
  sendPayrollEmail, 
  sendTerminationNoticeEmail, 
  sendTerminationRescissionEmail 
} = require("../utils/emailService");
const { generatePayslipPDF, generateDetailedPayslipPDF } = require("../utils/pdfGenerator");
const { generatePayslipPassword } = require("../utils/payslipPassword");
const { generateDTRPDF } = require("../utils/dtrGenerator");
const { decrypt } = require("../utils/encryption");
const { saveFileToArchive } = require("../utils/fileStorage");
const { resolvePaydaySchedule } = require("../utils/paydayResolver");

// ... (rest of imports remains similar)
const { getAttendanceReportInternal } = require("./attendance.controller");
const { logAudit, logTransaction } = require("../utils/logger");
const { computeMonthlyShares, computePeriodTax } = require("../utils/govtDeductions");
const { generatePayrollSummaryPDF } = require("../utils/payrollSummaryGenerator");
const { generateGovLoanReportPDF, generateIndividualLoanPDF, generateEastwestLoanReportPDF } = require("../utils/loanReportGenerator");
const { queueSlotDeletion } = require("./rfid.controller");
const { 
  toCents, 
  fromCents, 
  roundMoney, 
  addMoney, 
  subtractMoney, 
  multiplyMoney, 
  divideMoney 
} = require("../utils/financialHelper");
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
      const detailedPdfBuffer = await generateDetailedPayslipPDF(fullStats, pdfPassword);
      archive.append(pdfBuffer, { name: `Payslip_${p.user_LastName}_${p.user_Id}.pdf` });
      archive.append(detailedPdfBuffer, { name: `Payslip_${p.user_LastName}_${p.user_Id}_Detailed.pdf` });
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

  // 1.05 Standard semi-monthly cutoff attendance window & rollover configuration
  const settings = await SystemSettings.findOne();
  const bufferDays = (settings && settings.payrollCutoffBufferDays !== undefined && settings.payrollCutoffBufferDays !== null) 
    ? parseInt(settings.payrollCutoffBufferDays, 10) 
    : 2;

  const [sY, sM, sD] = period_Start.split("-").map(Number);
  const [eY, eM, eD] = period_End.split("-").map(Number);

  const isPeriod1 = (sD === 1 && eD === 15);
  const isPeriod2 = (sD === 16);
  const isStandardSemiMonthly = isPeriod1 || isPeriod2;

  let evaluation_End = period_End;
  let hasRollover = false;
  let rollover_Start = null;
  let rollover_End = null;

  if (isPeriod1) {
    // Period 1 (1st to 15th): attendance is evaluated from day 1 to (15 - bufferDays).
    const evalEndDay = Math.max(1, 15 - bufferDays);
    evaluation_End = `${sY}-${String(sM).padStart(2, "0")}-${String(evalEndDay).padStart(2, "0")}`;
    hasRollover = bufferDays > 0;
    
    // Rollover window from previous month tail (last bufferDays of previous month)
    const prevMonthLastDate = new Date(sY, sM - 1, 0);
    const prevLastDay = prevMonthLastDate.getDate();
    const prevMonth = prevMonthLastDate.getMonth() + 1;
    const prevYear = prevMonthLastDate.getFullYear();
    
    if (bufferDays > 0) {
      rollover_Start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLastDay - bufferDays + 1).padStart(2, "0")}`;
      rollover_End = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;
    }
  } else if (isPeriod2) {
    // Period 2 (16th to End): attendance is evaluated from day 16 to (End - bufferDays).
    const evalEndDay = Math.max(16, eD - bufferDays);
    evaluation_End = `${eY}-${String(eM).padStart(2, "0")}-${String(evalEndDay).padStart(2, "0")}`;
    hasRollover = bufferDays > 0;
    
    // Rollover window from current month Period 1 tail (days (15 - bufferDays + 1) to 15)
    if (bufferDays > 0) {
      rollover_Start = `${sY}-${String(sM).padStart(2, "0")}-${String(15 - bufferDays + 1).padStart(2, "0")}`;
      rollover_End = `${sY}-${String(sM).padStart(2, "0")}-15`;
    }
  }

  // 1.1 Check if user has attendance exemption (is_time_exempt)
  const [empPosition] = await sequelize.query(
    `SELECT "position", "department", "is_time_exempt" FROM "User" WHERE "user_Id" = :user_Id LIMIT 1`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );
  const isPresident = empPosition?.is_time_exempt === true;

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

  // 3. Get attendance logs from the reporting table (which stores units)
  const logs = await sequelize.query(
    `SELECT
       "log_Date"::text AS log_date,
       "time_Logged_inArr",
       "time_Logged_outArr",
       "attendance_StatusId" as att_status,
       COALESCE("reg_hrs", 0) as reg_hrs,
       COALESCE("nd_hrs", 0) as nd_hrs,
       COALESCE("ot_hrs", 0) as ot_hrs,
       COALESCE("holiday_hrs", 0) as holiday_hrs,
       COALESCE("total_payable_hrs", 0) as total_units
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

  // 4. Get approved leaves (Vacation, Sick, Emergency, Half-Day, Statutory)
  const approvedLeaveDaysMap = new Map(); 
  const leaveRecords = await sequelize.query(
    `SELECT "StartDate", "EndDate", "WithPayID", 1.0 as "amount" FROM "Vacation_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)
     UNION
     SELECT "StartDate", "EndDate", "WithPayID", 1.0 as "amount" FROM "Sick_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)
     UNION
     SELECT "DateOfLeave" as "StartDate", "DateOfLeave" as "EndDate", "WithPayID", 1.0 as "amount" FROM "Emergency_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)
     UNION
     SELECT "DateOfLeave" as "StartDate", "DateOfLeave" as "EndDate", "WithPayID", 0.5 as "amount" FROM "HalfDay_Leave" 
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)
     UNION
     SELECT "StartDate", "EndDate", "WithPayID", 1.0 as "amount" FROM "Statutory_Leave"
     WHERE "user_Id" = :user_Id AND "emp_reqId" IN (SELECT "emp_reqId" FROM "emp_Request" WHERE "emp_reqStatusId" = 2)`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );
  leaveRecords.forEach(lr => {
    const sStr = typeof lr.StartDate === 'string' ? lr.StartDate.substring(0, 10) : new Date(lr.StartDate).toISOString().split('T')[0];
    const eStr = typeof lr.EndDate === 'string' ? lr.EndDate.substring(0, 10) : new Date(lr.EndDate).toISOString().split('T')[0];
    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);
    let curr = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    while(curr <= end) {
      approvedLeaveDaysMap.set(curr.toISOString().split('T')[0], { 
        withPay: lr.WithPayID === 1,
        amount: parseFloat(lr.amount)
      });
      curr.setUTCDate(curr.getUTCDate() + 1);
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
  let legalHol_Days = 0;     
  let specialHol_Days = 0;   
  let legalHol_NotWorked = 0; 
  let specialHol_NotWorked = 0; 
  let actual_Worked_Days = 0; 
  let actual_Worked_Hrs = 0;
  
  // Precise Units
  let total_nd_units = 0;
  let total_ot_units = 0;
  let total_hol_units = 0;
  let total_legal_hol_units = 0;
  let total_special_hol_units = 0;
  let total_payable_units = 0;
  const holidayBreakdown = [];

  for (let i = 0; i < allDays.length; i++) {
    const dateStr = allDays[i];
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    // 2-Day Cutoff attendance window: dates in the buffer tail are not penalized as absences
    // and their variable premiums (OT/ND/Holidays) roll over into the next period.
    if (isStandardSemiMonthly && dateStr > evaluation_End) {
      continue;
    }

    const holiday = holidayMap[dateStr];
    const log = logMap[dateStr];
    const isOnField = onfieldMap.has(dateStr);
    
    // Check whether actual physical work punches exist
    let hasActualPunches = false;
    if (log) {
      try {
        const inArr = JSON.parse(log.time_Logged_inArr || "[]");
        const outArr = JSON.parse(log.time_Logged_outArr || "[]");
        hasActualPunches = (inArr.length > 0 && inArr.some(t => t && t !== "—")) || (outArr.length > 0 && outArr.some(t => t && t !== "—"));
      } catch (e) {
        hasActualPunches = false;
      }
    }

    // Status 7 is Incidental Visit (<3hrs on leave), should be ignored for worked time
    // Status 3 is Absent
    // Status 5 is On Leave (if without actual work scans and no stored units, treat as unworked so leave credits apply)
    const isExcludedStatus = log && (
      parseInt(log.att_status) === 3 || 
      parseInt(log.att_status) === 7 ||
      (parseInt(log.att_status) === 5 && !hasActualPunches && parseFloat(log.total_units || 0) <= 0)
    );
    const worked = (!!log && !isExcludedStatus && (hasActualPunches || parseFloat(log.total_units || 0) > 0)) || isOnField;
    const isLeave = approvedLeaveDaysMap.has(dateStr);

    if (worked) {
      let dailyHrs = 0;
      let dailyUnits = 0;

      if (isOnField) {
        dailyHrs = 8.0;
        dailyUnits = 8.0;
      } else if (log) {
        // Use stored values if available
        // Check total_units first, but only if NOT status 7 (already handled by isExcludedStatus)
        if (parseFloat(log.total_units) > 0) {
          dailyHrs = parseFloat(log.reg_hrs);
          dailyUnits = parseFloat(log.total_units);
          total_nd_units += parseFloat(log.nd_hrs);
          total_ot_units += parseFloat(log.ot_hrs);
          total_hol_units += parseFloat(log.holiday_hrs);
        } else {
          // Fallback logic for older records - only run if status is NOT excluded
          const inArr = JSON.parse(log.time_Logged_inArr || "[]");
          const isExempt = parseInt(log.att_status) === 6;
          const SLOT_MIDPOINT = "12:30";
          const morningIn = inArr.find(t => t.substring(0, 5) < SLOT_MIDPOINT);
          const afternoonIn = inArr.find(t => t.substring(0, 5) >= "12:00" && t.substring(0, 5) < "17:30");

          if (morningIn && morningIn !== "—") {
            dailyHrs += 4.0;
            const [lh, lm] = morningIn.split(":").map(Number);
            const loginMinutes = lh * 60 + lm;
            const graceMinutes = 8 * 60 + 35;
            if (loginMinutes > graceMinutes && !isExempt) {
              const minsLate = Math.max(0, loginMinutes - graceMinutes);
              tardiness_Mins += minsLate;
              dailyHrs = Math.max(0, dailyHrs - (minsLate / 60));
            }
          }
          if (afternoonIn && afternoonIn !== "—") dailyHrs += 4.0;
          dailyUnits = dailyHrs; 
        }
      }
      
      const threshold = settings?.workHourThreshold !== undefined ? parseFloat(settings.workHourThreshold) : 4.0;
      if (dailyHrs < threshold && !isPresident) {
        dailyHrs = 0;
        dailyUnits = (log ? (parseFloat(log.ot_hrs || 0) + parseFloat(log.nd_hrs || 0) + parseFloat(log.holiday_hrs || 0)) : 0);
      }

      const dayPortion = dailyHrs >= 7 ? 1.0 : (dailyHrs >= threshold ? 0.5 : 0.0);
      actual_Worked_Days += dayPortion;
      actual_Worked_Hrs += dailyHrs;
      total_payable_units += dailyUnits;

      if (dayPortion < 1.0 && !isPresident) {
        if (isLeave) {
          const leaveData = approvedLeaveDaysMap.get(dateStr);
          const leavePortion = Math.min(1.0 - dayPortion, leaveData.amount || 1.0);
          if (leaveData.withPay) {
            paidLeave_Days += leavePortion;
            total_payable_units += leavePortion * 8; // Credit payable hours for the paid leave portion
          } else {
            unpaidLeave_Days += leavePortion;
          }
        } else {
          absence_Days += (1.0 - dayPortion);
        }
      }

      if (holiday) {
        const isRegular = holiday.type === "Regular Holiday";
        const loggedHolHours = parseFloat(log?.holiday_hrs || 0);
        // If logged holiday units exist, use them; otherwise fallback to standard premium units (1.0x for regular, 0.3x for special)
        const holHours = loggedHolHours > 0 ? loggedHolHours : (isRegular ? dailyHrs * 1.0 : dailyHrs * 0.3);

        if (isRegular) {
          legalHol_Days++;
          total_legal_hol_units += holHours;
        } else {
          specialHol_Days++;
          total_special_hol_units += holHours;
        }

        holidayBreakdown.push({
          holidayId: holiday.holidayId,
          name: holiday.name || (isRegular ? "Regular Holiday" : "Special Holiday"),
          date: dateStr,
          type: holiday.type,
          worked: true,
          hoursWorked: dailyHrs,
          premiumHours: holHours,
          multiplier: isRegular ? 2.0 : 1.3,
          premiumRate: isRegular ? 1.0 : 0.3
        });
      }
      continue; 
    }

    if (holiday) {
      if (!isFuture) {
        const isRegular = holiday.type === "Regular Holiday";
        if (isRegular) {
          actual_Worked_Days++;
          actual_Worked_Hrs += WORK_HRS_PER_DAY;
          total_payable_units += WORK_HRS_PER_DAY;
          legalHol_NotWorked++;
          holidayBreakdown.push({
            holidayId: holiday.holidayId,
            name: holiday.name || "Regular Holiday",
            date: dateStr,
            type: holiday.type,
            worked: false,
            hoursWorked: 0,
            premiumHours: 0,
            multiplier: 1.0,
            premiumRate: 0,
            note: "Unworked Regular Holiday (100% in Basic Pay)"
          });
        } else {
          specialHol_NotWorked++;
          holidayBreakdown.push({
            holidayId: holiday.holidayId,
            name: holiday.name || "Special Holiday",
            date: dateStr,
            type: holiday.type,
            worked: false,
            hoursWorked: 0,
            premiumHours: 0,
            multiplier: 0,
            premiumRate: 0,
            note: "Unworked Special Holiday (No work, no pay)"
          });
        }
      }
      continue; 
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (dateObj.getUTCDay() === 0) continue;

    if (isLeave) {
      const leaveData = approvedLeaveDaysMap.get(dateStr);
      if (leaveData.withPay) {
        paidLeave_Days += leaveData.amount;
        total_payable_units += leaveData.amount * 8; // Convert day to hours
      } else {
        unpaidLeave_Days += leaveData.amount;
      }
      continue;
    }

    if (!isFuture) {
      if (!log) {
        const isAfterCutoff = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 30);
        if (!isToday || isAfterCutoff) absence_Days++;
      } else if (log.att_status === 3) {
        absence_Days++;
      }
    }
  }

  // 6. Manual OT Check (Legacy/Backup)
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
    const log = logMap[dateStr];
    // Only add if not already captured by the precise calculation
    if (!log || log.ot_hrs === 0) {
      const presenceLog = await sequelize.query(
        `SELECT "time_Logged" FROM "user_logging"
         WHERE "user_id" = :user_Id AND "log_Date"::date = :dateStr::date
         AND "logged_StatusId" IN (2, 4, 6, 11)
         AND "time_Logged" > :otStart
         ORDER BY "time_Logged" DESC LIMIT 1`,
        { replacements: { user_Id, dateStr, otStart: req.HrFrom }, type: QueryTypes.SELECT }
      );
      if (presenceLog.length > 0) verified_OT_Hrs += parseFloat(req.Total_Hrs);
    }
  }

  // 7. Rollover Window Processing (Carry-over OT, Night Diff, and Holiday units from previous cutoff tail)
  let rollover_ot_hrs = 0;
  let rollover_nd_hrs = 0;
  let rollover_hol_hrs = 0;
  let rollover_legal_hol_hrs = 0;
  let rollover_special_hol_hrs = 0;
  const rolloverBreakdown = [];

  if (hasRollover && rollover_Start && rollover_End) {
    const rolloverLogs = await sequelize.query(
      `SELECT
         "log_Date"::text AS log_date,
         "time_Logged_inArr",
         "time_Logged_outArr",
         "attendance_StatusId" as att_status,
         COALESCE("reg_hrs", 0) as reg_hrs,
         COALESCE("nd_hrs", 0) as nd_hrs,
         COALESCE("ot_hrs", 0) as ot_hrs,
         COALESCE("holiday_hrs", 0) as holiday_hrs,
         COALESCE("total_payable_hrs", 0) as total_units
       FROM "employee_Logging_report"
       WHERE "user_id" = :user_Id
       AND "log_Date" BETWEEN :rollover_Start AND :rollover_End`,
      { replacements: { user_Id, rollover_Start, rollover_End }, type: QueryTypes.SELECT }
    );
    const rolloverLogMap = {};
    rolloverLogs.forEach((l) => {
      const dStr = typeof l.log_date === 'string' ? l.log_date : l.log_date.toISOString().split('T')[0];
      rolloverLogMap[dStr] = l;
    });

    const rolloverHolidays = await sequelize.query(
      `SELECT *, "date"::text FROM "Holiday" WHERE "date" BETWEEN :rollover_Start AND :rollover_End`,
      { replacements: { rollover_Start, rollover_End }, type: QueryTypes.SELECT }
    );
    const rolloverHolidayMap = {};
    rolloverHolidays.forEach((h) => {
      const dStr = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
      rolloverHolidayMap[dStr] = h;
    });

    const rolloverDaysResult = await sequelize.query(
      `SELECT generate_series(
         :rollover_Start::date,
         :rollover_End::date,
         '1 day'::interval
       )::date::text AS work_date`,
      { replacements: { rollover_Start, rollover_End }, type: QueryTypes.SELECT }
    );
    const rolloverDays = rolloverDaysResult.map(d => d.work_date);

    for (const rDateStr of rolloverDays) {
      const rLog = rolloverLogMap[rDateStr];
      const rHoliday = rolloverHolidayMap[rDateStr];

      if (rLog) {
        const rOt = parseFloat(rLog.ot_hrs || 0);
        const rNd = parseFloat(rLog.nd_hrs || 0);
        const rRegHrs = parseFloat(rLog.reg_hrs || 0);

        if (rOt > 0) {
          rollover_ot_hrs += rOt;
          total_ot_units += rOt;
          total_payable_units += rOt;
        }

        if (rNd > 0) {
          rollover_nd_hrs += rNd;
          total_nd_units += rNd;
        }

        if (rHoliday) {
          const isRegular = rHoliday.type === "Regular Holiday";
          const loggedHolHours = parseFloat(rLog.holiday_hrs || 0);
          const holHours = loggedHolHours > 0 ? loggedHolHours : (isRegular ? rRegHrs * 1.0 : rRegHrs * 0.3);

          if (isRegular) {
            legalHol_Days++;
            rollover_legal_hol_hrs += holHours;
            total_legal_hol_units += holHours;
          } else {
            specialHol_Days++;
            rollover_special_hol_hrs += holHours;
            total_special_hol_units += holHours;
          }
          rollover_hol_hrs += holHours;

          holidayBreakdown.push({
            holidayId: rHoliday.holidayId,
            name: `${rHoliday.name || (isRegular ? "Regular Holiday" : "Special Holiday")} (Rollover from ${rDateStr})`,
            date: rDateStr,
            type: rHoliday.type,
            worked: true,
            hoursWorked: rRegHrs,
            premiumHours: holHours,
            multiplier: isRegular ? 2.0 : 1.3,
            premiumRate: isRegular ? 1.0 : 0.3,
            isRollover: true
          });
        }

        if (rOt > 0 || rNd > 0 || (rHoliday && rRegHrs > 0)) {
          rolloverBreakdown.push({
            date: rDateStr,
            ot_hrs: rOt,
            nd_hrs: rNd,
            reg_hrs: rRegHrs,
            holidayName: rHoliday ? rHoliday.name : null
          });
        }
      }
    }

    const rolloverOTRequests = await sequelize.query(
      `SELECT ot.* FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
       WHERE ot."user_Id" = :user_Id
       AND ot."OT_DateOf" BETWEEN :rollover_Start AND :rollover_End
       AND er."emp_reqStatusId" = 2`,
      { replacements: { user_Id, rollover_Start, rollover_End }, type: QueryTypes.SELECT }
    );

    for (const req of rolloverOTRequests) {
      const dateStr = typeof req.OT_DateOf === 'string' ? req.OT_DateOf : req.OT_DateOf.toISOString().split('T')[0];
      const rLog = rolloverLogMap[dateStr];
      if (!rLog || parseFloat(rLog.ot_hrs || 0) === 0) {
        const presenceLog = await sequelize.query(
          `SELECT "time_Logged" FROM "user_logging"
           WHERE "user_id" = :user_Id AND "log_Date"::date = :dateStr::date
           AND "logged_StatusId" IN (2, 4, 6, 11)
           AND "time_Logged" > :otStart
           ORDER BY "time_Logged" DESC LIMIT 1`,
          { replacements: { user_Id, dateStr, otStart: req.HrFrom }, type: QueryTypes.SELECT }
        );
        if (presenceLog.length > 0) {
          const reqHrs = parseFloat(req.Total_Hrs || 0);
          rollover_ot_hrs += reqHrs;
          total_ot_units += reqHrs;
          total_payable_units += reqHrs;
          rolloverBreakdown.push({
            date: dateStr,
            ot_hrs: reqHrs,
            nd_hrs: 0,
            reg_hrs: 0,
            isManual: true
          });
        }
      }
    }
  }

  if (isPresident) {
    absence_Days = 0;
    tardiness_Mins = 0;
    unpaidLeave_Days = 0;
    actual_Worked_Days = totalScheduledDays;
    actual_Worked_Hrs = totalScheduledDays * 8.0;
    total_payable_units = totalScheduledDays * 8.0;
  }

  return {
    NoDays_Worked: actual_Worked_Days,
    NoHrs_Worked: Math.round(actual_Worked_Hrs * 100) / 100,
    Total_Payable_Units: Math.round(total_payable_units * 100) / 100,
    nd_hrs: Math.round(total_nd_units * 100) / 100,
    ot_hrs: Math.round(total_ot_units * 100) / 100,
    holiday_hrs: Math.round(total_hol_units * 100) / 100,
    legal_hol_hrs: Math.round(total_legal_hol_units * 100) / 100,
    special_hol_hrs: Math.round(total_special_hol_units * 100) / 100,
    rollover_ot_hrs: Math.round(rollover_ot_hrs * 100) / 100,
    rollover_nd_hrs: Math.round(rollover_nd_hrs * 100) / 100,
    rollover_hol_hrs: Math.round(rollover_hol_hrs * 100) / 100,
    rollover_period: hasRollover ? { start: rollover_Start, end: rollover_End } : null,
    rolloverBreakdown,
    evaluation_End,
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
    OT_Hrs_Manual: verified_OT_Hrs,
    workedHolidays: { regular: legalHol_Days, special: specialHol_Days },
    holidayBreakdown
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
    `SELECT u."dailyRate", u."previousDailyRate", u."position", u."department",
            d."sss_Share", d."sss_is_manual", d."philhealth_Share", d."ph_is_manual", d."hdmf_Share", d."hdmf_is_manual", d."tax_Share",
            d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", d."calamityLoan_Amnt",
            d."advances_Amnt", d."globe_Deduction", d."multiPurposeSavings", d."eastwest_Loan"
     FROM "User" u
     LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
     WHERE u."user_Id" = :user_Id`,
    { replacements: { user_Id }, type: QueryTypes.SELECT }
  );

  if (dailyRate === null || isNaN(dailyRate)) dailyRate = parseFloat(user[0]?.dailyRate || 0);
  const previousDailyRate = parseFloat(user[0]?.previousDailyRate || 0);
  
  // ── "Both Relation" Matrix Synchronization Logic ────────────────────────────
  const { computeMonthlySharesAsync } = require("../utils/govtDeductions");
  const dynamicShares = await computeMonthlySharesAsync(dailyRate, period_End);


  // Check if period ends on 15th for government deductions
  // Use string splitting to be robust against timezone shifts
  const periodEndParts = String(period_End).split('-');
  const periodEndDay = parseInt(periodEndParts[periodEndParts.length - 1]);
  const isMidMonth = periodEndDay === 15;

  // SSS Selection
  if (user[0]?.sss_is_manual) {
    sss_Share = isMidMonth ? (user[0]?.sss_Share || 0) : 0;
    SSS_Ded_ER = isMidMonth ? dynamicShares.employer_sss : 0;
  } else {
    sss_Share = isMidMonth ? dynamicShares.sss_Share : 0;
    SSS_Ded_ER = isMidMonth ? dynamicShares.employer_sss : 0;
  }

  // PhilHealth Selection
  if (user[0]?.ph_is_manual) {
    philhealth_Share = isMidMonth ? (user[0]?.philhealth_Share || 0) : 0;
    Philhealth_Ded_ER = isMidMonth ? dynamicShares.employer_ph : 0;
  } else {
    philhealth_Share = isMidMonth ? dynamicShares.philhealth_Share : 0;
    Philhealth_Ded_ER = isMidMonth ? dynamicShares.employer_ph : 0;
  }

  // HDMF Selection
  if (user[0]?.hdmf_is_manual) {
    hdmf_Share = isMidMonth ? (user[0]?.hdmf_Share || 0) : 0;
    HDMF_Ded_ER = isMidMonth ? dynamicShares.employer_hdmf : 0;
  } else {
    hdmf_Share = isMidMonth ? dynamicShares.hdmf_Share : 0;
    HDMF_Ded_ER = isMidMonth ? dynamicShares.employer_hdmf : 0;
  }
  // ────────────────────────────────────────────────────────────────────────────

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
    if (govLoanRecords.length > 0) {
      sLoan = 0; hLoan = 0; cLoan = 0; mpSave = 0;
      govLoanRecords.forEach(record => {
        const type = record.government_type;
        if (type === 'SSS' || type === 'SSS Salary' || type === 'SSS Conso Loan') sLoan += record.amount;
        else if (type === 'Pag-IBIG' || type === 'Pag-IBIG MPL') hLoan += record.amount;
        else if (type === 'Calamity' || type === 'SSS Calamity' || type === 'Pag-IBIG Calamity' || type === 'SSS Emergency') cLoan += record.amount;
        else if (type === 'Multi-Purpose') mpSave += record.amount;
      });
    }
  } catch (err) {
    console.error("[GOV LOAN LEDGER CHECK ERROR]:", err.message);
    sLoan = user[0]?.SSS_Loan || 0;
    hLoan = user[0]?.HDMF_Loan || 0;
    cLoan = user[0]?.calamityLoan_Amnt || 0;
    mpSave = user[0]?.multiPurposeSavings || 0;
  }
  // ────────────────────────────────────────────────────────────────────────────

  gDed = user[0]?.globe_Deduction || 0;

  const ratePerHr = divideMoney(dailyRate, WORK_HRS_PER_DAY);
  const ratePerMin = divideMoney(ratePerHr, 60);

  // 1. Basic Pay (Assumption: Full Attendance Basic)
  const potentialBasicPay = multiplyMoney(stats.totalScheduledDays, dailyRate);

  // 2. Holiday Premiums (Using Precise Units)
  const legalHol_Amnt = multiplyMoney(stats.legal_hol_hrs || 0, ratePerHr);
  const specialHol_Amnt = multiplyMoney(stats.special_hol_hrs || 0, ratePerHr);
  const total_hol_Amnt = addMoney(legalHol_Amnt, specialHol_Amnt);

  // 3. OT & Night Diff
  // Retrieve settings to get dynamic multipliers
  const settings = await SystemSettings.findOne();
  const nsdRate = parseFloat(settings?.payrollRates?.otNightRates?.nsdRate ?? 10) / 100; // e.g. 0.10
  const ordinaryOTRate = parseFloat(settings?.payrollRates?.otNightRates?.ordinaryOT ?? 25) / 100; // e.g. 0.25 (Total: 1.25)
  
  const OT_Rate = multiplyMoney(ratePerHr, 1 + ordinaryOTRate);
  const ND_OT_Rate = multiplyMoney(ratePerHr, (1 + ordinaryOTRate) * (1 + nsdRate)); // Logic: 1.25x * 1.1x = 1.375x

  // Logic to separate regular night diff from OT night diff
  // nd_hrs in stats is the total night hours (10PM-6AM)
  // ot_hrs in stats is the total overtime hours
  const night_OT_hrs = Math.min(stats.ot_hrs, stats.nd_hrs);
  const regular_OT_hrs = Math.max(0, stats.ot_hrs - night_OT_hrs);
  const regular_night_hrs = Math.max(0, stats.nd_hrs - night_OT_hrs);

  const OT_Amnt = multiplyMoney(regular_OT_hrs, OT_Rate);
  const nightOT_Amnt = multiplyMoney(night_OT_hrs, ND_OT_Rate);
  const nightDiff_Amnt = multiplyMoney(regular_night_hrs * ratePerHr, nsdRate);

  console.log(`[DEBUG PAYROLL] stats: ot_hrs=${stats.ot_hrs}, nd_hrs=${stats.nd_hrs}`);
  console.log(`[DEBUG PAYROLL] split: regular_OT_hrs=${regular_OT_hrs}, night_OT_hrs=${night_OT_hrs}, regular_night_hrs=${regular_night_hrs}`);
  console.log(`[DEBUG PAYROLL] amounts: OT_Amnt=${OT_Amnt}, nightOT_Amnt=${nightOT_Amnt}, nightDiff_Amnt=${nightDiff_Amnt}`);

  const total_OT_Amnt = addMoney(OT_Amnt, nightOT_Amnt);
  
  // 4. Attendance Deductions (Exempt if is_time_exempt is enabled)
  const isPresident = user[0]?.is_time_exempt === true;
  if (isPresident) {
    stats.absence_Days = 0;
    stats.tardiness_Mins = 0;
    stats.unpaidLeave_Days = 0;
  }

  const absence_Amnt = isPresident ? 0 : multiplyMoney(stats.absence_Days, dailyRate); 
  const tardiness_Amnt = isPresident ? 0 : multiplyMoney(stats.tardiness_Mins, ratePerMin);
  const unpaidLeave_Amnt = isPresident ? 0 : multiplyMoney(stats.unpaidLeave_Days, dailyRate);
  const specialHol_Adj = 0;

  const incentives = roundMoney(customIncentives || 0); 
  const allowance = roundMoney(customAllowance || 0);

  // 4. Actual Earnings & Adjustments
  // "Gross Earnings" should be the potential pay + premiums before ANY deductions (absences/tardiness)
  // This ensures the math (Gross - Total Deductions = Net) is transparent on the payslip.
  let grossEarnings = addMoney(potentialBasicPay, legalHol_Amnt, specialHol_Amnt, nightDiff_Amnt, OT_Amnt, nightOT_Amnt, incentives);
  if (isNaN(grossEarnings) || grossEarnings < 0) grossEarnings = 0;

  // Actual Basic Pay for internal record (Potential - Absences)
  const basicPay = isPresident ? potentialBasicPay : Math.max(0, subtractMoney(potentialBasicPay, absence_Amnt, unpaidLeave_Amnt));

  // 5. Government Deductions
  const govtTotal = grossEarnings > 0 ? addMoney(sss_Share, philhealth_Share, hdmf_Share) : 0;
  
  // 6. Other Deductions
  const personalLoanCombined = addMoney(advAmnt, ewLoan);
  const otherTotal = grossEarnings > 0 ? addMoney(hCard, sLoan, hLoan, cLoan, personalLoanCombined, gDed, mpSave) : 0;

  let Tax_Ded_Final = 0;
  if (grossEarnings > 0 && isMidMonth) {
    if (toCents(tax_Share) > 0) {
      Tax_Ded_Final = roundMoney(tax_Share);
    } else {
      const { computePeriodTaxAsync } = require("../utils/govtDeductions");
      Tax_Ded_Final = await computePeriodTaxAsync(grossEarnings, govtTotal, period_End, period_Start, true);
    }
  }
 

  // Total Deductions includes everything: Absences, Tardiness, Gov't, and Loans
  const totalDeductions = addMoney(absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt, govtTotal, otherTotal, Tax_Ded_Final);

  // Final Net Pay calculation: (Gross - Total Deductions) + Non-taxable Allowance
  let netPay = addMoney(subtractMoney(grossEarnings, totalDeductions), allowance);
  if (isNaN(netPay) || netPay < 0) netPay = 0;

  const decoratedHolidayBreakdown = (stats.holidayBreakdown || []).map(h => {
    let amount = 0;
    let formula = "";
    if (h.worked) {
      if (h.type === "Regular Holiday") {
        amount = (h.premiumHours || 8) * ratePerHr;
        formula = `100% Base in Basic Pay + 100% Regular Holiday Premium: ₱${dailyRate.toFixed(2)} × 1.00 = ₱${amount.toFixed(2)}`;
      } else {
        amount = (h.premiumHours || 2.4) * ratePerHr;
        formula = `100% Base in Basic Pay + 30% Special Premium: (₱${dailyRate.toFixed(2)} × 1.30) - ₱${dailyRate.toFixed(2)} = ₱${amount.toFixed(2)}`;
      }
    } else {
      if (h.type === "Regular Holiday") {
        formula = `Unworked Regular Holiday: 100% Daily Rate (₱${dailyRate.toFixed(2)}) included in Basic Pay`;
      } else {
        formula = `Unworked Special Holiday: No work, no pay`;
      }
    }
    return {
      ...h,
      amount: Math.round(amount * 100) / 100,
      formula
    };
  });

  return {
    ...stats,
    NoDays_Worked: stats.NoDays_Worked, 
    absence_Hrs: stats.absence_Days * 8,
    dailyRate,
    previousDailyRate,
    ratePerHr,
    basicPay: basicPay, 
    potentialBasicPay: potentialBasicPay,
    actualBasicPay: basicPay,
    grossEarnings: grossEarnings, // The full potential amount
    totalEarnings: grossEarnings, // For backward compatibility with some reports
    legalHol_Amnt,
    specialHol_Amnt,
    total_hol_Amnt,
    specialHol_Adj,
    holidayBreakdown: decoratedHolidayBreakdown,
    OT_Hrs: regular_OT_hrs,
    OT_Amnt,
    nightOT_Hrs: night_OT_hrs,
    nightOT_Amnt,
    restDay_OT_Hrs: 0,
    restDay_OT_Amnt: 0,
    nightDiff_Hrs: regular_night_hrs,
    nightDiff_Amnt,
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
    eastwest_Loan: personalLoanCombined, // COMBINED FIELD FOR UI
    multiPurposeSavings: mpSave,
    Tax_Ded: Tax_Ded_Final,
    totalDeductions,
    netPay
  };
}

// ── Internal Helper: Generate Detailed Holiday Breakdown ─────────────────────
async function getHolidayBreakdown(user_Id, period_Start, period_End, dailyRate = 0, ratePerHr = 0, legalHol_Amnt = 0, specialHol_Amnt = 0) {
  try {
    const numDailyRate = parseFloat(dailyRate || 0);
    const numRatePerHr = ratePerHr > 0 ? parseFloat(ratePerHr) : (numDailyRate / WORK_HRS_PER_DAY);

    const holidays = await sequelize.query(
      `SELECT "holidayId", "name", "date"::text as "date", "type" 
       FROM "Holiday" 
       WHERE "date" BETWEEN :period_Start AND :period_End 
       ORDER BY "date"::date ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );
    if (!holidays || holidays.length === 0) return [];

    const logs = await sequelize.query(
      `SELECT "log_Date"::text as log_date, "reg_hrs", "holiday_hrs", "attendance_StatusId"
       FROM "employee_Logging_report"
       WHERE "user_id" = :user_Id AND "log_Date" BETWEEN :period_Start AND :period_End`,
      { replacements: { user_Id, period_Start, period_End }, type: QueryTypes.SELECT }
    );
    const logMap = {};
    logs.forEach(l => {
      const dStr = typeof l.log_date === 'string' ? l.log_date : l.log_date.toISOString().split('T')[0];
      logMap[dStr] = l;
    });

    const breakdown = [];
    for (const h of holidays) {
      const dStr = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
      const log = logMap[dStr];
      const isRegular = h.type === "Regular Holiday";
      const worked = log && (parseInt(log.attendance_StatusId) !== 3 && parseInt(log.attendance_StatusId) !== 7);
      const hours = worked ? parseFloat(log.reg_hrs || 8) : 0;
      
      let amount = 0;
      let formula = "";
      if (worked) {
        if (isRegular) {
          amount = hours * numRatePerHr * 1.0;
          formula = `100% Base in Basic Pay + 100% Regular Holiday Premium: ₱${numDailyRate.toFixed(2)} × 1.00 = ₱${amount.toFixed(2)}`;
        } else {
          amount = hours * numRatePerHr * 0.3;
          formula = `100% Base in Basic Pay + 30% Special Premium: (₱${numDailyRate.toFixed(2)} × 1.30) - ₱${numDailyRate.toFixed(2)} = ₱${amount.toFixed(2)}`;
        }
      } else {
        if (isRegular) {
          formula = `Unworked Regular Holiday: 100% Daily Rate (₱${numDailyRate.toFixed(2)}) included in Basic Pay`;
        } else {
          formula = `Unworked Special Holiday: No work, no pay`;
        }
      }

      breakdown.push({
        holidayId: h.holidayId,
        name: h.name,
        date: dStr,
        type: h.type,
        worked: Boolean(worked),
        hoursWorked: hours,
        amount: Math.round(amount * 100) / 100,
        formula
      });
    }
    return breakdown;
  } catch (err) {
    console.error("[HOLIDAY BREAKDOWN ERROR]:", err);
    return [];
  }
}

// ── Internal Helper: Calculate YTD ───────────────────────────────────────────
async function calculateYTD(user_Id, period_Start, period_End, currentEarnings, currentAllowance, currentDeductions, currentTax) {
  const year = new Date(period_Start).getFullYear();
  const safeYear = isNaN(year) ? new Date().getFullYear() : year;

  const ytdData = await sequelize.query(
    `SELECT 
       SUM(COALESCE(p."totalEarnings", 0)) as "ytdGross",
       SUM(COALESCE(e."allowance", 0)) as "ytdNonTaxable",
       SUM(COALESCE(p."totalDeductions", 0) - COALESCE(d."Tax_Ded", 0)) as "ytdDeductions",
       SUM(COALESCE(d."Tax_Ded", 0)) as "ytdBIR"
     FROM "Payroll" p
     LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
     LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
     WHERE p."user_Id" = :user_Id 
     AND p."status" IN (2, 3, 4, 5)
     AND EXTRACT(YEAR FROM p."period_Start") = :safeYear
     AND p."period_End" < :period_Start`,
    { 
      replacements: { user_Id, safeYear, period_Start }, 
      type: QueryTypes.SELECT 
    }
  );

  const hist = ytdData[0] || {};
  return {
    ytdGross: Math.round((parseFloat(hist.ytdGross || 0) + parseFloat(currentEarnings || 0)) * 100) / 100,
    ytdNonTaxable: Math.round((parseFloat(hist.ytdNonTaxable || 0) + parseFloat(currentAllowance || 0)) * 100) / 100,
    ytdDeductions: Math.round((parseFloat(hist.ytdDeductions || 0) + (parseFloat(currentDeductions || 0) - parseFloat(currentTax || 0))) * 100) / 100,
    ytdBIR: Math.round((parseFloat(hist.ytdBIR || 0) + parseFloat(currentTax || 0)) * 100) / 100
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
    
    // Add YTD to preview
    const ytd = await calculateYTD(
      user_Id, 
      period_Start, 
      period_End, 
      fullStats.totalEarnings, 
      fullStats.allowance, 
      fullStats.totalDeductions, 
      fullStats.Tax_Ded
    );

    res.status(200).json({ ...fullStats, ...ytd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Payroll Preview Batch (High Performance for Current/Draft Period) ───────
exports.getPayrollPreviewBatch = async (req, res) => {
  const { period_Start, period_End } = req.query;
  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    // 1. Fetch all active employees eligible for payroll in this period
    const employees = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."dailyRate", u."taxStatus"
       FROM "User" u
       WHERE (u."deletedAt" IS NULL OR u."deletedAt" >= :period_Start)
         AND (u."hireDate" IS NULL OR u."hireDate" <= :period_End)
         AND u."dailyRate" > 0
         AND u."user_Id" != 999
       ORDER BY u."user_LastName" ASC, u."user_FirstName" ASC`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );

    if (employees.length === 0) {
      return res.status(200).json({
        employees: [],
        totalNetPay: 0,
        totalEarnings: 0,
        totalDeductions: 0
      });
    }

    // 2. Compute previews in concurrent chunks of 6 to protect database connection pool
    const chunkSize = 6;
    const results = [];

    for (let i = 0; i < employees.length; i += chunkSize) {
      const chunk = employees.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (emp) => {
          try {
            const fullStats = await calculatePayrollStats(emp.user_Id, period_Start, period_End);
            return {
              payrollId: `preview-${emp.user_Id}`,
              user_FirstName: emp.user_FirstName,
              user_LastName: emp.user_LastName,
              user_Id: emp.user_Id,
              period_Start,
              period_End,
              NoDays_Worked: fullStats.NoDays_Worked,
              NoHrs_Worked: fullStats.NoHrs_Worked,
              totalScheduledDays: fullStats.totalScheduledDays,
              potentialBasicPay: fullStats.potentialBasicPay || (fullStats.totalScheduledDays ? fullStats.totalScheduledDays * emp.dailyRate : emp.dailyRate * 13),
              basicPay: fullStats.basicPay,
              totalEarnings: fullStats.totalEarnings,
              grossEarnings: fullStats.grossEarnings || fullStats.totalEarnings,
              totalDeductions: fullStats.totalDeductions,
              netPay: fullStats.netPay,
              dailyRate: emp.dailyRate,
              taxStatus: emp.taxStatus,
              PaystatusName: "Draft"
            };
          } catch (err) {
            console.error(`[PREVIEW BATCH ERROR for User ${emp.user_Id}]:`, err.message);
            return null;
          }
        })
      );
      results.push(...chunkResults.filter(Boolean));
    }

    // 3. Compute grand totals
    let totalNetPay = 0;
    let totalEarnings = 0;
    let totalDeductions = 0;

    for (const item of results) {
      totalNetPay = addMoney(totalNetPay, item.netPay);
      totalEarnings = addMoney(totalEarnings, item.totalEarnings);
      totalDeductions = addMoney(totalDeductions, item.totalDeductions);
    }

    res.status(200).json({
      employees: results,
      totalNetPay,
      totalEarnings,
      totalDeductions
    });
  } catch (error) {
    console.error("[GET PAYROLL PREVIEW BATCH ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Generate Batch Payroll (Internal) ───────────────────────────────────────
async function generateBatchPayrollInternal(period_Start, period_End, adminId = 1, shouldRelease = false, customDailyRate = null, targetUserId = null, awaitReleaseTasks = false) {
  const now = await getSystemTime();
  const nowStr = formatForSQL(now);

  const periodRow = await sequelize.query(
    `SELECT "periodId" FROM "PayrollPeriod" 
     WHERE "startDate" = :period_Start AND "endDate" = :period_End LIMIT 1`,
    { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
  );
  const periodId = periodRow.length > 0 ? periodRow[0].periodId : null;

  let employeeQuery = `
    SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."user_Email", u."dailyRate",
           d."sss_Share", d."philhealth_Share", d."hdmf_Share", b."account_Number"
     FROM "User" u
     LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
     LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
     WHERE (u."deletedAt" IS NULL OR u."deletedAt" >= :period_Start)
       AND (u."hireDate" IS NULL OR u."hireDate" <= :period_End)
       AND u."dailyRate" > 0
       AND u."user_Id" != 999
   `;
  
  const replacements = { period_Start, period_End, periodId: periodId || -1 };
  if (targetUserId) {
    employeeQuery += ` AND u."user_Id" = :targetUserId`;
    replacements.targetUserId = targetUserId;
  }
  employeeQuery += ` ORDER BY u."user_Id" ASC`;

  const employees = await sequelize.query(employeeQuery, { replacements, type: QueryTypes.SELECT });

  let processedCount = 0;
  let skippedCount = 0;
  const newPayrollsForEmail = [];

  for (const emp of employees) {
    const existing = await sequelize.query(
      `SELECT "payrollId", "status" FROM "Payroll" 
       WHERE "user_Id" = :user_Id 
       AND (("period_Start" = :period_Start AND "period_End" = :period_End) OR ("periodId" = :periodId))`,
      { replacements: { user_Id: emp.user_Id, period_Start, period_End, periodId: periodId || -1 }, type: QueryTypes.SELECT }
    );

    if (existing.length > 0) {
      if (existing[0].status === 5) {
        skippedCount++;
        continue;
      }

      // Recompute stats fresh from user_logging, requests, loans & rates
      const existingPayrollId = existing[0].payrollId;
      const rateToUse = customDailyRate !== null ? customDailyRate : emp.dailyRate;
      const fullStats = await calculatePayrollStats(emp.user_Id, period_Start, period_End, rateToUse);
      const targetStatus = shouldRelease ? 5 : 1;

      await sequelize.query(
        `UPDATE "Payroll" SET 
          "NoDays_Worked" = :NoDays_Worked, "NoHrs_Worked" = :NoHrs_Worked, "totalScheduledDays" = :totalScheduledDays,
          "dailyRate" = :dailyRate, "previousDailyRate" = :previousDailyRate, "ratePerHr" = :ratePerHr,
          "basicPay" = :basicPay, "totalEarnings" = :totalEarnings, "totalDeductions" = :totalDed, "netPay" = :netPay,
          "holidaysTotal" = :holidaysTotal, "holidaysRegularWorked" = :holidaysRegularWorked, "holidaysSpecialWorked" = :holidaysSpecialWorked,
          "status" = :targetStatus, "updatedAt" = :now
         WHERE "payrollId" = :payrollId`,
        {
          replacements: {
            payrollId: existingPayrollId,
            NoDays_Worked: fullStats.NoDays_Worked, NoHrs_Worked: fullStats.NoHrs_Worked,
            totalScheduledDays: fullStats.totalScheduledDays,
            dailyRate: fullStats.dailyRate, previousDailyRate: fullStats.previousDailyRate,
            ratePerHr: fullStats.ratePerHr,
            basicPay: fullStats.basicPay, totalEarnings: fullStats.totalEarnings,
            totalDed: fullStats.totalDeductions, netPay: fullStats.netPay,
            holidaysTotal: fullStats.holidaysTotal || 0,
            holidaysRegularWorked: fullStats.legalHol_Days || 0,
            holidaysSpecialWorked: fullStats.specialHol_Days || 0,
            targetStatus,
            now: nowStr
          },
          type: QueryTypes.UPDATE
        }
      );

      await sequelize.query(
        `UPDATE "Payroll_Earnings" SET
          "OT_Hrs" = :OT_Hrs, "OT_Amnt" = :OT_Amnt, 
          "nightOT_Hrs" = :nightOT_Hrs, "nightOT_Amnt" = :nightOT_Amnt,
          "nightDiff_Hrs" = :nightDiff_Hrs, "nightDiff_Amnt" = :nightDiff_Amnt,
          "legalHol_Amnt" = :legalHol_Amnt, "specialHol_Amnt" = :specialHol_Amnt, "specialHol_Adj" = :specialHol_Adj
         WHERE "payrollId" = :payrollId`,
        {
          replacements: {
            payrollId: existingPayrollId,
            OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
            nightOT_Hrs: fullStats.nightOT_Hrs, nightOT_Amnt: fullStats.nightOT_Amnt,
            nightDiff_Hrs: fullStats.nightDiff_Hrs, nightDiff_Amnt: fullStats.nightDiff_Amnt,
            legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt, specialHol_Adj: fullStats.specialHol_Adj
          },
          type: QueryTypes.UPDATE
        }
      );

      await sequelize.query(
        `UPDATE "Payroll_Deductions" SET
          "absence_Hrs" = :absence_Hrs, "absence_Amnt" = :absence_Amnt,
          "tardiness_Mins" = :tardiness_Mins, "tardiness_Amnt" = :tardiness_Amnt,
          "unpaidLeave_Days" = :unpaidLeave_Days, "unpaidLeave_Amnt" = :unpaidLeave_Amnt, "paidLeave_Days" = :paidLeave_Days,
          "SSS_Ded" = :sss, "Philhealth_Ded" = :ph, "HDMF_Ded" = :hd, "Tax_Ded" = :tax,
          "SSS_Ded_ER" = :sssER, "Philhealth_Ded_ER" = :phER, "HDMF_Ded_ER" = :hdER,
          "healthCard_Amnt" = :hc, "SSS_Loan" = :sl, "HDMF_Loan" = :hl, "calamityLoan_Amnt" = :cl,
          "multiPurposeSavings" = :ms, "advances_Amnt" = :aa, "globe_Deduction" = :gd, "eastwest_Loan" = :el
         WHERE "payrollId" = :payrollId`,
        {
          replacements: {
            payrollId: existingPayrollId,
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
          type: QueryTypes.UPDATE
        }
      );

      if (shouldRelease) {
        await sequelize.query(
          `UPDATE "User_Deduction_Profile" SET "advances_Amnt" = 0, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id: emp.user_Id, now: nowStr }, type: QueryTypes.UPDATE }
        );

        newPayrollsForEmail.push({
          emp,
          payrollId: existingPayrollId,
          fullStats
        });
      }

      processedCount++;
      continue;
    }

    // Use custom rate if provided, else use current employee rate
    const rateToUse = customDailyRate !== null ? customDailyRate : emp.dailyRate;
    const fullStats = await calculatePayrollStats(emp.user_Id, period_Start, period_End, rateToUse);

    const initialStatus = shouldRelease ? 5 : 1;
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
         :initialStatus, :now, :now)
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
          initialStatus,
          now: nowStr
        },
        type: QueryTypes.INSERT
      }
    );

    const payrollId = payrollResult[0][0].payrollId;

    await sequelize.query(
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "nightOT_Hrs", "nightOT_Amnt", "nightDiff_Hrs", "nightDiff_Amnt", "legalHol_Amnt", "specialHol_Amnt", "specialHol_Adj")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :nightOT_Hrs, :nightOT_Amnt, :nightDiff_Hrs, :nightDiff_Amnt, :legalHol_Amnt, :specialHol_Amnt, :specialHol_Adj)`,
      { 
        replacements: { 
          payrollId, user_Id: emp.user_Id, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          nightOT_Hrs: fullStats.nightOT_Hrs, nightOT_Amnt: fullStats.nightOT_Amnt,
          nightDiff_Hrs: fullStats.nightDiff_Hrs, nightDiff_Amnt: fullStats.nightDiff_Amnt,
          legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt, specialHol_Adj: fullStats.specialHol_Adj
        },
        type: QueryTypes.INSERT 
      }
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

    // ── Auto-record/link to Ledger Tables ─────────────────────────────────
    // 1. Government Loans Link & Balance Update
    if (fullStats.SSS_Loan > 0 || fullStats.HDMF_Loan > 0 || fullStats.calamityLoan_Amnt > 0) {
      // Link Ledger
      await sequelize.query(
        `UPDATE "Payroll_GovernmentLoans" SET "payrollId" = :payrollId
         WHERE "user_Id" = :user_Id AND "date" = :period_End`,
        { replacements: { payrollId, user_Id: emp.user_Id, period_End }, type: QueryTypes.UPDATE }
      );

      // Update Master Balances & History
      const loanMappings = [
        { amount: fullStats.SSS_Loan, types: ['sss_loan', 'sss_conso'], label: 'SSS Loan' },
        { amount: fullStats.HDMF_Loan, types: ['hdmf_loan'], label: 'Pag-IBIG Loan' },
        { amount: fullStats.calamityLoan_Amnt, types: ['calamity', 'sss_emergency', 'hdmf_calamity'], label: 'Calamity Loan' }
      ];

      for (const m of loanMappings) {
        if (m.amount > 0) {
          const activeLoan = await sequelize.query(
            `SELECT id, "remainingBalance" FROM "Loan_Deductions" 
             WHERE "userId" = :user_Id AND "deductionType" IN (:types) AND "status" = 'active' LIMIT 1`,
            { replacements: { user_Id: emp.user_Id, types: m.types }, type: QueryTypes.SELECT }
          );
          if (activeLoan.length > 0) {
            const loanId = activeLoan[0].id;
            const newBalance = Math.max(0, subtractMoney(activeLoan[0].remainingBalance, m.amount));
            const status = newBalance <= 0 ? 'completed' : 'active';

            await sequelize.query(
              `UPDATE "Loan_Deductions" SET "remainingBalance" = :newBalance, "status" = :status, "updatedAt" = :now
               WHERE id = :loanId`,
              { replacements: { newBalance, status, loanId, now: nowStr }, type: QueryTypes.UPDATE }
            );

            console.log(`[DEBUG LOAN] User ${emp.user_Id}: Deducted ${m.amount} for ${m.label}. New Balance: ${newBalance}`);

            await sequelize.query(
              `INSERT INTO "Loan_Deduction_History" ("loanDeductionId", "payrollId", "amountDeducted", "balanceAfter", "deductionDate", "createdAt")
               VALUES (:loanId, :payrollId, :amount, :balanceAfter, :date, :now)`,
              { replacements: { loanId, payrollId, amount: m.amount, balanceAfter: newBalance, date: period_End, now: nowStr }, type: QueryTypes.INSERT }
            );
          }
        }
      }
    }

    // 2. Cash Advance Link
    await sequelize.query(
      `UPDATE "Payroll_Cash_Advances" SET "payrollId" = :payrollId
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { payrollId, user_Id: emp.user_Id, period_End }, type: QueryTypes.UPDATE }
    );

    // 2.5 Eastwest / Company Loan Link
    await sequelize.query(
      `UPDATE "Payroll_Eastwest" SET "payrollId" = :payrollId
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { payrollId, user_Id: emp.user_Id, period_End }, type: QueryTypes.UPDATE }
    );

    // 2.7 DOLE Art. 113 Non-Statutory Deduction Authorization Verification & Audit
    const hasNonStatutory = (parseFloat(fullStats.eastwest_Loan || 0) > 0 || parseFloat(fullStats.advances_Amnt || 0) > 0);
    if (hasNonStatutory) {
      try {
        const approvedReq = await sequelize.query(
          `SELECT "emp_reqId" FROM "emp_Request" 
           WHERE "user_Id" = :user_Id AND "emp_reqTypeId" IN (13, 14) AND "emp_reqStatusId" = 2 
           ORDER BY "emp_reqId" DESC LIMIT 1`,
          { replacements: { user_Id: emp.user_Id }, type: QueryTypes.SELECT }
        );
        const isAuthorizedByRequest = approvedReq.length > 0;
        await logAudit(
          req,
          req?.user?.user_Id || 1,
          "Payroll",
          "DEDUCTION_AUTHORIZATION_VERIFY",
          "Payroll",
          payrollId,
          null,
          {
            userId: emp.user_Id,
            eastwest_Loan: fullStats.eastwest_Loan,
            advances_Amnt: fullStats.advances_Amnt,
            compliance: "DOLE Art. 113 & DO 195",
            authorizedByEmployeeRequest: isAuthorizedByRequest,
            authorizationBasis: isAuthorizedByRequest ? `Approved Employee Request #${approvedReq[0].emp_reqId}` : "Administrative Profile Record"
          }
        );
      } catch (authLogErr) {
        console.warn(`[DOLE AUDIT WARN] Failed to log deduction authorization for User ${emp.user_Id}:`, authLogErr.message);
      }
    }

    // 3. Maxicare Auto-record
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

    if (shouldRelease) {
      await sequelize.query(
        `UPDATE "User_Deduction_Profile" SET "advances_Amnt" = 0, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id: emp.user_Id, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }
  }

  if (shouldRelease) {
    if (periodId) {
      await sequelize.query(
        `UPDATE "PayrollPeriod" SET "status" = 'Released', "updatedAt" = :now WHERE "periodId" = :periodId`,
        { replacements: { periodId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }
    
    // Also mark individual payrolls as released (status 5 = Released in Payroll_status)
    await sequelize.query(
      `UPDATE "Payroll" SET "status" = 5, "updatedAt" = :now WHERE "period_Start" = :period_Start AND "period_End" = :period_End`,
      { replacements: { period_Start, period_End, now: nowStr }, type: QueryTypes.UPDATE }
    );
  }

  // Handle release tasks (archival, emails)
  if (newPayrollsForEmail.length > 0 && shouldRelease) {
    const processReleaseTasks = async () => {
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

          const payslipPayload = {
            ...fullStats,
            user_FirstName: emp.user_FirstName,
            user_LastName: emp.user_LastName,
            user_Position: emp.position,
            period_Start,
            period_End,
            accountNo: decrypt(emp.account_Number) || "—"
          };

          const payslipBuffer = await generatePayslipPDF(payslipPayload, pdfPassword);
          const detailedPayslipBuffer = await generateDetailedPayslipPDF(payslipPayload, pdfPassword);

          const dtrBuffer = await generateDTRPDF({
            employee: emp,
            dtrData,
            period_Start,
            period_End,
            fullStats: fullStats
          });

          const dateObj = new Date(period_End);
          const archiveOpts = {
            year: dateObj.getFullYear(),
            month: formatMonthFolder(dateObj),
            subFolder: getPeriodFolder(period_Start, period_End)
          };

          await saveFileToArchive(payslipBuffer, `Payslip_${emp.user_LastName}_${emp.user_Id}.pdf`, archiveOpts);
          await saveFileToArchive(detailedPayslipBuffer, `Payslip_${emp.user_LastName}_${emp.user_Id}_Detailed.pdf`, archiveOpts);
          await saveFileToArchive(dtrBuffer, `DTR_${emp.user_LastName}_${emp.user_Id}.pdf`, archiveOpts);

          // Email sending (only if not skipped)
          if (process.env.SKIP_EMAILS !== 'true') {
            await sendPayrollEmail({
              email: emp.user_Email,
              name: `${emp.user_FirstName} ${emp.user_LastName}`,
              period: `${period_Start} to ${period_End}`,
              netPay: fullStats.netPay,
              attachments: [
                { filename: `Payslip_${emp.user_LastName}.pdf`, content: payslipBuffer },
                { filename: `Payslip_${emp.user_LastName}_Detailed.pdf`, content: detailedPayslipBuffer },
                { filename: `DTR_${emp.user_LastName}.pdf`, content: dtrBuffer }
              ]
            });
          }
        } catch (taskErr) {
          console.error(`[RELEASE ARCHIVE ERROR] for ${item.emp?.user_Email || item.emp?.user_Id}:`, taskErr.message);
        }
      }

      // Archival logic for summary report
      try {
        const dateObj = new Date(period_End);
        const archiveOpts = {
          year: dateObj.getFullYear(),
          month: formatMonthFolder(dateObj),
          subFolder: getPeriodFolder(period_Start, period_End)
        };

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
      } catch (archErr) {
        console.error(`[INTERNAL BATCH ARCHIVE ERROR]:`, archErr.message);
      }
    };

    if (awaitReleaseTasks) {
      await processReleaseTasks();
    } else {
      processReleaseTasks().catch(err => console.error('[ASYNC RELEASE ERROR]:', err));
    }
  }

  const aggResult = await sequelize.query(
    `SELECT 
       COALESCE(SUM("netPay"), 0)::float as "totalNetPay",
       COALESCE(SUM("totalEarnings"), 0)::float as "totalEarnings",
       COALESCE(SUM("totalDeductions"), 0)::float as "totalDeductions",
       COUNT(*)::int as "totalCount"
     FROM "Payroll"
     WHERE ("period_Start" = :period_Start AND "period_End" = :period_End)
        OR ("periodId" = :periodId)`,
    { replacements: { period_Start, period_End, periodId: periodId || -1 }, type: QueryTypes.SELECT }
  );

  const totalNetPay = aggResult[0]?.totalNetPay || 0;
  const totalEarnings = aggResult[0]?.totalEarnings || 0;
  const totalDeductions = aggResult[0]?.totalDeductions || 0;
  const totalCount = aggResult[0]?.totalCount || processedCount;

  return { 
    processedCount, 
    skippedCount, 
    periodId, 
    totalNetPay, 
    totalEarnings, 
    totalDeductions, 
    totalCount,
    status: shouldRelease ? 'Released' : 'Draft' 
  };
}

exports.generateBatchPayrollInternal = generateBatchPayrollInternal;
exports.calculatePayrollStats = calculatePayrollStats;

// ── Generate Batch Payroll ──────────────────────────────────────────────────
exports.generateBatchPayroll = async (req, res) => {
  const { period_Start, period_End, shouldRelease } = req.body;
  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    const releaseNow = Boolean(shouldRelease);
    const result = await generateBatchPayrollInternal(period_Start, period_End, currentAdminId, releaseNow);

    await logTransaction(
      null, 
      currentAdminId, 
      releaseNow ? "BATCH_PAYROLL_RELEASE" : "BATCH_PAYROLL_GEN", 
      `${releaseNow ? "Released and locked" : "Generated draft"} batch payroll for period ${period_Start} to ${period_End}`, 
      { processedCount: result.processedCount, periodId: result.periodId, status: result.status }, 
      req
    );

    const message = releaseNow
      ? `Batch payroll successfully released and locked for ${result.processedCount || result.totalCount} employees. Records locked and payslip emails dispatched.`
      : `Batch draft calculated for ${result.processedCount} employees (${result.skippedCount} existing drafts skipped).`;

    res.status(201).json({ 
      message, 
      processed: result.processedCount, 
      skipped: result.skippedCount,
      totalCount: result.totalCount,
      totalNetPay: result.totalNetPay,
      totalEarnings: result.totalEarnings,
      totalDeductions: result.totalDeductions,
      status: result.status,
      periodId: result.periodId
    });
  } catch (error) {
    console.error("[generateBatchPayroll ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.releaseBatchPayroll = async (req, res) => {
  req.body.shouldRelease = true;
  return exports.generateBatchPayroll(req, res);
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
           "nightOT_Hrs" = :nightOT_Hrs, "nightOT_Amnt" = :nightOT_Amnt,
           "nightDiff_Hrs" = :nightDiff_Hrs, "nightDiff_Amnt" = :nightDiff_Amnt,
           "legalHol_Amnt" = :legalHol_Amnt, "specialHol_Amnt" = :specialHol_Amnt,
           "specialHol_Adj" = :specialHol_Adj
       WHERE "payrollId" = :payrollId`,
      { replacements: { 
          payrollId, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          nightOT_Hrs: fullStats.nightOT_Hrs, nightOT_Amnt: fullStats.nightOT_Amnt,
          nightDiff_Hrs: fullStats.nightDiff_Hrs, nightDiff_Amnt: fullStats.nightDiff_Amnt,
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
      `INSERT INTO "Payroll_Earnings" ("payrollId", "user_Id", "OT_Hrs", "OT_Amnt", "nightOT_Hrs", "nightOT_Amnt", "nightDiff_Hrs", "nightDiff_Amnt", "legalHol_Amnt", "specialHol_Amnt", "specialHol_Adj")
       VALUES (:payrollId, :user_Id, :OT_Hrs, :OT_Amnt, :nightOT_Hrs, :nightOT_Amnt, :nightDiff_Hrs, :nightDiff_Amnt, :legalHol_Amnt, :specialHol_Amnt, :specialHol_Adj)`,
      { 
        replacements: { 
          payrollId, user_Id, 
          OT_Hrs: fullStats.OT_Hrs, OT_Amnt: fullStats.OT_Amnt,
          nightOT_Hrs: fullStats.nightOT_Hrs, nightOT_Amnt: fullStats.nightOT_Amnt,
          nightDiff_Hrs: fullStats.nightDiff_Hrs, nightDiff_Amnt: fullStats.nightDiff_Amnt,
          legalHol_Amnt: fullStats.legalHol_Amnt, specialHol_Amnt: fullStats.specialHol_Amnt, specialHol_Adj: fullStats.specialHol_Adj
        },
        type: QueryTypes.INSERT 
      }
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

        const payslipPayload = {
          ...fullStats,
          user_FirstName: emp.user_FirstName,
          user_LastName: emp.user_LastName,
          user_Position: emp.position,
          period_Start,
          period_End,
          accountNo: decrypt(emp.account_Number) || "—"
        };

        const payslipBuffer = await generatePayslipPDF(payslipPayload, pdfPassword);
        const detailedPayslipBuffer = await generateDetailedPayslipPDF(payslipPayload, pdfPassword);

        const dtrBuffer = await generateDTRPDF({
          employee: { user_Id, ...emp },
          dtrData,
          period_Start,
          period_End,
          fullStats: fullStats
        });

        // ── Archive to PC Drive ──────────────────────────────────────────
        const dateObj = new Date(period_End);
        const archiveOpts = {
          year: dateObj.getFullYear(),
          month: formatMonthFolder(dateObj),
          subFolder: getPeriodFolder(period_Start, period_End)
        };

        await saveFileToArchive(payslipBuffer, `Payslip_${emp.user_LastName}_${user_Id}.pdf`, archiveOpts);
        await saveFileToArchive(detailedPayslipBuffer, `Payslip_${emp.user_LastName}_${user_Id}_Detailed.pdf`, archiveOpts);
        await saveFileToArchive(dtrBuffer, `DTR_${emp.user_LastName}_${user_Id}.pdf`, archiveOpts);
        // ──────────────────────────────────────────────────────────────────

        await sendPayrollEmail({
          email: emp.user_Email,
          name: `${emp.user_FirstName} ${emp.user_LastName}`,
          period: `${period_Start} to ${period_End}`,
          netPay: fullStats.netPay,
          attachments: [
            { filename: `Payslip_${emp.user_LastName}.pdf`, content: payslipBuffer },
            { filename: `Payslip_${emp.user_LastName}_Detailed.pdf`, content: detailedPayslipBuffer },
            { filename: `DTR_${emp.user_LastName}.pdf`, content: dtrBuffer }
          ]
        });
      }
    } catch (emailErr) {
      console.error(`[PAYROLL EMAIL ERROR] for user ${user_Id}:`, emailErr.message);
    }
    // ──────────────────────────────────────────────────────────────────────

    // ── Auto-record/link to Ledger Tables ─────────────────────────────────
    // 1. Government Loans Link & Balance Update
    if (fullStats.SSS_Loan > 0 || fullStats.HDMF_Loan > 0 || fullStats.calamityLoan_Amnt > 0) {
      // Link Ledger
      await sequelize.query(
        `UPDATE "Payroll_GovernmentLoans" SET "payrollId" = :payrollId
         WHERE "user_Id" = :user_Id AND "date" = :period_End`,
        { replacements: { payrollId, user_Id, period_End }, type: QueryTypes.UPDATE }
      );

      // Update Master Balances & History
      const loanMappings = [
        { amount: fullStats.SSS_Loan, types: ['sss_loan', 'sss_conso'], label: 'SSS Loan' },
        { amount: fullStats.HDMF_Loan, types: ['hdmf_loan'], label: 'Pag-IBIG Loan' },
        { amount: fullStats.calamityLoan_Amnt, types: ['calamity', 'sss_emergency', 'hdmf_calamity'], label: 'Calamity Loan' }
      ];

      for (const m of loanMappings) {
        if (m.amount > 0) {
          const activeLoan = await sequelize.query(
            `SELECT id, "remainingBalance" FROM "Loan_Deductions" 
             WHERE "userId" = :user_Id AND "deductionType" IN (:types) AND "status" = 'active' LIMIT 1`,
            { replacements: { user_Id, types: m.types }, type: QueryTypes.SELECT }
          );
          if (activeLoan.length > 0) {
            const loanId = activeLoan[0].id;
            const newBalance = Math.max(0, subtractMoney(activeLoan[0].remainingBalance, m.amount));
            const status = newBalance <= 0 ? 'completed' : 'active';

            await sequelize.query(
              `UPDATE "Loan_Deductions" SET "remainingBalance" = :newBalance, "status" = :status, "updatedAt" = :now
               WHERE id = :loanId`,
              { replacements: { newBalance, status, loanId, now: nowStr }, type: QueryTypes.UPDATE }
            );

            console.log(`[DEBUG LOAN] User ${user_Id}: Deducted ${m.amount} for ${m.label}. New Balance: ${newBalance}`);

            await sequelize.query(
              `INSERT INTO "Loan_Deduction_History" ("loanDeductionId", "payrollId", "amountDeducted", "balanceAfter", "deductionDate", "createdAt")
               VALUES (:loanId, :payrollId, :amount, :balanceAfter, :date, :now)`,
              { replacements: { loanId, payrollId, amount: m.amount, balanceAfter: newBalance, date: period_End, now: nowStr }, type: QueryTypes.INSERT }
            );
          }
        }
      }
    }

    // 2. Cash Advance Link
    await sequelize.query(
      `UPDATE "Payroll_Cash_Advances" SET "payrollId" = :payrollId
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { payrollId, user_Id, period_End }, type: QueryTypes.UPDATE }
    );

    // 2.5 Eastwest / Company Loan Link
    await sequelize.query(
      `UPDATE "Payroll_Eastwest" SET "payrollId" = :payrollId
       WHERE "user_Id" = :user_Id AND "date" = :period_End`,
      { replacements: { payrollId, user_Id, period_End }, type: QueryTypes.UPDATE }
    );

    // 2.7 DOLE Art. 113 Non-Statutory Deduction Authorization Verification & Audit
    const hasNonStatutory = (parseFloat(fullStats.eastwest_Loan || 0) > 0 || parseFloat(fullStats.advances_Amnt || 0) > 0);
    if (hasNonStatutory) {
      try {
        const approvedReq = await sequelize.query(
          `SELECT "emp_reqId" FROM "emp_Request" 
           WHERE "user_Id" = :user_Id AND "emp_reqTypeId" IN (13, 14) AND "emp_reqStatusId" = 2 
           ORDER BY "emp_reqId" DESC LIMIT 1`,
          { replacements: { user_Id }, type: QueryTypes.SELECT }
        );
        const isAuthorizedByRequest = approvedReq.length > 0;
        await logAudit(
          req,
          req?.user?.user_Id || 1,
          "Payroll",
          "DEDUCTION_AUTHORIZATION_VERIFY",
          "Payroll",
          payrollId,
          null,
          {
            userId,
            eastwest_Loan: fullStats.eastwest_Loan,
            advances_Amnt: fullStats.advances_Amnt,
            compliance: "DOLE Art. 113 & DO 195",
            authorizedByEmployeeRequest: isAuthorizedByRequest,
            authorizationBasis: isAuthorizedByRequest ? `Approved Employee Request #${approvedReq[0].emp_reqId}` : "Administrative Profile Record"
          }
        );
      } catch (authLogErr) {
        console.warn(`[DOLE AUDIT WARN] Failed to log deduction authorization for User ${user_Id}:`, authLogErr.message);
      }
    }

    // 3. Maxicare Auto-record
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
      `SELECT COUNT(*) as count FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0 AND "user_Id" != 999`, 
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
      `UPDATE "Payroll" SET "status" = 5, "updatedAt" = :now WHERE "payrollId" = :payrollId`,
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

    const payslipPayload = {
      ...fullStats,
      user_FirstName: payroll.user_FirstName,
      user_LastName: payroll.user_LastName,
      user_Position: payroll.position || payroll.user_Position,
      accountNo: decrypt(payroll.account_Number) || "—"
    };

    const [payslipBuffer, detailedPayslipBuffer, dtrBuffer] = await Promise.all([
      generatePayslipPDF(payslipPayload, pdfPassword),
      generateDetailedPayslipPDF(payslipPayload, pdfPassword),
      generateDTRPDF({
        employee: payroll,
        dtrData,
        period_Start: payroll.period_Start,
        period_End: payroll.period_End,
        fullStats: fullStats
      })
    ]);

    await sendPayrollEmail({
      email: payroll.user_Email,
      name: `${payroll.user_FirstName} ${payroll.user_LastName}`,
      period: `${payroll.period_Start} to ${payroll.period_End}`,
      netPay: payroll.netPay,
      attachments: [
        { filename: `Payslip_${payroll.user_LastName}.pdf`, content: payslipBuffer },
        { filename: `Payslip_${payroll.user_LastName}_Detailed.pdf`, content: detailedPayslipBuffer },
        { filename: `DTR_${payroll.user_LastName}.pdf`, content: dtrBuffer }
      ]
    });

    res.status(200).json({ message: "Payroll email resent successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Resend Batch Payroll Emails ──────────────────────────────────────────────
exports.resendBatchPayrollEmails = async (req, res) => {
  const { period_Start, period_End } = req.body;
  if (!period_Start || !period_End) {
    return res.status(400).json({ error: "period_Start and period_End are required." });
  }

  try {
    const payrolls = await sequelize.query(
      `SELECT p.*, u."user_FirstName", u."user_LastName", u."user_Email", b."account_Number"
       FROM "Payroll" p
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       WHERE p."period_Start" = :period_Start AND p."period_End" = :period_End
       ORDER BY p."user_Id"`,
      { replacements: { period_Start, period_End }, type: QueryTypes.SELECT }
    );

    if (payrolls.length === 0) {
      return res.status(404).json({ error: "No payroll records found for this period." });
    }

    let successCount = 0;
    const errors = [];

    for (const payroll of payrolls) {
      try {
        const earnings = await sequelize.query(
          `SELECT * FROM "Payroll_Earnings" WHERE "payrollId" = :payrollId`,
          { replacements: { payrollId: payroll.payrollId }, type: QueryTypes.SELECT }
        );
        const deductions = await sequelize.query(
          `SELECT * FROM "Payroll_Deductions" WHERE "payrollId" = :payrollId`,
          { replacements: { payrollId: payroll.payrollId }, type: QueryTypes.SELECT }
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

        const payslipPayload = {
          ...fullStats,
          user_FirstName: payroll.user_FirstName,
          user_LastName: payroll.user_LastName,
          user_Position: payroll.position || payroll.user_Position,
          accountNo: decrypt(payroll.account_Number) || "—"
        };

        const [payslipBuffer, detailedPayslipBuffer, dtrBuffer] = await Promise.all([
          generatePayslipPDF(payslipPayload, pdfPassword),
          generateDetailedPayslipPDF(payslipPayload, pdfPassword),
          generateDTRPDF({
            employee: payroll,
            dtrData,
            period_Start: payroll.period_Start,
            period_End: payroll.period_End,
            fullStats: fullStats
          })
        ]);

        await sendPayrollEmail({
          email: payroll.user_Email,
          name: `${payroll.user_FirstName} ${payroll.user_LastName}`,
          period: `${payroll.period_Start} to ${payroll.period_End}`,
          netPay: payroll.netPay,
          attachments: [
            { filename: `Payslip_${payroll.user_LastName}.pdf`, content: payslipBuffer },
            { filename: `Payslip_${payroll.user_LastName}_Detailed.pdf`, content: detailedPayslipBuffer },
            { filename: `DTR_${payroll.user_LastName}.pdf`, content: dtrBuffer }
          ]
        });

        successCount++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`[BATCH EMAIL ERROR] for payroll ${payroll.payrollId}:`, err.message);
        errors.push({ payrollId: payroll.payrollId, user_Id: payroll.user_Id, error: err.message });
      }
    }

    res.status(200).json({
      message: `Successfully processed and sent ${successCount} of ${payrolls.length} payroll emails.`,
      successCount,
      totalCount: payrolls.length,
      errors
    });
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
         e."nightOT_Hrs", e."nightOT_Amnt",
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt",         e."specialHol_Adj", e."incentives", e."allowance",
         d.*,
         (COALESCE(d."healthCard_Amnt",0) +
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",
         u."user_FirstName", u."user_LastName", u."position" AS "user_Position", u."dailyRate",
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
         p."payrollId", p."user_Id", p."period_Start", p."period_End", 
         p."NoDays_Worked", p."NoHrs_Worked", p."totalScheduledDays",
         p."dailyRate", p."previousDailyRate", p."ratePerHr", 
         p."basicPay", p."totalEarnings", p."totalDeductions", p."netPay",
         p."holidaysTotal", p."holidaysRegularWorked", p."holidaysSpecialWorked",
         p."status", p."createdAt", p."updatedAt",
         
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt",
         e."nightOT_Hrs", e."nightOT_Amnt",
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."specialHol_Adj", e."incentives", e."allowance",
         
         d."absence_Hrs", d."absence_Amnt", d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         d."SSS_Ded", d."Philhealth_Ded", d."HDMF_Ded", 
         d."SSS_Ded_ER", d."Philhealth_Ded_ER", d."HDMF_Ded_ER", 
         d."Tax_Ded", d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", 
         d."calamityLoan_Amnt", d."multiPurposeSavings", d."advances_Amnt", 
         d."globe_Deduction", d."eastwest_Loan",
         
         (COALESCE(d."healthCard_Amnt",0) +
          COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."advances_Amnt",0) + COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",
         u."user_FirstName", u."user_LastName", u."position" AS "user_Position",
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

    const currentPayroll = payroll[0];
    
    // Ensure numeric fields are numbers (sometimes pg returns them as strings)
    const numericFields = [
      "dailyRate", "previousDailyRate", "ratePerHr", "basicPay", "totalEarnings", 
      "totalDeductions", "netPay", "OT_Amnt", "restDay_OT_Amnt", "nightOT_Amnt", 
      "nightDiff_Amnt", "specialHol_Amnt", "legalHol_Amnt", "specialHol_Adj", 
      "incentives", "allowance", "absence_Amnt", "tardiness_Amnt", "unpaidLeave_Amnt",
      "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "SSS_Ded_ER", "Philhealth_Ded_ER", 
      "HDMF_Ded_ER", "Tax_Ded", "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", 
      "calamityLoan_Amnt", "multiPurposeSavings", "advances_Amnt", "globe_Deduction", 
      "eastwest_Loan", "Other_Deductions"
    ];
    
    numericFields.forEach(field => {
      if (currentPayroll[field] !== undefined) {
        currentPayroll[field] = parseFloat(currentPayroll[field] || 0);
      }
    });

    const ytd = await calculateYTD(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.totalEarnings,
      currentPayroll.allowance,
      currentPayroll.totalDeductions,
      currentPayroll.Tax_Ded
    );

    const holidayBreakdown = await getHolidayBreakdown(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.dailyRate,
      currentPayroll.ratePerHr,
      currentPayroll.legalHol_Amnt,
      currentPayroll.specialHol_Amnt
    );

    const result = {
      ...currentPayroll,
      ...ytd,
      holidayBreakdown
    };

    res.status(200).json(result);
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
        e."nightOT_Hrs", e."nightOT_Amnt",
        e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt",        e."specialHol_Adj", e."incentives", e."allowance"
      FROM "Payroll" p
      LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
      LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
      LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
      LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
      LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
      WHERE 1=1
    `;

    const replacements = {};
    if (startDate && startDate !== "undefined" && startDate !== "null") {
      query += ` AND p."period_Start" >= :startDate`;
      replacements.startDate = startDate;
    }
    if (endDate && endDate !== "undefined" && endDate !== "null") {
      query += ` AND p."period_End" <= :endDate`;
      replacements.endDate = endDate;
    }
    if (user_Id && user_Id !== "All Employees" && user_Id !== "all") {
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
    const shares = await computeMonthlyShares(dailyRate);

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

    const { decrypt } = require("../utils/encryption");
    payrollRows = payrollRows.map(row => ({
      ...row,
      accountNo: decrypt(row.accountNo)
    }));

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
         WHERE (u."deletedAt" IS NULL OR u."deletedAt" >= :period_Start)
           AND u."dailyRate" > 0
           AND u."user_Id" != 999
         ORDER BY u."user_Id" ASC`,
        { replacements: { period_Start }, type: QueryTypes.SELECT }
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

    // Fetch Signatures
    const sigUsers = await sequelize.query(
      `SELECT u."user_FirstName", u."user_LastName", u."position", u."department"
       FROM "User" u
       WHERE (u."position" IN ('ACCOUNTING STAFF', 'PRESIDENT') OR (u."position" = 'SUPERVISOR' AND u."department" = 'ADMIN'))
       AND u."deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    const signatures = {
      preparedBy: sigUsers.find(u => u.position === 'ACCOUNTING STAFF') ? `${sigUsers.find(u => u.position === 'ACCOUNTING STAFF').user_FirstName} ${sigUsers.find(u => u.position === 'ACCOUNTING STAFF').user_LastName}` : "Loonie Medina",
      approvedBy: sigUsers.find(u => u.position === 'PRESIDENT') ? `${sigUsers.find(u => u.position === 'PRESIDENT').user_FirstName} ${sigUsers.find(u => u.position === 'PRESIDENT').user_LastName}` : "Kael Voss",
      checkedBy: sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN') ? `${sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN').user_FirstName} ${sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN').user_LastName}` : "Jenny C. Galeon",
      preparedByLabel: "Prepared by",
      approvedByLabel: "Approved by",
      checkedByLabel: "Checked by"
    };

    const pdfBuffer = await generatePayrollSummaryPDF(payrollRows, periodLabel, signatures);

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

    const { decrypt } = require("../utils/encryption");
    payrollRows = payrollRows.map(row => ({
      ...row,
      accountNo: decrypt(row.accountNo)
    }));

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

    // Fetch Signatures
    const sigUsers = await sequelize.query(
      `SELECT u."user_FirstName", u."user_LastName", u."position", u."department"
       FROM "User" u
       WHERE (u."position" IN ('ACCOUNTING STAFF', 'PRESIDENT') OR (u."position" = 'SUPERVISOR' AND u."department" = 'ADMIN'))
       AND u."deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    const signatures = {
      preparedBy: sigUsers.find(u => u.position === 'ACCOUNTING STAFF') ? `${sigUsers.find(u => u.position === 'ACCOUNTING STAFF').user_FirstName} ${sigUsers.find(u => u.position === 'ACCOUNTING STAFF').user_LastName}` : "Loonie Medina",
      approvedBy: sigUsers.find(u => u.position === 'PRESIDENT') ? `${sigUsers.find(u => u.position === 'PRESIDENT').user_FirstName} ${sigUsers.find(u => u.position === 'PRESIDENT').user_LastName}` : "Kael Voss",
      checkedBy: sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN') ? `${sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN').user_FirstName} ${sigUsers.find(u => u.position === 'SUPERVISOR' && u.department === 'ADMIN').user_LastName}` : "Jenny C. Galeon",
      preparedByLabel: "Prepared by",
      approvedByLabel: "Approved by",
      checkedByLabel: "Checked by"
    };

    const { build8PageReportHTML } = require("../utils/payrollSummaryGenerator");
    const html = build8PageReportHTML(payrollRows, periodLabel, signatures);
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
    OT_Hrs, OT_Amnt, nightOT_Hrs, nightOT_Amnt, nightDiff_Hrs, nightDiff_Amnt,
    legalHol_Amnt, specialHol_Amnt, specialHol_Adj, incentives, allowance,
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

    const govtTotal  = addMoney(SSS_Ded, Philhealth_Ded, HDMF_Ded);
    const taxTotal   = roundMoney(Tax_Ded || 0);
    const otherTotal = addMoney(healthCard_Amnt, SSS_Loan, HDMF_Loan, calamityLoan_Amnt, multiPurposeSavings, advances_Amnt, globe_Deduction);
    const attendanceDed = addMoney(absence_Amnt, tardiness_Amnt, unpaidLeave_Amnt);
    
    // Net Pay = (Taxable Income) - (Other + Tax) + Allowance
    const taxableIncome = subtractMoney(totalEarnings, attendanceDed, govtTotal);
    const computedNet = addMoney(subtractMoney(taxableIncome, otherTotal, taxTotal), allowance);

    const computedTotalDed = addMoney(govtTotal, taxTotal, otherTotal, attendanceDed, req.body.eastwest_Loan || 0);

    await sequelize.query(`UPDATE "Payroll" SET "dailyRate"=:dailyRate, "ratePerHr"=:ratePerHr, "NoDays_Worked"=:NoDays_Worked, "NoHrs_Worked"=:NoHrs_Worked, "basicPay"=:basicPay, "totalEarnings"=:totalEarnings, "totalDeductions"=:totalDed, "netPay"=:netPay, "status"=:status, "updatedAt"=:now WHERE "payrollId" = :payrollId`, { replacements: { payrollId, dailyRate, ratePerHr, NoDays_Worked, NoHrs_Worked, basicPay, totalEarnings, totalDed: computedTotalDed, netPay: computedNet, status, now: nowStr }, type: QueryTypes.UPDATE });
    
    await sequelize.query(`UPDATE "Payroll_Earnings" SET "OT_Hrs"=:OT_Hrs, "OT_Amnt"=:OT_Amnt, "nightOT_Hrs"=:nightOT_Hrs, "nightOT_Amnt"=:nightOT_Amnt, "nightDiff_Hrs"=:nightDiff_Hrs, "nightDiff_Amnt"=:nightDiff_Amnt, "legalHol_Amnt"=:legalHol_Amnt, "specialHol_Amnt"=:specialHol_Amnt, "specialHol_Adj"=:specialHol_Adj, "incentives"=:incentives, "allowance"=:allowance WHERE "payrollId" = :payrollId`, { replacements: { payrollId, OT_Hrs, OT_Amnt, nightOT_Hrs, nightOT_Amnt, nightDiff_Hrs, nightDiff_Amnt, legalHol_Amnt, specialHol_Amnt, specialHol_Adj, incentives, allowance }, type: QueryTypes.UPDATE });
    
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
  "SSS": { dbType: "sss_loan", dedCol: "SSS_Loan", govType: "SSS" },
  "SSS Calamity": { dbType: "sss_calamity", dedCol: "calamityLoan_Amnt", govType: "SSS Calamity" },
  "SSS Emergency": { dbType: "sss_emergency", dedCol: "calamityLoan_Amnt", govType: "SSS Emergency" },
  "SSS Conso Loan": { dbType: "sss_conso", dedCol: "SSS_Loan", govType: "SSS Conso Loan" },
  "Pag-IBIG": { dbType: "hdmf_loan", dedCol: "HDMF_Loan", govType: "Pag-IBIG" },
  "Pag-IBIG MPL": { dbType: "pagibig_mpl", dedCol: "HDMF_Loan", govType: "Pag-IBIG MPL" },
  "Pag-IBIG Calamity": { dbType: "pagibig_calamity", dedCol: "calamityLoan_Amnt", govType: "Pag-IBIG Calamity" },
  "Calamity": { dbType: "calamity", dedCol: "calamityLoan_Amnt", govType: "Calamity" },
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
        `SELECT pca."date", pca."user_Id", pca."amount", pca."payrollId",
                u."user_FirstName" || ' ' || u."user_LastName" as "userName"
         FROM "Payroll_Cash_Advances" pca
         JOIN "User" u ON pca."user_Id" = u."user_Id"
         ORDER BY pca."date" ASC`,
        { type: QueryTypes.SELECT }
      );
      return res.status(200).json(history);
    }

    if (type === "Eastwest Loan") {
      const history = await sequelize.query(
        `SELECT pe."date", pe."user_Id", pe."amount", pe."payrollId", 'Eastwest' as "source",
                u."user_FirstName" || ' ' || u."user_LastName" as "userName"
         FROM "Payroll_Eastwest" pe
         JOIN "User" u ON pe."user_Id" = u."user_Id"
         ORDER BY pe."date" ASC`,
        { type: QueryTypes.SELECT }
      );
      return res.status(200).json(history);
    }

    // 2. Government Loan Ledger
    if (config.govType) {
      const history = await sequelize.query(
        `SELECT "date", "user_Id", "amount", "payrollId" FROM "Payroll_GovernmentLoans" WHERE "government_type"::text = :govType ORDER BY "date" ASC`,
        { replacements: { govType: config.govType }, type: QueryTypes.SELECT }
      );

      // Fallback for transition period: pull from Payroll_Deductions if ledger is empty
      if (history.length === 0) {
         const legacyHistory = await sequelize.query(
          `SELECT p."period_End" as date, p."user_Id", pd."${config.dedCol}" as amount, p."payrollId"
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
    console.error(`[ERROR getLoanHistory] type=${type}:`, error.message);
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
      let finalAmount = amount;
      if (config.govType) {
        let categoryTypes = [];
        if (config.dedCol === 'SSS_Loan') categoryTypes = ['SSS', 'SSS Salary'];
        else if (config.dedCol === 'HDMF_Loan') categoryTypes = ['Pag-IBIG', 'Pag-IBIG MPL'];
        else if (config.dedCol === 'calamityLoan_Amnt') categoryTypes = ['Calamity', 'SSS Calamity', 'Pag-IBIG Calamity'];
        else if (config.dedCol === 'multiPurposeSavings') categoryTypes = ['Multi-Purpose'];

        if (categoryTypes.length > 0) {
          const sumRes = await sequelize.query(
            `SELECT SUM("amount") as "total" FROM "Payroll_GovernmentLoans" 
             WHERE "user_Id" = :user_Id AND "date" = :date AND "government_type" IN (:categoryTypes)`,
            { replacements: { user_Id, date, categoryTypes }, type: QueryTypes.SELECT }
          );
          finalAmount = parseFloat(sumRes[0]?.total || 0);
        }
      }

      const [_, metadata] = await sequelize.query(
        `UPDATE "Payroll_Deductions" pd
         SET "${config.dedCol}" = :finalAmount
         FROM "Payroll" p
         WHERE p."payrollId" = pd."payrollId"
         AND p."user_Id" = :user_Id
         AND p."period_End" = :date`,
        { replacements: { finalAmount, user_Id, date }, type: QueryTypes.UPDATE }
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

// ── 13th Month Pay Logic ───────────────────────────────────────────────────

/**
 * Previews 13th Month Pay for all employees for a given year.
 */
exports.getThirteenthMonthPreview = async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: "Year is required." });

  try {
    const preview = await sequelize.query(
      `SELECT 
         u."user_Id", u."user_FirstName", u."user_LastName", u."deletedAt",
         COALESCE(SUM(p."basicPay"), 0) as "totalBasicEarned",
         (COALESCE(SUM(p."basicPay"), 0) / 12) as "computedAmount",
         GREATEST(0, (COALESCE(SUM(p."basicPay"), 0) / 12) - 90000) as "taxableExcess",
         tm."status" as "existingStatus",
         tm."amount" as "savedAmount",
         (
           SELECT json_agg(m ORDER BY (m).month_num)
           FROM (
             SELECT 
               EXTRACT(MONTH FROM p2."period_Start")::int as month_num,
               TO_CHAR(DATE_TRUNC('month', p2."period_Start"), 'Month') as month_name,
               SUM(p2."basicPay") as monthly_basic
             FROM "Payroll" p2
             WHERE p2."user_Id" = u."user_Id" 
               AND EXTRACT(YEAR FROM p2."period_Start") = :year 
               AND p2."status" IN (2, 3, 4, 5)
             GROUP BY month_num, month_name
             ORDER BY month_num
           ) m
         ) as "breakdown"
       FROM "User" u
       LEFT JOIN "Payroll" p ON u."user_Id" = p."user_Id" 
         AND EXTRACT(YEAR FROM p."period_Start") = :year 
         AND p."status" IN (2, 3, 4, 5)
       LEFT JOIN "Payroll_ThirteenthMonth" tm ON u."user_Id" = tm."user_Id" AND tm."year" = :year
       WHERE u."dailyRate" > 0
       GROUP BY u."user_Id", u."user_FirstName", u."user_LastName", tm."status", tm."amount", u."deletedAt"
       HAVING COALESCE(SUM(p."basicPay"), 0) > 0 OR tm."status" IS NOT NULL
       ORDER BY u."user_LastName" ASC`,
      { replacements: { year: parseInt(year) }, type: QueryTypes.SELECT }
    );

    res.status(200).json(preview);
  } catch (error) {
    console.error("[13TH_MONTH_PREVIEW_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generates/Drafts 13th Month Pay records.
 */
exports.generateThirteenthMonth = async (req, res) => {
  const { year, records } = req.body; 
  console.log(`[13TH_MONTH_GEN] Received request for year ${year} with ${records?.length} records`);

  if (!year || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Year and records array are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    let savedCount = 0;
    let skippedCount = 0;

    for (const rec of records) {
      // Basic sanity check
      const basicEarned = parseFloat(rec.totalBasicEarned || 0);
      if (!rec.user_Id || basicEarned <= 0) {
        skippedCount++;
        continue;
      }

      await sequelize.query(
        `INSERT INTO "Payroll_ThirteenthMonth" 
          ("user_Id", "year", "totalBasicEarned", "amount", "taxable_Excess", "status", "createdAt", "updatedAt")
         VALUES 
          (:user_Id, :year, :totalBasicEarned, :amount, :taxable_Excess, 'Draft', :now, :now)
         ON CONFLICT ("user_Id", "year") DO UPDATE SET
          "totalBasicEarned" = EXCLUDED."totalBasicEarned",
          "amount" = EXCLUDED."amount",
          "taxable_Excess" = EXCLUDED."taxable_Excess",
          "updatedAt" = EXCLUDED."updatedAt"
         WHERE "Payroll_ThirteenthMonth"."status" = 'Draft'`,
        { 
          replacements: { 
            user_Id: rec.user_Id, 
            year: parseInt(year), 
            totalBasicEarned: basicEarned, 
            amount: parseFloat(rec.amount || 0), 
            taxable_Excess: parseFloat(rec.taxable_Excess || 0),
            now: nowStr
          },
          type: QueryTypes.INSERT
        }
      );
      savedCount++;
    }

    console.log(`[13TH_MONTH_GEN] Saved: ${savedCount}, Skipped: ${skippedCount}`);

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "13TH_MONTH_GEN", `Generated draft 13th month records for year ${year}`, { year, count: savedCount }, req);

    res.status(201).json({ message: `Successfully saved ${savedCount} 13th month drafts.`, savedCount, skippedCount });
  } catch (error) {
    console.error("[13TH_MONTH_GEN_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Releases 13th Month Pay records for a specific year.
 * This will automatically UPSERT drafts for all eligible employees before releasing.
 */
exports.releaseThirteenthMonth = async (req, res) => {
  const { year } = req.body;
  console.log(`[13TH_MONTH_RELEASE] Processing release for year ${year}`);
  
  if (!year) return res.status(400).json({ error: "Year is required." });

  const t = await sequelize.transaction();
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const parsedYear = parseInt(year);

    // 1. Fetch eligible data (same logic as preview)
    const eligibleRecords = await sequelize.query(
      `SELECT 
         u."user_Id",
         COALESCE(SUM(p."basicPay"), 0) as "totalBasicEarned",
         (COALESCE(SUM(p."basicPay"), 0) / 12) as "computedAmount",
         GREATEST(0, (COALESCE(SUM(p."basicPay"), 0) / 12) - 90000) as "taxableExcess"
       FROM "User" u
       JOIN "Payroll" p ON u."user_Id" = p."user_Id" 
         AND EXTRACT(YEAR FROM p."period_Start") = :year 
         AND p."status" IN (2, 3, 4, 5)
       WHERE u."deletedAt" IS NULL AND u."dailyRate" > 0
       GROUP BY u."user_Id"
       HAVING SUM(p."basicPay") > 0`,
      { replacements: { year: parsedYear }, type: QueryTypes.SELECT, transaction: t }
    );

    if (eligibleRecords.length === 0) {
      await t.rollback();
      return res.status(200).json({ message: "No eligible records found to release.", updatedCount: 0 });
    }

    // 2. Upsert into Payroll_ThirteenthMonth
    for (const rec of eligibleRecords) {
      await sequelize.query(
        `INSERT INTO "Payroll_ThirteenthMonth" 
          ("user_Id", "year", "totalBasicEarned", "amount", "taxable_Excess", "status", "releasedAt", "createdAt", "updatedAt")
         VALUES 
          (:user_Id, :year, :totalBasicEarned, :amount, :taxable_Excess, 'Released', :now, :now, :now)
         ON CONFLICT ("user_Id", "year") DO UPDATE SET
          "totalBasicEarned" = EXCLUDED."totalBasicEarned",
          "amount" = EXCLUDED."amount",
          "taxable_Excess" = EXCLUDED."taxable_Excess",
          "status" = 'Released',
          "releasedAt" = :now,
          "updatedAt" = :now
         WHERE "Payroll_ThirteenthMonth"."status" != 'Released'`,
        { 
          replacements: { 
            user_Id: rec.user_Id, 
            year: parsedYear, 
            totalBasicEarned: parseFloat(rec.totalBasicEarned), 
            amount: parseFloat(rec.computedAmount), 
            taxable_Excess: parseFloat(rec.taxableExcess),
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction: t
        }
      );
    }

    await t.commit();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "13TH_MONTH_RELEASE", `Released 13th month records for year ${year}`, { year, updatedCount: eligibleRecords.length }, req);

    res.status(200).json({ 
      message: `Successfully released ${eligibleRecords.length} 13th month records for ${year}.`, 
      updatedCount: eligibleRecords.length 
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("[13TH_MONTH_RELEASE_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Internal helper to generate/release 13th month pay records during seed or automation
 */
async function releaseThirteenthMonthInternal(year, status = 'Released') {
  const parsedYear = parseInt(year);
  const now = await getSystemTime();
  const nowStr = formatForSQL(now);

  const eligibleRecords = await sequelize.query(
    `SELECT 
       u."user_Id",
       COALESCE(SUM(p."basicPay"), 0) as "totalBasicEarned",
       (COALESCE(SUM(p."basicPay"), 0) / 12) as "computedAmount",
       GREATEST(0, (COALESCE(SUM(p."basicPay"), 0) / 12) - 90000) as "taxableExcess"
     FROM "User" u
     JOIN "Payroll" p ON u."user_Id" = p."user_Id" 
       AND EXTRACT(YEAR FROM p."period_Start") = :year 
       AND p."status" IN (2, 3, 4, 5)
     WHERE u."deletedAt" IS NULL AND u."dailyRate" > 0
     GROUP BY u."user_Id"
     HAVING SUM(p."basicPay") > 0`,
    { replacements: { year: parsedYear }, type: QueryTypes.SELECT }
  );

  for (const rec of eligibleRecords) {
    await sequelize.query(
      `INSERT INTO "Payroll_ThirteenthMonth" 
        ("user_Id", "year", "totalBasicEarned", "amount", "taxable_Excess", "status", "releasedAt", "createdAt", "updatedAt")
       VALUES 
        (:user_Id, :year, :totalBasicEarned, :amount, :taxable_Excess, :status, ${status === 'Released' ? ':now' : 'NULL'}, :now, :now)
       ON CONFLICT ("user_Id", "year") DO UPDATE SET
        "totalBasicEarned" = EXCLUDED."totalBasicEarned",
        "amount" = EXCLUDED."amount",
        "taxable_Excess" = EXCLUDED."taxable_Excess",
        "status" = EXCLUDED."status",
        "releasedAt" = EXCLUDED."releasedAt",
        "updatedAt" = :now`,
      { 
        replacements: { 
          user_Id: rec.user_Id, 
          year: parsedYear, 
          totalBasicEarned: parseFloat(rec.totalBasicEarned), 
          amount: parseFloat(rec.computedAmount), 
          taxable_Excess: parseFloat(rec.taxableExcess),
          status,
          now: nowStr
        },
        type: QueryTypes.INSERT
      }
    );
  }

  return { updatedCount: eligibleRecords.length };
}

exports.releaseThirteenthMonthInternal = releaseThirteenthMonthInternal;

/**
 * Gets 13th Month history.
 */
exports.getThirteenthMonthHistory = async (req, res) => {
  const { year } = req.query;
  try {
    let query = `
      SELECT tm.*, u."user_FirstName", u."user_LastName",
      (
        SELECT json_agg(m ORDER BY (m).month_num)
        FROM (
          SELECT 
            EXTRACT(MONTH FROM p2."period_Start")::int as month_num,
            TO_CHAR(DATE_TRUNC('month', p2."period_Start"), 'Month') as month_name,
            SUM(p2."basicPay") as monthly_basic
          FROM "Payroll" p2
          WHERE p2."user_Id" = tm."user_Id" 
            AND EXTRACT(YEAR FROM p2."period_Start") = tm."year"
            AND p2."status" IN (2, 3, 4, 5)
          GROUP BY month_num, month_name
          ORDER BY month_num
        ) m
      ) as "breakdown"
      FROM "Payroll_ThirteenthMonth" tm
      JOIN "User" u ON tm."user_Id" = u."user_Id"
      WHERE tm."status" = 'Released'
    `;
    const replacements = {};
    if (year) {
      query += ` AND tm."year" = :year`;
      replacements.year = year;
    }
    query += ` ORDER BY tm."year" DESC, u."user_LastName" ASC`;

    const history = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Separation Pay Logic ───────────────────────────────────────────────────

/**
 * Gets all authorized separation causes.
 */
exports.getSeparationCauses = async (req, res) => {
  try {
    const causes = await sequelize.query(`SELECT * FROM "Separation_Cause" ORDER BY "causeId" ASC`, {
      type: QueryTypes.SELECT
    });
    res.status(200).json(causes);
  } catch (error) {
    console.error("[GET_SEPARATION_CAUSES_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Previews Separation Pay for an employee.
 */
exports.getSeparationPayPreview = async (req, res) => {
  const { user_Id, separationDate } = req.query;
  if (!user_Id || !separationDate) {
    return res.status(400).json({ error: "user_Id and separationDate are required." });
  }

  try {
    const userResult = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."hireDate", u."dailyRate",
              0 as "monthlyAllowance"
       FROM "User" u
       LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
       WHERE u."user_Id" = :user_Id LIMIT 1`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    if (userResult.length === 0) return res.status(404).json({ error: "User not found." });
    const user = userResult[0];

    if (!user.hireDate) return res.status(400).json({ error: "User hireDate is missing. Cannot calculate tenure." });

    const start = new Date(user.hireDate);
    const end = new Date(separationDate);

    // Calculate tenure in months
    let diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) diffMonths--;

    // Apply "6 months considered as 1 whole year" rule
    let yearsOfService = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    if (remainingMonths >= 6) yearsOfService++;
    
    // Minimum 1 year for computation if they reached at least 6 months total
    if (yearsOfService === 0 && diffMonths >= 6) yearsOfService = 1;

    const monthlyBasic = (user.dailyRate || 0) * 26;
    const baseSalary = monthlyBasic + (parseFloat(user.monthlyAllowance) || 0);

    // 1. Fetch Leave Balances
    const leaveBalances = await sequelize.query(
      `SELECT "VL_balance", "SL_balance" FROM "Leave_Balance" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const vlBalance = parseFloat(leaveBalances[0]?.VL_balance || 0);
    const slBalance = parseFloat(leaveBalances[0]?.SL_balance || 0);
    const totalLeaveCredits = vlBalance + slBalance;
    const leaveConversion = Math.round(totalLeaveCredits * (user.dailyRate || 0) * 100) / 100;

    // 2. Fetch Final Worked Days Salary (Attendance Audit)
    // Find the end date of the last closed/released payroll for this user up to separation date
    const lastPayroll = await sequelize.query(
      `SELECT MAX(COALESCE(p."period_End", pp."endDate")) as "lastDate" 
       FROM "Payroll" p 
       LEFT JOIN "PayrollPeriod" pp ON p."periodId" = pp."periodId" 
       WHERE p."user_Id" = :user_Id 
         AND p."status" IN (2, 3, 4, 5)
         AND p."period_End" <= :sepDate`,
      { replacements: { user_Id, sepDate: separationDate }, type: QueryTypes.SELECT }
    );
    
    const hasLastPayroll = Boolean(lastPayroll[0]?.lastDate);
    const startDate = hasLastPayroll ? lastPayroll[0].lastDate : user.hireDate;
    const startDateStr = typeof startDate === 'string' ? startDate.split('T')[0] : new Date(startDate).toISOString().split('T')[0];

    const attendanceGap = await sequelize.query(
      `SELECT COUNT(*) as "worked" 
       FROM "employee_Logging_report" 
       WHERE "user_id" = :user_Id 
         AND "log_Date" ${hasLastPayroll ? '>' : '>='} :startDate::date 
         AND "log_Date" <= :sepDate::date
         AND "attendance_StatusId" IN (1, 2, 4, 5, 6)`,
      { 
        replacements: { user_Id, startDate: startDateStr, sepDate: separationDate }, 
        type: QueryTypes.SELECT 
      }
    );

    const workedDaysCount = parseInt(attendanceGap[0]?.worked || 0);
    const finalWorkedSalary = Math.round(workedDaysCount * (user.dailyRate || 0) * 100) / 100;

    // 3. Fetch current year earnings for pro-rated 13th month
    const currentYear = new Date(separationDate).getFullYear();
    const earningsResult = await sequelize.query(
      `SELECT COALESCE(SUM("basicPay"), 0) as "totalBasic"
       FROM "Payroll" 
       WHERE "user_Id" = :user_Id 
         AND EXTRACT(YEAR FROM "period_Start") = :year 
         AND "status" IN (2, 3, 4, 5)
         AND "period_End" <= :sepDate`,
      { replacements: { user_Id, year: currentYear, sepDate: separationDate }, type: QueryTypes.SELECT }
    );
    const totalBasicPayroll = parseFloat(earningsResult[0]?.totalBasic || 0);
    const totalBasicYear = Math.round((totalBasicPayroll + finalWorkedSalary) * 100) / 100;
    const prorated13thMonth = Math.round((totalBasicYear / 12) * 100) / 100;

    // 4. Fetch Outstanding Loans (Mandatory full deduction on separation per SSS rules)
    const activeLoans = await sequelize.query(
      `SELECT "id", "deductionType", "totalAmount", "remainingBalance" 
       FROM "Loan_Deductions" 
       WHERE "userId" = :user_Id AND "status" = 'active'`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const totalLoanBalance = activeLoans.reduce((sum, loan) => sum + parseFloat(loan.remainingBalance || 0), 0);

    // 5. Fetch all causes to generate previews
    const causes = await sequelize.query(`SELECT * FROM "Separation_Cause"`, { type: QueryTypes.SELECT });
    const previews = causes.map(c => {
      const separationPay = Math.max(baseSalary, baseSalary * c.multiplier * yearsOfService);
      const backPayTotal = prorated13thMonth + leaveConversion + finalWorkedSalary;
      const grandTotal = separationPay + backPayTotal;
      const netAmount = Math.max(0, grandTotal - totalLoanBalance);

      return {
        causeId: c.causeId,
        causeName: c.causeName,
        multiplier: c.multiplier,
        amount: separationPay,
        backPayTotal,
        grandTotal,
        loanDeductions: totalLoanBalance,
        netAmount,
        desc: c.description
      };
    });

    return res.status(200).json({
      user_Id: user.user_Id,
      name: `${user.user_LastName}, ${user.user_FirstName}`,
      hireDate: user.hireDate,
      separationDate,
      diffMonths,
      yearsOfService,
      monthlyBasic,
      monthlyAllowance: user.monthlyAllowance || 0,
      baseSalary,
      loanDeductions: totalLoanBalance,
      backPay: {
        prorated13thMonth,
        totalBasicYear,
        leaveConversion,
        vlBalance,
        slBalance,
        workedDaysCount,
        finalWorkedSalary
      },
      preview: previews
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Generates/Drafts Separation Pay record.
 */
exports.generateSeparationPay = async (req, res) => {
  const { user_Id, separationDate, causeId, reason, status } = req.body;
  const targetStatus = status || 'Draft';

  if (!user_Id || !separationDate || !causeId) {
    return res.status(400).json({ error: "user_Id, separationDate, and causeId are required." });
  }

  const t = await sequelize.transaction();
  try {
    const previewRes = await exports.getSeparationPayPreview({ query: { user_Id, separationDate } }, { 
      status: () => ({ json: (d) => d }),
      json: (d) => d
    });

    if (previewRes.error) {
      await t.rollback();
      return res.status(400).json({ error: previewRes.error });
    }

    const selectedCause = previewRes.preview.find(p => p.causeId === parseInt(causeId));
    if (!selectedCause) {
      await t.rollback();
      return res.status(400).json({ error: "Invalid causeId." });
    }
    
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const backPayTotal = addMoney(
      previewRes.backPay.prorated13thMonth,
      previewRes.backPay.leaveConversion,
      previewRes.backPay.finalWorkedSalary
    );

    const grandTotal = addMoney(selectedCause.amount, backPayTotal);
    const loanDeductions = roundMoney(previewRes.loanDeductions || 0);
    const netAmount = Math.max(0, subtractMoney(grandTotal, loanDeductions));

    const result = await sequelize.query(
      `INSERT INTO "Payroll_Separation" 
        ("user_Id", "hireDate", "separationDate", "yearsOfService", "baseSalary", "multiplier", "totalAmount", 
         "backPay_13thMonth", "backPay_LeaveConversion", "finalWorkedSalary", "backPay_Total",
         "loanDeductions", "netAmount",
         "reason", "causeId", "status", "createdAt", "updatedAt")
       VALUES 
        (:user_Id, :hireDate, :separationDate, :yearsOfService, :baseSalary, :multiplier, :totalAmount, 
         :bp13th, :bpLeave, :bpFinalSalary, :bpTotal,
         :loanDeductions, :netAmount,
         :reason, :causeId, :status, :now, :now)
       RETURNING "separationId"`,
      {
        replacements: {
          user_Id,
          hireDate: previewRes.hireDate,
          separationDate,
          yearsOfService: previewRes.yearsOfService,
          baseSalary: previewRes.baseSalary,
          multiplier: selectedCause.multiplier,
          totalAmount: selectedCause.amount,
          bp13th: previewRes.backPay.prorated13thMonth,
          bpLeave: previewRes.backPay.leaveConversion,
          bpFinalSalary: previewRes.backPay.finalWorkedSalary,
          bpTotal: backPayTotal,
          loanDeductions,
          netAmount,
          reason: reason || selectedCause.causeName,
          causeId,
          status: targetStatus,
          now: nowStr
        },
        type: QueryTypes.INSERT,
        transaction: t
      }
    );

    const separationId = result[0][0].separationId;

    if (targetStatus === 'Notice Served') {
      await sequelize.query(
        `UPDATE "User" SET "user_EmploymentStatusId" = 4, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
      );

      const user = await sequelize.query(`SELECT "user_Email", "user_FirstName", "user_LastName" FROM "User" WHERE "user_Id" = :user_Id`, {
        replacements: { user_Id },
        type: QueryTypes.SELECT,
        transaction: t
      });

      if (user.length > 0) {
        await sendTerminationNoticeEmail({
          email: user[0].user_Email,
          name: `${user[0].user_FirstName} ${user[0].user_LastName}`,
          separationDate,
          cause: selectedCause.causeName
        });
      }
    }

    await t.commit();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "SEPARATION_GEN", `Generated separation pay (${targetStatus}) for user ${user_Id}`, { separationId }, req);

    res.status(201).json({ message: `Separation pay ${targetStatus.toLowerCase()} successfully.`, separationId });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

/**
 * Releases Separation Pay.
 */
exports.releaseSeparationPay = async (req, res) => {
  const { separationId } = req.params;
  const t = await sequelize.transaction();
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const record = await sequelize.query(
      `SELECT * FROM "Payroll_Separation" WHERE "separationId" = :separationId LIMIT 1`,
      { replacements: { separationId }, type: QueryTypes.SELECT, transaction: t }
    );

    if (record.length === 0) {
      await t.rollback();
      return res.status(404).json({ error: "Separation record not found." });
    }

    if (record[0].status === 'Released') {
      await t.rollback();
      return res.status(400).json({ error: "Record already released." });
    }

    const user_Id = record[0].user_Id;

    // 1. Update Separation Record
    await sequelize.query(
      `UPDATE "Payroll_Separation" SET "status" = 'Released', "releasedAt" = :now, "updatedAt" = :now WHERE "separationId" = :separationId`,
      { replacements: { separationId, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 2. Update User Status to 'Separated' (5)
    await sequelize.query(
      `UPDATE "User" SET "user_EmploymentStatusId" = 5, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 3. Soft Delete User (Paranoid)
    await sequelize.query(
      `UPDATE "User" SET "deletedAt" = :now WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 3.1 Hardware Deactivation: Archive MachipId and clear fingerprint template/slot
    const hardwareResult = await sequelize.query(
      `SELECT "user_MachipId", "user_FingerprintId" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT, transaction: t }
    );
    const currentMachipId = hardwareResult.length > 0 ? hardwareResult[0].user_MachipId : null;
    const currentFpSlot = hardwareResult.length > 0 ? hardwareResult[0].user_FingerprintId : null;
    const archivedMachipId = currentMachipId ? `${currentMachipId}-ARCHIVED-${user_Id}` : null;

    await sequelize.query(
      `UPDATE "User_Hardware" 
       SET "deletedAt" = :now, 
           "user_MachipId" = :archivedMachipId, 
           "user_FingerprintId" = NULL, 
           "user_FingerprintTemplate" = NULL,
           "updatedAt" = :now
       WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, now: nowStr, archivedMachipId }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 4. Settle Outstanding Loans (Mandatory per SSS rules)
    await sequelize.query(
      `UPDATE "Loan_Deductions" 
       SET "status" = 'completed', 
           "remainingBalance" = 0, 
           "notes" = CONCAT("notes", ' | Settled in full via Separation Pay on ', :now),
           "updatedAt" = :now 
       WHERE "userId" = :user_Id AND "status" = 'active'`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 5. Void all Pending (1) or Recommended (4) requests
    await sequelize.query(
      `UPDATE "emp_Request" 
       SET "emp_reqStatusId" = 3, 
           "admin_remarks" = 'Voided automatically due to employee separation.',
           "date_Processed" = :now,
           "updatedAt" = :now
       WHERE "user_Id" = :user_Id AND "emp_reqStatusId" IN (1, 4)`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();

    // Queue hardware sensor slot wipe for ESP32
    if (currentFpSlot) {
      queueSlotDeletion(currentFpSlot);
    }

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "SEPARATION_RELEASE", `Released separation pay and archived user ${user_Id}`, { separationId, user_Id }, req);

    res.status(200).json({ message: "Separation pay released and employee archived." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancels/Rescinds Separation Pay.
 */
exports.cancelSeparationPay = async (req, res) => {
  const { separationId } = req.params;
  const t = await sequelize.transaction();
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const record = await sequelize.query(
      `SELECT * FROM "Payroll_Separation" WHERE "separationId" = :separationId LIMIT 1`,
      { replacements: { separationId }, type: QueryTypes.SELECT, transaction: t }
    );

    if (record.length === 0) {
      await t.rollback();
      return res.status(404).json({ error: "Record not found." });
    }

    if (record[0].status === 'Released') {
      await t.rollback();
      return res.status(400).json({ error: "Cannot cancel a released payment." });
    }

    const user_Id = record[0].user_Id;

    // 1. Reset User Status to 'Regular' (1) - or could be mapped back to previous
    await sequelize.query(
      `UPDATE "User" SET "user_EmploymentStatusId" = 1, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
    );

    // 2. Delete Separation Record
    await sequelize.query(
      `DELETE FROM "Payroll_Separation" WHERE "separationId" = :separationId`,
      { replacements: { separationId }, type: QueryTypes.DELETE, transaction: t }
    );

    // 3. Get User Email for notification
    const user = await sequelize.query(`SELECT "user_Email", "user_FirstName", "user_LastName" FROM "User" WHERE "user_Id" = :user_Id`, {
      replacements: { user_Id },
      type: QueryTypes.SELECT,
      transaction: t
    });

    if (user.length > 0) {
      await sendTerminationRescissionEmail({
        email: user[0].user_Email,
        name: `${user[0].user_FirstName} ${user[0].user_LastName}`
      });
    }

    await t.commit();

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "SEPARATION_CANCEL", `Rescinded separation for user ${user_Id}`, { separationId, user_Id }, req);

    res.status(200).json({ message: "Termination notice rescinded and employee status restored." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets Separation Pay history.
 */
exports.getSeparationPayHistory = async (req, res) => {
  try {
    const history = await sequelize.query(
      `SELECT s.*, u."user_FirstName", u."user_LastName", st."statusName" as "userCurrentStatus",
              c."causeName"
       FROM "Payroll_Separation" s
       JOIN "User" u ON s."user_Id" = u."user_Id"
       JOIN "employementStatus" st ON u."user_EmploymentStatusId" = st."statusId"
       JOIN "Separation_Cause" c ON s."causeId" = c."causeId"
       ORDER BY s."separationDate" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets Retirement Pay Preview.
 * Logic: Daily Rate * 22.5 days * Years of Service.
 * Components of 22.5: 15 (Salary) + 5 (SIL) + 2.5 (1/12 of 13th month).
 */
exports.getRetirementPayPreview = async (req, res) => {
  const { user_Id, retirementDate } = req.query;
  if (!user_Id || !retirementDate) {
    return res.status(400).json({ error: "user_Id and retirementDate are required." });
  }

  try {
    const userResult = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", u."hireDate", u."user_DOB", u."dailyRate", u."hasAvailedRetirementTax"
       FROM "User" u
       WHERE u."user_Id" = :user_Id LIMIT 1`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    if (userResult.length === 0) return res.status(404).json({ error: "User not found." });
    const user = userResult[0];

    if (!user.hireDate) return res.status(400).json({ error: "User hireDate is missing." });
    if (!user.user_DOB) return res.status(400).json({ error: "User date of birth is missing." });

    const hireDate = new Date(user.hireDate);
    const birthDate = new Date(user.user_DOB);
    const targetDate = new Date(retirementDate);

    // Age Calculation
    let age = targetDate.getFullYear() - birthDate.getFullYear();
    const m = targetDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) age--;

    // Tenure Calculation (6 months considered as 1 whole year)
    let diffMonths = (targetDate.getFullYear() - hireDate.getFullYear()) * 12 + (targetDate.getMonth() - hireDate.getMonth());
    if (targetDate.getDate() < hireDate.getDate()) diffMonths--;
    
    let yearsOfService = Math.floor(diffMonths / 12);
    if ((diffMonths % 12) >= 6) yearsOfService++;

    // Eligibility Check
    const isEligible = age >= 60 && yearsOfService >= 5;
    const isCompulsory = age >= 65;

    // Components
    const dailyRate = user.dailyRate || 0;
    const salary15Days = dailyRate * 15;
    const sil5Days = dailyRate * 5;
    const thirteenthMonth2_5Days = dailyRate * 2.5;
    const oneHalfMonthSalary = dailyRate * 22.5;
    const totalAmount = oneHalfMonthSalary * yearsOfService;

    // Tax Exemption Check (Age 50+ AND 10+ years tenure AND one-time only)
    const isTaxExempt = age >= 50 && yearsOfService >= 10 && !user.hasAvailedRetirementTax;

    // 1. Fetch Leave Balances
    const leaveBalances = await sequelize.query(
      `SELECT "VL_balance", "SL_balance" FROM "Leave_Balance" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const vlBalance = parseFloat(leaveBalances[0]?.VL_balance || 0);
    const slBalance = parseFloat(leaveBalances[0]?.SL_balance || 0);
    const totalLeaveCredits = vlBalance + slBalance;
    const leaveConversion = Math.round(totalLeaveCredits * dailyRate * 100) / 100;

    // 2. Fetch Final Worked Days Salary (Attendance Audit)
    // Find the end date of the last closed/released payroll for this user up to retirement date
    const lastPayroll = await sequelize.query(
      `SELECT MAX(COALESCE(p."period_End", pp."endDate")) as "lastDate" 
       FROM "Payroll" p 
       LEFT JOIN "PayrollPeriod" pp ON p."periodId" = pp."periodId" 
       WHERE p."user_Id" = :user_Id 
         AND p."status" IN (2, 3, 4, 5)
         AND p."period_End" <= :retirementDate`,
      { replacements: { user_Id, retirementDate }, type: QueryTypes.SELECT }
    );
    
    const hasLastPayroll = Boolean(lastPayroll[0]?.lastDate);
    const auditStartDate = hasLastPayroll ? lastPayroll[0].lastDate : user.hireDate;
    const auditStartDateStr = typeof auditStartDate === 'string' ? auditStartDate.split('T')[0] : new Date(auditStartDate).toISOString().split('T')[0];

    const attendanceGap = await sequelize.query(
      `SELECT COUNT(*) as "worked" 
       FROM "employee_Logging_report" 
       WHERE "user_id" = :user_Id 
         AND "log_Date" ${hasLastPayroll ? '>' : '>='} :startDate::date 
         AND "log_Date" <= :sepDate::date
         AND "attendance_StatusId" IN (1, 2, 4, 5, 6)`,
      { 
        replacements: { user_Id, startDate: auditStartDateStr, sepDate: retirementDate }, 
        type: QueryTypes.SELECT 
      }
    );

    const workedDaysCount = parseInt(attendanceGap[0]?.worked || 0);
    const finalWorkedSalary = Math.round(workedDaysCount * dailyRate * 100) / 100;

    // 3. Fetch current year earnings for pro-rated 13th month
    const currentYearNum = targetDate.getFullYear();
    const earningsResult = await sequelize.query(
      `SELECT COALESCE(SUM("basicPay"), 0) as "totalBasic"
       FROM "Payroll" 
       WHERE "user_Id" = :user_Id 
         AND EXTRACT(YEAR FROM "period_Start") = :year 
         AND "status" IN (2, 3, 4, 5)
         AND "period_End" <= :retirementDate`,
      { replacements: { user_Id, year: currentYearNum, retirementDate }, type: QueryTypes.SELECT }
    );
    const totalBasicPayroll = parseFloat(earningsResult[0]?.totalBasic || 0);
    const totalBasicYear = Math.round((totalBasicPayroll + finalWorkedSalary) * 100) / 100;
    const prorated13thMonth = Math.round((totalBasicYear / 12) * 100) / 100;

    // 4. Fetch Outstanding Loans (Mandatory deduction per SSS rules)
    const activeLoans = await sequelize.query(
      `SELECT "id", "remainingBalance" 
       FROM "Loan_Deductions" 
       WHERE "userId" = :user_Id AND "status" = 'active'`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const totalLoanBalance = activeLoans.reduce((sum, loan) => sum + parseFloat(loan.remainingBalance || 0), 0);

    const backPayTotal = prorated13thMonth + leaveConversion + finalWorkedSalary;
    const grandTotal = totalAmount + backPayTotal;
    const netAmount = Math.max(0, grandTotal - totalLoanBalance);

    return res.status(200).json({
      user_Id: user.user_Id,
      name: `${user.user_LastName}, ${user.user_FirstName}`,
      age,
      yearsOfService,
      dailyRate,
      isEligible,
      isCompulsory,
      isTaxExempt,
      components: {
        salary15Days,
        sil5Days,
        thirteenthMonth2_5Days,
        oneHalfMonthSalary
      },
      loanDeductions: totalLoanBalance,
      netAmount,
      backPay: {
        prorated13thMonth,
        totalBasicYear,
        leaveConversion,
        vlBalance,
        slBalance,
        workedDaysCount,
        finalWorkedSalary
      },
      totalAmount,
      hireDate: user.hireDate,
      retirementDate
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Generates/Drafts Retirement Pay record.
 */
exports.generateRetirementPay = async (req, res) => {
  const { user_Id, retirementDate } = req.body;
  if (!user_Id || !retirementDate) {
    return res.status(400).json({ error: "user_Id and retirementDate are required." });
  }

  try {
    const previewRes = await exports.getRetirementPayPreview({ query: { user_Id, retirementDate } }, { 
      status: () => ({ json: (d) => d }),
      json: (d) => d
    });

    if (previewRes.error) return res.status(400).json({ error: previewRes.error });

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const backPayTotal = addMoney(
      previewRes.backPay.prorated13thMonth,
      previewRes.backPay.leaveConversion,
      previewRes.backPay.finalWorkedSalary
    );

    const grandTotal = addMoney(previewRes.totalAmount, backPayTotal);
    const loanDeductions = roundMoney(previewRes.loanDeductions || 0);
    const netAmount = Math.max(0, subtractMoney(grandTotal, loanDeductions));

    const result = await sequelize.query(
      `INSERT INTO "Payroll_Retirement" 
        ("user_Id", "hireDate", "retirementDate", "yearsOfService", "dailyRate", "totalAmount", 
         "component_salary_15days", "component_sil_5days", "component_13thmonth_2_5days", 
         "backPay_13thMonth", "backPay_LeaveConversion", "finalWorkedSalary", "backPay_Total",
         "loanDeductions", "netAmount",
         "isTaxExempt", "status", "createdAt", "updatedAt")
       VALUES 
        (:user_Id, :hireDate, :retirementDate, :yearsOfService, :dailyRate, :totalAmount, 
         :salary15Days, :sil5Days, :thirteenthMonth2_5Days, 
         :bp13th, :bpLeave, :bpFinalSalary, :bpTotal,
         :loanDeductions, :netAmount,
         :isTaxExempt, 'Draft', :now, :now)
       RETURNING "retirementId"`,
      {
        replacements: {
          user_Id,
          hireDate: previewRes.hireDate,
          retirementDate,
          yearsOfService: previewRes.yearsOfService,
          dailyRate: previewRes.dailyRate,
          totalAmount: previewRes.totalAmount,
          salary15Days: previewRes.components.salary15Days,
          sil5Days: previewRes.components.sil5Days,
          thirteenthMonth2_5Days: previewRes.components.thirteenthMonth2_5Days,
          bp13th: previewRes.backPay.prorated13thMonth,
          bpLeave: previewRes.backPay.leaveConversion,
          bpFinalSalary: previewRes.backPay.finalWorkedSalary,
          bpTotal: backPayTotal,
          loanDeductions,
          netAmount,
          isTaxExempt: previewRes.isTaxExempt,
          now: nowStr
        },
        type: QueryTypes.INSERT
      }
    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "RETIREMENT_GEN", `Generated retirement pay draft for user ${user_Id}`, { retirementId: result[0][0].retirementId }, req);

    res.status(201).json({ message: "Retirement pay draft generated.", retirementId: result[0][0].retirementId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Releases Retirement Pay.
 */
exports.releaseRetirementPay = async (req, res) => {
  const { retirementId } = req.params;
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Get the retirement record first to update user tax status later
    const retirement = await sequelize.query(
      `SELECT * FROM "Payroll_Retirement" WHERE "retirementId" = :retirementId LIMIT 1`,
      { replacements: { retirementId }, type: QueryTypes.SELECT }
    );

    if (retirement.length === 0) return res.status(404).json({ error: "Retirement record not found." });
    if (retirement[0].status === 'Released') return res.status(400).json({ error: "Retirement pay already released." });

    await sequelize.transaction(async (t) => {
      const user_Id = retirement[0].user_Id;

      // 1. Update Retirement Status
      await sequelize.query(
        `UPDATE "Payroll_Retirement" SET "status" = 'Released', "releasedAt" = :now, "updatedAt" = :now WHERE "retirementId" = :retirementId`,
        { replacements: { retirementId, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
      );

      // 2. If it was tax exempt, mark user as having availed it
      if (retirement[0].isTaxExempt) {
        await sequelize.query(
          `UPDATE "User" SET "hasAvailedRetirementTax" = true WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id }, type: QueryTypes.UPDATE, transaction: t }
        );
      }

      // 3. Update User Status to 'Retired' (6) and Archive
      await sequelize.query(
        `UPDATE "User" SET "user_EmploymentStatusId" = 6, "deletedAt" = :now, "updatedAt" = :now WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
      );

      // 3.1 Hardware Deactivation: Archive MachipId and clear fingerprint template/slot
      const hardwareResult = await sequelize.query(
        `SELECT "user_MachipId", "user_FingerprintId" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id }, type: QueryTypes.SELECT, transaction: t }
      );
      const currentMachipId = hardwareResult.length > 0 ? hardwareResult[0].user_MachipId : null;
      const currentFpSlot = hardwareResult.length > 0 ? hardwareResult[0].user_FingerprintId : null;
      const archivedMachipId = currentMachipId ? `${currentMachipId}-ARCHIVED-${user_Id}` : null;

      await sequelize.query(
        `UPDATE "User_Hardware" 
         SET "deletedAt" = :now, 
             "user_MachipId" = :archivedMachipId, 
             "user_FingerprintId" = NULL, 
             "user_FingerprintTemplate" = NULL,
             "updatedAt" = :now
         WHERE "user_Id" = :user_Id`,
        { replacements: { user_Id, now: nowStr, archivedMachipId }, type: QueryTypes.UPDATE, transaction: t }
      );

      // 4. Settle Outstanding Loans (Mandatory per SSS rules)
      await sequelize.query(
        `UPDATE "Loan_Deductions" 
         SET "status" = 'completed', 
             "remainingBalance" = 0, 
             "notes" = CONCAT("notes", ' | Settled in full via Retirement Pay on ', :now),
             "updatedAt" = :now 
         WHERE "userId" = :user_Id AND "status" = 'active'`,
        { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
      );

      // 5. Void all Pending (1) or Recommended (4) requests
      await sequelize.query(
        `UPDATE "emp_Request" 
         SET "emp_reqStatusId" = 3, 
             "admin_remarks" = 'Voided automatically due to employee retirement.',
             "date_Processed" = :now,
             "updatedAt" = :now
         WHERE "user_Id" = :user_Id AND "emp_reqStatusId" IN (1, 4)`,
        { replacements: { user_Id, now: nowStr }, type: QueryTypes.UPDATE, transaction: t }
      );

      // 6. Log Transaction
      const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
      await logTransaction(null, currentAdminId, "RETIREMENT_RELEASE", `Released retirement pay ID ${retirementId} and archived user ${user_Id}`, { retirementId, user_Id }, req);

      if (currentFpSlot) {
        queueSlotDeletion(currentFpSlot);
      }
    });

    res.status(200).json({ message: "Retirement pay released successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Updates a draft Retirement Pay record with a new date.
 * Re-calculates everything based on the new retirementDate.
 */
exports.updateRetirementDate = async (req, res) => {
  const { retirementId } = req.params;
  const { retirementDate } = req.body;

  if (!retirementDate) return res.status(400).json({ error: "retirementDate is required." });

  try {
    // 1. Fetch current record
    const record = await sequelize.query(
      `SELECT * FROM "Payroll_Retirement" WHERE "retirementId" = :retirementId LIMIT 1`,
      { replacements: { retirementId }, type: QueryTypes.SELECT }
    );

    if (record.length === 0) return res.status(404).json({ error: "Record not found." });
    if (record[0].status === 'Released') return res.status(400).json({ error: "Cannot edit a released payout." });

    const user_Id = record[0].user_Id;

    // 2. Trigger re-calculation
    const previewRes = await exports.getRetirementPayPreview({ query: { user_Id, retirementDate } }, { 
      status: () => ({ json: (d) => d }),
      json: (d) => d
    });

    if (previewRes.error) return res.status(400).json({ error: previewRes.error });

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const backPayTotal = addMoney(
      previewRes.backPay.prorated13thMonth,
      previewRes.backPay.leaveConversion,
      previewRes.backPay.finalWorkedSalary
    );

    // 3. Update DB
    await sequelize.query(
      `UPDATE "Payroll_Retirement" SET
        "retirementDate" = :retirementDate,
        "yearsOfService" = :yearsOfService,
        "totalAmount" = :totalAmount,
        "component_salary_15days" = :salary15Days,
        "component_sil_5days" = :sil5Days,
        "component_13thmonth_2_5days" = :thirteenthMonth2_5Days,
        "backPay_13thMonth" = :bp13th,
        "backPay_LeaveConversion" = :bpLeave,
        "finalWorkedSalary" = :bpFinalSalary,
        "backPay_Total" = :bpTotal,
        "isTaxExempt" = :isTaxExempt,
        "updatedAt" = :now
       WHERE "retirementId" = :retirementId`,
      {
        replacements: {
          retirementId,
          retirementDate,
          yearsOfService: previewRes.yearsOfService,
          totalAmount: previewRes.totalAmount,
          salary15Days: previewRes.components.salary15Days,
          sil5Days: previewRes.components.sil5Days,
          thirteenthMonth2_5Days: previewRes.components.thirteenthMonth2_5Days,
          bp13th: previewRes.backPay.prorated13thMonth,
          bpLeave: previewRes.backPay.leaveConversion,
          bpFinalSalary: previewRes.backPay.finalWorkedSalary,
          bpTotal: backPayTotal,
          isTaxExempt: previewRes.isTaxExempt,
          now: nowStr
        },
        type: QueryTypes.UPDATE
      }
    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "RETIREMENT_UPDATE", `Updated retirement date to ${retirementDate} for user ${user_Id}`, { retirementId }, req);

    res.status(200).json({ message: "Retirement date updated and amounts re-calculated." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets all active loans for management dashboard.
 */
exports.getActiveLoans = async (req, res) => {
  try {
    const loans = await sequelize.query(
      `SELECT 
        ld."id",
        CASE
          WHEN ld."deductionType" = 'sss_loan' THEN 'SSS Salary'
          WHEN ld."deductionType" = 'sss_emergency' THEN 'SSS Emergency'
          WHEN ld."deductionType" = 'sss_conso' THEN 'SSS Conso Loan'
          WHEN ld."deductionType" = 'hdmf_loan' THEN 'Pag-IBIG MPL'
          WHEN ld."deductionType" = 'hdmf_calamity' THEN 'Pag-IBIG Calamity'
          WHEN ld."deductionType" = 'calamity' THEN 'SSS Calamity'
          WHEN ld."deductionType" = 'cash_advance' OR ld."provider" = 'Company' THEN 'Company'
          WHEN ld."deductionType" = 'multipurpose' THEN 'Multi-Purpose'
          ELSE ld."deductionType"
        END as "govtype",        u."user_FirstName" || ' ' || u."user_LastName" as "employee",
        ld."notes" as "title",
        ld."totalAmount" as "principal",
        (ld."totalAmount" - ld."remainingBalance") as "paid",
        ld."remainingBalance" as "outstanding",
        ld."status",
        u."user_Email" as "email",
        ld."userId" as "employeeId",
        CASE 
          WHEN ld."totalAmount" > 0 THEN ROUND(((ld."totalAmount" - ld."remainingBalance") / ld."totalAmount") * 100)
          ELSE 0 
        END as "progress"
       FROM "Loan_Deductions" ld
       JOIN "User" u ON ld."userId" = u."user_Id"
       WHERE u."deletedAt" IS NULL
         AND ld."deductionType" NOT IN ('cash_advance', 'eastwest', 'maxicare')
       ORDER BY ld."createdAt" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets specific loan details by ID.
 */
exports.getLoanById = async (req, res) => {
  const { id } = req.params;
  try {
    const loanResult = await sequelize.query(
      `SELECT 
        ld."id" as "loanId",
        ld."userId" as "requesterId",
        ld."deductionType" as "deductionType",
        ld."status" as "status",
        ld."contractDate" as "contractDate",
        ld."monthsToPay" as "monthsToPay",
        ld."deductionPerCutoff" as "deductionPerCutoff",
        ld."totalAmount" as "totalAmount",
        ld."remainingBalance" as "remainingBalance",
        ld."provider" as "provider",
        ld."reference" as "reference",
        ld."notes" as "notes",
        ld."createdAt" as "createdAt",
        u."user_FirstName" || ' ' || u."user_LastName" as "employeeName",
        u."user_Email" as "employeeEmail",
        u."hireDate" as "hireDate",
        u."user_Id" as "empId",
        es."statusName" as "employmentStatus"
       FROM "Loan_Deductions" ld
       JOIN "User" u ON ld."userId" = u."user_Id"
       LEFT JOIN "employementStatus" es ON u."user_EmploymentStatusId" = es."statusId"
       WHERE ld."id" = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    if (loanResult.length === 0) {
      return res.status(404).json({ error: "Loan record not found." });
    }

    const loan = loanResult[0];
    const targetUserId = loan.requesterId || loan.empId;

    // Map govType for ledger lookup (Must match govDbType used in userRequest.controller)
    let govType = 'SSS';
    const dT = loan.deductionType;
    if (dT === 'sss_loan') govType = 'SSS';
    else if (dT === 'sss_emergency') govType = 'SSS Emergency';
    else if (dT === 'sss_conso') govType = 'SSS Conso Loan';
    else if (dT === 'hdmf_loan') govType = 'Pag-IBIG MPL';
    else if (dT === 'hdmf_calamity') govType = 'Pag-IBIG Calamity';
    else if (dT === 'calamity') govType = 'SSS Calamity';
    else if (dT === 'multipurpose') govType = 'Multi-Purpose';
    else if (loan.provider === 'Pag-IBIG') {
       // Fallback for cases where deductionType might be generic
       govType = dT === 'hdmf_calamity' ? 'Pag-IBIG Calamity' : 'Pag-IBIG MPL';
    }
    else if (loan.provider === 'SSS') {
       govType = dT === 'calamity' ? 'SSS Calamity' : 'SSS';
    }
    else if (loan.provider === 'Company') govType = 'Company';

    // Fetch Ledger (Amortization + History)
    const ledger = await sequelize.query(
      `SELECT 
        "govern_Id" as "id",
        "date" as "dueDate",
        "amount" as "total",
        "principalPaid" as "principal",
        "interestPaid" as "interest",
        "payrollId",
        CASE WHEN "payrollId" IS NOT NULL THEN 'PAID' ELSE 'PENDING' END as "status"
       FROM "Payroll_GovernmentLoans"
       WHERE "user_Id" = :userId AND ("government_type"::text = :govType OR "government_type"::text LIKE :govType || '%')
       ORDER BY "date" ASC`,
      { replacements: { userId: targetUserId, govType }, type: QueryTypes.SELECT }
    );

    // Fetch calamity details if applicable
    let calamityArea = null;
    if (dT === 'calamity' || dT === 'hdmf_calamity') {
       const reqRes = await sequelize.query(
         `SELECT lr."calamityArea" FROM "emp_Request" er
          JOIN "Loan_Request" lr ON er."emp_reqId" = lr."emp_reqId"
          WHERE er."user_Id" = :userId AND er."emp_reqTypeId" = 14 AND lr."loanType" = 'Calamity Loan'
          ORDER BY er."date_Processed" DESC LIMIT 1`,
         { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
       );
       if (reqRes.length > 0) calamityArea = reqRes[0].calamityArea;
    }
    // Calculate remaining for each row (diminishing view)
    let runningBalance = parseFloat(loan.totalAmount || 0);
    const schedule = (ledger || []).map((item, idx) => {
      const currentAmt = parseFloat(item.total || 0);
      runningBalance -= currentAmt;
      return {
        ...item,
        number: idx + 1,
        remaining: Math.max(0, runningBalance)
      };
    });

    res.status(200).json({
      ...loan,
      schedule,
      calamityArea,
      history: schedule.filter(s => s.status === 'PAID')
    });
  } catch (error) {
    console.error("[getLoanById Error]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets Retirement Pay history.
 */
exports.getRetirementPayHistory = async (req, res) => {
  try {
    const history = await sequelize.query(
      `SELECT r.*, u."user_FirstName", u."user_LastName"
       FROM "Payroll_Retirement" r
       JOIN "User" u ON r."user_Id" = u."user_Id"
       ORDER BY r."retirementDate" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Employee Side Endpoints ───────────────────────────────────────────────────

/**
 * Gets the payroll history for the logged-in employee.
 * Only returns released payrolls (status = 2).
 */
exports.getMyPayrollHistory = async (req, res) => {
  const user_Id = req.user.user_Id;
  try {
    const payrolls = await sequelize.query(
      `SELECT
         p.*,
         ps."PaystatusName",
         pp."label" AS "period_Label"
       FROM "Payroll" p
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       LEFT JOIN "PayrollPeriod" pp ON pp."periodId" = p."periodId"
       WHERE p."user_Id" = :user_Id AND p."status" IN (2, 5)
       ORDER BY p."period_Start" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );
    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets a specific payroll record for the logged-in employee.
 * Only allows viewing if it belongs to them and is released.
 */
exports.getMyPayrollById = async (req, res) => {
  const { payrollId } = req.params;
  const user_Id = req.user.user_Id;
  const roleId = Number(req.user.user_RoleId);

  if (isNaN(parseInt(payrollId))) return res.status(400).json({ error: "Invalid ID" });

  try {
    const isManagement = [1, 2, 4].includes(roleId);
    let whereClause = `p."payrollId" = :payrollId`;
    const replacements = { payrollId };

    if (!isManagement) {
      // Principle of Least Privilege: employees can ONLY access their own records AND only if officially Released (status = 5)
      whereClause += ` AND p."user_Id" = :user_Id AND p."status" = 5`;
      replacements.user_Id = user_Id;
    }

    const payroll = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt",
         e."nightOT_Hrs", e."nightOT_Amnt",
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."specialHol_Adj", e."incentives", e."allowance",
         d."absence_Hrs", d."absence_Amnt", d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         d."SSS_Ded", d."Philhealth_Ded", d."HDMF_Ded", 
         d."SSS_Ded_ER", d."Philhealth_Ded_ER", d."HDMF_Ded_ER", 
         d."Tax_Ded", d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", 
         d."calamityLoan_Amnt", d."multiPurposeSavings", d."advances_Amnt", 
         d."globe_Deduction", d."eastwest_Loan",
         (COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",
         u."user_FirstName", u."user_LastName", u."position" AS "user_Position",
         b."account_Number",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE ${whereClause}
       LIMIT 1`,
      { replacements, type: QueryTypes.SELECT },
    );

    if (payroll.length === 0) return res.status(404).json({ error: "Payroll not found or access denied." });

    const currentPayroll = payroll[0];

    // Ensure numeric fields are numbers
    const numericFields = [
      "dailyRate", "previousDailyRate", "ratePerHr", "basicPay", "totalEarnings", 
      "totalDeductions", "netPay", "OT_Amnt", "restDay_OT_Amnt", "nightOT_Amnt", 
      "nightDiff_Amnt", "specialHol_Amnt", "legalHol_Amnt", "specialHol_Adj", 
      "incentives", "allowance", "absence_Amnt", "tardiness_Amnt", "unpaidLeave_Amnt",
      "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "SSS_Ded_ER", "Philhealth_Ded_ER", 
      "HDMF_Ded_ER", "Tax_Ded", "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", 
      "calamityLoan_Amnt", "multiPurposeSavings", "advances_Amnt", "globe_Deduction", 
      "eastwest_Loan", "Other_Deductions"
    ];
    numericFields.forEach(field => {
      if (currentPayroll[field] !== undefined) {
        currentPayroll[field] = parseFloat(currentPayroll[field] || 0);
      }
    });

    const ytd = await calculateYTD(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.totalEarnings,
      currentPayroll.allowance,
      currentPayroll.totalDeductions,
      currentPayroll.Tax_Ded
    );

    const holidayBreakdown = await getHolidayBreakdown(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.dailyRate,
      currentPayroll.ratePerHr,
      currentPayroll.legalHol_Amnt,
      currentPayroll.specialHol_Amnt
    );

    res.status(200).json({
      ...currentPayroll,
      ...ytd,
      holidayBreakdown,
      accountNo: decrypt(currentPayroll.account_Number) || "—"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads an individual standard or detailed payslip PDF.
 * Enforces Principle of Least Privilege: employees can ONLY download their own RELEASED (status = 5) payslip.
 */
exports.downloadMyPayslipPDF = async (req, res) => {
  const { payrollId } = req.params;
  const { type } = req.query; // 'detailed' or 'standard'
  const user_Id = req.user.user_Id;
  const roleId = Number(req.user.user_RoleId);

  if (isNaN(parseInt(payrollId))) return res.status(400).json({ error: "Invalid payroll ID" });

  try {
    const isManagement = [1, 2, 4].includes(roleId);
    let whereClause = `p."payrollId" = :payrollId`;
    const replacements = { payrollId };

    if (!isManagement) {
      // Least privilege: strictly own record and strictly Released status (status = 5)
      whereClause += ` AND p."user_Id" = :user_Id AND p."status" = 5`;
      replacements.user_Id = user_Id;
    }

    const payrollRows = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt",
         e."nightOT_Hrs", e."nightOT_Amnt",
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."specialHol_Adj", e."incentives", e."allowance",
         d."absence_Hrs", d."absence_Amnt", d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         d."SSS_Ded", d."Philhealth_Ded", d."HDMF_Ded", 
         d."SSS_Ded_ER", d."Philhealth_Ded_ER", d."HDMF_Ded_ER", 
         d."Tax_Ded", d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", 
         d."calamityLoan_Amnt", d."multiPurposeSavings", d."advances_Amnt", 
         d."globe_Deduction", d."eastwest_Loan",
         (COALESCE(d."calamityLoan_Amnt",0) + COALESCE(d."multiPurposeSavings",0) +
          COALESCE(d."globe_Deduction",0) +
          COALESCE(d."eastwest_Loan",0)) AS "Other_Deductions",
         u."user_FirstName", u."user_LastName", u."position" AS "user_Position",
         b."account_Number",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "User_Banking" b ON u."user_Id" = b."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE ${whereClause}
       LIMIT 1`,
      { replacements, type: QueryTypes.SELECT }
    );

    if (payrollRows.length === 0) {
      return res.status(404).json({ error: "Payroll record not found or access denied." });
    }

    const currentPayroll = payrollRows[0];
    const numericFields = [
      "dailyRate", "previousDailyRate", "ratePerHr", "basicPay", "totalEarnings", 
      "totalDeductions", "netPay", "OT_Amnt", "restDay_OT_Amnt", "nightOT_Amnt", 
      "nightDiff_Amnt", "specialHol_Amnt", "legalHol_Amnt", "specialHol_Adj", 
      "incentives", "allowance", "absence_Amnt", "tardiness_Amnt", "unpaidLeave_Amnt",
      "SSS_Ded", "Philhealth_Ded", "HDMF_Ded", "SSS_Ded_ER", "Philhealth_Ded_ER", 
      "HDMF_Ded_ER", "Tax_Ded", "healthCard_Amnt", "SSS_Loan", "HDMF_Loan", 
      "calamityLoan_Amnt", "multiPurposeSavings", "advances_Amnt", "globe_Deduction", 
      "eastwest_Loan", "Other_Deductions"
    ];
    numericFields.forEach(field => {
      if (currentPayroll[field] !== undefined) {
        currentPayroll[field] = parseFloat(currentPayroll[field] || 0);
      }
    });

    const ytd = await calculateYTD(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.totalEarnings,
      currentPayroll.allowance,
      currentPayroll.totalDeductions,
      currentPayroll.Tax_Ded
    );

    const holidayBreakdown = await getHolidayBreakdown(
      currentPayroll.user_Id,
      currentPayroll.period_Start,
      currentPayroll.period_End,
      currentPayroll.dailyRate,
      currentPayroll.ratePerHr,
      currentPayroll.legalHol_Amnt,
      currentPayroll.specialHol_Amnt
    );

    const fullStats = {
      ...currentPayroll,
      ...ytd,
      holidayBreakdown,
      accountNo: decrypt(currentPayroll.account_Number) || "—"
    };

    let pdfBuffer;
    let filenameSuffix = "";
    if (type === "detailed") {
      pdfBuffer = await generateDetailedPayslipPDF(fullStats, null);
      filenameSuffix = "_Detailed";
    } else {
      pdfBuffer = await generatePayslipPDF(fullStats, null);
    }

    const filename = `Payslip_${currentPayroll.user_LastName || "Employee"}_${payrollId}${filenameSuffix}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error generating payslip PDF:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads individual DTR PDF for an employee's released payroll.
 * Enforces Principle of Least Privilege: employees can ONLY download their own RELEASED (status = 5) DTR.
 */
exports.downloadMyDTRPDF = async (req, res) => {
  const { payrollId } = req.params;
  const user_Id = req.user.user_Id;
  const roleId = Number(req.user.user_RoleId);

  if (isNaN(parseInt(payrollId))) return res.status(400).json({ error: "Invalid payroll ID" });

  try {
    const isManagement = [1, 2, 4].includes(roleId);
    let whereClause = `p."payrollId" = :payrollId`;
    const replacements = { payrollId };

    if (!isManagement) {
      whereClause += ` AND p."user_Id" = :user_Id AND p."status" = 5`;
      replacements.user_Id = user_Id;
    }

    const payrollRows = await sequelize.query(
      `SELECT
         p.*,
         e."OT_Hrs", e."OT_Amnt", e."restDay_OT_Hrs", e."restDay_OT_Amnt",
         e."nightOT_Hrs", e."nightOT_Amnt",
         e."nightDiff_Hrs", e."nightDiff_Amnt", e."specialHol_Amnt", e."legalHol_Amnt", 
         e."specialHol_Adj", e."incentives", e."allowance",
         d."absence_Hrs", d."absence_Amnt", d."tardiness_Mins", d."tardiness_Amnt",
         d."unpaidLeave_Days", d."unpaidLeave_Amnt", d."paidLeave_Days",
         d."SSS_Ded", d."Philhealth_Ded", d."HDMF_Ded", 
         d."SSS_Ded_ER", d."Philhealth_Ded_ER", d."HDMF_Ded_ER", 
         d."Tax_Ded", d."healthCard_Amnt", d."SSS_Loan", d."HDMF_Loan", 
         d."calamityLoan_Amnt", d."multiPurposeSavings", d."advances_Amnt", 
         d."globe_Deduction", d."eastwest_Loan",
         u."user_FirstName", u."user_LastName", u."position" AS "user_Position",
         ps."PaystatusName"
       FROM "Payroll" p
       LEFT JOIN "Payroll_Earnings" e ON e."payrollId" = p."payrollId"
       LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
       LEFT JOIN "User" u ON u."user_Id" = p."user_Id"
       LEFT JOIN "Payroll_status" ps ON ps."PaystatusId" = p."status"
       WHERE ${whereClause}
       LIMIT 1`,
      { replacements, type: QueryTypes.SELECT }
    );

    if (payrollRows.length === 0) {
      return res.status(404).json({ error: "Payroll record not found or access denied." });
    }

    const currentPayroll = payrollRows[0];
    const dtrData = await getAttendanceReportInternal(currentPayroll.period_Start, currentPayroll.period_End, currentPayroll.user_Id);

    const fullStats = {
      ...currentPayroll,
      netPay: parseFloat(currentPayroll.netPay || 0),
      basicPay: parseFloat(currentPayroll.basicPay || 0)
    };

    const dtrBuffer = await generateDTRPDF({
      employee: currentPayroll,
      dtrData,
      period_Start: currentPayroll.period_Start,
      period_End: currentPayroll.period_End,
      fullStats
    });

    const filename = `DTR_${currentPayroll.user_LastName || "Employee"}_${payrollId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(dtrBuffer);
  } catch (error) {
    console.error("Error generating DTR PDF:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets 13th month history for the logged-in employee.
 * Includes a monthly breakdown of basic pay used in computation.
 */
exports.getMyThirteenthMonthHistory = async (req, res) => {
  const user_Id = req.user.user_Id;
  const { year } = req.query;
  try {
    const replacements = { user_Id };
    let yearClause = "";
    if (year && !isNaN(parseInt(year))) {
      yearClause = ` AND tm."year" = :year`;
      replacements.year = parseInt(year);
    }

    const history = await sequelize.query(
      `SELECT tm.*,
      (
        SELECT COALESCE(json_agg(m ORDER BY (m).month_num), '[]'::json)
        FROM (
          SELECT 
            EXTRACT(MONTH FROM p2."period_Start")::int as month_num,
            TRIM(TO_CHAR(p2."period_Start", 'Month')) as month_name,
            SUM(p2."basicPay") as monthly_basic
          FROM "Payroll" p2
          WHERE p2."user_Id" = :user_Id 
            AND EXTRACT(YEAR FROM p2."period_Start") = tm."year"
            AND p2."status" IN (2, 3, 4, 5)
          GROUP BY month_num, month_name
          ORDER BY month_num
        ) m
      ) as "breakdown"
       FROM "Payroll_ThirteenthMonth" tm
       WHERE tm."user_Id" = :user_Id 
         AND tm."status" = 'Released'
         ${yearClause}
       ORDER BY tm."year" DESC`,
      { replacements, type: QueryTypes.SELECT }
    );
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Deletes/Discards draft 13th Month Pay records for a specified year.
 */
exports.deleteThirteenthMonthDrafts = async (req, res) => {
  const { year } = req.params;
  if (!year || isNaN(parseInt(year))) {
    return res.status(400).json({ error: "A valid year is required." });
  }

  try {
    const deleted = await sequelize.query(
      `DELETE FROM "Payroll_ThirteenthMonth" 
       WHERE "year" = :year AND "status" = 'Draft'`,
      { replacements: { year: parseInt(year) }, type: QueryTypes.DELETE }
    );

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logTransaction(null, currentAdminId, "13TH_MONTH_DISCARD_DRAFTS", `Discarded draft 13th month records for year ${year}`, { year }, req);

    res.status(200).json({ message: `Successfully discarded draft 13th month records for year ${year}.` });
  } catch (error) {
    console.error("[13TH_MONTH_DISCARD_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets separation pay record for the logged-in employee.
 */
exports.getMySeparationPay = async (req, res) => {
  const user_Id = req.user.user_Id;
  try {
    const records = await sequelize.query(
      `SELECT s.*, c."causeName"
       FROM "Payroll_Separation" s
       JOIN "Separation_Cause" c ON s."causeId" = c."causeId"
       WHERE s."user_Id" = :user_Id AND s."status" = 'Released'
       ORDER BY s."separationDate" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets retirement pay record for the logged-in employee.
 */
exports.getMyRetirementPay = async (req, res) => {
  const user_Id = req.user.user_Id;
  try {
    const records = await sequelize.query(
      `SELECT * FROM "Payroll_Retirement"
       WHERE "user_Id" = :user_Id AND "status" = 'Released'
       ORDER BY "retirementDate" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets aggregated history for all government loans.
 */
exports.getGovLoanHistoryAll = async (req, res) => {
  try {
    const history = await sequelize.query(
      `SELECT 
        pgl."govern_Id" as id,
        pgl."date",
        pgl."amount",
        pgl."government_type" as type,
        pgl."user_Id",
        u."user_FirstName" || ' ' || u."user_LastName" as "userName"
       FROM "Payroll_GovernmentLoans" pgl
       JOIN "User" u ON pgl."user_Id" = u."user_Id"
       ORDER BY pgl."date" DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads a PDF report of government loan remittances.
 */
exports.downloadGovLoanReportPDF = async (req, res) => {
  const { year, type } = req.query;
  try {
    let query = `
      SELECT 
        pgl."date",
        pgl."amount",
        pgl."government_type" as type,
        pgl."user_Id",
        u."user_FirstName" || ' ' || u."user_LastName" as "userName"
       FROM "Payroll_GovernmentLoans" pgl
       JOIN "User" u ON pgl."user_Id" = u."user_Id"
       WHERE 1=1
    `;
    const replacements = {};

    if (year && year !== "All Years") {
      query += ` AND EXTRACT(YEAR FROM pgl."date") = :year`;
      replacements.year = parseInt(year);
    }
    if (type && type !== "All Types") {
      query += ` AND pgl."government_type"::text = :type`;
      replacements.type = type;
    }

    query += ` ORDER BY pgl."date" DESC`;

    const history = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });

    const pdfBuffer = await generateGovLoanReportPDF(history, { year, type });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Gov_Loan_Report_${year || 'All'}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets aggregated history for all employee bank loans (Eastwest) & advances.
 */
exports.getEastwestLoanHistory = async (req, res) => {
  const { year } = req.query;
  try {
    let query = `
      SELECT * FROM (
        SELECT 
          pe."date"::text as "date",
          pe."user_Id",
          pe."amount",
          pe."payrollId",
          'Eastwest Bank Loan' as "source",
          pe."notes",
          u."user_FirstName" || ' ' || u."user_LastName" AS "userName"
        FROM "Payroll_Eastwest" pe
        JOIN "User" u ON pe."user_Id" = u."user_Id"

        UNION ALL

        SELECT 
          p."period_End"::text as "date",
          p."user_Id",
          pd."eastwest_Loan" as "amount",
          p."payrollId",
          'Eastwest Bank Loan' as "source",
          'Payroll Deduction' as "notes",
          u."user_FirstName" || ' ' || u."user_LastName" AS "userName"
        FROM "Payroll_Deductions" pd
        JOIN "Payroll" p ON pd."payrollId" = p."payrollId"
        JOIN "User" u ON p."user_Id" = u."user_Id"
        WHERE pd."eastwest_Loan" > 0
          AND NOT EXISTS (
            SELECT 1 FROM "Payroll_Eastwest" pe3 
            WHERE pe3."user_Id" = p."user_Id" AND (pe3."payrollId" = p."payrollId" OR pe3."date" = p."period_End")
          )
      ) combined
      WHERE 1=1
    `;
    const replacements = {};
    if (year && year !== "All Years") {
      query += ` AND EXTRACT(YEAR FROM combined."date"::date) = :year`;
      replacements.year = parseInt(year);
    }
    query += ` ORDER BY combined."date" DESC, combined."userName" ASC`;

    const history = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.status(200).json(history);
  } catch (error) {
    console.error("[GET_EASTWEST_LOAN_HISTORY_ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads a PDF report of employee bank loan & advance remittances.
 */
exports.downloadEastwestLoanReportPDF = async (req, res) => {
  const { year } = req.query;
  try {
    let query = `
      SELECT * FROM (
        SELECT 
          pe."date"::text as "date",
          pe."user_Id",
          pe."amount",
          pe."payrollId",
          'Eastwest Bank Loan' as "source",
          pe."notes",
          u."user_FirstName" || ' ' || u."user_LastName" AS "userName"
        FROM "Payroll_Eastwest" pe
        JOIN "User" u ON pe."user_Id" = u."user_Id"

        UNION ALL

        SELECT 
          p."period_End"::text as "date",
          p."user_Id",
          pd."eastwest_Loan" as "amount",
          p."payrollId",
          'Eastwest Bank Loan' as "source",
          'Payroll Deduction' as "notes",
          u."user_FirstName" || ' ' || u."user_LastName" AS "userName"
        FROM "Payroll_Deductions" pd
        JOIN "Payroll" p ON pd."payrollId" = p."payrollId"
        JOIN "User" u ON p."user_Id" = u."user_Id"
        WHERE pd."eastwest_Loan" > 0
          AND NOT EXISTS (
            SELECT 1 FROM "Payroll_Eastwest" pe3 
            WHERE pe3."user_Id" = p."user_Id" AND (pe3."payrollId" = p."payrollId" OR pe3."date" = p."period_End")
          )
      ) combined
      WHERE 1=1
    `;
    const replacements = {};
    if (year && year !== "All Years") {
      query += ` AND EXTRACT(YEAR FROM combined."date"::date) = :year`;
      replacements.year = parseInt(year);
    }
    query += ` ORDER BY combined."date" DESC, combined."userName" ASC`;

    const history = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    const pdfBuffer = await generateEastwestLoanReportPDF(history, { year });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Employee_Loan_Report_${year || 'All'}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    console.error("[DOWNLOAD_EASTWEST_LOAN_PDF_ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads an individual loan ledger PDF.
 */
exports.downloadIndividualLoanPDF = async (req, res) => {
  const { id } = req.params;
  try {
    // We can reuse getLoanById internal logic or call it
    const loanResult = await sequelize.query(
      "SELECT ld.*, u.\"user_FirstName\" || ' ' || u.\"user_LastName\" as \"employeeName\" FROM \"Loan_Deductions\" ld JOIN \"User\" u ON ld.\"userId\" = u.\"user_Id\" WHERE ld.\"id\" = :id",
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    if (loanResult.length === 0) return res.status(404).json({ error: "Loan not found." });
    const loan = loanResult[0];

    // Map for ledger lookup
    let govType = 'SSS';
    const dT = loan.deductionType;
    if (dT === 'sss_loan') govType = 'SSS';
    else if (dT === 'sss_emergency') govType = 'SSS Emergency';
    else if (dT === 'sss_conso') govType = 'SSS Conso Loan';
    else if (dT === 'hdmf_loan') govType = 'Pag-IBIG MPL';
    else if (dT === 'hdmf_calamity') govType = 'Pag-IBIG Calamity';
    else if (dT === 'calamity') govType = 'SSS Calamity';
    else if (dT === 'multipurpose') govType = 'Multi-Purpose';

    const ledger = await sequelize.query(
      `SELECT 
        "date" as "dueDate",
        "amount" as "total",
        CASE WHEN "payrollId" IS NOT NULL THEN 'PAID' ELSE 'PENDING' END as "status"
       FROM "Payroll_GovernmentLoans"
       WHERE "user_Id" = :userId AND "government_type"::text = :govType
       ORDER BY "date" ASC`,
      { replacements: { userId: loan.userId, govType }, type: QueryTypes.SELECT }
    );

    let runningBalance = parseFloat(loan.totalAmount || 0);
    const schedule = ledger.map((item) => {
      const currentAmt = parseFloat(item.total || 0);
      runningBalance -= currentAmt;
      return { ...item, remaining: Math.max(0, runningBalance) };
    });

    const pdfBuffer = await generateIndividualLoanPDF(loan, schedule);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Loan_Ledger_${loan.id}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets real-time proactive status alerts for payroll timing.
 * Evaluates T-2 days, T-0 payroll day, T+1..T+deadlineDays overdue warnings, and auto-release.
 */
exports.getPayrollStatusAlerts = async (req, res) => {
  try {
    const now = await getSystemTime();
    const todayStr = formatForSQL(now).split(" ")[0]; // YYYY-MM-DD
    const settings = await SystemSettings.findOne();

    if (settings && settings.payrollRemindersEnabled === false) {
      return res.status(200).json({ enabled: false, alerts: [] });
    }

    const bufferDays = (settings && settings.payrollCutoffBufferDays !== undefined && settings.payrollCutoffBufferDays !== null)
      ? parseInt(settings.payrollCutoffBufferDays, 10)
      : 2;
    const deadlineDays = (settings && settings.payrollProcessingDeadlineDays !== undefined && settings.payrollProcessingDeadlineDays !== null)
      ? parseInt(settings.payrollProcessingDeadlineDays, 10)
      : 3;
    const autoRelease = Boolean(settings && settings.payrollAutoRelease);
    const weekendRule = settings?.payrollWeekendRule || "PRECEDING_FRIDAY";

    // Fetch official holidays for accurate banking schedule adjustment
    const holidayRows = await sequelize.query(
      `SELECT "date"::text as "hDate" FROM "Holiday"`,
      { type: QueryTypes.SELECT }
    );
    const holidayList = holidayRows.map(h => (h.hDate ? h.hDate.split("T")[0] : ""));

    // Fetch latest periods
    const periods = await sequelize.query(
      `SELECT * FROM "PayrollPeriod" ORDER BY "endDate" DESC LIMIT 6`,
      { type: QueryTypes.SELECT }
    );

    const alerts = [];

    for (const p of periods) {
      const pStart = p.startDate;
      const pEnd = p.endDate;

      // Resolve Payday schedule (Weekend / Sunday -> Friday shift)
      const sched = resolvePaydaySchedule(pEnd, weekendRule, holidayList);

      const isAuditDay = (todayStr === sched.checkingDate);
      const isPayday = (todayStr === sched.effectivePayday);
      const isPastPayday = (todayStr > sched.effectivePayday);

      // 1. Audit & Manual Batch Verification Day (T-1 Business Day)
      if (isAuditDay && p.status === 'Draft') {
        alerts.push({
          type: "audit_day",
          severity: "info",
          title: "Audit & Manual Verification Day",
          message: `Payroll release for ${p.label || `${pStart} to ${pEnd}`} is scheduled for ${sched.readablePayday}. Please review attendance corrections, overtime claims, and loan deductions, and verify the batch draft today.`,
          periodId: p.periodId,
          periodText: p.label,
          endDate: pEnd,
          effectivePayday: sched.effectivePayday,
          checkingDate: sched.checkingDate,
          isAdjusted: sched.isAdjusted,
          adjustmentNotice: sched.adjustmentNotice
        });
      }

      // 2. Payday (T-0 Day)
      if (isPayday) {
        if (p.status === 'Draft') {
          if (autoRelease) {
            try {
              await exports.generateBatchPayrollInternal(pStart, pEnd, 1, true);
              alerts.push({
                type: "auto_released",
                severity: "success",
                title: "Payroll Auto-Released for Payday",
                message: `Batch payroll for ${p.label || `${pStart} to ${pEnd}`} was automatically released and locked today (${sched.readablePayday}). Payslips and records are now available.`,
                periodId: p.periodId,
                periodText: p.label,
                isAdjusted: sched.isAdjusted,
                adjustmentNotice: sched.adjustmentNotice
              });
            } catch (autoErr) {
              console.error(`[AutoRelease] Payday auto-release error for ${p.label}:`, autoErr.message);
            }
          } else {
            alerts.push({
              type: "payroll_day",
              severity: "purple",
              title: "Today is Payday Release Day!",
              message: `The designated payroll release date (${sched.readablePayday}) for ${p.label || `${pStart} to ${pEnd}`} has arrived. Please finalize and release the batch.`,
              periodId: p.periodId,
              periodText: p.label,
              status: p.status,
              endDate: pEnd,
              isAdjusted: sched.isAdjusted,
              adjustmentNotice: sched.adjustmentNotice
            });
          }
        } else if (p.status === 'Released') {
          alerts.push({
            type: "payday_released",
            severity: "success",
            title: "Payroll Released for Payday",
            message: `Batch payroll for ${p.label || `${pStart} to ${pEnd}`} is officially released and active today (${sched.readablePayday}).`,
            periodId: p.periodId,
            periodText: p.label,
            isAdjusted: sched.isAdjusted,
            adjustmentNotice: sched.adjustmentNotice
          });
        }
      }

      // 3. Post-Payday (Past effective payday and still Draft)
      if (isPastPayday && p.status === 'Draft') {
        if (autoRelease) {
          try {
            await exports.generateBatchPayrollInternal(pStart, pEnd, 1, true);
            alerts.push({
              type: "auto_released",
              severity: "success",
              title: "Payroll Auto-Released",
              message: `Draft period ${p.label || `${pStart} to ${pEnd}`} was automatically locked and released per designated payday schedule (${sched.readablePayday}). Payslips and records are now available.`,
              periodId: p.periodId,
              periodText: p.label,
              isAdjusted: sched.isAdjusted,
              adjustmentNotice: sched.adjustmentNotice
            });
          } catch (autoErr) {
            console.error(`[AutoRelease] Failed to auto-release past period ${p.label}:`, autoErr.message);
          }
        }
        // In manual finalization mode, no intrusive banner is generated. 
        // Periods remain accessible via the quiet status indicator in the Payroll Periods table.
      }
    }

    res.status(200).json({
      enabled: true,
      currentDate: todayStr,
      bufferDays,
      deadlineDays,
      autoRelease,
      weekendRule,
      alerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets active and past loan records for the authenticated employee with Proposal 5 metrics.
 */
exports.getMyLoans = async (req, res) => {
  const userId = req.user.user_Id;
  try {
    const loans = await sequelize.query(
      `SELECT ld.*, 
              u."user_FirstName", u."user_LastName", u."user_Email"
       FROM "Loan_Deductions" ld
       JOIN "User" u ON u."user_Id" = ld."userId"
       WHERE ld."userId" = :userId
       ORDER BY CASE WHEN ld."status" = 'active' THEN 1 ELSE 2 END, ld."contractDate" DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const now = await getSystemTime();

    const formatDateLocal = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const YYYY = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, "0");
      const DD = String(d.getDate()).padStart(2, "0");
      return `${YYYY}-${MM}-${DD}`;
    };

    const mapTypeInfo = (dT) => {
      if (dT === 'sss_loan') return { title: 'SSS Salary Loan', institution: 'Social Security System', category: 'Government Statutory', color: 'purple', badgeClass: 'badge-purple' };
      if (dT === 'sss_emergency') return { title: 'SSS Emergency Loan', institution: 'Social Security System', category: 'Government Statutory', color: 'purple', badgeClass: 'badge-purple' };
      if (dT === 'sss_conso') return { title: 'SSS Conso Loan', institution: 'Social Security System', category: 'Government Statutory', color: 'purple', badgeClass: 'badge-purple' };
      if (dT === 'calamity') return { title: 'SSS Calamity Loan', institution: 'Social Security System', category: 'Government Statutory', color: 'purple', badgeClass: 'badge-purple' };
      if (dT === 'hdmf_loan') return { title: 'Pag-IBIG Multi-Purpose Loan', institution: 'HDMF Fund', category: 'Government Statutory', color: 'green', badgeClass: 'badge-success' };
      if (dT === 'hdmf_calamity') return { title: 'Pag-IBIG Calamity Loan', institution: 'HDMF Fund', category: 'Government Statutory', color: 'green', badgeClass: 'badge-success' };
      if (dT === 'eastwest') return { title: 'EastWest Personal Loan', institution: 'EastWest Bank', category: 'Commercial Bank', color: 'blue', badgeClass: 'badge-info' };
      if (dT === 'cash_advance') return { title: 'Company Cash Advance', institution: 'MAC-J Ltd. Internal Benefit', category: 'Company Benefit', color: 'gold', badgeClass: 'badge-warning' };
      return { title: 'Institutional Loan', institution: 'Financial Institution', category: 'Company Benefit', color: 'gold', badgeClass: 'badge-warning' };
    };

    let totalOutstanding = 0;
    let nextCutoffDeduction = 0;

    const mappedLoans = loans.map(loan => {
      const typeInfo = mapTypeInfo(loan.deductionType);
      const totalAmt = parseFloat(loan.totalAmount || 0);
      const remBal = parseFloat(loan.remainingBalance || 0);
      const cutoffAmt = parseFloat(loan.deductionPerCutoff || 0);
      const isActive = loan.status === 'active';

      if (isActive) {
        totalOutstanding += remBal;
        nextCutoffDeduction += cutoffAmt;
      }

      const cutoffsRemaining = cutoffAmt > 0 ? Math.max(0, Math.ceil(remBal / cutoffAmt)) : 0;
      const totalCutoffs = cutoffAmt > 0 ? Math.round(totalAmt / cutoffAmt) : (loan.monthsToPay ? loan.monthsToPay * 2 : 0);
      const cutoffsPaid = Math.max(0, totalCutoffs - cutoffsRemaining);
      const progressPct = totalAmt > 0 ? Math.min(100, Math.max(0, Math.round(((totalAmt - remBal) / totalAmt) * 100))) : 100;

      let projectedDate = new Date(now);
      let count = cutoffsRemaining;
      while (count > 0) {
        if (projectedDate.getDate() < 15) {
          projectedDate.setDate(15);
        } else {
          projectedDate = new Date(projectedDate.getFullYear(), projectedDate.getMonth() + 1, 0);
          projectedDate.setDate(projectedDate.getDate() + 1);
        }
        count--;
      }
      const payoffDateStr = cutoffsRemaining === 0 ? (loan.renewalDate || formatDateLocal(now)) : formatDateLocal(projectedDate);

      return {
        id: loan.id,
        loanId: loan.id,
        deductionType: loan.deductionType,
        title: typeInfo.title,
        institution: loan.provider || typeInfo.institution,
        category: typeInfo.category,
        color: typeInfo.color,
        badgeClass: typeInfo.badgeClass,
        reference: loan.reference || `${loan.deductionType.toUpperCase()}-${loan.id}`,
        status: loan.status,
        contractDate: loan.contractDate,
        renewalDate: loan.renewalDate,
        totalAmount: totalAmt.toFixed(2),
        totalDeducted: parseFloat(loan.totalDeducted || 0).toFixed(2),
        remainingBalance: remBal.toFixed(2),
        deductionPerCutoff: cutoffAmt.toFixed(2),
        cutoffsRemaining,
        totalCutoffs,
        cutoffsPaid,
        progressPct,
        payoffDate: payoffDateStr,
        notes: loan.notes
      };
    });

    const activeList = mappedLoans.filter(l => l.status === 'active');

    let earliestPayoff = null;
    if (activeList.length > 0) {
      const sortedByPayoff = [...activeList].sort((a, b) => new Date(a.payoffDate) - new Date(b.payoffDate));
      const first = sortedByPayoff[0];
      earliestPayoff = {
        title: first.title,
        payoffDate: first.payoffDate,
        cutoffsRemaining: first.cutoffsRemaining,
        freedPerCutoff: parseFloat(first.deductionPerCutoff).toFixed(2),
        freedMonthly: (parseFloat(first.deductionPerCutoff) * 2).toFixed(2)
      };
    }

    let debtFreeTarget = null;
    if (activeList.length > 0) {
      const sortedByPayoff = [...activeList].sort((a, b) => new Date(b.payoffDate) - new Date(a.payoffDate));
      const last = sortedByPayoff[0];
      debtFreeTarget = {
        title: last.title,
        payoffDate: last.payoffDate,
        totalRestoredMonthly: (nextCutoffDeduction * 2).toFixed(2)
      };
    }

    const reliefPhases = [];
    if (activeList.length > 0) {
      const sortedByMaturity = [...activeList].sort((a, b) => new Date(a.payoffDate) - new Date(b.payoffDate));
      let currentRunningCutoff = nextCutoffDeduction;
      let cumulativeFreedMonthly = 0;

      reliefPhases.push({
        phaseNumber: 1,
        title: `Phase 1: Now`,
        cutoffDateStr: formatDateLocal(now),
        activeLoansCount: activeList.length,
        deductionPerCutoff: currentRunningCutoff.toFixed(2),
        freedMonthly: "0.00",
        description: `All ${activeList.length} loans deducting concurrently.`
      });

      sortedByMaturity.forEach((l, idx) => {
        const freedCutoff = parseFloat(l.deductionPerCutoff);
        currentRunningCutoff = Math.max(0, currentRunningCutoff - freedCutoff);
        cumulativeFreedMonthly += (freedCutoff * 2);

        const isLast = idx === sortedByMaturity.length - 1;
        reliefPhases.push({
          phaseNumber: idx + 2,
          title: isLast ? `Phase ${idx + 2}: 100% Debt-Free` : `Phase ${idx + 2}: ${l.title} Cleared`,
          cutoffDateStr: l.payoffDate,
          activeLoansCount: Math.max(0, activeList.length - (idx + 1)),
          deductionPerCutoff: currentRunningCutoff.toFixed(2),
          freedMonthly: cumulativeFreedMonthly.toFixed(2),
          isDebtFree: isLast,
          description: isLast 
            ? `Complete freedom! Full salary retained (+PHP ${cumulativeFreedMonthly.toFixed(2)}/mo).`
            : `${l.title} cleared! +PHP ${(freedCutoff * 2).toFixed(2)}/mo restored to take-home pay.`
        });
      });
    }

    res.status(200).json({
      loans: mappedLoans,
      summary: {
        totalOutstanding: totalOutstanding.toFixed(2),
        nextCutoffDeduction: nextCutoffDeduction.toFixed(2),
        activeLoansCount: activeList.length,
        completedLoansCount: mappedLoans.filter(l => l.status !== 'active').length,
        earliestPayoff,
        debtFreeTarget,
        reliefPhases
      }
    });
  } catch (error) {
    console.error("[getMyLoans Error]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Gets the deduction ledger audit history for a specific loan owned by the authenticated employee.
 */
exports.getMyLoanLedger = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_Id;
  try {
    const loanResult = await sequelize.query(
      `SELECT ld.*, u."user_FirstName", u."user_LastName" 
       FROM "Loan_Deductions" ld 
       JOIN "User" u ON u."user_Id" = ld."userId" 
       WHERE ld."id" = :id AND ld."userId" = :userId`,
      { replacements: { id, userId }, type: QueryTypes.SELECT }
    );

    if (loanResult.length === 0) {
      return res.status(404).json({ error: "Loan account not found or access denied." });
    }
    const loan = loanResult[0];

    const history = await sequelize.query(
      `SELECT ldh.*, p."period_Start", p."period_End", pp."label" as "periodLabel"
       FROM "Loan_Deduction_History" ldh
       LEFT JOIN "Payroll" p ON p."payrollId" = ldh."payrollId"
       LEFT JOIN "PayrollPeriod" pp ON pp."periodId" = p."periodId"
       WHERE ldh."loanDeductionId" = :id
       ORDER BY ldh."deductionDate" DESC, ldh."id" DESC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    res.status(200).json({ loan, history });
  } catch (error) {
    console.error("[getMyLoanLedger Error]:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Downloads official individual loan statement PDF with zero-trust ownership validation.
 */
exports.downloadMyLoanPDF = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_Id;
  try {
    const loanResult = await sequelize.query(
      `SELECT ld.* FROM "Loan_Deductions" ld WHERE ld."id" = :id AND ld."userId" = :userId`,
      { replacements: { id, userId }, type: QueryTypes.SELECT }
    );
    if (loanResult.length === 0) {
      return res.status(404).json({ error: "Loan account not found or access denied." });
    }
    return exports.downloadIndividualLoanPDF(req, res);
  } catch (error) {
    console.error("[downloadMyLoanPDF Error]:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.computePeriodStats = computePeriodStats;


