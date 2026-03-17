const { sequelize, Notification, User } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { ensureAbsentsMarked } = require("../utils/attendanceHelper.js");

// ── Mark Attendance ───────────────────────────────────────────────────────────
exports.markAttendance = async (req, res) => {
  const { forcedStatus } = req.body; // 1 for Clock In, 2 for Clock Out

  try {
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];
    const timeStr  = now.toTimeString().split(" ")[0];

    // Pick a user based on forcedStatus
    let userQuery = `
      SELECT u.* FROM "User" u 
      LEFT JOIN "employee_Logging_report" r ON u."user_Id" = r."user_id" AND r."log_Date" = :todayStr
      WHERE u."deletedAt" IS NULL 
    `;

    if (forcedStatus === 1) {
      userQuery += ` AND (r."logged_StatusId" IS NULL OR r."logged_StatusId" IN (2, 3, 6))
                     AND (r."attendance_StatusId" IS NULL OR r."attendance_StatusId" != 4)`;
    } else if (forcedStatus === 2) {
      userQuery += ` AND r."logged_StatusId" IN (1, 4, 5)`;
    }

    userQuery += ` ORDER BY RANDOM() LIMIT 1`;

    const users = await sequelize.query(userQuery, { 
      replacements: { todayStr }, 
      type: QueryTypes.SELECT 
    });

    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: "No available users found for this action." });
    }

    const user_Id = user.user_Id;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // ── Get last log of the day ───────────────────────────────────────────
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

    // Check for approved OT for today
    const approvedOTResult = await sequelize.query(
      `SELECT ot.* FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       WHERE ot."user_Id" = :user_Id 
       AND ot."OT_DateOf" = :todayStr
       AND er."emp_reqStatusId" = 2`,
      { replacements: { user_Id, todayStr }, type: QueryTypes.SELECT }
    );
    const approvedOT = approvedOTResult[0];
    const hasApprovedOT = !!approvedOT;

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
      } else if (lastStatus === 5 || (hasApprovedOT && isWithinOTWindow && lastStatus === 1)) {
        nextStatus = 6; // Overtime-Out
      } else {
        nextStatus = 2; // Clock Out
      }
    } else {
      if (!lastStatus || [2, 3, 6].includes(lastStatus)) {
        nextStatus = 1;
      } else {
        nextStatus = isLunchWindow ? 3 : 2;
      }
    }

    // ── SUSPICIOUS ACTIVITY CHECK ──────────────────────────────────────────
    const fivePMThirty = new Date(now);
    fivePMThirty.setHours(17, 30, 0, 0);

    const isLateNightFirstIn = (nextStatus === 1 && now >= fivePMThirty && !hasPriorClockIn && !isWithinOTWindow);
    const isUnauthorizedReEntry = (nextStatus === 1 && hasPriorClockIn && !isWithinOTWindow);
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
        adminMessage += `logged in at ${timeStrFormatted} (Past 5:30 PM) without a prior attendance record or approved Overtime request.`;
      } else {
        adminMessage += `clocked in again at ${timeStrFormatted} after previously logging out, without an approved Overtime request.`;
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
        (:user_Id, :log_Date, :time_Logged, :logged_StatusId, :attendance_StatusId)
       RETURNING *`,
      {
        replacements: {
          user_Id,
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
          (:user_Id, :todayStr, :inArr, :outArr, :attendance_StatusId, :reportLoggedStatus)`,
        {
          replacements: {
            user_Id,
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
         WHERE "user_id" = :user_Id AND "log_Date" = :todayStr`,
        {
          replacements: {
            inArr: JSON.stringify(inArr),
            outArr: JSON.stringify(outArr),
            reportLoggedStatus,
            attendance_StatusId: attendanceVal,
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
      5: "Overtime-In",
      6: "Overtime-Out",
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
         CASE 
           WHEN r."logged_StatusId" = 1 AND EXISTS (
             SELECT 1 FROM "user_logging" ul 
             WHERE ul."user_id" = r."user_id" AND ul."log_Date" = r."log_Date" 
             AND ul."logged_StatusId" = 1 
             AND (
               (ul."time_Logged" >= '17:30:00' AND NOT EXISTS (
                 SELECT 1 FROM "user_logging" prev 
                 WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date"
                 AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
               ))
               OR 
               (EXISTS (
                 SELECT 1 FROM "user_logging" prev 
                 WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date"
                 AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
               ))
             )
             AND NOT EXISTS (
               SELECT 1 FROM "Overtime_Request" ot
               JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
               WHERE ot."user_Id" = ul."user_id" AND ot."OT_DateOf" = ul."log_Date" AND er."emp_reqStatusId" = 2
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

    const dailyRows = reports.map((report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]");
      const outArr = JSON.parse(report.time_Logged_outArr || "[]");
      return {
        sessionId: `${report.user_id}-${report.log_Date}`,
        log_Date: report.log_Date,
        time_In: inArr[0] ?? null,
        time_Out: outArr[outArr.length - 1] ?? null,
        logStatus: report.loggedStatusName,
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
             (ul."time_Logged" >= '17:30:00' AND NOT EXISTS (
               SELECT 1 FROM "user_logging" prev 
               WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date" 
               AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
             ))
             OR
             (EXISTS (
               SELECT 1 FROM "user_logging" prev 
               WHERE prev."user_id" = ul."user_id" AND prev."log_Date" = ul."log_Date" 
               AND prev."logged_StatusId" = 1 AND prev."user_loggingId" < ul."user_loggingId"
             ))
           )
           AND NOT EXISTS (
             SELECT 1 FROM "Overtime_Request" ot
             JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
             WHERE ot."user_Id" = ul."user_id" AND ot."OT_DateOf" = ul."log_Date" AND er."emp_reqStatusId" = 2
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

      return {
        user_Id: r.user_id,
        machipId: r.user_MachipId,
        userName: `${r.user_FirstName} ${r.user_LastName}`,
        log_Date: r.log_Date,
        time_In: inArr[0] ?? "—",
        time_Out: outArr[outArr.length - 1] ?? "—",
        hoursWorked: hoursWorked.toFixed(2),
        status: r.attendanceStatusName ?? "—",
        remarks: "", // Could be expanded if remarks are added to DB
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

