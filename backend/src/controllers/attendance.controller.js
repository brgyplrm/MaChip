const { sequelize, Notification, User } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { ensureAbsentsMarked } = require("../utils/attendanceHelper.js");
const { logAudit, logTransaction } = require("../utils/logger");

// ── Mark Attendance ───────────────────────────────────────────────────────────
exports.markAttendance = async (req, res) => {
  let { forcedStatus, user_Id, log_Type } = req.body; // 1 for Clock In, 2 for Clock Out

  // Map log_Type (from frontend) to forcedStatus if needed
  if (!forcedStatus && log_Type) {
    const type = log_Type.toLowerCase();
    if (type.includes("in")) forcedStatus = 1;
    else if (type.includes("out")) forcedStatus = 2;
  }

  try {
    const now = await getSystemTime();
    
    // Format YYYY-MM-DD in local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    
    const timeStr = now.toTimeString().split(" ")[0];

    let user;
    if (user_Id) {
      // Try user_Id first, then user_MachipId
      user = await User.findOne({ 
        where: { 
          [sequelize.Sequelize.Op.or]: [
            { user_Id: isNaN(parseInt(user_Id)) ? -1 : parseInt(user_Id) }, 
            { user_MachipId: user_Id }
          ],
          deletedAt: null 
        } 
      });
    } else {
      // Fallback: Select an active user
      const users = await sequelize.query(
        `SELECT * FROM "User" WHERE "deletedAt" IS NULL ORDER BY RANDOM() LIMIT 1`,
        { type: QueryTypes.SELECT }
      );
      user = users[0];
    }

    if (!user) {
      return res.status(404).json({ error: "User not found or inactive." });
    }

    const target_user_Id = user.user_Id;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const fivePMThirty = new Date(now);
    fivePMThirty.setHours(17, 30, 0, 0);

    // Check for approved OT for today (needed for auto-transition)
    const approvedOTResult = await sequelize.query(
      `SELECT ot.* FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       WHERE ot."user_Id" = :target_user_Id 
       AND ot."OT_DateOf" = :todayStr
       AND er."emp_reqStatusId" = 2`,
      { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT }
    );
    const approvedOT = approvedOTResult[0];
    const hasApprovedOT = !!approvedOT;

    // ── Get last log of the day ───────────────────────────────────────────
    const lastLogs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;

    // ── Auto-Transition at 5:30 PM for OT ──────────────────────────────────
    // If user is still "In" (1 or 4) after 5:30 PM and has approved OT, 
    // we automatically close regular shift and start OT shift at 5:30 PM.
    if ([1, 4].includes(lastStatus) && now >= fivePMThirty && hasApprovedOT) {
      console.log(`[SYSTEM] Auto-transitioning user ${target_user_Id} to OT shift at 17:30:00`);
      
      // 1. Record Regular Out at 17:30
      await sequelize.query(
        `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId")
         VALUES (:target_user_Id, :todayStart, '17:30:00', 2)`,
        { replacements: { target_user_Id, todayStart }, type: QueryTypes.INSERT }
      );

      // 2. Record OT In at 17:30
      await sequelize.query(
        `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId")
         VALUES (:target_user_Id, :todayStart, '17:30:00', 5)`,
        { replacements: { target_user_Id, todayStart }, type: QueryTypes.INSERT }
      );

      // 3. Update the report Arrays
      const report = await sequelize.query(
        `SELECT * FROM "employee_Logging_report" WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`,
        { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT }
      );

      if (report[0]) {
        const inArr = JSON.parse(report[0].time_Logged_inArr || "[]");
        const outArr = JSON.parse(report[0].time_Logged_outArr || "[]");
        outArr.push("17:30:00");
        inArr.push("17:30:00");

        await sequelize.query(
          `UPDATE "employee_Logging_report" 
           SET "time_Logged_inArr" = :inArr, "time_Logged_outArr" = :outArr, "logged_StatusId" = 1
           WHERE "employee_Logging_reportId" = :reportId`,
          { replacements: { 
              inArr: JSON.stringify(inArr), 
              outArr: JSON.stringify(outArr), 
              reportId: report[0].employee_Logging_reportId 
          }, type: QueryTypes.UPDATE }
        );
      }

      // 4. Update local state for the remainder of this function
      lastLogs[0] = { logged_StatusId: 5 }; // Pretend the last status was OT-In
    }

    const currentStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;

    // Validate forcedStatus against currentStatus
    if (forcedStatus === 1 && [1, 4, 5].includes(currentStatus)) {
      return res.status(400).json({ error: `User ${user.user_FirstName} is already clocked in.` });
    }
    if (forcedStatus === 2 && (currentStatus === null || [2, 3, 6].includes(currentStatus))) {
      return res.status(400).json({ error: `User ${user.user_FirstName} is already clocked out.` });
    }

    // Check if the user has EVER clocked in (status 1) today
    const firstLoginToday = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "logged_StatusId" = 1
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );
    const hasPriorClockIn = !!firstLoginToday[0];

    let isWithinOTWindow = false;
    let isPastOTWindow = false;
    if (hasApprovedOT) {
      const currentTimeStr = now.toTimeString().split(" ")[0];
      isWithinOTWindow = (currentTimeStr >= approvedOT.HrFrom && currentTimeStr <= approvedOT.HrTo);
      isPastOTWindow = (currentTimeStr > approvedOT.HrTo);
    }

    // ── Lunch window check ──────────────────────────────────────────────────
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const isLunchWindow = totalMinutes >= 720 && totalMinutes < 780;

    // ── Determine next status ───────────────────────────────────────────────
    let nextStatus;
    let finalTimeStr = timeStr;

    if (forcedStatus === 1) {
      if (lastStatus === 3) {
        nextStatus = 4; // In From Lunch
      } else if (hasApprovedOT && isWithinOTWindow) {
        nextStatus = 5; // Overtime-In
      } else {
        nextStatus = 1; // Clock In
      }
    } else if (forcedStatus === 2) {
      if (isLunchWindow && (lastStatus === 1 || lastStatus === 4)) {
        nextStatus = 3; // Out For Lunch
      } else if (lastStatus === 5) {
        nextStatus = 6; // Overtime-Out
      } else {
        nextStatus = 2; // Clock Out
      }
    } else {
      // Fallback for auto-detection
      if (!lastStatus || [2, 3, 6].includes(lastStatus)) {
        nextStatus = (hasApprovedOT && isWithinOTWindow) ? 5 : 1;
      } else {
        if (isLunchWindow && [1, 4].includes(lastStatus)) {
          nextStatus = 3;
        } else if (lastStatus === 5) {
          nextStatus = 6;
        } else {
          nextStatus = 2;
        }
      }
    }

    // ── SUSPICIOUS ACTIVITY CHECK ──────────────────────────────────────────
    const fourAM = new Date(now);
    fourAM.setHours(4, 0, 0, 0);

    const isLateNightFirstIn = (nextStatus === 1 && (now >= fivePMThirty || now < fourAM) && !hasPriorClockIn && !isWithinOTWindow);
    const isUnauthorizedReEntry = (nextStatus === 1 && hasPriorClockIn && now >= fivePMThirty && !isWithinOTWindow);
    const isPastOTEntry = (nextStatus === 1 && hasApprovedOT && isPastOTWindow);

    if (isLateNightFirstIn || isUnauthorizedReEntry || isPastOTEntry) {
      const admins = await User.findAll({
        where: { user_RoleId: 1 },
        attributes: ["user_Id"],
      });

      const timeStrFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let adminMessage = `[SYSTEM NOTICE] Suspicious activity detected: User ${user.user_FirstName} ${user.user_LastName} (ID: ${user.user_Id}) `;
      
      if (isPastOTEntry) {
        adminMessage += `clocked in at ${timeStrFormatted}, which is past their approved Overtime window (Ended at ${approvedOT.HrTo}).`;
      } else if (isLateNightFirstIn) {
        adminMessage += `logged in at ${timeStrFormatted} (Outside 4 AM - 5:30 PM) without a prior attendance record or approved Overtime request.`;
      } else if (isUnauthorizedReEntry) {
        adminMessage += `clocked in again at ${timeStrFormatted} (Past 5:30 PM) after previously logging out, without an approved Overtime request.`;
      }

      for (const admin of admins) {
        await Notification.create({
          user_Id: admin.user_Id,
          title: "Suspicious Activity Detected",
          message: adminMessage,
          isRead: false
        });
      }
    }

    // ── Attendance value (only on first Clock In of the day) ────────────────
    let attendanceVal = null;
    if (nextStatus === 1 && !hasPriorClockIn) {
      attendanceVal = now.getHours() < 9 ? 1 : 2;
    }

    // ── Insert into user_logging ────────────────────────────────────────────
    const newLogResult = await sequelize.query(
      `INSERT INTO "user_logging"
        ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
       VALUES
        (:target_user_Id, :log_Date, :time_Logged, :logged_StatusId, :attendance_StatusId)
       RETURNING *`,
      {
        replacements: {
          target_user_Id,
          log_Date: todayStart,
          time_Logged: finalTimeStr,
          logged_StatusId: nextStatus,
          attendance_StatusId: attendanceVal,
        },
        type: QueryTypes.INSERT,
      },
    );

    const newLog = newLogResult[0][0];

    // ── Upsert employee_Logging_report ──────────────────────────────────────
    const isEntry = [1, 4, 5].includes(nextStatus);
    let reportLoggedStatus = nextStatus;
    if (nextStatus === 4 || nextStatus === 5) reportLoggedStatus = 1;
    if (nextStatus === 3 || nextStatus === 6) reportLoggedStatus = 2;

    const existingReport = await sequelize.query(
      `SELECT * FROM "employee_Logging_report"
       WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr
       LIMIT 1`,
      { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT },
    );

    if (!existingReport[0]) {
      await sequelize.query(
        `INSERT INTO "employee_Logging_report"
          ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr",
           "attendance_StatusId", "logged_StatusId")
         VALUES
          (:target_user_Id, :todayStr, :inArr, :outArr, :attendance_StatusId, :reportLoggedStatus)`,
        {
          replacements: {
            target_user_Id,
            todayStr,
            inArr: isEntry ? JSON.stringify([finalTimeStr]) : JSON.stringify([]),
            outArr: !isEntry ? JSON.stringify([finalTimeStr]) : JSON.stringify([]),
            attendance_StatusId: attendanceVal,
            reportLoggedStatus,
          },
          type: QueryTypes.INSERT,
        },
      );
    } else {
      const inArr  = JSON.parse(existingReport[0].time_Logged_inArr  || "[]");
      const outArr = JSON.parse(existingReport[0].time_Logged_outArr || "[]");

      if (isEntry) inArr.push(finalTimeStr);
      else outArr.push(finalTimeStr);

      await sequelize.query(
        `UPDATE "employee_Logging_report"
         SET "time_Logged_inArr"  = :inArr,
             "time_Logged_outArr" = :outArr,
             "logged_StatusId" = :reportLoggedStatus,
             "attendance_StatusId" = COALESCE("attendance_StatusId", :attendance_StatusId)
         WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`,
        {
          replacements: {
            inArr: JSON.stringify(inArr),
            outArr: JSON.stringify(outArr),
            reportLoggedStatus,
            attendance_StatusId: attendanceVal,
            target_user_Id,
            todayStr,
          },
          type: QueryTypes.UPDATE,
        },
      );
    }



    const statusLabels = {
      1: "Clock In",
      2: "Clock Out",
      3: "Out For Lunch",
      4: "In From Lunch",
      5: "Overtime-In",
      6: "Overtime-Out",
    };

    // Log transaction
    await logTransaction(target_user_Id, null, "ATTENDANCE_LOG", `${statusLabels[nextStatus]} for user ${target_user_Id}`, { status: statusLabels[nextStatus], time: finalTimeStr, method: log_Type || "Manual/RFID" }, req);

    return res.status(201).json({
      message: `${statusLabels[nextStatus]} recorded successfully`,
      data: newLog,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View User Logs ────────────────────────────────────────────────────────────
exports.viewUserLogs = async (req, res) => {
  const { user_Id } = req.params;
  try {
    await ensureAbsentsMarked();
    const reports = await sequelize.query(
      `SELECT
         r.*,
         a."statusName" AS "attendanceStatusName",
         CASE 
           WHEN r."logged_StatusId" = 1 AND EXISTS (
             SELECT 1 FROM "user_logging" ul 
             WHERE ul."user_id" = r."user_id" AND ul."log_Date" = r."log_Date" 
             AND ul."logged_StatusId" = 1 
             AND (
               -- Suspicious First In (Outside 4 AM - 5:30 PM)
               ((ul."time_Logged" >= '17:30:00' OR ul."time_Logged" < '04:00:00') AND NOT EXISTS (
                 SELECT 1 FROM "user_logging" prev 
                 WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date"
                 AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
               ))
               OR 
               -- Suspicious Re-entry (After 5:30 PM)
               (ul."time_Logged" >= '17:30:00' AND EXISTS (
                 SELECT 1 FROM "user_logging" prev 
                 WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date"
                 AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
               ))
             )
             AND NOT EXISTS (
               SELECT 1 FROM "Overtime_Request" ot
               JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
               WHERE ot."user_Id" = ul."user_id" AND ot."OT_DateOf" = ul."log_Date" AND er."emp_reqStatusId" = 2
               AND ul."time_Logged" BETWEEN ot."HrFrom" AND ot."HrTo"
             )
           ) THEN l."statusName" || ' (Suspicious)'
           ELSE l."statusName"
         END AS "loggedStatusName"
       FROM "employee_Logging_report" r
       LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
       LEFT JOIN "logged_status" l ON l."statusId" = r."logged_StatusId"
       WHERE r."user_id" = :user_Id
       ORDER BY r."log_Date" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const dailyRows = await Promise.all(reports.map(async (report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]");
      const outArr = JSON.parse(report.time_Logged_outArr || "[]");
      
      const allLogs = [...inArr, ...outArr].sort();
      
      let time_In = inArr[0] ?? null;
      let time_Out = null;
      let ot_In = null;
      let ot_Out = null;

      // Logic to separate regular and OT
      // Regular end is usually around 17:30
      const regularOuts = outArr.filter(t => t <= "17:35:00");
      time_Out = regularOuts.length > 0 ? regularOuts[regularOuts.length - 1] : (outArr[0] ?? null);

      const otIns = inArr.filter(t => t >= "17:30:00");
      ot_In = otIns.length > 0 ? otIns[0] : null;

      const otOuts = outArr.filter(t => t > "17:35:00");
      ot_Out = otOuts.length > 0 ? otOuts[otOuts.length - 1] : null;

      let attendanceStatus = report.attendanceStatusName ?? "—";

      // If no logs, check if there was an approved Onfield Work for this day
      if (!time_In && !time_Out) {
        const onfield = await sequelize.query(
          `SELECT ow.* FROM "Onfield_Work" ow
           JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
           WHERE er."user_Id" = :user_Id AND ow."DateonField" = :logDate
           AND er."emp_reqStatusId" = 2`,
          { replacements: { user_Id, logDate: report.log_Date }, type: QueryTypes.SELECT }
        );

        if (onfield.length > 0) {
          time_In = "08:30:00";
          time_Out = "17:30:00";
          attendanceStatus = "On-Field";
        }
      }

      return {
        sessionId: `${report.user_id}-${report.log_Date}`,
        log_Date: report.log_Date,
        time_In,
        time_Out,
        ot_In,
        ot_Out,
        logStatus: report.loggedStatusName,
        attendanceStatus,
      };
    }));

    res.status(200).json(dailyRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── View All Attendance ───────────────────────────────────────────────────────
exports.viewAllAttendance = async (req, res) => {
  try {
    await ensureAbsentsMarked();
    const logs = await sequelize.query(
      `SELECT
         ul."user_loggingId",
         ul."user_id",
         ul."time_Logged",
         ul."log_Date",
         ul."logged_StatusId",
         ul."attendance_StatusId",
         u."user_Id",
         u."user_FirstName",
         u."user_LastName",
         u."user_MachipId",
         CASE 
           WHEN ul."logged_StatusId" = 1 AND (
             -- Suspicious First In (Outside 4 AM - 5:30 PM)
             ((ul."time_Logged" >= '17:30:00' OR ul."time_Logged" < '04:00:00') AND NOT EXISTS (
               SELECT 1 FROM "user_logging" prev 
               WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date" 
               AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
             ))
             OR
             -- Suspicious Re-entry (After 5:30 PM)
             (ul."time_Logged" >= '17:30:00' AND EXISTS (
               SELECT 1 FROM "user_logging" prev 
               WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date" 
               AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
             ))
           )
           AND NOT EXISTS (
             SELECT 1 FROM "Overtime_Request" ot
             JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
             WHERE ot."user_Id" = ul."user_id" AND ot."OT_DateOf" = ul."log_Date" AND er."emp_reqStatusId" = 2
             AND ul."time_Logged" BETWEEN ot."HrFrom" AND ot."HrTo"
           )
           THEN ls."statusName" || ' (Suspicious)'
           ELSE ls."statusName"
         END AS "loggedStatusName",
         att."statusName" AS "attendanceStatusName"
       FROM "user_logging" ul
       LEFT JOIN "User" u ON u."user_Id" = ul."user_id"
       LEFT JOIN "logged_status" ls ON ls."statusId" = ul."logged_StatusId"
       LEFT JOIN "attendance_status" att ON att."statusId" = ul."attendance_StatusId"
       ORDER BY ul."user_loggingId" DESC`,
      { type: QueryTypes.SELECT },
    );

    res.status(200).json(logs);
  } catch (error) {
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
    await ensureAbsentsMarked();

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

// ── Get Monthly Attendance Stats (Global) ────────────────────────────────────
exports.getMonthlyAttendanceStats = async (req, res) => {
  try {
    await ensureAbsentsMarked();
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
       GROUP BY name, month_num
       ORDER BY month_num ASC`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Monthly Attendance Stats (Specific User) ──────────────────────────────
exports.getMonthlyAttendanceStatsByUser = async (req, res) => {
  const { user_Id } = req.params;
  try {
    await ensureAbsentsMarked();
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
    await ensureAbsentsMarked();
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

    // 4. Leave Requests for the CURRENT MONTH
    const monthlyRequests = await sequelize.query(
      `SELECT
        er."emp_reqId",
        er."emp_reqTypeId",
        rt."reqTypeName",
        rs."reqStatName" as "status",
        er."date_Filed",
        er.remarks,
        ot."OT_DateOf",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        ow."DateonField"
      FROM "emp_Request" er
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      WHERE er."user_Id" = :user_Id
      AND EXTRACT(YEAR FROM er."date_Filed") = :currentYear
      AND EXTRACT(MONTH FROM er."date_Filed") = :currentMonth
      ORDER BY er."date_Filed" DESC`,
      { replacements: { user_Id, currentYear, currentMonth }, type: QueryTypes.SELECT }
    );

    res.status(200).json({
      attendance: {
        absent: parseInt(attendanceStats[0].absentCount || 0),
        onTime: parseInt(attendanceStats[0].onTimeCount || 0),
        late: parseInt(attendanceStats[0].lateCount || 0),
        monthName: now.toLocaleString('default', { month: 'long' })
      },
      leaveBalance: leaveBalance[0] || {
        VL_total: 7, VL_used: 0, VL_balance: 7,
        SL_total: 7, SL_used: 0, SL_balance: 7
      },
      recentLogs: recentLogs.map(log => ({
        date: log.log_Date,
        status: log.attendanceStatus || "—",
        timeIn: JSON.parse(log.time_Logged_inArr || "[]")[0] || "—",
        timeOut: JSON.parse(log.time_Logged_outArr || "[]").pop() || "—"
      })),
      monthlyRequests: monthlyRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Dashboard Stats ───────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    await ensureAbsentsMarked();
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];

    const userCountResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM "User" WHERE "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );
    const totalEmployees = parseInt(userCountResult[0].total);

    const stats = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE "logged_StatusId" = 1) AS "officeOccupancy",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 1) AS "onTimeCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "lateArrivalsCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 3) AS "absentCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 4) AS "onLeaveCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 5) AS "onFieldCount"
       FROM "employee_Logging_report"
       WHERE "log_Date" = :todayStr`,
      { replacements: { todayStr }, type: QueryTypes.SELECT },
    );

    res.status(200).json({
      totalEmployees,
      officeOccupancy: parseInt(stats[0].officeOccupancy || 0),
      onTimeCount: parseInt(stats[0].onTimeCount || 0),
      lateArrivalsCount: parseInt(stats[0].lateArrivalsCount || 0),
      absentCount: parseInt(stats[0].absentCount || 0),
      onLeaveCount: parseInt(stats[0].onLeaveCount || 0),
      onFieldCount: parseInt(stats[0].onFieldCount || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Office Occupancy ──────────────────────────────────────────────────────
exports.getOfficeOccupancy = async (req, res) => {
  try {
    await ensureAbsentsMarked();
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];

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
       AND r."logged_StatusId" = 1`,
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

// ── Get Attendance Report (Filtered) ──────────────────────────────────────────
exports.getAttendanceReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    await ensureAbsentsMarked();
    let query = `
      SELECT
        r.*,
        u."user_Id" as "actual_user_Id",
        u."user_FirstName",
        u."user_LastName",
        u."user_MachipId",
        a."statusName" AS "attendanceStatusName"
      FROM "employee_Logging_report" r
      LEFT JOIN "User" u ON u."user_Id" = r."user_id"
      LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
      WHERE r."log_Date" BETWEEN :startDate AND :endDate
    `;

    const replacements = { startDate, endDate };
    if (user_Id && user_Id !== "All Employees") {
      query += ` AND r."user_id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    query += ` ORDER BY r."log_Date" DESC, u."user_LastName" ASC`;

    const reports = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    const calculateHours = (inArr, outArr) => {
      let total = 0;
      const len = Math.min(inArr.length, outArr.length);
      for (let i = 0; i < len; i++) {
        if (inArr[i] && outArr[i]) {
          const [h1, m1, s1] = inArr[i].split(":").map(Number);
          const [h2, m2, s2] = outArr[i].split(":").map(Number);
          const d1 = new Date(0, 0, 0, h1, m1, s1);
          const d2 = new Date(0, 0, 0, h2, m2, s2);
          total += (d2 - d1) / (1000 * 60 * 60);
        }
      }
      return total;
    };

    const data = reports.map((r) => {
      const inArr = JSON.parse(r.time_Logged_inArr || "[]");
      const outArr = JSON.parse(r.time_Logged_outArr || "[]");
      const hoursWorked = calculateHours(inArr, outArr);

      // Separate regular and OT
      const time_In = inArr[0] ?? "—";
      const regularOuts = outArr.filter(t => t <= "17:35:00");
      const time_Out = regularOuts.length > 0 ? regularOuts[regularOuts.length - 1] : (outArr[0] ?? "—");

      const otIns = inArr.filter(t => t >= "17:30:00");
      const ot_In = otIns.length > 0 ? otIns[0] : "—";

      const otOuts = outArr.filter(t => t > "17:35:00");
      const ot_Out = otOuts.length > 0 ? otOuts[otOuts.length - 1] : "—";

      return {
        user_Id: r.user_id,
        machipId: r.user_MachipId,
        userName: `${r.user_FirstName} ${r.user_LastName}`,
        log_Date: r.log_Date,
        time_In,
        time_Out,
        ot_In,
        ot_Out,
        hoursWorked: hoursWorked.toFixed(2),
        status: r.attendanceStatusName ?? "—",
        remarks: "", 
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

