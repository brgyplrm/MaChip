const { sequelize, SystemSettings, Holiday } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("./systemTime.js");
const { logTransaction } = require("./logger");

/**
 * Advanced Time-Slicing Algorithm
 * Slices a shift into minutes and assigns them to payable buckets based on DOLE rules.
 */
async function calculateMultiBucketHours(firstIn, lastOut, logDate, userShiftId, settings = null, holidays = null) {
  const result = {
    totalRawMinutes: 0,
    payableMinutes: 0,
    totalPayableHours: 0,
    buckets: {} // will store minutes per rate type
  };

  if (!firstIn || !lastOut) return result;

  // 1. Setup Settings and Holidays
  if (!settings) settings = await SystemSettings.findOne();
  if (!holidays) holidays = await Holiday.findAll();

  const holidayMap = {}; // date -> { types: [], count: 0 }
  holidays.forEach(h => { 
    if (!holidayMap[h.date]) holidayMap[h.date] = { types: [], count: 0 };
    holidayMap[h.date].types.push(h.type);
    holidayMap[h.date].count++;
  });

  // 2. Parse times and handle cross-midnight
  // logDate is YYYY-MM-DD
  const [inH, inM] = firstIn.split(":").map(Number);
  const [outH, outM] = lastOut.split(":").map(Number);

  const startCursor = new Date(`${logDate}T${firstIn}`);
  let endCursor = new Date(`${logDate}T${lastOut}`);

  if (endCursor < startCursor) {
    // Crosses midnight
    endCursor.setDate(endCursor.getDate() + 1);
  }

  const totalMinutes = Math.floor((endCursor - startCursor) / 60000);
  result.totalRawMinutes = totalMinutes;

  if (totalMinutes <= 0) return result;

  // 3. Time-Slicing (Minute by Minute)
  const buckets = {}; // key: rateKey, value: minutes

  for (let i = 0; i < totalMinutes; i++) {
    const currentMinute = new Date(startCursor.getTime() + i * 60000);
    const dateStr = formatDateLocal(currentMinute);
    const hour = currentMinute.getHours();

    // Determine Day properties
    const holidayData = holidayMap[dateStr] || { types: [], count: 0 };
    const isRegularHoliday = holidayData.types.includes("Regular Holiday");
    const isSpecialHoliday = holidayData.types.includes("Special Holiday");
    const isDoubleRegular = holidayData.count >= 2 && isRegularHoliday && !isSpecialHoliday;
    const isDoubleSpecial = holidayData.count >= 2 && isSpecialHoliday && !isRegularHoliday;

    const isSunday = currentMinute.getDay() === 0;
    const isNightDiff = (hour >= 22 || hour < 6);

    // Determine Rate Key
    let rateKey = "ordinaryDayRate";
    
    if (isDoubleRegular) {
      rateKey = isSunday ? "doubleRegularHolidayRestDayRate" : "doubleRegularHolidayRate";
    } else if (isRegularHoliday) {
      rateKey = isSunday ? "regularHolidayRestDayRate" : "regularHolidayRate";
    } else if (isDoubleSpecial) {
      rateKey = isSunday ? "doubleSpecialDayRestDayRate" : "doubleSpecialDayRate";
    } else if (isSpecialHoliday) {
      rateKey = isSunday ? "specialDayRestDayRate" : "specialDayRate";
    } else if (isSunday) {
      rateKey = "restDayRate";
    }

    // Apply Night Diff stacking
    if (isNightDiff) {
      // ND is usually baseRate * multiplier. We will track ND minutes separately to apply 10% premium later
      const ndKey = rateKey + "_ND";
      buckets[ndKey] = (buckets[ndKey] || 0) + 1;
    } else {
      buckets[rateKey] = (buckets[rateKey] || 0) + 1;
    }
  }

  // 4. Flexible Break Deduction (1 hour = 60 mins)
  // Deduct from ordinary minutes first
  let breakRemaining = totalMinutes > 300 ? 60 : 0;
  
  // Deduct break from buckets (prioritize non-ND, ordinary buckets)
  const bucketPriority = ["ordinaryDayRate", "restDayRate", "specialDayRate", "regularHolidayRate"];
  for (const key of bucketPriority) {
    if (breakRemaining <= 0) break;
    if (buckets[key]) {
      const deduct = Math.min(buckets[key], breakRemaining);
      buckets[key] -= deduct;
      breakRemaining -= deduct;
    }
  }
  // If still remaining, deduct from ND buckets
  if (breakRemaining > 0) {
    for (const key in buckets) {
      const deduct = Math.min(buckets[key], breakRemaining);
      buckets[key] -= deduct;
      breakRemaining -= deduct;
      if (breakRemaining <= 0) break;
    }
  }

  // 5. Convert Minutes to Payable Hours using Settings Multipliers
  let totalPayableMinutes = 0;
  for (const key in buckets) {
    const isND = key.endsWith("_ND");
    const baseKey = isND ? key.replace("_ND", "") : key;
    
    const multiplier = settings[baseKey] || 1.0;
    const ndPremium = isND ? (settings.nightDiffRate || 1.1) : 1.0;
    
    // Logic: Multiplier stacks (e.g. 2.0 Regular Holiday * 1.1 ND = 2.2 total factor)
    const effectiveMultiplier = multiplier * (isND ? (ndPremium - 1 + 1) : 1.0);
    // Actually simpler: effective = multiplier * (isND ? 1.1 : 1.0)
    
    totalPayableMinutes += buckets[key] * (multiplier * (isND ? (settings.nightDiffRate || 1.1) : 1.0));
  }

  result.payableMinutes = totalPayableMinutes;
  result.buckets = buckets;
  result.totalPayableHours = totalPayableMinutes / 60;

  return result;
}

/**
 * Optimized version of markAbsents that processes multiple users in bulk
 */
async function ensureAbsentsMarked(dateOverride = null) {
  try {
    const now = await getSystemTime();
    
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
    // Use local getDay since todayStr is treated as UTC midnight by new Date(str)
    // but we want the day of the week for that date.
    // actually new Date("YYYY-MM-DD").getUTCDay() is safest for absolute day.
    const dayOfWeek = new Date(todayStr).getUTCDay(); // 0 = Sunday

    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // logic: if it's a PAST day, it's ALWAYS past cutoff. 
    // If it's TODAY, it's past cutoff only after 5:30 PM.
    const isPastCutoff = (todayStr < currentTodayStr) || (hour > 17) || (hour === 17 && minute >= 30);

    // 1. Process On-Field Work (Bulk)
    // Find all users who have an approved On-Field request today but no logs in report table
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
           VALUES (:userId, :todayStr, '17:30:00', 2, 5)
           ON CONFLICT DO NOTHING`, 
          { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
        );
        
        // Insert entry into employee_Logging_report (for payroll/reporting)
        await sequelize.query(
          `INSERT INTO "employee_Logging_report" 
            ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
           VALUES (:userId, :todayStr, '["08:30:00"]', '["17:30:00"]', 5, 2)
           ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
          { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
        );
        console.log(`[SYSTEM] Auto-credited On-Field: ${user.user_FirstName} ${user.user_LastName}`);
      }
    }

    // 2. Process Absents and Exempt Users (Bulk) - Only past 5:30 PM (or for past days) and not Sunday
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
      // Find all users where user_RoleId = 1 (Admin Manager) but no report exists yet
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
             VALUES (:userId, :todayStr, '08:30:00', 1, 6), (:userId, :todayStr, '17:30:00', 2, 6)
             ON CONFLICT DO NOTHING`, 
          { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
          
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '["08:30:00"]', '["17:30:00"]', 6, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
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
             -- Check for Approved Leave (Vacation or Sick)
             SELECT 1 FROM "emp_Request" er
             LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
             LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
             WHERE er."user_Id" = u."user_Id" 
               AND er."emp_reqStatusId" = 2
               AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate")
           )`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (absentUsers.length > 0) {
        console.log(`[SYSTEM] Marking ${absentUsers.length} users as Absent on ${todayStr}.`);
        for (const user of absentUsers) {
          const userId = user.user_Id;

          // Insert into user_logging
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, '17:30:00', 2, 3)
             ON CONFLICT DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );

          // Insert into report table
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '[]', '[]', 3, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
          
          console.log(`[SYSTEM] Marked Absent: ${user.user_FirstName} ${user.user_LastName}`);
        }
      } else {
        console.log(`[DEBUG] No new absents to mark for ${todayStr}.`);
      }
    } else {
      console.log(`[DEBUG] Skipping absence check for ${todayStr}: Not past cutoff or is Sunday.`);
    }
  } catch (error) {
    console.error("[ERROR] ensureAbsentsMarked:", error);
  }
}

module.exports = { ensureAbsentsMarked, calculateMultiBucketHours };
