const { sequelize, SystemSettings, Holiday, User, Notification } = require("../config/sequelize.js");
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
    if (totalHours < 1) { newStatus = 7; actionTaken = "Accidental tap (<1hr). Leave remains."; }
    else if (totalHours >= 1 && totalHours <= 5) { refundAmount = 0.5; actionTaken = "Converted to Half-Day Work."; }
    else if (totalHours > 5) { refundAmount = 1.0; actionTaken = "Voided by Full-Day Work."; }
    if (leave.HD_Id && totalHours >= 1) { refundAmount = 0.5; actionTaken = "Half-Day Leave voided."; }
    const t = await sequelize.transaction();
    try {
      const year = new Date(logDate).getFullYear();
      if (newStatus === 7) {
        await sequelize.query(`UPDATE "employee_Logging_report" SET "attendance_StatusId" = 7 WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
        await sequelize.query(`UPDATE "user_logging" SET "attendance_StatusId" = 7 WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
      } else if (refundAmount > 0) {
        await sequelize.query(`UPDATE "employee_Logging_report" SET "attendance_StatusId" = CASE WHEN "attendance_StatusId" = 4 OR "attendance_StatusId" IS NULL THEN 1 ELSE "attendance_StatusId" END WHERE "user_id" = :userId AND "log_Date" = :logDate`, { replacements: { userId, logDate }, transaction: t });
      }
      if (totalHours < 1) { await t.commit(); return { success: true, message: actionTaken }; }
      if (leave.vacL_Id && leave.vlPay === 1) await sequelize.query(`UPDATE "Leave_Balance" SET "VL_used" = "VL_used" - :refundAmount WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year }, transaction: t });
      else if (leave.SickL_Id && leave.slPay === 1) await sequelize.query(`UPDATE "Leave_Balance" SET "SL_used" = "SL_used" - :refundAmount WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year }, transaction: t });
      else if (leave.statL_Id && leave.stPay === 1 && Number(leave.emp_reqTypeId) === 10) await sequelize.query(`UPDATE "Leave_Balance" SET "SoloParent_used" = "SoloParent_used" - :refundAmount WHERE "user_Id" = :userId AND "year" = :year`, { replacements: { refundAmount, userId, year }, transaction: t });
      if (leave.vacL_Id) await sequelize.query(`UPDATE "Vacation_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "vacL_Id" = :vacL_Id`, { replacements: { refundAmount, vacL_Id: leave.vacL_Id }, transaction: t });
      else if (leave.SickL_Id) await sequelize.query(`UPDATE "Sick_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "SickL_Id" = :SickL_Id`, { replacements: { refundAmount, SickL_Id: leave.SickL_Id }, transaction: t });
      else if (leave.EL_Id) await sequelize.query(`UPDATE "Emergency_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "EL_Id" = :EL_Id`, { replacements: { refundAmount, EL_Id: leave.EL_Id }, transaction: t });
      else if (leave.statL_Id) await sequelize.query(`UPDATE "Statutory_Leave" SET "NoDays" = "NoDays" - :refundAmount WHERE "statL_Id" = :statL_Id`, { replacements: { refundAmount, statL_Id: leave.statL_Id }, transaction: t });
      await sequelize.query(`UPDATE "emp_Request" SET "system_remarks" = COALESCE("system_remarks", '') || :remark WHERE "emp_reqId" = :emp_reqId`, { replacements: { remark: `\n[${new Date().toISOString()}] SYSTEM: ${actionTaken} ${refundAmount} day(s) refunded.`, emp_reqId: leave.emp_reqId }, transaction: t });
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
  const startCursor = new Date(`${logDate}T${firstIn}`);
  let endCursor = new Date(`${logDate}T${lastOut}`);
  if (endCursor < startCursor) endCursor.setDate(endCursor.getDate() + 1);
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
    const [dayOT] = await sequelize.query(`SELECT * FROM "emp_Request" WHERE "user_Id" = :userId AND "emp_reqTypeId" = 1 AND "emp_reqStatusId" = 2 AND "OT_DateOf" = :logDate`, { replacements: { userId, logDate }, type: QueryTypes.SELECT });
    let firstIn = inArr[0], lastOut = outArr[outArr.length - 1];
    const shiftStart = (user?.user_ShiftId === 2) ? (settings?.eveningShiftStart || "20:30:00") : (settings?.morningShiftStart || "08:30:00");
    const shiftEnd = (user?.user_ShiftId === 2) ? (settings?.eveningShiftEnd || "05:30:00") : (settings?.morningShiftEnd || "17:30:00");
    if (firstIn && firstIn < shiftStart && user?.user_ShiftId !== 2) firstIn = shiftStart;
    if (!dayOT && lastOut && lastOut > shiftEnd && user?.user_ShiftId !== 2) lastOut = shiftEnd;
    const stats = await calculateMultiBucketHours(firstIn, lastOut, logDate, user?.user_ShiftId, settings, holidays);
    await report.update({ reg_hrs: stats.reg_hrs, nd_hrs: stats.nd_hrs, ot_hrs: stats.ot_hrs, holiday_hrs: stats.hol_hrs, total_payable_hrs: stats.totalPayableHours });
    return { success: true, stats };
  } catch (error) { return { success: false, error: error.message }; }
}

function mapLogsToBuckets(inArr, outArr, settings) {
  const ins = (inArr || []).map(t => t.substring(0, 5)).filter(t => t && t !== "—" && t !== "00:00").sort();
  const outs = (outArr || []).map(t => t.substring(0, 5)).filter(t => t && t !== "—" && t !== "00:00").sort();
  if (ins.length === 0 && outs.length === 0) return { morning_In: "—", morning_Out: "—", afternoon_In: "—", afternoon_Out: "—" };
  const morning_In = ins[0] || "—";
  const afternoon_Out = outs[outs.length - 1] || "—";
  let morning_Out = "—";
  const outCandidates = outs.filter(o => o !== afternoon_Out && timeToMins(o) > timeToMins(morning_In) && timeToMins(o) < timeToMins("14:30"));
  if (outCandidates.length > 0) morning_Out = outCandidates[outCandidates.length - 1];
  let afternoon_In = "—";
  const inCandidates = ins.filter(i => i !== morning_In && timeToMins(i) < timeToMins("16:00") && (morning_Out === "—" ? timeToMins(i) > timeToMins("11:30") : timeToMins(i) > timeToMins(morning_Out)));
  if (inCandidates.length > 0) afternoon_In = inCandidates[0];
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
    const now = await getSystemTime();
    let todayStr = dateOverride instanceof Date ? formatDateLocal(dateOverride) : (dateOverride || formatDateLocal(now));
    const dayOfWeek = new Date(todayStr).getUTCDay();
    if (dayOfWeek !== 0) {
      const onLeaveUsers = await sequelize.query(`SELECT DISTINCT er."user_Id" FROM "emp_Request" er LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId" LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId" LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId" LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId" LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId" WHERE er."emp_reqStatusId" = 2 AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate" OR el."DateOfLeave" = :todayStr OR hd."DateOfLeave" = :todayStr OR :todayStr BETWEEN st."StartDate" AND st."EndDate")`, { replacements: { todayStr }, type: QueryTypes.SELECT });
      for (const u of onLeaveUsers) await sequelize.query(`INSERT INTO "employee_Logging_report" ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId") VALUES (:userId, :todayStr, '[]', '[]', 4, 2) ON CONFLICT ("user_id", "log_Date") DO NOTHING`, { replacements: { userId: u.user_Id, todayStr }, type: QueryTypes.INSERT });
    }
  } catch (error) { console.error("[ERROR] ensureAbsentsMarked:", error); }
}

module.exports = { ensureAbsentsMarked, calculateMultiBucketHours, resolveLeaveConflict, calculateAndStoreAttendanceUnits, mapLogsToBuckets };
