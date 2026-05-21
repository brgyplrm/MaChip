const { sequelize, SystemSettings, Holiday, User, Notification } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("./systemTime.js");
const { logTransaction } = require("./logger");

/**
 * Resolves conflicts between approved leaves and actual attendance.
 * Priority: Actual Work > Planned Leave.
 * Thresholds:
 * - < 1 hr: Accidental Tap (Leave remains)
 * - 1 to 5 hrs: Half-Day Work (Pay 0.5, Refund 0.5 Leave)
 * - > 5 hrs: Full-Day Work (Pay 1.0, Void/Refund 1.0 Leave)
 */
async function resolveLeaveConflict(userId, logDate) {
  try {
    // 1. Get the report for this day to see total hours
    const [report] = await sequelize.query(
      `SELECT "time_Logged_inArr", "time_Logged_outArr" 
       FROM "employee_Logging_report" 
       WHERE "user_id" = :userId AND "log_Date" = :logDate`,
      { replacements: { userId, logDate }, type: QueryTypes.SELECT }
    );

    if (!report) return { success: false, message: "No attendance report found for this date." };

    const inArr = JSON.parse(report.time_Logged_inArr || "[]");
    const outArr = JSON.parse(report.time_Logged_outArr || "[]");

    if (inArr.length === 0 || outArr.length === 0) {
      return { success: false, message: "Incomplete logs. Cannot resolve conflict yet." };
    }

    // Calculate total raw minutes worked (sum of all segments)
    let totalMinutesWorked = 0;
    const segments = Math.min(inArr.length, outArr.length);
    for (let i = 0; i < segments; i++) {
      const start = new Date(`${logDate}T${inArr[i]}`);
      const end = new Date(`${logDate}T${outArr[i]}`);
      if (end > start) {
        totalMinutesWorked += Math.floor((end - start) / 60000);
      }
    }

    const totalHours = totalMinutesWorked / 60;
    console.log(`[LEAVE-RESOLVE] User ${userId} worked ${totalHours.toFixed(2)} hours on ${logDate}`);

    // 2. Check for Approved Leaves
    // We check Vacation, Sick, Emergency, HalfDay, and Statutory leaves.
    const approvedLeave = await sequelize.query(
      `SELECT er."emp_reqId", er."emp_reqTypeId", 
              vl."vacL_Id", vl."WithPayID" as "vlPay",
              sl."SickL_Id", sl."WithPayID" as "slPay",
              el."EL_Id", el."WithPayID" as "elPay",
              hd."HD_Id", hd."WithPayID" as "hdPay",
              st."statL_Id", st."WithPayID" as "stPay"
       FROM "emp_Request" er
       LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
       LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
       LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
       LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
       LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
       WHERE er."user_Id" = :userId 
         AND er."emp_reqStatusId" = 2 -- Approved
         AND (
           (:logDate BETWEEN vl."StartDate" AND vl."EndDate") OR
           (:logDate BETWEEN sl."StartDate" AND sl."EndDate") OR
           (el."DateOfLeave" = :logDate) OR
           (hd."DateOfLeave" = :logDate) OR
           (:logDate BETWEEN st."StartDate" AND st."EndDate")
         )
       LIMIT 1`,
      { replacements: { userId, logDate }, type: QueryTypes.SELECT }
    );

    if (approvedLeave.length === 0) {
      return { success: true, message: "No overlapping approved leave found." };
    }

    const leave = approvedLeave[0];
    let refundAmount = 0;
    let actionTaken = "";

    // 3. Threshold Logic
    let newStatus = null;
    if (totalHours < 1) {
      // < 1 Hour: Accidental Tap. Mark attendance as Accidental (7) and leave remains active.
      newStatus = 7;
      actionTaken = "Accidental tap detected (<1hr). Attendance voided, leave remains active.";
    } else if (totalHours >= 1 && totalHours <= 5) {
      // 1 to 5 Hours: Half-Day Work. Refund 0.5.
      refundAmount = 0.5;
      actionTaken = "Converted to Half-Day Work due to attendance (1-5 hrs).";
    } else if (totalHours > 5) {
      // > 5 Hours: Full-Day Work. Refund 1.0.
      refundAmount = 1.0;
      actionTaken = "Voided by Full-Day Work attendance (>5 hrs).";
    }

    // Special case for Half-Day Leave: if they already only applied for half-day, 
    // and they worked > 1 hour, we void the whole half-day leave.
    if (leave.HD_Id && totalHours >= 1) {
      refundAmount = 0.5; // Half-day leave is always 0.5
      actionTaken = "Half-Day Leave voided by attendance.";
    }

    // 4. Update Database
    const t = await sequelize.transaction();
    try {
      const year = new Date(logDate).getFullYear();
      
      // Update Attendance Status in DB if needed
      if (newStatus === 7) {
        await sequelize.query(
          `UPDATE "employee_Logging_report" SET "attendance_StatusId" = 7 
           WHERE "user_id" = :userId AND "log_Date" = :logDate`,
          { replacements: { userId, logDate }, type: QueryTypes.UPDATE, transaction: t }
        );
        await sequelize.query(
          `UPDATE "user_logging" SET "attendance_StatusId" = 7 
           WHERE "user_id" = :userId AND "log_Date" = :logDate`,
          { replacements: { userId, logDate }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (refundAmount > 0) {
        // If they worked significant hours, ensure the status is NOT "On-Leave" (4) anymore
        await sequelize.query(
          `UPDATE "employee_Logging_report" 
           SET "attendance_StatusId" = CASE 
             WHEN "attendance_StatusId" = 4 OR "attendance_StatusId" IS NULL THEN 1 
             ELSE "attendance_StatusId" 
           END
           WHERE "user_id" = :userId AND "log_Date" = :logDate`,
          { replacements: { userId, logDate }, type: QueryTypes.UPDATE, transaction: t }
        );
      }

      if (totalHours < 1) {
        await t.commit();
        return { success: true, message: actionTaken, refundAmount: 0 };
      }

      // Update Leave Balance
      if (leave.vacL_Id && leave.vlPay === 1) {
        await sequelize.query(
          `UPDATE "Leave_Balance" SET "VL_used" = "VL_used" - :refundAmount 
           WHERE "user_Id" = :userId AND "year" = :year`,
          { replacements: { refundAmount, userId, year }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (leave.SickL_Id && leave.slPay === 1) {
        await sequelize.query(
          `UPDATE "Leave_Balance" SET "SL_used" = "SL_used" - :refundAmount 
           WHERE "user_Id" = :userId AND "year" = :year`,
          { replacements: { refundAmount, userId, year }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (leave.statL_Id && leave.stPay === 1) {
        // Only Solo Parent (Type 10) has a balance that needs refunding
        if (Number(leave.emp_reqTypeId) === 10) {
          await sequelize.query(
            `UPDATE "Leave_Balance" SET "SoloParent_used" = "SoloParent_used" - :refundAmount 
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { refundAmount, userId, year }, type: QueryTypes.UPDATE, transaction: t }
          );
        }
      }

      // Update Leave Records (Reduce NoDays)
      if (leave.vacL_Id) {
        await sequelize.query(
          `UPDATE "Vacation_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "vacL_Id" = :vacL_Id`,
          { replacements: { refundAmount, vacL_Id: leave.vacL_Id }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (leave.SickL_Id) {
        await sequelize.query(
          `UPDATE "Sick_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "SickL_Id" = :SickL_Id`,
          { replacements: { refundAmount, SickL_Id: leave.SickL_Id }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (leave.EL_Id) {
        await sequelize.query(
          `UPDATE "Emergency_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "EL_Id" = :EL_Id`,
          { replacements: { refundAmount, EL_Id: leave.EL_Id }, type: QueryTypes.UPDATE, transaction: t }
        );
      } else if (leave.statL_Id) {
        await sequelize.query(
          `UPDATE "Statutory_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "statL_Id" = :statL_Id`,
          { replacements: { refundAmount, statL_Id: leave.statL_Id }, type: QueryTypes.UPDATE, transaction: t }
        );
      }

      // Add System Remark to the Request
      await sequelize.query(
        `UPDATE "emp_Request" 
         SET "system_remarks" = COALESCE("system_remarks", '') || :remark
         WHERE "emp_reqId" = :emp_reqId`,
        { 
          replacements: { 
            remark: `\n[${new Date().toISOString()}] SYSTEM: ${actionTaken} ${refundAmount} day(s) refunded.`,
            emp_reqId: leave.emp_reqId 
          }, 
          type: QueryTypes.UPDATE, 
          transaction: t 
        }
      );

      // If NoDays becomes 0 or less, we should probably mark the request as "Partially Voided" or just let it stay Approved but with 0 days.
      // For simplicity, let's just keep it Approved with updated days.

      await t.commit();

      // 5. Notify User
      await Notification.create({
        user_Id: userId,
        title: "Leave Adjustment",
        message: `Your leave on ${logDate} has been adjusted: ${actionTaken} ${refundAmount} credits returned to your balance.`,
        isRead: false
      });

      console.log(`[LEAVE-RESOLVE] Success: Refunded ${refundAmount} to User ${userId} for ${logDate}`);
      return { success: true, message: actionTaken, refundAmount };

    } catch (err) {
      await t.rollback();
      console.error("[LEAVE-RESOLVE] Transaction Error:", err);
      throw err;
    }

  } catch (error) {
    console.error("[LEAVE-RESOLVE] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Advanced Time-Slicing Algorithm
 * Slices a shift into minutes and assigns them to payable buckets based on DOLE rules.
 * Handles: Fixed 1-hr break after 4 hrs, OT after 8 hrs, Night Diff (22:00-06:00), 
 * and Holiday stacking multipliers.
 */
async function calculateMultiBucketHours(firstIn, lastOut, logDate, userShiftId, settings = null, holidays = null) {
  const result = {
    totalRawMinutes: 0,
    reg_hrs: 0,
    nd_hrs: 0,
    ot_hrs: 0,
    holiday_hrs: 0,
    totalPayableHours: 0
  };

  if (!firstIn || !lastOut) return result;

  // 1. Setup Settings and Holidays
  if (!settings) settings = await SystemSettings.findOne();
  if (!holidays) holidays = await Holiday.findAll();

  const holidayMap = {}; 
  holidays.forEach(h => { 
    const dStr = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
    if (!holidayMap[dStr]) holidayMap[dStr] = { types: [], count: 0 };
    holidayMap[dStr].types.push(h.type);
    holidayMap[dStr].count++;
  });

  // 2. Parse times and handle cross-midnight
  const startCursor = new Date(`${logDate}T${firstIn}`);
  let endCursor = new Date(`${logDate}T${lastOut}`);

  if (endCursor < startCursor) {
    endCursor.setDate(endCursor.getDate() + 1);
  }

  const totalMinutes = Math.floor((endCursor - startCursor) / 60000);
  result.totalRawMinutes = totalMinutes;

  if (totalMinutes <= 0) return result;

  // 3. Time-Slicing (Minute by Minute)
  let workMinutesCount = 0;
  let totalUnits = 0;
  let regUnits = 0;
  let otUnits = 0;
  let ndUnits = 0;
  let holUnits = 0;

  for (let i = 0; i < totalMinutes; i++) {
    // Dynamic Break Deduction: Skip configured duration after 4 hours of work
    // [FIX] Only deduct if total duration exceeds threshold (e.g., 5 hours / 300 mins)
    const lunchDur = settings?.lunchDuration || 60;
    const breakThreshold = settings?.flexibleBreakThreshold || 300;

    if (workMinutesCount === 240 && totalMinutes >= breakThreshold) {
      i += lunchDur; 
      if (i >= totalMinutes) break;
    }

    const currentMinute = new Date(startCursor.getTime() + i * 60000);
    const dateStr = formatDateLocal(currentMinute);
    const hour = currentMinute.getHours();

    // Determine Day properties
    const holidayData = holidayMap[dateStr] || { types: [], count: 0 };
    const isRegularHoliday = holidayData.types.includes("Regular Holiday");
    const isSpecialHoliday = holidayData.types.includes("Special Holiday");
    const isDoubleRegular = holidayData.count >= 2 && isRegularHoliday;
    const isDoubleSpecial = holidayData.count >= 2 && isSpecialHoliday;

    const isSunday = currentMinute.getDay() === 0;
    const isNightDiff = (hour >= 22 || hour < 6);

    // Determine Rate Key
    let rateKey = "ordinaryDayRate";
    if (isDoubleRegular) rateKey = isSunday ? "doubleRegularHolidayRestDayRate" : "doubleRegularHolidayRate";
    else if (isRegularHoliday) rateKey = isSunday ? "regularHolidayRestDayRate" : "regularHolidayRate";
    else if (isDoubleSpecial) rateKey = isSunday ? "doubleSpecialDayRestDayRate" : "doubleSpecialDayRate";
    else if (isSpecialHoliday) rateKey = isSunday ? "specialDayRestDayRate" : "specialDayRate";
    else if (isSunday) rateKey = "restDayRate";

    workMinutesCount++;
    const isOT = workMinutesCount > 480;

    // Multipliers
    const baseMult = settings[rateKey] || 1.0;
    const otMult = isOT ? (settings.overtimeRate || 1.25) : 1.0;
    const ndMult = isNightDiff ? (settings.nightDiffRate || 1.1) : 1.0;

    // Premium Stacking Logic
    // Total = Base * OT * ND
    const currentTotalFactor = baseMult * otMult * ndMult;
    totalUnits += currentTotalFactor;

    // Deconstruct into buckets (in minute-units, convert to hrs at end)
    regUnits += 1; // Physical work minute
    if (baseMult > 1.0) holUnits += (baseMult - 1);
    
    // OT Premium = (Base * OT) - Base
    if (isOT) otUnits += (baseMult * (otMult - 1));
    
    // ND Premium = (Base * OT * ND) - (Base * OT)
    if (isNightDiff) ndUnits += (baseMult * otMult * (ndMult - 1));
  }

  // 4. Final Conversion (Minutes to Hours)
  result.reg_hrs = Math.round((regUnits / 60) * 100) / 100;
  result.hol_hrs = Math.round((holUnits / 60) * 100) / 100;
  result.ot_hrs = Math.round((otUnits / 60) * 100) / 100;
  result.nd_hrs = Math.round((ndUnits / 60) * 100) / 100;
  result.totalPayableHours = Math.round((totalUnits / 60) * 100) / 100;

  return result;
  }

  /**
  * Orchestrates calculation and storage of attendance units for a specific report.
  */
  async function calculateAndStoreAttendanceUnits(userId, logDate) {
  try {
    const { employee_Logging_report, SystemSettings, Holiday, User } = require("../config/sequelize.js");

    // 1. Fetch the report
    const report = await employee_Logging_report.findOne({
      where: { user_id: userId, log_Date: logDate }
    });

    if (!report) return { success: false, message: "No report found." };

    const inArr = JSON.parse(report.time_Logged_inArr || "[]");
    const outArr = JSON.parse(report.time_Logged_outArr || "[]");

    if (inArr.length === 0 || outArr.length === 0) {
      return { success: false, message: "Incomplete logs. Units not calculated." };
    }

    // 2. Fetch User Shift and settings
    const user = await User.findByPk(userId);
    const settings = await SystemSettings.findOne();
    const holidays = await Holiday.findAll();

    // 3. Calculate
    const stats = await calculateMultiBucketHours(
      inArr[0], 
      outArr[outArr.length - 1], 
      logDate, 
      user?.user_ShiftId, 
      settings, 
      holidays
    );

    // 4. Update the report
    await report.update({
      reg_hrs: stats.reg_hrs,
      nd_hrs: stats.nd_hrs,
      ot_hrs: stats.ot_hrs,
      holiday_hrs: stats.hol_hrs,
      total_payable_hrs: stats.totalPayableHours
    });

    console.log(`[ATTENDANCE-CALC] Updated units for User ${userId} on ${logDate}: ${stats.totalPayableHours} total units.`);
    return { success: true, stats };
  } catch (error) {
    console.error("[ATTENDANCE-CALC] Error:", error);
    return { success: false, error: error.message };
  }
  }

  /**
  * Optimized version of markAbsents that processes multiple users in bulk
  */
  async function ensureAbsentsMarked(dateOverride = null) {
  try {
    const { SystemSettings } = require("../config/sequelize.js");
    const settings = await SystemSettings.findOne();
    const now = await getSystemTime();
    
    const morningStart = settings?.morningShiftStart || "08:30:00";
    const morningEnd   = settings?.morningShiftEnd   || "17:30:00";
    const cutoffHour   = parseInt(morningEnd.split(':')[0]);
    const cutoffMin    = parseInt(morningEnd.split(':')[1]);

    // Ensure todayStr is YYYY-MM-DD
    let todayStr;
    if (dateOverride) {
      if (dateOverride instanceof Date) {
        todayStr = formatDateLocal(dateOverride);
      } else {
        todayStr = dateOverride; // assume already string
      }
    } else {
      todayStr = formatDateLocal(now);
    }

    const currentTodayStr = formatDateLocal(now);
    const dayOfWeek = new Date(todayStr).getUTCDay(); // 0 = Sunday

    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // logic: if it's a PAST day, it's ALWAYS past cutoff. 
    // If it's TODAY, it's past cutoff only after shift end.
    const isPastCutoff = (todayStr < currentTodayStr) || (hour > cutoffHour) || (hour === cutoffHour && minute >= cutoffMin);

    // 1. Process On-Field Work (Bulk)
    // ... (rest of the logic using morningStart/morningEnd)
    const onFieldUsers = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName"
       FROM "User" u
       JOIN "emp_Request" er ON u."user_Id" = er."user_Id"
       JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
       LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
       WHERE u."deletedAt" IS NULL 
         AND er."emp_reqStatusId" = 2
         AND ow."DateonField" = :todayStr
         AND elr."user_id" IS NULL`,
      { replacements: { todayStr }, type: QueryTypes.SELECT }
    );

    if (onFieldUsers.length > 0) {
      console.log(`[SYSTEM] Auto-crediting On-Field Attendance for ${onFieldUsers.length} users on ${todayStr}.`);
      for (const user of onFieldUsers) {
        const userId = user.user_Id;
        
        // Insert dummy log into user_logging (for audit)
        await sequelize.query(
          `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
           VALUES (:userId, :todayStr, :morningEnd, 2, 5)
           ON CONFLICT DO NOTHING`, 
          { replacements: { userId, todayStr, morningEnd }, type: QueryTypes.INSERT }
        );
        
        // Insert entry into employee_Logging_report (for payroll/reporting)
        await sequelize.query(
          `INSERT INTO "employee_Logging_report" 
            ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
           VALUES (:userId, :todayStr, :inArr, :outArr, 5, 2)
           ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
          { replacements: { userId, todayStr, inArr: JSON.stringify([morningStart]), outArr: JSON.stringify([morningEnd]) }, type: QueryTypes.INSERT }
        );
        console.log(`[SYSTEM] Auto-credited On-Field: ${user.user_FirstName} ${user.user_LastName}`);
      }
    }

    // 2. Process Absents and Exempt Users (Bulk) - Only past shift end (or for past days) and not Sunday
    if (isPastCutoff && dayOfWeek !== 0) {
      // Check if today is a holiday
      const isHoliday = await sequelize.query(
        `SELECT 1 FROM "Holiday" WHERE "date" = :todayStr`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (isHoliday.length > 0) {
        console.log(`[SYSTEM] Skipping absence/exempt check for ${todayStr}: It is a holiday.`);
        return; 
      }

      // 1.5 Process Exempt Users (Bulk)
      const exemptUsers = await sequelize.query(
        `SELECT u."user_Id", u."user_FirstName", u."user_LastName"
         FROM "User" u
         LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
         WHERE u."deletedAt" IS NULL 
           AND u."user_RoleId" = 1
           AND elr."user_id" IS NULL
           AND NOT EXISTS (
               -- Check for Approved Leave
               SELECT 1 FROM "emp_Request" er
               LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
               LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
               WHERE er."user_Id" = u."user_Id" 
                 AND er."emp_reqStatusId" = 2
                 AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate")
           )`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (exemptUsers.length > 0) {
        console.log(`[SYSTEM] Auto-crediting Exempt Attendance for ${exemptUsers.length} users on ${todayStr}.`);
        for (const user of exemptUsers) {
          const userId = user.user_Id;
          
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, :morningStart, 1, 6), (:userId, :todayStr, :morningEnd, 2, 6)
             ON CONFLICT DO NOTHING`, 
          { replacements: { userId, todayStr, morningStart, morningEnd }, type: QueryTypes.INSERT }
          );
          
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, :inArr, :outArr, 6, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr, inArr: JSON.stringify([morningStart]), outArr: JSON.stringify([morningEnd]) }, type: QueryTypes.INSERT }
          );
          console.log(`[SYSTEM] Auto-credited Exempt: ${user.user_FirstName} ${user.user_LastName}`);
        }
      }

      // 2. Process Absents
      const absentUsers = await sequelize.query(
        `SELECT u."user_Id", u."user_FirstName", u."user_LastName"
         FROM "User" u
         LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
         WHERE u."deletedAt" IS NULL 
           AND u."user_RoleId" != 1
           AND elr."user_id" IS NULL
           AND NOT EXISTS (
             -- Check for Approved Leave (Vacation, Sick, Emergency, Half-Day)
             SELECT 1 FROM "emp_Request" er
             LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
             LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
             LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
             LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
             WHERE er."user_Id" = u."user_Id" 
               AND er."emp_reqStatusId" = 2
               AND (
                 :todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR 
                 :todayStr BETWEEN sl."StartDate" AND sl."EndDate" OR
                 el."DateOfLeave" = :todayStr OR
                 hd."DateOfLeave" = :todayStr
               )
           )`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (absentUsers.length > 0) {
        console.log(`[SYSTEM] Marking ${absentUsers.length} users as Absent on ${todayStr}.`);
        for (const user of absentUsers) {
          const userId = user.user_Id;
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, :morningEnd, 2, 3)
             ON CONFLICT DO NOTHING`,
            { replacements: { userId, todayStr, morningEnd }, type: QueryTypes.INSERT }
          );
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '[]', '[]', 3, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
        }
      }

      // 3. Process Users on Approved Leave (Bulk)
      // Mark them as "On-Leave" (4) if they haven't logged anything
      const onLeaveUsers = await sequelize.query(
        `SELECT u."user_Id", u."user_FirstName", u."user_LastName"
         FROM "User" u
         JOIN "emp_Request" er ON u."user_Id" = er."user_Id"
         LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
         LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
         LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
         LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
         LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
         LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
         WHERE u."deletedAt" IS NULL 
           AND er."emp_reqStatusId" = 2
           AND elr."user_id" IS NULL
           AND (
             :todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR 
             :todayStr BETWEEN sl."StartDate" AND sl."EndDate" OR
             el."DateOfLeave" = :todayStr OR
             hd."DateOfLeave" = :todayStr OR
             :todayStr BETWEEN st."StartDate" AND st."EndDate"
           )`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (onLeaveUsers.length > 0) {
        console.log(`[SYSTEM] Marking ${onLeaveUsers.length} users as On-Leave on ${todayStr}.`);
        for (const user of onLeaveUsers) {
          const userId = user.user_Id;
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '[]', '[]', 4, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
        }
      }
    } else {
      console.log(`[DEBUG] Skipping absence check for ${todayStr}: Not past cutoff or is Sunday.`);
    }
  } catch (error) {
    console.error("[ERROR] ensureAbsentsMarked:", error);
  }
}

module.exports = { ensureAbsentsMarked, calculateMultiBucketHours, resolveLeaveConflict, calculateAndStoreAttendanceUnits };
