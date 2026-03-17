const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { ensureAbsentsMarked } = require("../utils/attendanceHelper.js");

// ── Mark Attendance ───────────────────────────────────────────────────────────
exports.markAttendance = async (req, res) => {
  const { forcedStatus } = req.body; // 1 for Clock In, 2 for Clock Out

  try {
    const now = await getSystemTime();
    await ensureAbsentsMarked();

    let userQuery = `
      SELECT u.* FROM "User" u 
      LEFT JOIN "employee_Logging_report" r ON u."user_Id" = r."user_id" AND r."log_Date" = CURRENT_DATE
      WHERE u."deletedAt" IS NULL 
      AND (r."attendance_StatusId" IS NULL OR r."attendance_StatusId" NOT IN (3, 4))
    `;

    if (forcedStatus === 1) {
      // Pick a user who is currently Logged Out (status 2 or no report yet)
      userQuery += ` AND (r."logged_StatusId" IS NULL OR r."logged_StatusId" = 2)`;
    } else if (forcedStatus === 2) {
      // Pick a user who is currently Logged In (status 1)
      userQuery += ` AND r."logged_StatusId" = 1`;
    }

    userQuery += ` ORDER BY RANDOM() LIMIT 1`;

    const users = await sequelize.query(userQuery, { type: QueryTypes.SELECT });

    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: "No available users found for this action." });
    }

    const user_Id = user.user_Id;

    const todayStr = now.toISOString().split("T")[0];
    const timeStr  = now.toTimeString().split(" ")[0];

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // ── Lunch window check ──────────────────────────────────────────────────
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const isLunchWindow = totalMinutes >= 720 && totalMinutes < 780;

    // ── Get ONLY TODAY's last log ───────────────────────────────────────────
    const lastLogs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;

    // Check if the user has EVER clocked in (status 1) today
    const firstLoginToday = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :user_Id
       AND "logged_StatusId" = 1
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const hasPriorClockIn = !!firstLoginToday[0];

    // ── Determine next status ───────────────────────────────────────────────
    let nextStatus;
    if (!lastStatus || lastStatus === 2) {
      nextStatus = 1; // Clock In
    } else if (lastStatus === 3) {
      nextStatus = 4; // In From Lunch
    } else {
      nextStatus = isLunchWindow ? 3 : 2;
    }

    // ── SUSPICIOUS ACTIVITY CHECK ──────────────────────────────────────────
    // If attempting Clock In (status 1) past 5:30 PM AND has no prior clock-in today
    const fivePMThirty = new Date(now);
    fivePMThirty.setHours(17, 30, 0, 0);

    if (nextStatus === 1 && now >= fivePMThirty && !hasPriorClockIn) {
      // Create Suspicious Activity Notification for Admin (assume Admin ID = 1)
      const adminId = 1; 
      const timeStrFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      await sequelize.query(
        `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "createdAt", "updatedAt")
         VALUES (:adminId, :title, :message, false, NOW(), NOW())`,
        {
          replacements: {
            adminId,
            title: "Suspicious Activity Detected",
            message: `User ${user.user_FirstName} ${user.user_LastName} (ID: ${user.user_Id}) attempted to Clock In at ${timeStrFormatted} but has no prior attendance record for today. Entry blocked.`,
          },
          type: QueryTypes.INSERT,
        }
      );

      return res.status(403).json({ 
        error: "Suspicious Activity: Clock-in blocked. Administrator notified.",
        suspicious: true 
      });
    }

    // ── Attendance value (only on first Clock In of the day) ────────────────
    let attendanceVal = null;
    if (nextStatus === 1 && !hasPriorClockIn) {
      // Only mark Late if within working hours
      // Past 5:30 with no log is now blocked as suspicious
      attendanceVal = now.getHours() < 9 ? 1 : 2;
    }

    // ── Insert into user_logging ────────────────────────────────────────────
    const newLogResult = await sequelize.query(
      `INSERT INTO "user_logging"
        ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
       VALUES
        (:user_Id, :log_Date, :time_Logged, :logged_StatusId, :attendance_StatusId)
       RETURNING *`,
      {
        replacements: {
          user_Id,
          log_Date: todayStart,
          time_Logged: timeStr,
          logged_StatusId: nextStatus,
          attendance_StatusId: attendanceVal,
        },
        type: QueryTypes.INSERT,
      },
    );

    const newLog = newLogResult[0][0];

    // ── Upsert employee_Logging_report ──────────────────────────────────────
    const isEntry    = nextStatus === 1 || nextStatus === 4;
    const finalStatus = nextStatus === 4 ? 1 : nextStatus;

    const existingReport = await sequelize.query(
      `SELECT * FROM "employee_Logging_report"
       WHERE "user_id" = :user_Id AND "log_Date" = :todayStr
       LIMIT 1`,
      { replacements: { user_Id, todayStr }, type: QueryTypes.SELECT },
    );

    if (!existingReport[0]) {
      await sequelize.query(
        `INSERT INTO "employee_Logging_report"
          ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr",
           "attendance_StatusId", "logged_StatusId")
         VALUES
          (:user_Id, :todayStr, :inArr, :outArr, :attendance_StatusId, :finalStatus)`,
        {
          replacements: {
            user_Id,
            todayStr,
            inArr: isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            outArr: !isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            attendance_StatusId: attendanceVal,
            finalStatus,
          },
          type: QueryTypes.INSERT,
        },
      );
    } else {
      const inArr  = JSON.parse(existingReport[0].time_Logged_inArr  || "[]");
      const outArr = JSON.parse(existingReport[0].time_Logged_outArr || "[]");

      if (isEntry) inArr.push(timeStr);
      else outArr.push(timeStr);

      await sequelize.query(
        `UPDATE "employee_Logging_report"
         SET "time_Logged_inArr"  = :inArr,
             "time_Logged_outArr" = :outArr,
             "logged_StatusId" = :finalStatus
         WHERE "user_id" = :user_Id AND "log_Date" = :todayStr`,
        {
          replacements: {
            inArr: JSON.stringify(inArr),
            outArr: JSON.stringify(outArr),
            finalStatus,
            user_Id,
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
    };

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
         l."statusName" AS "loggedStatusName"
       FROM "employee_Logging_report" r
       LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
       LEFT JOIN "logged_status" l ON l."statusId" = r."logged_StatusId"
       WHERE r."user_id" = :user_Id
       ORDER BY r."log_Date" DESC`,
      { replacements: { user_Id }, type: QueryTypes.SELECT },
    );

    const dailyRows = reports.map((report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]");
      const outArr = JSON.parse(report.time_Logged_outArr || "[]");
      return {
        sessionId: `${report.user_id}-${report.log_Date}`,
        log_Date: report.log_Date,
        time_In: inArr[0] ?? null,
        time_Out: outArr[outArr.length - 1] ?? null,
        logStatus:
          report.loggedStatusName ??
          (report.logged_StatusId === 1 ? "Clock In" : "Clock Out"),
        attendanceStatus: report.attendanceStatusName ?? "—",
      };
    });

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
         ul."log_Date",
         ul."time_Logged",
         ul."logged_StatusId",
         ul."attendance_StatusId",
         u."user_Id",
         u."user_FirstName",
         u."user_LastName",
         u."user_MachipId",
         ls."statusName"  AS "loggedStatusName",
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
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 1) AS "OnTime",
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
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 1) AS "OnTime",
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
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 4) AS "onLeaveCount"
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

