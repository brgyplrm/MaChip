const { sequelize, SystemSettings, Holiday, User, Notification, user_logging, employee_Logging_report } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("./systemTime.js");
const { logTransaction } = require("./logger");

async function resolveLeaveConflict(userId, logDate) {
  try {
    const [report] = await sequelize.query(`SELECT "time_Logged_inArr", "time_Logged_outArr" FROM "employee_Logging_report" WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, type: QueryTypes.SELECT });
    if (!report) return { success: false, message: "No report." };
    const inArr = JSON.parse(report.time_Logged_inArr || "[]");
    const outArr = JSON.parse(report.time_Logged_outArr || "[]");
    if (inArr.length === 0 || outArr.length === 0) return { success: false, message: "Incomplete." };
    let totalMinutesWorked = 0;
    const segments = Math.min(inArr.length, outArr.length);
    for (let i = 0; i < segments; i++) {
      const start = new Date(`${logDate}T${inArr[i]}`);
      const end = new Date(`${logDate}T${outArr[i]}`);
      if (end > start) totalMinutesWorked += Math.floor((end - start) / 60000);
    }
    const totalHours = totalMinutesWorked / 60;
    const approvedLeave = await sequelize.query(`SELECT er."emp_reqId", er."emp_reqTypeId", vl."vacL_Id", vl."WithPayID" as "vlPay", sl."SickL_Id", sl."WithPayID" as "slPay", el."EL_Id", el."WithPayID" as "elPay", hd."HD_Id", hd."WithPayID" as "hdPay", st."statL_Id", st."WithPayID" as "stPay" FROM "emp_Request" er LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId" LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId" LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId" LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId" LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId" WHERE er."user_Id" = :userId AND er."emp_reqStatusId" = 2 AND ((:logDate BETWEEN vl."StartDate" AND vl."EndDate") OR (:logDate BETWEEN sl."StartDate" AND sl."EndDate") OR (el."DateOfLeave" = :logDate) OR (hd."DateOfLeave" = :logDate) OR (:logDate BETWEEN st."StartDate" AND st."EndDate")) LIMIT 1`, { replacements: { userId, logDate }, type: QueryTypes.SELECT });
    if (approvedLeave.length === 0) return { success: true, message: "No overlap." };
    const leave = approvedLeave[0];
    let refundAmount = 0, actionTaken = "", newStatus = null;
    
    // NEW THRESHOLD LOGIC (Align with User Request)
    if (totalHours < 4) { 
      newStatus = 7; 
      actionTaken = "Incidental Visit (<4hrs). Leave remains."; 
    } else if (totalHours >= 4 && totalHours < 7) { 
      refundAmount = 0.5; 
      actionTaken = "Converted to Half-Day Work."; 
    } else if (totalHours >= 7) { 
      refundAmount = 1.0; 
      actionTaken = "Voided by Full-Day Work."; 
    }
    
    if (leave.HD_Id && totalHours >= 2) { 
      refundAmount = 0.5; 
      actionTaken = "Half-Day Leave voided."; 
    }

    // PREVENT DOUBLE REFUND: Check if this date was already processed in system_remarks
    const [currentReq] = await sequelize.query(`SELECT "system_remarks" FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`, { replacements: { emp_reqId: leave.emp_reqId }, type: QueryTypes.SELECT });
    if (currentReq && currentReq.system_remarks && currentReq.system_remarks.includes(`[${logDate}]`)) {
        // If already voided by 1.0, don't refund more. If already half-voided (0.5) and now full-day (1.0), refund the difference (0.5).
        if (currentReq.system_remarks.includes(`${logDate}] SYSTEM: Voided by Full-Day Work`)) return { success: true, message: "Already voided." };
        if (currentReq.system_remarks.includes(`${logDate}] SYSTEM: Converted to Half-Day Work`) && refundAmount === 1.0) {
            refundAmount = 0.5; // Only refund the remaining half
            actionTaken = "Upgraded to Full-Day Work Void.";
        } else {
            return { success: true, message: "Already processed." };
        }
    }

    const t = await sequelize.transaction();
    try {
      const year = new Date(logDate).getFullYear();
      const now = await getSystemTime();
      const nowStr = formatDateLocal(now) + " " + now.toTimeString().split(" ")[0];

      if (newStatus === 7) {
        await sequelize.query(`UPDATE "employee_Logging_report" SET "attendance_StatusId" = 7, "reg_hrs" = 0, "total_payable_hrs" = 0 WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
        await sequelize.query(`UPDATE "user_logging" SET "attendance_StatusId" = 7 WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
        await t.commit(); 
        return { success: true, message: actionTaken }; 
      }

      if (refundAmount > 0) {
        await sequelize.query(`UPDATE "employee_Logging_report" SET "attendance_StatusId" = CASE WHEN "attendance_StatusId" = 4 OR "attendance_StatusId" IS NULL THEN 1 ELSE "attendance_StatusId" END WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
      }
      
      const isPaid = Number(leave.vlPay) === 1 || Number(leave.slPay) === 1 || Number(leave.stPay) === 1 || Number(leave.hdPay) === 1 || Number(leave.elPay) === 1 || [6, 7, 8, 9, 10, 11, 12].includes(Number(leave.emp_reqTypeId));

      if (refundAmount > 0 && isPaid) {
        if (leave.vacL_Id) await sequelize.query(`UPDATE "Leave_Balance" SET "VL_used" = "VL_used" - :refundAmount, "VL_balance" = "VL_balance" + :refundAmount, "updatedAt" = :now WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year, now: nowStr }, transaction: t });
        else if (leave.SickL_Id) await sequelize.query(`UPDATE "Leave_Balance" SET "SL_used" = "SL_used" - :refundAmount, "SL_balance" = "SL_balance" + :refundAmount, "updatedAt" = :now WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year, now: nowStr }, transaction: t });
        else if (leave.statL_Id && Number(leave.emp_reqTypeId) === 10) await sequelize.query(`UPDATE "Leave_Balance" SET "SoloParent_used" = "SoloParent_used" - :refundAmount, "SoloParent_balance" = "SoloParent_balance" + :refundAmount, "updatedAt" = :now WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year, now: nowStr }, transaction: t });
      }

      if (leave.vacL_Id) await sequelize.query(`UPDATE "Vacation_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "vacL_Id" = :vacL_Id`, { replacements: { refundAmount, vacL_Id: leave.vacL_Id }, transaction: t });
      else if (leave.SickL_Id) await sequelize.query(`UPDATE "Sick_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "SickL_Id" = :SickL_Id`, { replacements: { refundAmount, SickL_Id: leave.SickL_Id }, transaction: t });
      else if (leave.EL_Id) await sequelize.query(`UPDATE "Emergency_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "EL_Id" = :EL_Id`, { replacements: { refundAmount, EL_Id: leave.EL_Id }, transaction: t });
      else if (leave.statL_Id) await sequelize.query(`UPDATE "Statutory_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "statL_Id" = :statL_Id`, { replacements: { refundAmount, statL_Id: leave.statL_Id }, transaction: t });
      
      await sequelize.query(`UPDATE "emp_Request" SET "system_remarks" = COALESCE("system_remarks", \u0027\u0027) || :remark WHERE "emp_reqId" = :emp_reqId`, { replacements: { remark: `\n[${logDate}] SYSTEM: ${actionTaken} ${refundAmount} day(s) refunded.`, emp_reqId: leave.emp_reqId }, transaction: t });
      await t.commit();
      await Notification.create({ user_Id: userId, title: "Leave Adjustment", message: `Your leave on ${logDate} has been adjusted.`, isRead: false });
      return { success: true, message: actionTaken, refundAmount };
    } catch (err) { await t.rollback(); throw err; }
  } catch (error) { return { success: false, error: error.message }; }
}

async function calculateMultiBucketHours(firstIn, lastOut, logDate, userShiftId, settings = null, holidays = null) {
  const result = { totalRawMinutes: 0, reg_hrs: 0, nd_hrs: 0, ot_hrs: 0, holiday_hrs: 0, totalPayableHours: 0 };
  if (!firstIn || !lastOut) return result;
  if (!settings) settings = await SystemSettings.findOne();
  if (!holidays) holidays = await Holiday.findAll();
  const holidayMap = {}; 
  holidays.forEach(h => { 
    const dStr = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
    if (!holidayMap[dStr]) holidayMap[dStr] = { types: [], count: 0 };
    holidayMap[dStr].types.push(h.type);
    holidayMap[dStr].count++;
  });
  const isNightShiftAllowed = Boolean(settings?.enableNightShift && userShiftId === 2);
  const startCursor = new Date(`${logDate}T${firstIn}`);
  let endCursor = new Date(`${logDate}T${lastOut}`);
  if (endCursor < startCursor) {
    if (isNightShiftAllowed) {
      endCursor.setDate(endCursor.getDate() + 1);
    } else {
      // Day shift or night shift disabled: invalid backwards range, no overnight rollover!
      return result;
    }
  }
  const totalMinutes = Math.floor((endCursor - startCursor) / 60000);
  result.totalRawMinutes = totalMinutes;
  if (totalMinutes <= 0) return result;
  let workMinutesCount = 0;
  let totalUnits = 0, regUnits = 0, otUnits = 0, ndUnits = 0, holUnits = 0;
  for (let i = 0; i < totalMinutes; i++) {
    const lunchDur = settings?.lunchDuration || 60;
    const breakThreshold = settings?.flexibleBreakThreshold || 300;
    if (workMinutesCount === 240 && totalMinutes >= breakThreshold) { i += lunchDur; if (i >= totalMinutes) break; }
    const currentMinute = new Date(startCursor.getTime() + i * 60000);
    const dateStr = formatDateLocal(currentMinute);
    const hour = currentMinute.getHours();
    const holidayData = holidayMap[dateStr] || { types: [], count: 0 };
    const isSunday = currentMinute.getDay() === 0;
    const isNightDiff = (hour >= 22 || hour < 6);
    let rateKey = "ordinaryDayRate";
    if (holidayData.count >= 2 && holidayData.types.includes("Regular Holiday")) rateKey = isSunday ? "doubleRegularHolidayRestDayRate" : "doubleRegularHolidayRate";
    else if (holidayData.types.includes("Regular Holiday")) rateKey = isSunday ? "regularHolidayRestDayRate" : "regularHolidayRate";
    else if (holidayData.count >= 2 && holidayData.types.includes("Special Holiday")) rateKey = isSunday ? "doubleSpecialDayRestDayRate" : "doubleSpecialDayRate";
    else if (holidayData.types.includes("Special Holiday")) rateKey = isSunday ? "specialDayRestDayRate" : "specialDayRate";
    else if (isSunday) rateKey = "restDayRate";
    workMinutesCount++;
    const isOT = workMinutesCount > 480;
    const baseMult = settings[rateKey] || 1.0;
    const otMult = isOT ? (settings.overtimeRate || 1.25) : 1.0;
    const ndMult = isNightDiff ? (settings.nightDiffRate || 1.1) : 1.0;
    totalUnits += (baseMult * otMult * ndMult);
    regUnits += 1;
    if (baseMult > 1.0) holUnits += (baseMult - 1);
    if (isOT) otUnits += (baseMult * (otMult - 1));
    if (isNightDiff) ndUnits += (baseMult * otMult * (ndMult - 1));
  }
  result.reg_hrs = Math.round((regUnits / 60) * 100) / 100;
  result.hol_hrs = Math.round((holUnits / 60) * 100) / 100;
  result.ot_hrs = Math.round((otUnits / 60) * 100) / 100;
  result.nd_hrs = Math.round((ndUnits / 60) * 100) / 100;
  result.totalPayableHours = Math.round((totalUnits / 60) * 100) / 100;
  return result;
}

async function calculateAndStoreAttendanceUnits(userId, logDate) {
  try {
    const { employee_Logging_report, SystemSettings, Holiday, User } = require("../config/sequelize.js");
    const report = await employee_Logging_report.findOne({ where: { user_id: userId, log_Date: logDate } });
    if (!report) return { success: false, message: "No report." };
    const inArr = JSON.parse(report.time_Logged_inArr || "[]");
    const outArr = JSON.parse(report.time_Logged_outArr || "[]");
    if (inArr.length === 0 || outArr.length === 0) return { success: false, message: "Incomplete." };
    const user = await User.findByPk(userId);
    const settings = await SystemSettings.findOne();
    const holidays = await Holiday.findAll();
    const [dayOT] = await sequelize.query(`SELECT ot.* FROM "Overtime_Request" ot JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId" WHERE er."user_Id" = :userId AND er."emp_reqTypeId" = 1 AND er."emp_reqStatusId" = 2 AND ot."OT_DateOf" = :logDate`, { replacements: { userId, logDate }, type: QueryTypes.SELECT });
    
    // Determine regular work window
    const mStart = settings?.morningShiftStart?.substring(0, 5) || "08:30";
    const mEnd   = settings?.morningShiftEnd?.substring(0, 5) || "17:30";
    
    // MIXED LOG LOGIC: Check if we should upgrade from Irregular (8) to a regular status
    const isNightShiftAllowed = Boolean(settings?.enableNightShift && user?.user_ShiftId === 2);
    const shiftStart = isNightShiftAllowed ? (settings?.eveningShiftStart || "20:30:00") : (settings?.morningShiftStart || "08:30:00");
    const shiftEnd = isNightShiftAllowed ? (settings?.eveningShiftEnd || "05:30:00") : (settings?.morningShiftEnd || "17:30:00");

    const firstRegularIn = !isNightShiftAllowed ? inArr.find(t => t && typeof t === "string" && t.substring(0, 5) >= "05:30" && t.substring(0, 5) < shiftEnd.substring(0, 5)) : (inArr.find(t => t && typeof t === "string") || inArr[0]);
    if (report.attendance_StatusId === 8 && firstRegularIn) {
      const graceTimeStr = settings?.gracePeriod || "08:35:00";
      const graceTime = graceTimeStr.substring(0, 5);
      let newStatus = 1;
      if (firstRegularIn.substring(0, 5) >= "12:00") {
        newStatus = 4; // Half Day
      } else if (firstRegularIn.substring(0, 5) > graceTime) {
        newStatus = 2; // Late
      }
      await report.update({ attendance_StatusId: newStatus });
      report.attendance_StatusId = newStatus;
    }

    let firstIn = (!isNightShiftAllowed && firstRegularIn) ? firstRegularIn : inArr.find(t => t && typeof t === "string");
    let lastOut = (outArr || []).slice().reverse().find(t => t && typeof t === "string") || null;
    
    // Clamp to shift boundaries for REGULAR hours calculation
    if (firstIn && firstIn < shiftStart && !isNightShiftAllowed) firstIn = shiftStart;
    if (!dayOT && lastOut && lastOut > shiftEnd && !isNightShiftAllowed) lastOut = shiftEnd;
    if (dayOT && dayOT.HrTo && lastOut > dayOT.HrTo) lastOut = dayOT.HrTo;
    
    let stats = { reg_hrs: 0, nd_hrs: 0, ot_hrs: 0, hol_hrs: 0, totalPayableHours: 0 };
    if (!firstIn || !lastOut || (firstIn >= shiftEnd && !dayOT && !isNightShiftAllowed)) {
      // Outside shift hours without approved OT, 0 hours
    } else {
      stats = await calculateMultiBucketHours(firstIn, lastOut, logDate, isNightShiftAllowed ? 2 : 1, settings, holidays);
    }
    
    // If status is Incidental Visit (7), Irregular (8), or Absent (3), zero out the payable hours
    if (report.attendance_StatusId === 7 || report.attendance_StatusId === 8 || report.attendance_StatusId === 3) {
      stats.reg_hrs = 0;
      stats.nd_hrs = 0;
      stats.ot_hrs = 0;
      stats.hol_hrs = 0;
      stats.totalPayableHours = 0;
    } else {
      // Threshold check: Zero out regular payable hours if below workHourThreshold
      // Half-Day attendees (status 4) or approved half-day leave have a reduced threshold of 3.0 hrs
      const hasHalfDayLeave = await sequelize.query(
        `SELECT er."emp_reqId" FROM "emp_Request" er
         LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
         WHERE er."user_Id" = :userId AND er."emp_reqStatusId" = 2 AND (er."emp_reqTypeId" = 7 OR hd."DateOfLeave" = :logDate) LIMIT 1`,
        { replacements: { userId, logDate }, type: QueryTypes.SELECT }
      );
      const isHalfDay = report.attendance_StatusId === 4 || hasHalfDayLeave.length > 0;
      const baseThreshold = settings?.workHourThreshold !== undefined ? parseFloat(settings.workHourThreshold) : 4.0;
      const threshold = isHalfDay ? 3.0 : baseThreshold;
      const isExempt = Boolean(user?.is_time_exempt) || (user?.user_RoleId === 1);
      if (!isExempt && stats.reg_hrs < threshold) {
        stats.reg_hrs = 0;
        stats.totalPayableHours = Math.round((stats.ot_hrs + stats.nd_hrs + stats.hol_hrs) * 100) / 100;
      }
    }

    const updateData = {
      reg_hrs: stats.reg_hrs,
      nd_hrs: stats.nd_hrs,
      ot_hrs: stats.ot_hrs,
      holiday_hrs: stats.hol_hrs,
      total_payable_hrs: stats.totalPayableHours
    };
    if (dayOT && stats.ot_hrs > 0 && lastOut >= shiftEnd) {
      updateData.logged_StatusId = 6; // Overtime OUT
    }

    await report.update(updateData);
    return { success: true, stats };
  } catch (error) { return { success: false, error: error.message }; }
}
function mapLogsToBuckets(inArr, outArr, settings, otStartTime = null) {
  let ins = (inArr || []).filter(t => t && typeof t === "string").map(t => t.substring(0, 5)).filter(t => t && t !== "—" && t !== "00:00").sort();
  let outs = (outArr || []).filter(t => t && typeof t === "string").map(t => t.substring(0, 5)).filter(t => t && t !== "—" && t !== "00:00").sort();
  
  // Define thresholds (allow all valid timestamps across the 24-hour cycle)
  const irregularStart = "23:59";
  const irregularEnd = "00:00";

  // Filter Ins: Keep all valid timestamps
  ins = ins.filter(time => {
    if (otStartTime && time >= otStartTime) return true;
    const mins = timeToMins(time);
    return mins >= timeToMins(irregularEnd) && mins <= timeToMins(irregularStart);
  });

  // Filter Outs: Allow shift clock-outs
  outs = outs.filter(time => {
    if (otStartTime && time >= otStartTime) return true;
    const mins = timeToMins(time);
    return mins >= timeToMins(irregularEnd) && mins <= timeToMins(irregularStart);
  });

  let morning_In = "—";
  let morning_Out = "—";
  let afternoon_In = "—";
  let afternoon_Out = "—";

  // If first In is at or after 12:00 PM noon, it is Afternoon In
  if (ins.length > 0 && timeToMins(ins[0]) >= 720) {
    afternoon_In = ins[0];
    const matchingOuts = outs.filter(o => timeToMins(o) >= timeToMins(afternoon_In));
    if (matchingOuts.length > 0) {
      afternoon_Out = matchingOuts[matchingOuts.length - 1];
    }
    return { morning_In, morning_Out, afternoon_In, afternoon_Out };
  }

  if (ins.length > 0) {
    morning_In = ins[0];
  }

  // Identify Lunch Interval (Typically 30-70 minutes)
  let foundLunchBreak = false;
  for (let i = 0; i < outs.length; i++) {
    const currentOut = outs[i];
    // Find the immediately next "In" after this "Out"
    const matchingIn = ins.find(input => timeToMins(input) > timeToMins(currentOut));

    if (matchingIn && timeToMins(currentOut) >= timeToMins("11:30")) {
      const diff = timeToMins(matchingIn) - timeToMins(currentOut);
      if (diff >= 30 && diff <= 75) {
        morning_Out = currentOut;
        afternoon_In = matchingIn;
        foundLunchBreak = true;
        break;
      }
    }
  }

  // If no clear lunch interval found, use the standard cutoff logic
  if (!foundLunchBreak) {
    if (outs.length > 0) {
      const lastOut = outs[outs.length - 1];
      if (timeToMins(lastOut) > timeToMins("13:30")) {
        afternoon_Out = lastOut;
        // Search for best morning out (latest out before 1:00 PM)
        const bestMOut = outs.filter(o => timeToMins(o) < timeToMins("13:00") && timeToMins(o) > timeToMins(morning_In)).pop();
        if (bestMOut) {
          morning_Out = bestMOut;
          // Try to find the earliest in after morning_Out to be afternoon_In
          const bestAIn = ins.find(i => timeToMins(i) > timeToMins(morning_Out) && timeToMins(i) < timeToMins(afternoon_Out));
          if (bestAIn) afternoon_In = bestAIn;
        }
      } else {
        morning_Out = lastOut;
      }
    }
  } else {
    // If lunch break was found, the final tap is afternoon out
    afternoon_Out = outs[outs.length - 1] === morning_Out ? "—" : outs[outs.length - 1];
  }

  return { morning_In, morning_Out, afternoon_In, afternoon_Out };
}

function timeToMins(timeStr) {
  if (!timeStr || timeStr === "—") return 0;
  const parts = timeStr.split(":");
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

async function ensureAbsentsMarked(dateOverride = null) {
  try {
    const settings = await SystemSettings.findOne();
    const shiftEndTime = settings?.morningShiftEnd || "17:30:00";
    const now = await getSystemTime();
    const todayStr = dateOverride instanceof Date ? formatDateLocal(dateOverride) : (dateOverride || formatDateLocal(now));
    
    // SAFEGUARD: If checking "today", only proceed if it's after 5:30 PM
    if (todayStr === formatDateLocal(now)) {
      const hour = now.getHours();
      if (hour < 17 || (hour === 17 && now.getMinutes() < 30)) {
        return; // Workday not over yet, skip to avoid premature absence marking
      }
    }

    // 1. Skip Sundays (Standard Rest Day)
    const dayOfWeek = new Date(todayStr).getUTCDay();
    if (dayOfWeek === 0) return;

    // 2. Skip Holidays
    const isHoliday = await Holiday.findOne({ where: { date: todayStr } });
    if (isHoliday) return;

    // 3. Get all active staff (Roles: 1-Admin, 2-Supervisor, 3-Employee, 4-Accountant)
    // Also include staff that were archived ON or AFTER today (to catch final day logs)
    const employees = await User.findAll({
      where: {
        user_RoleId: [1, 2, 3, 4],
        user_Id: { [sequelize.Sequelize.Op.ne]: 999 },
        [sequelize.Sequelize.Op.or]: [
          { deletedAt: null },
          { deletedAt: { [sequelize.Sequelize.Op.gte]: todayStr } }
        ]
      },
      paranoid: false // Required to see soft-deleted users
    });

    if (employees.length === 0) return;

    for (const emp of employees) {
      const userId = emp.user_Id;

      // NIGHT SHIFT SAFEGUARD: Night shift (20:30 - 05:30) employees must not be marked absent during daytime 17:30 run
      if (settings?.enableNightShift && Number(emp.user_ShiftId) === 2) {
        continue;
      }

      // Check if already has a record in report
      const existingReport = await employee_Logging_report.findOne({ where: { user_id: userId, log_Date: todayStr } });
      
      // EXEMPT LOGIC: Checked via is_time_exempt toggle OR legacy President in Admin Dept
      const isTimeExempt = Boolean(emp.is_time_exempt) || 
        (emp.position?.toUpperCase() === 'PRESIDENT' && emp.department?.toUpperCase() === 'ADMIN');

      if (isTimeExempt) {
        const standardInArr = JSON.stringify(["08:30:00", "13:00:00"]);
        const standardOutArr = JSON.stringify(["12:00:00", "17:30:00"]);

        if (!existingReport) {
          await employee_Logging_report.create({
            user_id: userId,
            log_Date: todayStr,
            time_Logged_inArr: standardInArr,
            time_Logged_outArr: standardOutArr,
            attendance_StatusId: 6, // Exempt
            logged_StatusId: 4, // Closed (Afternoon OUT)
            reg_hrs: 8,
            total_payable_hrs: 8
          });

          await user_logging.create({
            user_id: userId,
            log_Date: todayStr,
            time_Logged: "08:30:00",
            logged_StatusId: 7, // System Generated
            attendance_StatusId: 6
          });
        } else if (existingReport.attendance_StatusId === 3 || existingReport.attendance_StatusId === 8 || parseFloat(existingReport.reg_hrs || 0) === 0) {
          await existingReport.update({
            time_Logged_inArr: standardInArr,
            time_Logged_outArr: standardOutArr,
            attendance_StatusId: 6,
            logged_StatusId: 4, // Closed (Afternoon OUT)
            reg_hrs: 8,
            total_payable_hrs: 8
          });

          const existingUserLog = await user_logging.findOne({ where: { user_id: userId, log_Date: todayStr } });
          if (existingUserLog) {
            await existingUserLog.update({
              time_Logged: "08:30:00",
              logged_StatusId: 7,
              attendance_StatusId: 6
            });
          } else {
            await user_logging.create({
              user_id: userId,
              log_Date: todayStr,
              time_Logged: "08:30:00",
              logged_StatusId: 7,
              attendance_StatusId: 6
            });
          }
        }
        continue;
      }

      if (existingReport) {
        // EXCEPTION: If the existing report is just "Irregular" (Status 8), we don't skip.
        // We want these users to be marked as Absent (Status 3) at the end of the day.
        if (existingReport.attendance_StatusId === 8) {
           await existingReport.update({ attendance_StatusId: 3 });
           console.log(`[ABSENT-AUTO] User ${userId} flagged as Absent (Only Irregular logs found) on ${todayStr}`);
        } else if (existingReport.attendance_StatusId === 3) {
          // Check if an approved request (Leave or On-field) now exists for this date
          const approvedRequestCheck = await sequelize.query(`
            SELECT er."emp_reqTypeId"
            FROM "emp_Request" er
            LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
            LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
            LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
            LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
            LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
            LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
            WHERE er."user_Id" = :userId AND er."emp_reqStatusId" = 2
              AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate"
                   OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate"
                   OR (:todayStr >= el."DateOfLeave" AND :todayStr <= (el."DateOfLeave" + INTERVAL '1 day' * (GREATEST(1, el."NoDays") - 1))::date)
                   OR hd."DateOfLeave" = :todayStr
                   OR :todayStr BETWEEN st."StartDate" AND st."EndDate"
                   OR ow."DateonField" = :todayStr)
            LIMIT 1
          `, { replacements: { userId, todayStr }, type: QueryTypes.SELECT });

          if (approvedRequestCheck.length > 0) {
            const typeId = approvedRequestCheck[0].emp_reqTypeId;
            const repairedStatusId = (typeId === 2) ? 1 : (typeId === 7 ? 4 : 5);
            await existingReport.update({ attendance_StatusId: repairedStatusId });
            await sequelize.query(
              `UPDATE "user_logging" 
               SET "attendance_StatusId" = :repairedStatusId 
               WHERE "user_id" = :userId AND "log_Date"::date = :todayStr::date AND "attendance_StatusId" = 3`,
              { replacements: { repairedStatusId, userId, todayStr }, type: QueryTypes.UPDATE }
            );
            await calculateAndStoreAttendanceUnits(userId, todayStr);
            console.log(`[AUTO-REPAIR] User ${userId} upgraded from Absent to Status ${repairedStatusId} on ${todayStr}`);
          }
        } else if (existingReport.attendance_StatusId === 1 || existingReport.attendance_StatusId === 2) {
          // Check for single-session morning attendees who abandoned the afternoon
          const inArr = JSON.parse(existingReport.time_Logged_inArr || "[]");
          const outArr = JSON.parse(existingReport.time_Logged_outArr || "[]");
          const lastOut = outArr[outArr.length - 1];
          const hasAfternoonScan = outArr.some(t => t >= "13:30:00") || inArr.some(t => t >= "12:30:00");
          if (!hasAfternoonScan && lastOut && lastOut < "13:30:00" && inArr.length > 0) {
            // Half Day: Worked morning only
            await existingReport.update({ attendance_StatusId: 4 });
            await calculateAndStoreAttendanceUnits(userId, todayStr);
            console.log(`[HALF-DAY-AUTO] User ${userId} updated to Half Day on ${todayStr}`);
          }
        }
        continue;
      }

      // THRESHOLD CHECK: Use dynamic threshold from settings (default to 4 if not found)
      const threshold = settings?.workHourThreshold || 4.0;
      const logs = await user_logging.findAll({ 
        where: { user_id: userId, log_Date: todayStr },
        order: [['time_Logged', 'ASC']]
      });

      if (logs.length >= 2) {
        const first = logs[0].time_Logged;
        const last = logs[logs.length - 1].time_Logged;
        const start = new Date(`${todayStr}T${first}`);
        const end = new Date(`${todayStr}T${last}`);
        const workedHours = (end - start) / 3600000;
        
        if (workedHours >= threshold) continue; // Skip as they have valid work hours
      } else if (logs.length === 1) {
        continue; // Even one log means they were there, so not "Absent"
      }

      // Check for approved requests (Leave or On-field)
      const approvedRequest = await sequelize.query(`
        SELECT er."emp_reqTypeId"
        FROM "emp_Request" er
        LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
        LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
        LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
        LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
        LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
        LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
        WHERE er."user_Id" = :userId AND er."emp_reqStatusId" = 2
          AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate"
               OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate"
               OR (:todayStr >= el."DateOfLeave" AND :todayStr <= (el."DateOfLeave" + INTERVAL '1 day' * (GREATEST(1, el."NoDays") - 1))::date)
               OR hd."DateOfLeave" = :todayStr
               OR :todayStr BETWEEN st."StartDate" AND st."EndDate"
               OR ow."DateonField" = :todayStr)
        LIMIT 1
      `, { replacements: { userId, todayStr }, type: QueryTypes.SELECT });

      if (approvedRequest.length > 0) {
        const typeId = approvedRequest[0].emp_reqTypeId;
        const statusId = (typeId === 2) ? 1 : (typeId === 7 ? 4 : 5); // 1 for On-field (worked), 4 for Half-Day, 5 for On-leave
        
        await employee_Logging_report.create({
          user_id: userId,
          log_Date: todayStr,
          time_Logged_inArr: "[]",
          time_Logged_outArr: "[]",
          attendance_StatusId: statusId,
          logged_StatusId: 2 // Closed
        });

        // Also add to user_logging for raw log visibility
        await user_logging.create({
          user_id: userId,
          log_Date: todayStr,
          time_Logged: shiftEndTime,
          logged_StatusId: 7, // System Generated
          attendance_StatusId: statusId
        });
        continue;
      }

      // Final check: If absolutely no logs, mark as Absent (Status 3)
      if (logs.length === 0) {
        await employee_Logging_report.create({
          user_id: userId,
          log_Date: todayStr,
          time_Logged_inArr: "[]",
          time_Logged_outArr: "[]",
          attendance_StatusId: 3,
          logged_StatusId: 2
        });

        await user_logging.create({
          user_id: userId,
          log_Date: todayStr,
          time_Logged: shiftEndTime,
          logged_StatusId: 7, // System Generated
          attendance_StatusId: 3
        });
      }
    }
  } catch (error) { console.error("[ERROR] ensureAbsentsMarked:", error); }
}

module.exports = { ensureAbsentsMarked, calculateMultiBucketHours, resolveLeaveConflict, calculateAndStoreAttendanceUnits, mapLogsToBuckets };
