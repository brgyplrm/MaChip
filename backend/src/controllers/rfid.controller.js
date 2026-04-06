const { sequelize, User } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { logTransaction } = require("../utils/logger");

// Global state for registration/capture mode
let captureSession = {
  isCapturing: false,
  scannedUid: null,
  expiresAt: null
};

exports.scanRFID = async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ success: false, message: "No UID provided" });
  }

  // ── CAPTURE MODE CHECK ──────────────────────────────────────────────────
  if (captureSession.isCapturing && Date.now() < captureSession.expiresAt) {
    console.log(`[RFID] Captured UID for registration: ${uid}`);
    captureSession.scannedUid = uid;
    captureSession.isCapturing = false; // Capture only one
    return res.status(200).json({ 
      success: true, 
      message: "UID Captured for Registration",
      isCapture: true 
    });
  }

  try {
    const now = await getSystemTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const timeStr = now.toTimeString().split(" ")[0];

    // 1. Find User by MachipId
    const user = await User.findOne({
      where: { user_MachipId: uid, deletedAt: null }
    });

    if (!user) {
      console.log(`[RFID] Unknown card scanned: ${uid}`);
      return res.status(404).json({ success: false, message: "Unauthorized Card" });
    }

    const target_user_Id = user.user_Id;

    // Reuse logic from markAttendance to determine status
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get last log of the day
    const lastLogs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;

    // Lunch window check
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const isLunchWindow = totalMinutes >= 720 && totalMinutes < 780;

    // Determine next status (Auto-detect)
    let nextStatus;
    if (!lastStatus || [2, 3, 6].includes(lastStatus)) {
      nextStatus = 1; 
    } else {
      if (isLunchWindow && [1, 4].includes(lastStatus)) {
        nextStatus = 3; 
      } else {
        nextStatus = 2; 
      }
    }

    const firstLoginToday = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "logged_StatusId" = 1
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );
    const hasPriorClockIn = !!firstLoginToday[0];

    let attendanceVal = null;
    if (nextStatus === 1 && !hasPriorClockIn) {
      attendanceVal = now.getHours() < 9 ? 1 : 2; 
    }

    // ── Insert into user_logging ────────────────────────────────────────────
    await sequelize.query(
      `INSERT INTO "user_logging"
        ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
       VALUES
        (:target_user_Id, :log_Date, :time_Logged, :logged_StatusId, :attendance_StatusId)`,
      {
        replacements: {
          target_user_Id,
          log_Date: todayStart,
          time_Logged: timeStr,
          logged_StatusId: nextStatus,
          attendance_StatusId: attendanceVal,
        },
        type: QueryTypes.INSERT,
      },
    );

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
            inArr: isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            outArr: !isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            attendance_StatusId: attendanceVal,
            reportLoggedStatus,
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
    await logTransaction(target_user_Id, null, "RFID_SCAN", `${statusLabels[nextStatus]} via RFID`, { uid, status: statusLabels[nextStatus], time: timeStr });

    return res.status(200).json({
      success: true,
      name: user.user_FirstName,
      action: statusLabels[nextStatus]
    });

  } catch (error) {
    console.error("[RFID Error]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── CAPTURE LOGIC ───────────────────────────────────────────────────────────

exports.generateRfid = async (req, res) => {
  // Start capture mode
  captureSession = {
    isCapturing: true,
    scannedUid: null,
    expiresAt: Date.now() + 30000 // 30 seconds timeout
  };

  console.log("[RFID] Registration mode active for 30 seconds...");

  // Poll for the scanned UID (simple implementation with a loop/timeout)
  const startTime = Date.now();
  const checkInterval = setInterval(() => {
    if (captureSession.scannedUid) {
      clearInterval(checkInterval);
      const uid = captureSession.scannedUid;
      captureSession.scannedUid = null;
      captureSession.isCapturing = false;
      return res.status(200).json({ rfid: uid });
    }

    if (Date.now() - startTime > 30000) {
      clearInterval(checkInterval);
      captureSession.isCapturing = false;
      return res.status(408).json({ error: "Scan timeout. Please try again." });
    }
  }, 500);
};
