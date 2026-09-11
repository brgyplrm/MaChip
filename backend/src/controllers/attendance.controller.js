const { 
  sequelize, 
  Notification, 
  User, 
  User_Hardware,
  user_logging, 
  logged_status, 
  attendance_status,
  SystemSettings,
  Holiday
} = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal, formatDuration } = require("../utils/systemTime.js");
const { logAudit, logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");
const { 
  calculateMultiBucketHours, 
  resolveLeaveConflict, 
  calculateAndStoreAttendanceUnits,
  mapLogsToBuckets 
} = require("../utils/attendanceHelper");

// ... (rest of imports)

// ── Mark Attendance ───────────────────────────────────────────────────────────
exports.getSummaryReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    const replacements = { startDate, endDate };
    let userFilter = "";
    if (user_Id && user_Id !== "All Employees") {
      userFilter = ` AND r."user_id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    const logs = await sequelize.query(
      `SELECT r."user_id", u."user_FirstName", u."user_LastName",
              COUNT(CASE WHEN r."attendance_StatusId" = 3 THEN 1 END) as "absences",
              SUM(COALESCE(r."tardiness_mins", 0)) as "tardinessMins",
              COUNT(CASE WHEN r."attendance_StatusId" = 4 THEN 1 END) as "leaves",
              SUM(COALESCE(r."ot_hrs", 0)) as "otHrs"
       FROM "employee_Logging_report" r
       JOIN "User" u ON r."user_id" = u."user_Id"
       WHERE r."log_Date" BETWEEN :startDate AND :endDate
       ${userFilter}
       GROUP BY r."user_id", u."user_FirstName", u."user_LastName"`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAttendance = async (req, res) => {
  let { forcedStatus, user_Id, log_Type } = req.body;

  if (!forcedStatus && log_Type) {
    const type = log_Type.toLowerCase();
    if (type.includes("in")) forcedStatus = 1;
    else if (type.includes("out")) forcedStatus = 2;
  }

  try {
    const now = await getSystemTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const timeStr = now.toTimeString().split(" ")[0];

    // ── BULK CLOCK OUT LOGIC ───────────────────────────────────────────────
    if (user_Id === "all" && forcedStatus === 2) {
      const activeReports = await sequelize.query(
        `SELECT r."user_id" FROM "employee_Logging_report" r WHERE r."log_Date" = :todayStr AND r."logged_StatusId" = 1`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (activeReports.length === 0) return res.status(200).json({ message: "No employees are currently clocked in." });

      const settings = await SystemSettings.findOne();
      const lStartStr = settings?.lunchStartThreshold || "11:30:00";
      const lEndStr   = settings?.lunchEndThreshold   || "13:30:00";
      const lStart = parseInt(lStartStr.split(":")[0]) * 60 + parseInt(lStartStr.split(":")[1]);
      const lEnd   = parseInt(lEndStr.split(":")[0])   * 60 + parseInt(lEndStr.split(":")[1]);

      for (const report of activeReports) {
        const targetId = report.user_id;
        const totalMinutes = now.getHours() * 60 + now.getMinutes();
        const nextStatus = (totalMinutes >= lStart && totalMinutes < lEnd) ? 3 : 2;

        await sequelize.query(
          `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId") VALUES (:targetId, :todayStr, :timeStr, :nextStatus)`,
          { replacements: { targetId, todayStr, timeStr, nextStatus }, type: QueryTypes.INSERT }
        );

        const rep = await sequelize.query(`SELECT "time_Logged_outArr" FROM "employee_Logging_report" WHERE "user_id" = :targetId AND "log_Date" = :todayStr`, { replacements: { targetId, todayStr }, type: QueryTypes.SELECT });
        const outArr = JSON.parse(rep[0].time_Logged_outArr || "[]");
        outArr.push(timeStr);

        await sequelize.query(
          `UPDATE "employee_Logging_report" SET "time_Logged_outArr" = :outArr, "logged_StatusId" = 2 WHERE "user_id" = :targetId AND "log_Date" = :todayStr`,
          { replacements: { outArr: JSON.stringify(outArr), targetId, todayStr }, type: QueryTypes.UPDATE }
        );

        // Trigger calculation
        calculateAndStoreAttendanceUnits(targetId, todayStr).catch(err => console.error(`[BULK-CALC-ERR] User ${targetId}:`, err));
      }
      return res.status(200).json({ message: `Successfully clocked out ${activeReports.length} employee(s).` });
    }

    let user = await User.findOne({ 
      where: { 
        [sequelize.Sequelize.Op.or]: [
          { user_Id: isNaN(parseInt(user_Id)) ? -1 : parseInt(user_Id) }, 
          { '$hardware.user_MachipId$': user_Id }
        ],
        deletedAt: null 
      },
      include: [{ model: User_Hardware, as: 'hardware' }]
    });

    if (!user) return res.status(404).json({ error: "User not found or no specific employee selected." });

    const target_user_Id = user.user_Id;
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const fivePMThirty = new Date(now); fivePMThirty.setHours(17, 30, 0, 0);
    const fiveAMThirty = new Date(now); fiveAMThirty.setHours(5, 30, 0, 0);

    const approvedOTResult = await sequelize.query(
      `SELECT ot.* FROM "Overtime_Request" ot JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       WHERE ot."user_Id" = :target_user_Id AND ot."OT_DateOf" = :todayStr AND er."emp_reqStatusId" = 2`,
      { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT }
    );
    const approvedOT = approvedOTResult[0];
    const hasApprovedOT = !!approvedOT;

    const lastLogs = await sequelize.query(
      `SELECT * FROM "user_logging" WHERE "user_id" = :target_user_Id AND "log_Date" BETWEEN :todayStart AND :todayEnd ORDER BY "user_loggingId" DESC LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT }
    );
    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;

    if ([1, 3].includes(lastStatus) && now >= fivePMThirty && hasApprovedOT) {
      await sequelize.query(`INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId") VALUES (:target_user_Id, :todayStart, '17:30:00', 4)`, { replacements: { target_user_Id, todayStart }, type: QueryTypes.INSERT });
      await sequelize.query(`INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId") VALUES (:target_user_Id, :todayStart, '17:30:00', 5)`, { replacements: { target_user_Id, todayStart }, type: QueryTypes.INSERT });
      const report = await sequelize.query(`SELECT * FROM "employee_Logging_report" WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`, { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT });
      if (report[0]) {
        const inArr = JSON.parse(report[0].time_Logged_inArr || "[]");
        const outArr = JSON.parse(report[0].time_Logged_outArr || "[]");
        outArr.push("17:30:00"); inArr.push("17:30:00");
        await sequelize.query(`UPDATE "employee_Logging_report" SET "time_Logged_inArr" = :inArr, "time_Logged_outArr" = :outArr, "logged_StatusId" = 1 WHERE "employee_Logging_reportId" = :reportId`, { replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), reportId: report[0].employee_Logging_reportId }, type: QueryTypes.UPDATE });
      }
      lastLogs[0] = { logged_StatusId: 5 };
    }

    const currentStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;
    if (forcedStatus === 1 && [1, 3, 5].includes(currentStatus)) return res.status(400).json({ error: `User ${user.user_FirstName} is already clock-in` });
    if (forcedStatus === 2 && [2, 4, 6].includes(currentStatus)) return res.status(400).json({ error: `User ${user.user_FirstName} is already clock-out` });

    const firstLoginToday = await sequelize.query(`SELECT * FROM "user_logging" WHERE "user_id" = :target_user_Id AND "logged_StatusId" IN (1, 3) AND "log_Date" BETWEEN :todayStart AND :todayEnd LIMIT 1`, { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT });
    const hasPriorClockIn = !!firstLoginToday[0];

    const priorIrregular = await sequelize.query(
      `SELECT 1 FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "attendance_StatusId" = 8
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );
    const hadPriorIrregular = priorIrregular.length > 0;

    const settings = await SystemSettings.findOne();
    const lStartStr = settings?.lunchStartThreshold || "11:30:00";
    const lEndStr   = settings?.lunchEndThreshold   || "13:30:00";
    const lStart = parseInt(lStartStr.split(":")[0]) * 60 + parseInt(lStartStr.split(":")[1]);
    const lEnd   = parseInt(lEndStr.split(":")[0])   * 60 + parseInt(lEndStr.split(":")[1]);
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const isLunchWindow = totalMinutes >= lStart && totalMinutes < lEnd;

    // Helper for overnight OT comparison
    const isWithinOTWindow = hasApprovedOT && (
      approvedOT.HrFrom <= approvedOT.HrTo 
        ? (timeStr >= approvedOT.HrFrom && timeStr <= approvedOT.HrTo)
        : (timeStr >= approvedOT.HrFrom || timeStr <= approvedOT.HrTo)
    );
    const isPastOTWindow = hasApprovedOT && !isWithinOTWindow && (
      approvedOT.HrFrom <= approvedOT.HrTo 
        ? timeStr > approvedOT.HrTo 
        : (timeStr > approvedOT.HrTo && timeStr < approvedOT.HrFrom)
    );

    const isSuspiciousWindow = (now >= fivePMThirty || now < fiveAMThirty);
    const isPastOT = hasApprovedOT && isPastOTWindow;
    const isIrregular = (!isWithinOTWindow && isSuspiciousWindow && user.user_ShiftId !== 2) ||
                        isPastOT ||
                        hadPriorIrregular;

    let nextStatus;
    if (forcedStatus === 1) {
      if (hasApprovedOT && isWithinOTWindow) nextStatus = 5;
      else if (isLunchWindow || lastStatus === 2) nextStatus = 3;
      else if (totalMinutes >= lStart && !hasPriorClockIn && !isSuspiciousWindow) nextStatus = 3;
      else nextStatus = 1;
    } else if (forcedStatus === 2) {
      if (lastStatus === 5) nextStatus = 6;
      else if (isLunchWindow && [1, 3].includes(lastStatus)) nextStatus = 2;
      else nextStatus = 4;
    } else {
      if (!lastStatus || [2, 4, 6].includes(lastStatus)) {
        if (hasApprovedOT && isWithinOTWindow) nextStatus = 5;
        else if (isLunchWindow || lastStatus === 2) nextStatus = 3;
        else if (totalMinutes >= lStart && !hasPriorClockIn && !isSuspiciousWindow) nextStatus = 3;
        else nextStatus = 1;
      } else {
        if (lastStatus === 5) nextStatus = 6;
        else if (isLunchWindow && [1, 3].includes(lastStatus)) nextStatus = 2;
        else nextStatus = 4;
      }
    }

    if (isIrregular && [1, 3, 5].includes(nextStatus)) {
      const admins = await User.findAll({ where: { user_RoleId: 1 }, attributes: ["user_Id"] });
      const timeFmt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let msg = `Irregular log: ${user.user_FirstName} ${user.user_LastName} `;
      if (hasApprovedOT && isPastOTWindow) msg += `clocked in at ${timeFmt}, past OT window (Ended ${approvedOT.HrTo}).`;
      else if (isSuspiciousWindow && !hasPriorClockIn) msg += `logged in at ${timeFmt} (Outside 5:30 AM - 5:30 PM) without prior record or approved OT.`;
      else if (hasPriorClockIn && isSuspiciousWindow) msg += `clocked in again at ${timeFmt} (Irregular Hours: 5:30 PM - 5:30 AM) after logging out, without approved OT.`;
      for (const admin of admins) await Notification.create({ user_Id: admin.user_Id, title: "Irregular logs", message: msg, isRead: false });
    }

    let attendanceVal = null;
    if (user.user_RoleId === 1 || user.is_time_exempt === true) {
      attendanceVal = 6; // Exempt
    } else if (isIrregular) {
      attendanceVal = 8; // Irregular
    } else if (nextStatus === 5 && hasApprovedOT && isWithinOTWindow) {
      attendanceVal = 1; // On-Time (for approved Overtime)
    } else if (nextStatus === 1) {
      const graceTimeStr = settings?.gracePeriod || "08:35:00";
      const graceTime = new Date(`${todayStr}T${graceTimeStr}`);
      if (now <= graceTime) {
        attendanceVal = 1; // On-Time
      } else if (now > graceTime && now < fivePMThirty) {
        attendanceVal = 2; // Late
      }
    } else if (nextStatus === 3 && !hasPriorClockIn) {
      attendanceVal = 4; // Half Day (PM arrival)
    }

    const newLogResult = await sequelize.query(`INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId") VALUES (:target_user_Id, :log_Date, :time_Logged, :logged_StatusId, :attendance_StatusId) RETURNING *`, { replacements: { target_user_Id, log_Date: todayStart, time_Logged: timeStr, logged_StatusId: nextStatus, attendance_StatusId: attendanceVal }, type: QueryTypes.INSERT });
    const newLog = newLogResult[0][0];

    const isEntry = [1, 3, 5].includes(nextStatus);
    const repStat = isEntry ? 1 : 2;
    const existing = await sequelize.query(`SELECT * FROM "employee_Logging_report" WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`, { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT });
    if (!existing[0]) {
      const inArr = isEntry ? [timeStr] : []; const outArr = !isEntry ? [timeStr] : [];
      await sequelize.query(`INSERT INTO "employee_Logging_report" ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId") VALUES (:target_user_Id, :todayStr, :inArr, :outArr, :attendance_StatusId, :repStat)`, { replacements: { target_user_Id, todayStr, inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), attendance_StatusId: attendanceVal, repStat }, type: QueryTypes.INSERT });
    } else {
      const inArr = JSON.parse(existing[0].time_Logged_inArr || "[]"); const outArr = JSON.parse(existing[0].time_Logged_outArr || "[]");
      if (isEntry && !inArr.includes(timeStr)) inArr.push(timeStr); else if (!isEntry && !outArr.includes(timeStr)) outArr.push(timeStr);
      await sequelize.query(
        `UPDATE "employee_Logging_report" 
         SET "time_Logged_inArr" = :inArr, 
             "time_Logged_outArr" = :outArr, 
             "logged_StatusId" = :repStat, 
             "attendance_StatusId" = CASE 
                WHEN "attendance_StatusId" IS NULL OR "attendance_StatusId" = 3 THEN :attendance_StatusId 
                ELSE "attendance_StatusId" 
             END
         WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`, 
        { replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), repStat, attendance_StatusId: attendanceVal, target_user_Id, todayStr }, type: QueryTypes.UPDATE }
      );
    }

    // ── 7. RESOLVE LEAVE CONFLICTS (VOID LOGIC) ──────────────────────────────
    if (!isEntry) {
      // Triggered on Clock Out, Lunch Out, or OT Out
      resolveLeaveConflict(target_user_Id, todayStr)
        .then(async res => {
          if (res.refundAmount > 0) console.log(`[LEAVE-AUTO] ${res.message} for user ${target_user_Id}`);
          
          // Trigger Calculation and Storage of Payable Units
          await calculateAndStoreAttendanceUnits(target_user_Id, todayStr);
        })
        .catch(err => console.error("[ATTENDANCE-AUTO] Error in post-clockout tasks:", err));
    }

    const labels = { 1: "Clock In", 2: "Lunch Out", 3: "Lunch In", 4: "Clock Out", 5: "Overtime In", 6: "Overtime Out" };
    const punchLabel = [1, 3, 5].includes(nextStatus) ? "Clock In" : "Clock Out";
    if (isIrregular) {
      await logTransaction(target_user_Id, null, "IRREGULAR_LOG", `Irregular ${punchLabel} at ${timeStr}`, { status: labels[nextStatus], punchDirection: punchLabel, time: timeStr, method: log_Type || "Manual/RFID" }, req);
    } else {
      await logTransaction(target_user_Id, null, "ATTENDANCE_LOG", `${labels[nextStatus]} for user ${target_user_Id}`, { status: labels[nextStatus], time: timeStr, method: log_Type || "Manual/RFID" }, req);
    }

    const io = getIO(); 
    io.emit("NEW_ATTENDANCE_LOG", { userId: target_user_Id, status: isIrregular ? `Irregular ${punchLabel}` : labels[nextStatus] }); 
    io.to(`user_${target_user_Id}`).emit("NOTIFICATION_UPDATE");
    return res.status(201).json({ message: `${isIrregular ? `Irregular ${punchLabel}` : labels[nextStatus]} recorded successfully`, data: newLog });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};

// ── View User Logs ────────────────────────────────────────────────────────────
exports.viewUserLogs = async (req, res) => {
  const { user_Id } = req.params;
  const { startDate, endDate } = req.query; // Optional filters

  // Helper to format date without UTC shift
  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === 'string') return dateVal.split('T')[0];
    const d = new Date(dateVal);
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  };

  try {
    const settings = await SystemSettings.findOne();
    const holidays = await Holiday.findAll();

    // Fetch logs
    let query = `
      SELECT
         r.*,
         u."user_ShiftId",
         u."user_RoleId",
         a."statusName" AS "attendanceStatusName",
         l."statusName" AS "loggedStatusName"
       FROM "employee_Logging_report" r
       LEFT JOIN "User" u ON u."user_Id" = r."user_id"
       LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
       LEFT JOIN "logged_status" l ON l."statusId" = r."logged_StatusId"
       WHERE r."user_id" = :user_Id
    `;

    const replacements = { user_Id };
    if (startDate && endDate) {
      query += ` AND r."log_Date" BETWEEN :startDate AND :endDate`;
      replacements.startDate = startDate;
      replacements.endDate = endDate;
    }

    query += ` ORDER BY r."log_Date" DESC`;

    const reports = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });

    // Fetch Approved Requests (OT/Leave/Field) for calculations
    const requestQuery = `
        SELECT er."user_Id", er."emp_reqTypeId", 
               vl."StartDate" as "vStart", vl."EndDate" as "vEnd", 
               sl."StartDate" as "sStart", sl."EndDate" as "sEnd", 
               el."DateOfLeave" as "elDate",
               hd."DateOfLeave" as "hdDate",
               st."StartDate" as "stStart", st."EndDate" as "stEnd",
               ow."DateonField",
               ot."OT_DateOf", ot."HrFrom", ot."HrTo", ot."Total_Hrs"
        FROM "emp_Request" er
        LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
        LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
        LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
        LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
        LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
        LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
        LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
        WHERE er."user_Id" = :user_Id AND er."emp_reqStatusId" = 2
    `;

    const approvedRequests = await sequelize.query(requestQuery, { 
        replacements: { user_Id }, 
        type: QueryTypes.SELECT 
    });

    // Helper functions for filtering and mapping
    const parseLogs = (jsonStr) => {
      try {
        const arr = JSON.parse(jsonStr || "[]");
        return arr.filter(t => t && t !== "—").sort();
      } catch (e) { return []; }
    };

    const dailyRows = (await Promise.all(reports
      .map(async (report) => {
        const inArr = parseLogs(report.time_Logged_inArr);
        const outArr = parseLogs(report.time_Logged_outArr);
        const dateStr = formatDateOnly(report.log_Date);

        const dayOT = approvedRequests.find(req => Number(req.emp_reqTypeId) === 1 && formatDateOnly(req.OT_DateOf) === dateStr);
        const isOnField = approvedRequests.some(req => Number(req.emp_reqTypeId) === 2 && formatDateOnly(req.DateonField) === dateStr);
        
        // Refined OT Mapping: Look for the actual tap in inArr that matches or follows the OT start
        let ot_In = "—";
        if (dayOT && dayOT.HrFrom) {
          const reqStart = dayOT.HrFrom.substring(0, 5);
          const actualTap = inArr.find(t => t.substring(0, 5) >= reqStart);
          ot_In = actualTap ? actualTap.substring(0, 5) : reqStart;
        }

        const ot_Out = (dayOT && dayOT.HrFrom && outArr.length > 0 && outArr[outArr.length-1] && outArr[outArr.length-1].substring(0,5) > dayOT.HrFrom.substring(0,5)) ? outArr[outArr.length-1].substring(0,5) : "—";
      
        const otStartTime = (dayOT && dayOT.HrFrom) ? dayOT.HrFrom.substring(0, 5) : null;
        const { morning_In, morning_Out, afternoon_In, afternoon_Out } = mapLogsToBuckets(inArr, outArr, settings, otStartTime);
        
        // MIXED LOG/FILTER LOGIC: Only show the row if there's regular work OR a valid request OR explicitly absent
        const hasRegularWork = morning_In !== "—" || afternoon_Out !== "—" || (dayOT && outArr.length > 0);
        const hasRequest = approvedRequests.some(req => {
          const reqType = Number(req.emp_reqTypeId);
          if (reqType === 1) return formatDateOnly(req.OT_DateOf) === dateStr;
          if (reqType === 2) return formatDateOnly(req.DateonField) === dateStr;
          if (reqType === 3) return formatDateOnly(req.vStart) <= dateStr && formatDateOnly(req.vEnd) >= dateStr;
          if (reqType === 4) return formatDateOnly(req.sStart) <= dateStr && formatDateOnly(req.sEnd) >= dateStr;
          if (reqType === 6) return formatDateOnly(req.elDate) === dateStr;
          if (reqType === 7) return formatDateOnly(req.hdDate) === dateStr;
          if ([8, 9, 10, 11, 12].includes(reqType)) return formatDateOnly(req.stStart) <= dateStr && formatDateOnly(req.stEnd) >= dateStr;
          return false;
        });

        const isAbsent = Number(report.attendance_StatusId) === 3;
        
        // Return null if this row should be hidden (Irregular only, no work, no request)
        if (!hasRegularWork && !hasRequest && !isAbsent) return null;

        const mStart = settings?.morningShiftStart?.substring(0, 5) || "08:30";
        const mEnd   = settings?.morningShiftEnd?.substring(0, 5) || "17:30";
        const lStart = settings?.lunchStartThreshold?.substring(0, 5) || "12:00";
        const lEnd   = settings?.lunchEndThreshold?.substring(0, 5) || "13:00";

        if (isOnField) {
          morning_In = mStart; morning_Out = lStart; afternoon_In = lEnd; afternoon_Out = mEnd;
        }

        // Final fallback for time_Out: pick the absolute last out if bucketed ones are missing
        const absoluteLastOut = outArr.length > 0 ? outArr[outArr.length - 1].substring(0, 5) : "—";
        const effectiveOut = (ot_Out !== "—" ? ot_Out : (afternoon_Out !== "—" ? afternoon_Out : (morning_Out !== "—" ? morning_Out : absoluteLastOut)));

        // ── TIME-SLICING CALCULATION (Prefer Stored Values) ──
        let stats = {
          reg_hrs: parseFloat(report.reg_hrs || 0),
          nd_hrs: parseFloat(report.nd_hrs || 0),
          ot_hrs: parseFloat(report.ot_hrs || 0),
          holiday_hrs: parseFloat(report.holiday_hrs || 0),
          totalPayableHours: parseFloat(report.total_payable_hrs || 0)
        };

        if (isOnField) {
          stats.reg_hrs = 8.0;
          stats.totalPayableHours = 8.0;
        }

        // Fallback for older records or if recalculation is needed
        if (stats.totalPayableHours === 0 && !isOnField && inArr.length > 0 && outArr.length > 0) {
          let firstIn = inArr[0];
          let lastOut = outArr[outArr.length - 1];

          const mStartFull = settings?.morningShiftStart || "08:30:00";
          const mEndFull   = settings?.morningShiftEnd   || "17:30:00";
          const eStart = settings?.eveningShiftStart || "20:30:00";
          const eEnd   = settings?.eveningShiftEnd   || "05:30:00";

          const shiftStart = (report.user_ShiftId === 2) ? eStart : mStartFull;
          const shiftEnd   = (report.user_ShiftId === 2) ? eEnd : mEndFull;

          if (firstIn && firstIn < shiftStart && report.user_ShiftId !== 2) firstIn = shiftStart;
          if (!dayOT && lastOut && lastOut > shiftEnd && report.user_ShiftId !== 2) lastOut = shiftEnd;

          const hoursObj = await calculateMultiBucketHours(firstIn, lastOut, dateStr, report.user_ShiftId, settings, holidays);
          stats = {
            reg_hrs: hoursObj.reg_hrs,
            nd_hrs: hoursObj.nd_hrs,
            ot_hrs: hoursObj.ot_hrs,
            holiday_hrs: hoursObj.hol_hrs,
            totalPayableHours: hoursObj.totalPayableHours
          };
        }
        
        // Handle manual Overtime Request additions if any (Legacy Support)
        if (dayOT && dayOT.Total_Hrs && stats.ot_hrs === 0) {
          stats.totalPayableHours += parseFloat(dayOT.Total_Hrs) * (settings.overtimeRate || 1.25);
        }

        return {
          sessionId: `${report.user_id}-${dateStr}`,
          log_Date: dateStr,
          morning_In,
          morning_Out,
          afternoon_In,
          afternoon_Out,
          ot_In,
          ot_Out,
          time_In: morning_In,
          time_Out: ot_Out !== "—" ? ot_Out : effectiveOut,
          inArr,
          outArr,
          hoursWorked: stats.totalPayableHours,
          hoursWorkedFormatted: formatDuration(stats.totalPayableHours),
          breakdown: {
            reg: stats.reg_hrs,
            regFormatted: formatDuration(stats.reg_hrs),
            ot: stats.ot_hrs,
            otFormatted: formatDuration(stats.ot_hrs),
            nd: stats.nd_hrs,
            ndFormatted: formatDuration(stats.nd_hrs),
            holiday: stats.holiday_hrs,
            holidayFormatted: formatDuration(stats.holiday_hrs)
          },
          logStatus: report.loggedStatusName,
          attendanceStatus: (report.attendanceStatusName === "Exempt" || report.attendanceStatusName === "Present") ? "On Time" : (report.attendanceStatusName || (stats.totalPayableHours > 0 ? "On Time" : "No Record")),
          systemGenerated: report.logged_StatusId === 7 || isOnField
        };
      }))).filter(row => row !== null);

    res.status(200).json(dailyRows);
  } catch (error) {
    console.error(`[VIEW USER LOGS ERROR]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

// ── View All Attendance ───────────────────────────────────────────────────────
exports.viewAllAttendance = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.log_Date = {
        [sequelize.Sequelize.Op.between]: [startDate, `${endDate} 23:59:59`]
      };
    }

    if (user_Id) {
      whereClause.user_id = user_Id;
      // Strictly filter Visitor logs to only show Visitor Access statuses
      if (parseInt(user_Id) === 999) {
        whereClause.logged_StatusId = [8, 9];
      }
    } else {
      // Exclude Visitor system user (999) from general raw logs
      whereClause.user_id = {
        [sequelize.Sequelize.Op.ne]: 999
      };
    }

    const logs = await user_logging.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_Id", "user_FirstName", "user_LastName"],
          include: [
            {
              model: User_Hardware,
              as: "hardware",
              attributes: ["user_MachipId"],
            }
          ]
        },
        {
          model: User,
          as: "authorizingAdmin",
          attributes: ["user_Id", "user_FirstName", "user_LastName"],
          required: false,
        },
        {
          model: logged_status,
          as: "loggedStatus",
          attributes: ["statusName"],
        },
        {
          model: attendance_status,
          as: "attendanceStatus",
          attributes: ["statusName"],
        },
      ],
      order: [["user_loggingId", "DESC"]],
    });

    // Map to the format expected by the frontend
    const formattedLogs = logs.map(log => {
      const plain = log.get({ plain: true });
      const adminName = plain.authorizingAdmin
        ? `${plain.authorizingAdmin.user_FirstName || ""} ${plain.authorizingAdmin.user_LastName || ""}`.trim()
        : (plain.admin_id ? `Admin #${plain.admin_id}` : null);
      const adminDisplayId = plain.admin_id
        ? `MACJ-${String(plain.admin_id).padStart(3, "0")}`
        : null;

      const isIrregular = plain.attendance_StatusId === 8;
      const punchDirection = [1, 3, 5].includes(plain.logged_StatusId) ? "Clock In" : "Clock Out";
      const loggedStatusName = isIrregular 
        ? `Irregular ${punchDirection}` 
        : plain.loggedStatus?.statusName;

      return {
        ...plain,
        log_Date: formatDateLocal(plain.log_Date),
        user_FirstName: plain.user?.user_FirstName,
        user_LastName: plain.user?.user_LastName,
        user_MachipId: plain.user?.hardware?.user_MachipId,
        loggedStatusName,
        punchDirection,
        isIrregular,
        attendanceStatusName: (plain.attendanceStatus?.statusName === "Exempt" || plain.attendanceStatus?.statusName === "Present") ? "On Time" : plain.attendanceStatus?.statusName,
        reason: plain.reason || null,
        admin_id: plain.admin_id || null,
        adminName,
        adminDisplayId,
      };
    });

    res.status(200).json(formattedLogs);
  } catch (error) {
    console.error("[VIEW ALL ATTENDANCE ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};


// ── Delete All Logs ───────────────────────────────────────────────────────────
exports.deleteAllLogs = async (req, res) => {
  try {
    await sequelize.query(`DELETE FROM "employee_Logging_report"`, {
      type: QueryTypes.DELETE,
    });
    await sequelize.query(`DELETE FROM "user_logging"`, {
      type: QueryTypes.DELETE,
    });

    const currentAdminId = req.user ? req.user.user_Id : (req.headers["x-admin-id"] || 1);
    await logAudit(req, currentAdminId, "Attendance", "DELETE_ALL_ATTENDANCE", "user_logging", null, null, null);

    res
      .status(200)
      .json({ message: "All attendance logs have been deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Status Logic ──────────────────────────────────────────────────────────────
exports.StatusLogic = async (req, res) => {
  const { user_Id } = req.params;

  try {
    const now = await getSystemTime();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const logs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    let log = logs[0];

    if (!log) {
      return res
        .status(404)
        .json({ error: "No attendance record found for today" });
    }

    // If already Absent (3) or On-Leave (4), don't override
    if (log.attendance_StatusId === 3 || log.attendance_StatusId === 4) {
      return res
        .status(200)
        .json({ message: "Attendance status finalized", data: log });
    }

    // Find first Clock In of the day
    const firstLogs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       AND "logged_StatusId" = 1
       ORDER BY "user_loggingId" ASC
       LIMIT 1`,
      { replacements: { user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const firstLog = firstLogs[0];
    if (firstLog) {
      const loginHour = parseInt(firstLog.time_Logged.split(":")[0]);
      const newAttendanceStatus = loginHour >= 9 ? 2 : 1;

      await sequelize.query(
        `UPDATE "user_logging"
         SET "attendance_StatusId" = :attendance
         WHERE "user_loggingId" = :id`,
        {
          replacements: {
            attendance: newAttendanceStatus,
            id: firstLog.user_loggingId,
          },
          type: QueryTypes.UPDATE,
        },
      );

      const updated = await sequelize.query(
        `SELECT * FROM "user_logging" WHERE "user_loggingId" = :id`,
        {
          replacements: { id: firstLog.user_loggingId },
          type: QueryTypes.SELECT,
        },
      );

      return res
        .status(200)
        .json({ message: "Attendance status updated", data: updated[0] });
    }

    res.status(200).json({ message: "Attendance status updated", data: log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Overall Attendance Stats (Weekly, Quarterly, Yearly) ────────────────
exports.getOverallAttendanceStats = async (req, res) => {
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    // 1. Weekly Stats (Last 7 Days)
    const weeklyRaw = await sequelize.query(
      `SELECT 
         to_char("log_Date", 'Dy') as name,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) as absent,
         "log_Date"
       FROM "employee_Logging_report"
       WHERE "log_Date" > :now::date - interval '7 days'
       AND "user_id" != 999
       AND EXTRACT(DOW FROM "log_Date") != 0 -- Exclude Sundays
       GROUP BY name, "log_Date"
       ORDER BY "log_Date" ASC`,
      { replacements: { now }, type: QueryTypes.SELECT }
    );
    const weekly = weeklyRaw.map(d => {
      const total = parseInt(d.total);
      const absent = parseInt(d.absent);
      return {
        name: d.name,
        percentage: total > 0 ? Math.round(((total - absent) / total) * 1000) / 10 : 100
      };
    });

    // 2. Quarterly Stats (Current Half Year - Jan-Jun or Jul-Dec)
    const isFirstHalf = now.getMonth() < 6;
    const startMonth = isFirstHalf ? 1 : 7;
    const endMonth = isFirstHalf ? 6 : 12;

    const quarterlyRaw = await sequelize.query(
      `SELECT 
         to_char(to_date(EXTRACT(MONTH FROM "log_Date")::text, 'MM'), 'Mon') as name,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) as absent,
         EXTRACT(MONTH FROM "log_Date") as month_num
       FROM "employee_Logging_report"
       WHERE EXTRACT(YEAR FROM "log_Date") = :currentYear
       AND "user_id" != 999
       AND EXTRACT(MONTH FROM "log_Date") BETWEEN :startMonth AND :endMonth
       AND EXTRACT(DOW FROM "log_Date") != 0 -- Exclude Sundays
       GROUP BY name, month_num
       ORDER BY month_num ASC`,
      { replacements: { currentYear, startMonth, endMonth }, type: QueryTypes.SELECT }
    );
    const quarterly = quarterlyRaw.map(d => {
      const total = parseInt(d.total);
      const absent = parseInt(d.absent);
      return {
        name: d.name,
        percentage: total > 0 ? Math.round(((total - absent) / total) * 1000) / 10 : 100
      };
    });

    // 3. Yearly Stats (Last 5 Years)
    const yearlyRaw = await sequelize.query(
      `SELECT 
         EXTRACT(YEAR FROM "log_Date")::text as name,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) as absent
       FROM "employee_Logging_report"
       WHERE "user_id" != 999
       AND EXTRACT(DOW FROM "log_Date") != 0 -- Exclude Sundays
       GROUP BY name
       ORDER BY name ASC
       LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    const yearly = yearlyRaw.map(d => {
      const total = parseInt(d.total);
      const absent = parseInt(d.absent);
      return {
        name: d.name,
        percentage: total > 0 ? Math.round(((total - absent) / total) * 1000) / 10 : 100
      };
    });

    res.status(200).json({ weekly, quarterly, yearly });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Monthly Attendance Stats (Global) ────────────────────────────────────
exports.getMonthlyAttendanceStats = async (req, res) => {
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();
    const stats = await sequelize.query(
      `SELECT 
         TO_CHAR(TO_DATE(EXTRACT(MONTH FROM "log_Date")::text, 'MM'), 'Month') AS name,
         COUNT(*) FILTER (WHERE "attendance_StatusId" IN (1, 5)) AS "OnTime",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "Late",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) AS "Absent",
         EXTRACT(MONTH FROM "log_Date") as month_num
       FROM "employee_Logging_report"
       WHERE EXTRACT(YEAR FROM "log_Date") = :currentYear
       AND "user_id" != 999
       GROUP BY name, month_num
       ORDER BY month_num ASC`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    const formattedStats = stats.map(s => ({
      ...s,
      OnTime: parseInt(s.OnTime || 0),
      Late: parseInt(s.Late || 0),
      Absent: parseInt(s.Absent || 0)
    }));

    res.status(200).json(formattedStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Monthly Attendance Stats (Specific User) ──────────────────────────────
exports.getMonthlyAttendanceStatsByUser = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();
    const stats = await sequelize.query(
      `SELECT 
         TO_CHAR(TO_DATE(EXTRACT(MONTH FROM "log_Date")::text, 'MM'), 'Month') AS name,
         COUNT(*) FILTER (WHERE "attendance_StatusId" IN (1, 5)) AS "OnTime",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "Late",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) AS "Absent",
         EXTRACT(MONTH FROM "log_Date") as month_num
       FROM "employee_Logging_report"
       WHERE "user_id" = :user_Id AND EXTRACT(YEAR FROM "log_Date") = :currentYear
       GROUP BY name, month_num
       ORDER BY month_num ASC`,
      { replacements: { user_Id, currentYear }, type: QueryTypes.SELECT }
    );

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Employee Dashboard Stats (Consolidated) ────────────────────────────────
exports.getEmployeeDashboardStats = async (req, res) => {
  const { user_Id } = req.params;
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 1. Attendance Stats for Current Month
    const attendanceStats = await sequelize.query(
      `SELECT 
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) AS "absentCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" IN (1, 5)) AS "onTimeCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "lateCount"
       FROM "employee_Logging_report"
       WHERE "user_id" = :user_Id 
       AND EXTRACT(YEAR FROM "log_Date") = :currentYear
       AND EXTRACT(MONTH FROM "log_Date") = :currentMonth`,
      { replacements: { user_Id, currentYear, currentMonth }, type: QueryTypes.SELECT }
    );

    // 2. Recent Attendance Logs (Last 5)
    const recentLogs = await sequelize.query(
      `SELECT r.*, a."statusName" as "attendanceStatus"
       FROM "employee_Logging_report" r
       LEFT JOIN "attendance_status" a ON r."attendance_StatusId" = a."statusId"
       WHERE r."user_id" = :user_Id
       ORDER BY r."log_Date" DESC
       LIMIT 5`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    // 3. Leave Balances (Yearly Consumed vs Total)
    const leaveBalance = await sequelize.query(
      `SELECT * FROM "Leave_Balance" 
       WHERE "user_Id" = :user_Id AND "year" = :currentYear`,
      { replacements: { user_Id, currentYear }, type: QueryTypes.SELECT }
    );

    // 4. Recent Requests (Removed strict month filter to show most recent activity)
    const recentRequests = await sequelize.query(
      `SELECT
        er."emp_reqId",
        er."emp_reqTypeId",
        er."emp_reqStatusId",
        rt."reqTypeName",
        rs."reqStatName" as "status",
        er."date_Filed",
        er.remarks,
        ot."OT_DateOf",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        el."DateOfLeave" as "EL_DateOfLeave",
        hd."DateOfLeave" as "HD_DateOfLeave",
        ow."DateonField",
        lc."logDate" as "LC_logDate"
      FROM "emp_Request" er
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
      LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      WHERE er."user_Id" = :user_Id
      ORDER BY er."date_Filed" DESC, er."createdAt" DESC
      LIMIT 10`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    // Safe parsing helper
    const safeParseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch (e) {
        return [];
      }
    };

    const todayStr = formatDateLocal(now);
    const [todayReport] = await sequelize.query(
      `SELECT "time_Logged_inArr" FROM "employee_Logging_report" WHERE "user_id" = :user_Id AND "log_Date" = :todayStr`,
      { replacements: { user_Id, todayStr }, type: QueryTypes.SELECT }
    );

    let todayIn = "--:-- AM";
    if (todayReport) {
      const inArr = safeParseArray(todayReport.time_Logged_inArr);
      if (inArr.length > 0) {
        const [h, m] = inArr[0].split(":");
        const hr = parseInt(h);
        const ampm = hr >= 12 ? "PM" : "AM";
        const h12 = hr % 12 || 12;
        todayIn = `${h12}:${m} ${ampm}`;
      }
    }

    // Query user solo parent eligibility
    const [userRecord] = await sequelize.query(
      `SELECT "is_solo_parent" FROM "User" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );
    const isSoloParent = Boolean(userRecord && (userRecord.is_solo_parent === true || userRecord.is_solo_parent === "true" || userRecord.is_solo_parent === 1 || userRecord.is_solo_parent === "1"));

    const lb = leaveBalance[0];
    const spUsed = parseFloat(lb?.SoloParent_used || 0);
    const spBal = lb?.SoloParent_balance !== null && lb?.SoloParent_balance !== undefined ? parseFloat(lb.SoloParent_balance) : 0;
    const effectiveSpBal = (isSoloParent && spBal === 0 && spUsed === 0) ? 7 : spBal;

    const formattedLeaveBalance = {
      VL_total: lb ? (parseFloat(lb.VL_used || 0) + parseFloat(lb.VL_balance || 7)) : 7,
      VL_used: lb ? parseFloat(lb.VL_used || 0) : 0,
      VL_balance: lb ? parseFloat(lb.VL_balance || 0) : 7,
      SL_total: lb ? (parseFloat(lb.SL_used || 0) + parseFloat(lb.SL_balance || 7)) : 7,
      SL_used: lb ? parseFloat(lb.SL_used || 0) : 0,
      SL_balance: lb ? parseFloat(lb.SL_balance || 0) : 7,
    };

    if (isSoloParent) {
      formattedLeaveBalance.SoloParent_total = (spUsed + effectiveSpBal) || 7;
      formattedLeaveBalance.SoloParent_used = spUsed;
      formattedLeaveBalance.SoloParent_balance = effectiveSpBal;
    }

    res.status(200).json({
      todayIn,
      attendance: {
        absent: parseInt(attendanceStats[0]?.absentCount || 0),
        onTime: parseInt(attendanceStats[0]?.onTimeCount || 0),
        late: parseInt(attendanceStats[0]?.lateCount || 0),
        monthName: now.toLocaleString('default', { month: 'long' })
      },
      leaveBalance: formattedLeaveBalance,
      recentLogs: recentLogs.filter(log => {
        const inArr = safeParseArray(log.time_Logged_inArr);
        const outArr = safeParseArray(log.time_Logged_outArr);
        const hasValidLog = [...inArr, ...outArr].some(t => t.substring(0, 5) >= "06:00");
        const hasRequest = recentRequests.some(req => {
          const logDate = log.log_Date.split('T')[0];
          const otDate = req.OT_DateOf ? req.OT_DateOf.split('T')[0] : null;
          const fieldDate = req.DateonField ? req.DateonField.split('T')[0] : null;
          const vlStart = req.VL_StartDate ? req.VL_StartDate.split('T')[0] : null;
          const vlEnd = req.VL_EndDate ? req.VL_EndDate.split('T')[0] : null;
          const slStart = req.SL_StartDate ? req.SL_StartDate.split('T')[0] : null;
          const slEnd = req.SL_EndDate ? req.SL_EndDate.split('T')[0] : null;

          return (otDate === logDate) || (fieldDate === logDate) || 
                 (vlStart <= logDate && vlEnd >= logDate) || 
                 (slStart <= logDate && slEnd >= logDate);
        });
        return hasValidLog || hasRequest;
      }).map(log => {
        const inArr = safeParseArray(log.time_Logged_inArr);
        const outArr = safeParseArray(log.time_Logged_outArr);
        return {
          date: log.log_Date,
          status: log.attendanceStatus || "—",
          timeIn: inArr[0] || "—",
          timeOut: outArr.length > 0 ? outArr[outArr.length - 1] : "—"
        };
      }),
      monthlyRequests: recentRequests || []
    });
  } catch (error) {
    console.error("[DASHBOARD_STATS_ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Get Dashboard Stats ───────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const now = await getSystemTime();
    const todayStr = formatDateLocal(now);
    const roleId = req.user?.user_RoleId;
    const currentUserId = req.user?.user_Id;
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateLocal(yesterday);

    const userCountResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM "User" WHERE "deletedAt" IS NULL AND "user_Id" != 999`,
      { type: QueryTypes.SELECT }
    );
    const totalEmployees = parseInt(userCountResult[0].total);

    const stats = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE "logged_StatusId" = 1) AS "officeOccupancy",
         COUNT(*) FILTER (WHERE "attendance_StatusId" IN (1, 5, 6)) AS "onTimeCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "lateArrivalsCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) AS "absentCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 4) AS "onLeaveCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 5) AS "onFieldCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 6) AS "onExemptCount",
         COUNT(*) FILTER (WHERE "time_Logged_inArr" <> '[]') AS "enteredCount",
         COUNT(*) FILTER (WHERE "time_Logged_outArr" <> '[]') AS "exitedCount"
       FROM "employee_Logging_report"
       WHERE "log_Date" = :todayStr
       AND "user_id" != 999`,
      { replacements: { todayStr }, type: QueryTypes.SELECT },
    );

    const yesterdayStats = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE "attendance_StatusId" IN (1, 5, 6)) AS "onTimeCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "lateArrivalsCount"
       FROM "employee_Logging_report"
       WHERE "log_Date" = :yesterdayStr
       AND "user_id" != 999`,
      { replacements: { yesterdayStr }, type: QueryTypes.SELECT },
    );

    const calculateChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const onTimeChange = calculateChange(
      parseInt(stats[0].onTimeCount || 0),
      parseInt(yesterdayStats[0].onTimeCount || 0)
    );
    const lateArrivalsChange = calculateChange(
      parseInt(stats[0].lateArrivalsCount || 0),
      parseInt(yesterdayStats[0].lateArrivalsCount || 0)
    );

    // Fetch Pending Requests Count
    let pendingCount = 0;
    if (roleId === 1 || roleId === 2) {
      let pendingQuery = "";
      let pendingReplacements = { currentUserId };
      if (roleId === 1) { // Admin
        pendingQuery = `SELECT COUNT(*)::int as count FROM "emp_Request" er WHERE er."emp_reqStatusId" IN (1, 4) AND er."user_Id" != :currentUserId`;
      } else { // Supervisor
        pendingQuery = `SELECT COUNT(*)::int as count FROM "emp_Request" er JOIN "User" u ON er."user_Id" = u."user_Id" WHERE er."emp_reqStatusId" = 1 AND u."user_RoleId" = 3`;
      }
      const pendingResult = await sequelize.query(pendingQuery, { replacements: pendingReplacements, type: QueryTypes.SELECT });
      pendingCount = pendingResult[0].count;
    }

    // Dynamic Workdays Calculation (Excluding Sundays)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let workDaysInMonth = 0;
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) { // 0 = Sunday
        workDaysInMonth++;
      }
    }

    // Projected Monthly Net Payroll
    const payrollResult = await sequelize.query(
      `SELECT SUM(
        GREATEST(
          (u."dailyRate" * :workDaysInMonth) - 
          (
            COALESCE(d."sss_Share", 0) + 
            COALESCE(d."philhealth_Share", 0) + 
            COALESCE(d."hdmf_Share", 0) + 
            COALESCE(d."tax_Share", 0) + 
            COALESCE(d."healthCard_Amnt", 0) + 
            COALESCE(d."SSS_Loan", 0) + 
            COALESCE(d."HDMF_Loan", 0) + 
            COALESCE(d."calamityLoan_Amnt", 0) + 
            COALESCE(d."advances_Amnt", 0) + 
            COALESCE(d."globe_Deduction", 0) + 
            COALESCE(d."multiPurposeSavings", 0)
          ), 
          0
        )
      ) as projected 
      FROM "User" u
      LEFT JOIN "User_Deduction_Profile" d ON u."user_Id" = d."user_Id"
      WHERE u."deletedAt" IS NULL AND u."user_Id" != 999
 AND u."dailyRate" > 0`,
      { replacements: { workDaysInMonth }, type: QueryTypes.SELECT }
    );
    const projectedPayroll = Math.round(parseFloat(payrollResult[0].projected || 0));

    // Anomalies Count (Today)
    const anomaliesResult = await sequelize.query(
      `SELECT COUNT(*)::int as count FROM "Transaction_Log" 
       WHERE "event_Type" IN ('UNAUTHORIZED_SCAN', 'UNRECOGNIZED_SCAN', 'IRREGULAR_LOG', 'ATTENDANCE_LOG_SUSPICIOUS', '2FA_FAILURE')
       AND "createdAt" >= :todayStart`,
      { replacements: { todayStart: todayStr }, type: QueryTypes.SELECT }
    );
    const anomaliesCount = anomaliesResult[0].count;

    res.status(200).json({
      totalEmployees,
      officeOccupancy: parseInt(stats[0].officeOccupancy || 0),
      onTimeCount: parseInt(stats[0].onTimeCount || 0),
      lateArrivalsCount: parseInt(stats[0].lateArrivalsCount || 0),
      absentCount: parseInt(stats[0].absentCount || 0),
      onLeaveCount: parseInt(stats[0].onLeaveCount || 0),
      onFieldCount: parseInt(stats[0].onFieldCount || 0),
      onExemptCount: parseInt(stats[0].onExemptCount || 0),
      enteredCount: parseInt(stats[0].enteredCount || 0),
      exitedCount: parseInt(stats[0].exitedCount || 0),
      onTimeChange,
      lateArrivalsChange,
      pendingCount,
      projectedPayroll,
      anomaliesCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Office Occupancy ──────────────────────────────────────────────────────
exports.getOfficeOccupancy = async (req, res) => {
  try {
    const now = await getSystemTime();
    const todayStr = formatDateLocal(now);

    const reports = await sequelize.query(
      `SELECT
         r."user_id",
         r."time_Logged_inArr",
         u."user_Id",
         u."user_FirstName",
         u."user_LastName"
       FROM "employee_Logging_report" r
       LEFT JOIN "User" u ON u."user_Id" = r."user_id"
       WHERE r."log_Date" = :todayStr
       AND r."logged_StatusId" = 1
       AND r."user_id" != 999`,
      { replacements: { todayStr }, type: QueryTypes.SELECT },
    );

    const inOffice = reports
      .map((report) => {
        const inArr = JSON.parse(report.time_Logged_inArr || "[]");
        return {
          user_id: report.user_id,
          user_Id: report.user_Id ?? report.user_id,
          firstName: report.user_FirstName ?? "—",
          lastName: report.user_LastName ?? "—",
          time_In: inArr[0] ?? "—",
        };
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName));

    res.status(200).json({ count: inOffice.length, users: inOffice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Attendance Report Internal ──────────────────────────────────────────
const getAttendanceReportInternal = async (startDate, endDate, user_Id) => {
  const settings = await SystemSettings.findOne();
  const holidays = await Holiday.findAll();

  let query = `
    SELECT
      r.*,
      u."user_Id" as "actual_user_Id",
      u."user_FirstName",
      u."user_LastName",
      u."user_RoleId",
      u."user_ShiftId",
      h."user_MachipId",
      a."statusName" AS "attendanceStatusName",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."HrFrom" ELSE NULL END AS "ot_HrFrom",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."HrTo" ELSE NULL END AS "ot_HrTo",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."Total_Hrs" ELSE NULL END AS "ot_Total_Hrs"
    FROM "employee_Logging_report" r
    LEFT JOIN "User" u ON u."user_Id" = r."user_id"
    LEFT JOIN "User_Hardware" h ON h."user_Id" = u."user_Id"
    LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
    LEFT JOIN "Overtime_Request" ot ON ot."user_Id" = r."user_id" AND ot."OT_DateOf"::date = r."log_Date"::date
    LEFT JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
    WHERE 1=1
  `;

  const replacements = {};
  if (startDate && endDate && startDate !== "undefined" && endDate !== "undefined" && startDate !== "" && endDate !== "") {
    query += ` AND r."log_Date" BETWEEN :startDate AND :endDate`;
    replacements.startDate = startDate;
    replacements.endDate = endDate;
  } else if (startDate && startDate !== "undefined" && startDate !== "") {
    query += ` AND r."log_Date" >= :startDate`;
    replacements.startDate = startDate;
  } else if (endDate && endDate !== "undefined" && endDate !== "") {
    query += ` AND r."log_Date" <= :endDate`;
    replacements.endDate = endDate;
  }

  if (user_Id && user_Id !== "All Employees" && user_Id !== "all") {
    query += ` AND r."user_id" = :user_Id`;
    replacements.user_Id = user_Id;
  } else {
    // Exclude Visitor system user (999) from general reports
    query += ` AND r."user_id" != 999`;
  }

  query += ` ORDER BY r."log_Date" DESC, u."user_LastName" ASC`;

  const reports = await sequelize.query(query, {
    replacements,
    type: QueryTypes.SELECT,
  });

  // 2. Fetch ALL approved requests for these users in this period
  const effectiveStart = (startDate && startDate !== "undefined" && startDate !== "") ? startDate : "1970-01-01";
  const effectiveEnd = (endDate && endDate !== "undefined" && endDate !== "") ? endDate : "2099-12-31";

  const requestQuery = `
      SELECT er."user_Id", er."emp_reqTypeId", 
             vl."StartDate" as "vStart", vl."EndDate" as "vEnd", 
             sl."StartDate" as "sStart", sl."EndDate" as "sEnd", 
             el."DateOfLeave" as "elDate",
             hd."DateOfLeave" as "hdDate",
             st."StartDate" as "stStart", st."EndDate" as "stEnd",
             ow."DateonField",
             ot."OT_DateOf", ot."HrFrom", ot."HrTo", ot."Total_Hrs"
      FROM "emp_Request" er
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
      LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
      LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      WHERE er."emp_reqStatusId" = 2
        AND (
          (er."emp_reqTypeId" = 1 AND ot."OT_DateOf" BETWEEN :effectiveStart AND :effectiveEnd) OR
          (er."emp_reqTypeId" = 2 AND ow."DateonField" BETWEEN :effectiveStart AND :effectiveEnd) OR
          (er."emp_reqTypeId" = 3 AND (vl."StartDate" <= :effectiveEnd AND vl."EndDate" >= :effectiveStart)) OR
          (er."emp_reqTypeId" = 4 AND (sl."StartDate" <= :effectiveEnd AND sl."EndDate" >= :effectiveStart)) OR
          (er."emp_reqTypeId" = 6 AND (el."DateOfLeave" BETWEEN :effectiveStart AND :effectiveEnd)) OR
          (er."emp_reqTypeId" = 7 AND (hd."DateOfLeave" BETWEEN :effectiveStart AND :effectiveEnd)) OR
          (er."emp_reqTypeId" IN (8, 9, 10, 11, 12) AND (st."StartDate" <= :effectiveEnd AND st."EndDate" >= :effectiveStart))
        )
  `;

  const allApprovedRequests = await sequelize.query(requestQuery, { 
      replacements: { effectiveStart, effectiveEnd }, 
      type: QueryTypes.SELECT 
  });

  // Helper functions for filtering and mapping
  const parseLogs = (jsonStr) => {
    try {
      const arr = JSON.parse(jsonStr || "[]");
      return arr.filter(t => t && t !== "—").sort();
    } catch (e) { return []; }
  };

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === 'string') return dateVal.split('T')[0];
    const d = new Date(dateVal);
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  };

  const results = (await Promise.all(reports
    .map(async (r) => {
      const inArr = parseLogs(r.time_Logged_inArr);
      const outArr = parseLogs(r.time_Logged_outArr);
      const dateStr = formatDateOnly(r.log_Date);
      
      const userReqs = allApprovedRequests.filter(req => Number(req.user_Id) === Number(r.user_id));
      const isOnField = userReqs.some(req => Number(req.emp_reqTypeId) === 2 && formatDateOnly(req.DateonField) === dateStr);
      const dayOT = userReqs.find(req => Number(req.emp_reqTypeId) === 1 && formatDateOnly(req.OT_DateOf) === dateStr);

      const mStart = settings?.morningShiftStart?.substring(0, 5) || "08:30";
      const mEnd   = settings?.morningShiftEnd?.substring(0, 5) || "17:30";
      const lStart = settings?.lunchStartThreshold?.substring(0, 5) || "12:00";
      const lEnd   = settings?.lunchEndThreshold?.substring(0, 5) || "13:00";

      const otStartTime = dayOT ? dayOT.HrFrom.substring(0, 5) : null;
      let { morning_In, morning_Out, afternoon_In, afternoon_Out } = mapLogsToBuckets(inArr, outArr, settings, otStartTime);
      
      // MIXED LOG/FILTER LOGIC: Only show the row if there's regular work OR a valid request OR explicitly absent
      const hasRegularWork = morning_In !== "—" || afternoon_Out !== "—" || (dayOT && outArr.length > 0);
      const hasRequest = userReqs.some(req => {
        const reqType = Number(req.emp_reqTypeId);
        if (reqType === 1) return formatDateOnly(req.OT_DateOf) === dateStr;
        if (reqType === 2) return formatDateOnly(req.DateonField) === dateStr;
        if (reqType === 3) return formatDateOnly(req.vStart) <= dateStr && formatDateOnly(req.vEnd) >= dateStr;
        if (reqType === 4) return formatDateOnly(req.sStart) <= dateStr && formatDateOnly(req.sEnd) >= dateStr;
        if (reqType === 6) return formatDateOnly(req.elDate) === dateStr;
        if (reqType === 7) return formatDateOnly(req.hdDate) === dateStr;
        if ([8, 9, 10, 11, 12].includes(reqType)) return formatDateOnly(req.stStart) <= dateStr && formatDateOnly(req.stEnd) >= dateStr;
        return false;
      });

      const isAbsent = Number(r.attendance_StatusId) === 3;
      if (!hasRegularWork && !hasRequest && !isAbsent) return null;

      // Final fallback for time_Out: pick the absolute last out if bucketed ones are missing
      const absoluteLastOut = outArr.length > 0 ? outArr[outArr.length - 1].substring(0, 5) : "—";
      let effectiveOut = (afternoon_Out !== "—" ? afternoon_Out : (morning_Out !== "—" ? morning_Out : absoluteLastOut));

      // ── TIME-SLICING CALCULATION ──
      let firstIn = inArr[0];
      let lastOut = outArr[outArr.length - 1];

      if (firstIn && firstIn < mStart && r.user_ShiftId !== 2) firstIn = mStart;
      if (!dayOT && lastOut && lastOut > mEnd && r.user_ShiftId !== 2) lastOut = mEnd;

      const hoursObj = await calculateMultiBucketHours(firstIn, lastOut, dateStr, r.user_ShiftId, settings, holidays);

      if (isOnField) {
        morning_In = mStart; morning_Out = lStart; afternoon_In = lEnd; afternoon_Out = mEnd;
        // Ensure on-field work is credited with 8 hours even if no physical logs exist
        hoursObj.reg_hrs = 8.0;
        hoursObj.totalPayableHours = 8.0;
        hoursObj.formatted = "8h 0m"; 
      }

      // ── INCIDENTAL VISIT (7) OR IRREGULAR (8) OVERRIDE ──
      if (parseInt(r.attendance_StatusId) === 7 || parseInt(r.attendance_StatusId) === 8) {
        morning_In = "—"; morning_Out = "—"; afternoon_In = "—"; afternoon_Out = "—";
        hoursObj.totalPayableHours = 0;
        hoursObj.reg_hrs = 0;
      }
      
      // Add Overtime manually if approved (apply multiplier from settings)
      if (dayOT && dayOT.Total_Hrs && parseInt(r.attendance_StatusId) !== 7) {
        hoursObj.totalPayableHours += parseFloat(dayOT.Total_Hrs) * (settings.overtimeRate || 1.25);
      }

      const ot_In = (dayOT && dayOT.HrFrom && parseInt(r.attendance_StatusId) !== 7) ? dayOT.HrFrom.substring(0, 5) : "—";
      const ot_Out = (dayOT && dayOT.HrFrom && parseInt(r.attendance_StatusId) !== 7 && outArr.length > 0 && outArr[outArr.length-1] && outArr[outArr.length-1].substring(0,5) > dayOT.HrFrom.substring(0,5)) ? outArr[outArr.length-1].substring(0,5) : "—";

      return {
        sessionId: `${r.user_id}-${dateStr}`,
        user_Id: r.user_id,
        machipId: r.user_MachipId,
        userName: `${r.user_FirstName} ${r.user_LastName}`,
        log_Date: r.log_Date,
        morning_In,
        morning_Out,
        afternoon_In,
        afternoon_Out,
        ot_In,
        ot_Out,
        time_In: morning_In,
        time_Out: ot_Out !== "—" ? ot_Out : effectiveOut,
        inArr,
        outArr,
        hoursWorked: hoursObj.reg_hrs || 0,
        hoursWorkedFormatted: formatDuration(hoursObj.reg_hrs || 0),
        status: (r.attendanceStatusName === "Exempt" || r.attendanceStatusName === "Present") ? "On Time" : (r.attendanceStatusName || (hoursObj.reg_hrs > 0 ? "On Time" : "—")),
        shiftId: r.user_ShiftId,
        buckets: hoursObj.buckets,
        systemGenerated: r.logged_StatusId === 7
      };
    }))).filter(row => row !== null);

  return results;
};

exports.getAttendanceReportInternal = getAttendanceReportInternal;

// ── Get Attendance Report (Filtered) ──────────────────────────────────────────
exports.getAttendanceReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    const logs = await getAttendanceReportInternal(startDate, endDate, user_Id);
    
    let payrollSummary = null;

    // If a specific user is requested, try to fetch payroll summary
    if (user_Id && user_Id !== "All Employees") {
      const payroll = await sequelize.query(
        `SELECT p.*, d."tardiness_Amnt", (COALESCE(d."absence_Hrs", 0) / 8) as "absence_Days"
         FROM "Payroll" p
         LEFT JOIN "Payroll_Deductions" d ON d."payrollId" = p."payrollId"
         WHERE p."user_Id" = :user_Id 
           AND p."period_Start" = :startDate 
           AND p."period_End" = :endDate
         LIMIT 1`,
        { replacements: { user_Id, startDate, endDate }, type: QueryTypes.SELECT }
      );

      if (payroll.length > 0) {
        const p = payroll[0];
        payrollSummary = {
          reg_hrs: p.NoHrs_Worked,
          ratePerHr: p.ratePerHr,
          basicPay: p.basicPay,
          tardiness_Amnt: p.tardiness_Amnt,
          absence_Days: p.absence_Days,
          netPay: p.netPay
        };
      } else {
        // Fallback: If payroll not generated, fetch live rates from User profile
        const user = await sequelize.query(
          `SELECT "dailyRate" FROM "User" WHERE "user_Id" = :user_Id`,
          { replacements: { user_Id }, type: QueryTypes.SELECT }
        );
        if (user.length > 0) {
          const dailyRate = parseFloat(user[0].dailyRate || 0);
          const ratePerHr = dailyRate / 8;
          const reg_hrs = logs.reduce((sum, l) => sum + parseFloat(l.hoursWorked || 0), 0);
          
          payrollSummary = {
            reg_hrs,
            ratePerHr,
            basicPay: reg_hrs * ratePerHr, // Estimated gross based on attendance
            tardiness_Amnt: 0,
            absence_Days: 0,
            netPay: null // TBD
          };
        }
      }
    }

    // Return as object if summary exists, else stay as array for backward compatibility
    if (payrollSummary) {
      return res.status(200).json({ logs, summary: payrollSummary });
    }

    res.status(200).json(logs);
  } catch (error) {
    console.error("[GET ATTENDANCE REPORT ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSingleAttendanceRecord = async (req, res) => {
  const { user_Id, date } = req.params;
  try {
    const report = await sequelize.query(
      `SELECT r.*, u."user_FirstName", u."user_LastName",
              ot."HrFrom" AS "ot_HrFrom", 
              ot."HrTo" AS "ot_HrTo",
              er."emp_reqStatusId"
       FROM "employee_Logging_report" r
       JOIN "User" u ON u."user_Id" = r."user_id"
       LEFT JOIN "Overtime_Request" ot ON ot."user_Id" = r."user_id" AND ot."OT_DateOf"::date = r."log_Date"::date
       LEFT JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
       WHERE r."user_id" = :user_Id AND r."log_Date" = :date`,
      {
        replacements: { user_Id, date },
        type: QueryTypes.SELECT,
      }
    );

    if (report.length === 0) {
      return res.status(404).json({ error: "Attendance record not found." });
    }

    const r = report[0];
    const inArr = JSON.parse(r.time_Logged_inArr || "[]").filter(t => t && t !== "—").sort();
    const outArr = JSON.parse(r.time_Logged_outArr || "[]").filter(t => t && t !== "—").sort();
    
    const hasApprovedOT = r.emp_reqStatusId === 2;
    const otStart = hasApprovedOT ? r.ot_HrFrom : null;

    const settings = await SystemSettings.findOne();
    const lStart = settings?.lunchStartThreshold?.substring(0, 5) || "11:30";
    const lEnd   = settings?.lunchEndThreshold?.substring(0, 5) || "13:30";

    const otStartTime = otStart ? otStart.substring(0, 5) : null;
    const { morning_In, morning_Out, afternoon_In, afternoon_Out } = mapLogsToBuckets(inArr, outArr, settings, otStartTime);
    
    // OT In defaults to the approved HrFrom if no specific log exists at that time
    const ot_In = hasApprovedOT && r.ot_HrFrom ? (inArr.find(t => t.substring(0, 5) >= r.ot_HrFrom)?.substring(0, 5) || r.ot_HrFrom.substring(0, 5)) : "";
    const ot_Out = hasApprovedOT && r.ot_HrFrom ? (outArr.find(t => t.substring(0, 5) >= r.ot_HrFrom)?.substring(0, 5) || "") : "";

    res.status(200).json({
      user_Id: r.user_id,
      userName: `${r.user_FirstName} ${r.user_LastName}`,
      log_Date: r.log_Date,
      morning_In,
      morning_Out,
      afternoon_In,
      afternoon_Out,
      ot_In,
      ot_Out,
      attendance_StatusId: r.attendance_StatusId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAttendanceRecord = async (req, res) => {
  const { user_Id, date } = req.params;
  const { morning_In, morning_Out, afternoon_In, afternoon_Out, ot_In, ot_Out, attendance_StatusId } = req.body;

  // [RULE] Admins cannot edit their own logs directly. 
  // They must file a Log Correction request to be approved by another admin.
  const operatorId = req.user?.user_Id;
  if (parseInt(operatorId) === parseInt(user_Id)) {
    return res.status(403).json({ 
      error: "You cannot edit your own logs. Please go to the Employee View and submit a Log Correction request for another administrator to review." 
    });
  }

  try {
    // 1. Fetch old record for logging
    const oldReport = await sequelize.query(
      `SELECT r.*, u."user_FirstName", u."user_LastName" 
       FROM "employee_Logging_report" r
       JOIN "User" u ON u."user_Id" = r."user_id"
       WHERE r."user_id" = :user_Id AND r."log_Date" = :date`,
      { replacements: { user_Id, date }, type: QueryTypes.SELECT }
    );

    if (oldReport.length === 0) {
      return res.status(404).json({ error: "Attendance record not found." });
    }

    const old = oldReport[0];
    const oldIn = JSON.parse(old.time_Logged_inArr || "[]");
    const oldOut = JSON.parse(old.time_Logged_outArr || "[]");

    // 2. Build new arrays cleanly
    const cleanTime = (t) => (t && t !== "—" && t !== "" ? (t.length === 5 ? t + ":00" : t) : null);

    const amIn = cleanTime(morning_In);
    const amOut = cleanTime(morning_Out);
    const pmIn = cleanTime(afternoon_In);
    const pmOut = cleanTime(afternoon_Out);
    const otIn = cleanTime(ot_In);
    const otOut = cleanTime(ot_Out);

    // [FIX] Deduplicate PM session if it perfectly overlaps with the end of the AM session
    // This happens if a user clocks out at 12:00 PM and logs reflect ["08:00", "12:00"] and ["12:00", "12:00"]
    let finalPmIn = pmIn;
    let finalPmOut = pmOut;
    if (pmIn && pmIn === amOut && pmOut === amOut) {
      finalPmIn = null;
      finalPmOut = null;
    }

    let inArr = [amIn, finalPmIn, otIn];
    let outArr = [amOut, finalPmOut, otOut];

    // Trim trailing nulls (to keep DB clean but preserve internal nulls if needed)
    while (inArr.length > 0 && inArr[inArr.length - 1] === null) inArr.pop();
    while (outArr.length > 0 && outArr[outArr.length - 1] === null) outArr.pop();

    const inArrStr = JSON.stringify(inArr);
    const outArrStr = JSON.stringify(outArr);

    const reportLoggedStatus = (outArr.length >= inArr.length && outArr.length > 0) ? 2 : 1;

    // 3. Update the record
    await sequelize.query(
      `UPDATE "employee_Logging_report"
       SET "time_Logged_inArr" = :inArr,
           "time_Logged_outArr" = :outArr,
           "attendance_StatusId" = :attendance_StatusId,
           "logged_StatusId" = :reportLoggedStatus
       WHERE "user_id" = :user_Id AND "log_Date" = :date`,
      {
        replacements: {
          inArr: inArrStr,
          outArr: outArrStr,
          attendance_StatusId,
          reportLoggedStatus,
          user_Id,
          date
        },
        type: QueryTypes.UPDATE
      }
    );

    // ── 7. RESOLVE LEAVE CONFLICTS (VOID LOGIC) ──────────────────────────────
    if (reportLoggedStatus === 2) {
      resolveLeaveConflict(user_Id, date)
        .then(res => {
          if (res.refundAmount > 0) console.log(`[LEAVE-AUTO] ${res.message} for user ${user_Id}`);
        })
        .catch(err => console.error("[LEAVE-AUTO] Error resolving leave conflict:", err));
    }

    // 4. Log Changes
    const changes = [];
    const checkChange = (label, oldVal, newVal) => {
      const v1 = (oldVal || "—").substring(0, 5);
      const v2 = (newVal || "—").substring(0, 5);
      if (v1 !== v2) changes.push(`${label}: ${v1} → ${v2}`);
    };

    checkChange("AM In", oldIn[0], amIn);
    checkChange("AM Out", oldOut[0], amOut);
    checkChange("PM In", oldIn[1], pmIn);
    checkChange("PM Out", oldOut[1], pmOut);
    checkChange("OT In", oldIn[2], otIn);
    checkChange("OT Out", oldOut[2], otOut);

    if (parseInt(old.attendance_StatusId) !== parseInt(attendance_StatusId)) {
      changes.push(`Status ID: ${old.attendance_StatusId} → ${attendance_StatusId}`);
    }

    if (changes.length > 0) {
      const changeMsg = `Edited logs for ${old.user_FirstName} ${old.user_LastName} on ${date}. Changes: ${changes.join(", ")}`;
      
      // Transaction Log
      await logTransaction(user_Id, null, "EDIT_ATTENDANCE", changeMsg, { 
        date, 
        old: { in: oldIn, out: oldOut, status: old.attendance_StatusId },
        new: { in: inArr, out: outArr, status: attendance_StatusId }
      }, req);

      // Audit Log
      await logAudit(req, req.user?.user_Id || user_Id, "Attendance", "UPDATE_LOGS", "employee_Logging_report", old.employee_Logging_reportId, old, { ...old, time_Logged_inArr: inArrStr, time_Logged_outArr: outArrStr, attendance_StatusId });
    }

    res.status(200).json({ message: "Attendance record updated successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
