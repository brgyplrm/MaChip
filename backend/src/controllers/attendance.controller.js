const { Op, UUIDV1, Model, Sequelize } = require("sequelize");
const {
  User,
  user_logging,
  employee_Logging_report,
  logged_status,
  attendance_status,
} = require("../config/sequelize.js");

exports.markAttendance = async (req, res) => {
  try {
    // SIMULATION: Randomly pick one user from the User table
    const user = await User.findOne({
      order: [Sequelize.literal("RAND()")],
    });

    if (!user) {
      return res.status(404).json({ error: "No users found in the database." });
    }

    // Extract the actual ID string from the Sequelize instance
    const user_Id = user.user_Id;

    const now = new Date();

    // ── Determine login / logout status ──────────────────────────────────────
    const lastLog = await user_logging.findOne({
      where: { user_id: user_Id },
      order: [["user_loggingId", "DESC"]],
    });

    // nextStatus: 1 = Logged In, 2 = Logged Out
    const nextStatus = lastLog && lastLog.time_LoggedStatus === 1 ? 2 : 1;

    // ── Attendance value ──────────────────────────────────────────────────────
    // Rules:
    //  • Login  + first of the day → 1 (On-Time) if before 09:00, else 2 (Late)
    //  • Login  + NOT first of the day → null  (no status)
    //  • Logout → null  (no status)
    let attendanceVal = null;

    if (nextStatus === 1) {
      // Check whether there is already a login for today
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const firstLoginToday = await user_logging.findOne({
        where: {
          user_id: user_Id,
          time_LoggedStatus: 1,
          log_Date: { [Op.between]: [startOfDay, endOfDay] },
        },
      });

      if (!firstLoginToday) {
        // This IS the first login of the day — assign On-Time or Late
        const hour = now.getHours();
        attendanceVal = hour < 9 ? 1 : 2; // 1 = On-Time, 2 = Late
      }
      // else: not the first login today → attendanceVal stays null
    }
    // For logout (nextStatus === 2): attendanceVal stays null

    const timeStr = now.toTimeString().split(" ")[0]; // "HH:MM:SS"
    const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

    // ── 1. Write the raw individual event to user_logging ────────────────────
    const newLog = await user_logging.create({
      user_id: user_Id,
      log_Date: now,
      time_Logged: timeStr,
      time_LoggedStatus: nextStatus,
      attendance: attendanceVal,
    });

    // ── 2. Upsert the daily summary in employee_Logging_report ───────────────
    // Rules:
    //  • One row per user per day (unique_user_day index)
    //  • Login  → append timeStr to time_Logged_inArr, set final_LoggedStatus = 1
    //  • Logout → append timeStr to time_Logged_outArr, set final_LoggedStatus = 2
    //  • attendance is only set on the very first login row creation

    const existingReport = await employee_Logging_report.findOne({
      where: { user_id: user_Id, log_Date: todayStr },
    });

    if (!existingReport) {
      // First event of the day — create the daily summary row
      await employee_Logging_report.create({
        user_id: user_Id,
        log_Date: todayStr,
        time_Logged_inArr:
          nextStatus === 1 ? JSON.stringify([timeStr]) : JSON.stringify([]),
        time_Logged_outArr:
          nextStatus === 2 ? JSON.stringify([timeStr]) : JSON.stringify([]),
        attendance: attendanceVal, // On-Time / Late / null
        final_LoggedStatus: nextStatus,
      });
    } else {
      // Row already exists — append the time to the correct array and flip status
      const inArr = JSON.parse(existingReport.time_Logged_inArr || "[]");
      const outArr = JSON.parse(existingReport.time_Logged_outArr || "[]");

      if (nextStatus === 1) {
        inArr.push(timeStr);
        await existingReport.update({
          time_Logged_inArr: JSON.stringify(inArr),
          final_LoggedStatus: 1,
        });
      } else {
        outArr.push(timeStr);
        await existingReport.update({
          time_Logged_outArr: JSON.stringify(outArr),
          final_LoggedStatus: 2,
        });
      }
    }

    return res.status(201).json({
      message: `User ${nextStatus === 1 ? "logged in" : "logged out"} successfully`,
      data: newLog,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.viewUserLogs = async (req, res) => {
  const { user_Id } = req.params;

  try {
    // Read directly from employee_Logging_report — one row per day, already aggregated
    const reports = await employee_Logging_report.findAll({
      where: { user_id: user_Id },
      include: [
        {
          model: attendance_status,
          as: "attendanceStatus",
          attributes: ["statusName"],
        },
        {
          model: logged_status,
          as: "loggedStatus",
          attributes: ["statusName"],
        },
      ],
      order: [["log_Date", "DESC"]], // newest day first
    });

    const dailyRows = reports.map((report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]");
      const outArr = JSON.parse(report.time_Logged_outArr || "[]");
      return {
        sessionId: `${report.user_id}-${report.log_Date}`,
        log_Date: report.log_Date,
        time_In: inArr[0] ?? null, // first login — locked
        time_Out: outArr[outArr.length - 1] ?? null, // last logout — latest
        logStatus:
          report.loggedStatus?.statusName ??
          (report.final_LoggedStatus === 1 ? "Logged In" : "Logged Out"),
        attendanceStatus: report.attendanceStatus?.statusName ?? "—",
      };
    });

    res.status(200).json(dailyRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.viewAllAttendance = async (req, res) => {
  try {
    const logs = await user_logging.findAll({
      include: [
        {
          model: User,
          as: "user", // Explicitly name the joined object 'user'
          attributes: ["user_LastName", "user_MachipId"],
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
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAllLogs = async (req, res) => {
  try {
    // Both tables are now independent — delete both
    await employee_Logging_report.destroy({ where: {} });
    await user_logging.destroy({ where: {} });

    res.status(200).json({
      message: "All attendance logs have been deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.StatusLogic = async (req, res) => {
  const { user_Id } = req.params;
  const { mockTime } = req.query;
  try {
    let now = new Date();
    if (mockTime) {
      now = new Date(mockTime);
    }

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    let log = await user_logging.findOne({
      where: {
        user_id: user_Id,
        log_Date: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
      order: [["user_loggingId", "DESC"]],
    });

    const fivePM = new Date(now);
    fivePM.setHours(17, 0, 0, 0);

    if (!log) {
      if (now >= fivePM) {
        // No login record found and it's past 5:00 PM, mark as Absent

        log = await user_logging.create({
          user_id: user_Id,
          log_Date: logDate,
          time_Logged: "17:00:00",
          time_LoggedStatus: 2,
          attendance: 3,
        });
        return res
          .status(201)
          .json({ message: "User marked as Absent", data: log });
      }
      return res
        .status(404)
        .json({ error: "No attendance record found for today" });
    }

    // If it's already marked as Absent or On-Leave, don't override with On-time/Late
    if (log.attendance === "3" || log.attendance === "4") {
      return res
        .status(200)
        .json({ message: "Attendance status finalized", data: log });
    }

    const firstLog = await user_logging.findOne({
      where: {
        user_id: user_Id,
        log_date: today,
        time_LoggedStatus: 1,
      },
      order: [["user_loggingId", "ASC"]],
    });

    if (firstLog) {
      const [hours, minutes] = firstLog.time_Logged.split(":");
      const loginHour = parseInt(hours);

      let newAttendanceStatus = 1;
      if (loginHour >= 9) {
        newAttendanceStatus = 2;
      }

      firstLog.attendance = newAttendanceStatus;
      await firstLog.save();

      return res
        .status(200)
        .json({ message: "Attendance status updated", data: firstLog });
    }

    res.status(200).json({ message: "Attendance status updated", data: log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Read today's daily summary rows from employee_Logging_report — one row per user
    const todayReports = await employee_Logging_report.findAll({
      where: { log_Date: todayStr },
      attributes: ["attendance", "final_LoggedStatus"],
    });

    // 1. Office Occupancy — users whose final_LoggedStatus for today is 1 (Logged In)
    const officeOccupancy = todayReports.filter(
      (r) => r.final_LoggedStatus === 1,
    ).length;

    // 2. On-Time — users whose first-login attendance for today is 1
    const onTimeCount = todayReports.filter((r) => r.attendance === 1).length;

    // 3. Late Arrivals — users whose first-login attendance for today is 2
    const lateArrivalsCount = todayReports.filter(
      (r) => r.attendance === 2,
    ).length;

    res.status(200).json({ officeOccupancy, onTimeCount, lateArrivalsCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Returns the list of users currently inside the office (final_LoggedStatus = 1 today)
exports.getOfficeOccupancy = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const inOfficeReports = await employee_Logging_report.findAll({
      where: { log_Date: todayStr, final_LoggedStatus: 1 },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_Id", "user_FirstName", "user_LastName"],
        },
      ],
    });

    const inOffice = inOfficeReports.map((report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]");
      return {
        user_id: report.user_id,
        user_Id: report.user?.user_Id ?? report.user_id,
        firstName: report.user?.user_FirstName ?? "—",
        lastName: report.user?.user_LastName ?? "—",
        time_In: inArr[0] ?? "—", // first login of the day
      };
    });

    // Sort alphabetically by last name
    inOffice.sort((a, b) => a.lastName.localeCompare(b.lastName));

    res.status(200).json({ count: inOffice.length, users: inOffice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
