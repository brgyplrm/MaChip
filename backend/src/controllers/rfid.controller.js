const { sequelize, User, Notification } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");

const maskUid = (uid, isAuthorized) => {
  if (isAuthorized) return "[REDACTED]";
  if (!uid) return "****";
  const parts = uid.split(":");
  if (parts.length >= 2) {
    return `****:${parts[parts.length-2]}:${parts[parts.length-1]}`;
  }
  return `****${uid.slice(-4)}`;
};

// Global state for registration/capture mode
let captureSession = {
  isCapturing: false,
  scannedUid: null,
  expiresAt: null
};

// Global state for Fingerprint registration
let fpCaptureSession = {
  isCapturing: false,
  scannedSlot: null,
  userId: null,
  expiresAt: null,
  success: false
};

exports.scanRFID = async (req, res) => {
  let { uid, action } = req.body; 

  if (!uid) {
    return res.status(400).json({ success: false, message: "No UID provided" });
  }

  // ── CAPTURE MODE CHECK (Only for auto_detect scans) ───────────────────────
  if (action === "auto_detect" && captureSession.isCapturing && Date.now() < captureSession.expiresAt) {
    console.log(`[RFID] Captured UID for registration: ${uid}`);
    captureSession.scannedUid = uid;
    captureSession.isCapturing = false;
    return res.status(200).json({ 
      success: true, 
      message: "UID Captured!",
      isCapture: true 
    });
  }

  // If action is auto_detect but not capturing, it's a normal clock_in
  if (action === "auto_detect") {
    action = "clock_in";
  }

  try {
    const now = await getSystemTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const timeStr = now.toTimeString().split(" ")[0];

    // 1. Find User by MachipId or FingerprintId
    let user;
    if (action === "fingerprint_scan") {
      user = await User.findOne({
        where: { user_FingerprintId: parseInt(uid), deletedAt: null }
      });
    } else {
      user = await User.findOne({
        where: { user_MachipId: uid, deletedAt: null }
      });
    }

    if (!user) {
      const type = action === "fingerprint_scan" ? "Fingerprint" : "MaChip";
      console.log(`[${type}] Unknown ${type} scanned: ${uid} from ${req.ip}`);
      const masked = action === "fingerprint_scan" ? `Slot ${uid}` : maskUid(uid, false);
      const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

      await logTransaction(null, null, "UNAUTHORIZED_SCAN", `Unauthorized ${type} (${masked}) scanned from ${deviceIp}`, { 
        uid: masked,
        deviceIp,
        result: "Denied",
        role: "Unknown",
        type
      }, req);

      try {
        const admins = await User.findAll({ where: { user_RoleId: 1, deletedAt: null } });
        const notifications = admins.map(admin => ({
          user_Id: admin.user_Id,
          title: `Unauthorized ${type} Scan`,
          message: `An unauthorized ${type} (ID: ${masked}) was scanned from device ${deviceIp} at ${now.toLocaleTimeString()}.`,
          isRead: false
        }));
        await Notification.bulkCreate(notifications);
      } catch (notifErr) {
        console.error(`[${type}] Failed to create notifications:`, notifErr);
      }

      return res.status(404).json({ success: false, message: "User Not Registered" });
    }

    const target_user_Id = user.user_Id;

    // 2. Check last transaction/status for this user today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const lastLogs = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;
    const isCurrentlyIn = lastStatus === 1 || lastStatus === 4 || lastStatus === 5;

    // 3. Validation based on explicit action from ESP32
    // If fingerprint_scan, we toggle status automatically
    if (action === "fingerprint_scan") {
      action = isCurrentlyIn ? "clock_out" : "clock_in";
    }

    if (action === "clock_in") {
      if (isCurrentlyIn) {
        return res.status(400).json({ success: false, message: "Already Clocked In", name: user.user_FirstName });
      }
    } else if (action === "clock_out") {
      if (!isCurrentlyIn) {
        return res.status(400).json({ success: false, message: "Not Clocked In", name: user.user_FirstName });
      }
    }

    // Determine nextStatus based on action and current time (Lunch logic)
    let nextStatus;
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const isLunchWindow = totalMinutes >= 720 && totalMinutes < 780;

    if (action === "clock_in") {
      nextStatus = (isLunchWindow && lastStatus === 3) ? 4 : 1;
    } else {
      nextStatus = (isLunchWindow && lastStatus === 1) ? 3 : 2;
    }

    // 4. Record Attendance
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

    // 5. Update Reporting
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
      if (isEntry && !inArr.includes(timeStr)) inArr.push(timeStr); 
      else if (!isEntry && !outArr.includes(timeStr)) outArr.push(timeStr);

      await sequelize.query(
        `UPDATE "employee_Logging_report"
         SET "time_Logged_inArr"  = :inArr,
             "time_Logged_outArr" = :outArr,
             "logged_StatusId" = :reportLoggedStatus,
             "attendance_StatusId" = COALESCE("attendance_StatusId", :attendance_StatusId)
         WHERE "user_id" = :target_user_Id AND "log_Date" = :todayStr`,
        {
          replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), reportLoggedStatus, attendance_StatusId: attendanceVal, target_user_Id, todayStr },
          type: QueryTypes.UPDATE,
        },
      );
    }

    const statusLabels = { 1: "Clock In", 2: "Clock Out", 3: "Out For Lunch", 4: "In From Lunch", 5: "Overtime-In", 6: "Overtime-Out" };
    const attendanceResult = attendanceVal === 1 ? "On-Time" : attendanceVal === 2 ? "Late" : "N/A";
    const esp32Ip = req.ip || req.socket.remoteAddress || "Unknown ESP32";

    // 6. Log Transaction
    const method = action === "fingerprint_scan" ? "Fingerprint" : "RFID";
    await logTransaction(target_user_Id, null, `${method.toUpperCase()}_SCAN`, `${statusLabels[nextStatus]} via ${method}`, { 
      uid: action === "fingerprint_scan" ? `Slot ${uid}` : maskUid(uid, true),
      status: statusLabels[nextStatus], 
      time: timeStr,
      role: "Employee",
      result: attendanceResult,
      deviceIp: esp32Ip
    }, req);

    // [SOCKET] Trigger real-time UI updates
    const io = getIO();
    io.emit("NEW_ATTENDANCE_LOG", { userId: target_user_Id, status: statusLabels[nextStatus] });
    io.to(`user_${target_user_Id}`).emit("NOTIFICATION_UPDATE");

    return res.status(200).json({
      success: true,
      name: user.user_FirstName,
      message: statusLabels[nextStatus]
    });

  } catch (error) {
    console.error("[SCAN ERROR]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.generateRfid = async (req, res) => {
  captureSession = { isCapturing: true, scannedUid: null, expiresAt: Date.now() + 30000 };
  const startTime = Date.now();
  const checkInterval = setInterval(() => {
    if (captureSession.scannedUid) {
      const uid = captureSession.scannedUid;
      captureSession.scannedUid = null;
      captureSession.isCapturing = false;
      clearInterval(checkInterval);
      User.findOne({ where: { user_MachipId: uid, deletedAt: null } }).then(user => {
        if (user) return res.status(400).json({ error: "MaChip ID is already assigned to another user.", rfid: uid });
        return res.status(200).json({ rfid: uid });
      }).catch(err => res.status(500).json({ error: "Internal Server Error" }));
      return;
    }
    if (Date.now() - startTime > 30000) {
      clearInterval(checkInterval);
      captureSession.isCapturing = false;
      return res.status(408).json({ error: "Scan timeout. Please try again." });
    }
  }, 500);
};

exports.generateFingerprint = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT MAX("user_FingerprintId") AS "maxSlot" FROM "User"`,
      { type: QueryTypes.SELECT }
    );
    const nextSlot = (result[0].maxSlot ? parseInt(result[0].maxSlot) : 0) + 1;
    
    fpCaptureSession = { 
      isCapturing: true, 
      scannedSlot: nextSlot, 
      expiresAt: Date.now() + 60000, // 1 minute for fingerprint
      success: false 
    };

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (fpCaptureSession.success) {
        const slot = fpCaptureSession.scannedSlot;
        fpCaptureSession = { isCapturing: false, scannedSlot: null, expiresAt: null, success: false };
        clearInterval(checkInterval);
        return res.status(200).json({ fingerprintId: slot });
      }
      if (Date.now() - startTime > 60000) {
        clearInterval(checkInterval);
        fpCaptureSession.isCapturing = false;
        return res.status(408).json({ error: "Fingerprint scan timeout." });
      }
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ESP32 Endpoints
exports.getFingerprintSession = async (req, res) => {
  if (fpCaptureSession.isCapturing && Date.now() < fpCaptureSession.expiresAt) {
    return res.status(200).json({
      active: true,
      slotId: fpCaptureSession.scannedSlot,
      userId: "temp_registration"
    });
  }
  return res.status(200).json({ active: false });
};

exports.confirmFingerprintEnroll = async (req, res) => {
  const { slotId, success } = req.body;
  if (fpCaptureSession.isCapturing && parseInt(slotId) === fpCaptureSession.scannedSlot) {
    fpCaptureSession.success = success;
    return res.status(200).json({ success: true });
  }
  return res.status(400).json({ success: false, message: "No active session for this slot." });
};
