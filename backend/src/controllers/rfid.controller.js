const { sequelize, User, Notification, System_State } = require("../config/sequelize.js");
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

exports.clearFingerprintSession = (req, res) => {
  console.log("[FP] Manually clearing fingerprint session");
  fpCaptureSession.isCapturing = false;
  fpCaptureSession.scannedSlot = null;
  fpCaptureSession.userId = null;
  fpCaptureSession.expiresAt = null;
  fpCaptureSession.success = false;
  fpCaptureSession.template = null;
  
  if (res) {
    return res.status(200).json({ success: true, message: "Fingerprint session cleared" });
  }
};

exports.scanRFID = async (req, res) => {
  let { uid, action, terminalType } = req.body; 

  if (!uid) {
    return res.status(400).json({ success: false, message: "No UID provided" });
  }

  // ── REGISTRATION SESSION CHECK ───────────────────────────────────────────
  try {
    const regSession = await System_State.findOne({ where: { key: 'REGISTRATION_SESSION' } });
    
    if (regSession && (terminalType === 'FRONT' || !terminalType)) {
      const sessionData = JSON.parse(regSession.value);
      const targetUserId = sessionData.userId;

      // TYPE A: REGISTERING RFID
      if (sessionData.type === 'RFID') {
        // We no longer auto-save to DB here to allow frontend "Confirm" button to work.
        // We just populate captureSession for the polling frontend to see.
        captureSession.scannedUid = uid;
        captureSession.isCapturing = false;

        return res.status(200).json({
          success: true,
          isCapture: true, 
          mode: 'RFID_REG_SUCCESS', // Keep the mode so ESP32 knows it was accepted
          rfid: uid
        });
      }

      // TYPE B: REGISTERING FINGERPRINT
      // We no longer trigger WAITING_FOR_FINGERPRINT from here. 
      // Fingerprint enrollment is handled by the dedicated polling endpoint (/api/esp/fingerprint/session).
      // This allows unrelated RFID taps to be processed normally (e.g. denied if unauthorized) 
      // even while the Fingerprint modal is open.
      
    }
  } catch (err) {
    console.error("[REG SESSION CHECK ERROR]:", err);
  }

  // ── CAPTURE MODE CHECK (Legacy/Compatibility) ────────────────────────────
  // Captured regardless of action if session is active, BUT we prioritize Clock-In
  if (captureSession.isCapturing && Date.now() < captureSession.expiresAt && action !== "clock_out") {
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

    // ── 2FA Parsing (UID|FingerID) ──────────────────────────────────────────
    let rfidUid = uid;
    let scannedFingerId = null;
    let is2FA = false;

    if (uid.includes("|")) {
      const parts = uid.split("|");
      rfidUid = parts[0];
      scannedFingerId = parseInt(parts[1]);
      is2FA = true;
    }

    // 1. Find User by MachipId (Case-Insensitive) or FingerprintId
    let user;
    if (action === "fingerprint_scan") {
      user = await User.findOne({
        where: { user_FingerprintId: parseInt(uid), deletedAt: null }
      });
    } else {
      // Use case-insensitive search for RFID
      user = await User.findOne({
        where: {
          [sequelize.Sequelize.Op.and]: [
            sequelize.where(sequelize.fn('LOWER', sequelize.col('user_MachipId')), rfidUid.toLowerCase()),
            { deletedAt: null }
          ]
        }
      });
    }

    if (!user) {
      const type = action === "fingerprint_scan" ? "Fingerprint" : "MaChip";
      console.log(`[${type}] Unknown ${type} scanned: ${uid} from ${req.ip}`);
      const masked = action === "fingerprint_scan" ? `Slot ${uid}` : maskUid(uid, false);
      const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

      // Mark as SUSPICIOUS_SCAN for unauthorized users
      await logTransaction(null, null, "SUSPICIOUS_SCAN", `Suspicious ${type} (${masked}) detected on device ${deviceIp}`, { 
        uid: masked,
        deviceIp,
        result: "Denied/Suspicious",
        role: "Unknown",
        type,
        threatLevel: "High"
      }, req);

      try {
        const admins = await User.findAll({ where: { user_RoleId: 1, deletedAt: null } });
        const notifications = admins.map(admin => ({
          user_Id: admin.user_Id,
          title: `Suspicious ${type} Activity`,
          message: `A suspicious ${type} (ID: ${masked}) was detected on device ${deviceIp} at ${now.toLocaleTimeString()}. Possible unauthorized access attempt.`,
          isRead: false
        }));
        await Notification.bulkCreate(notifications);
      } catch (notifErr) {
        console.error(`[${type}] Failed to create notifications:`, notifErr);
      }

      return res.status(404).json({ success: false, message: "Access Denied" });
    }

    // ── 2FA FLOW TRIGGER ────────────────────────────────────────────────────
    // If the user has a Fingerprint ID enrolled, but only RFID was scanned,
    // we tell the device to proceed to biometric verification.
    if (!is2FA && user.user_FingerprintId && action !== "fingerprint_scan") {
      console.log(`[2FA] User ${user.user_FirstName} requires biometric verification. Triggering ESP32...`);
      return res.status(200).json({
        success: true,
        mode: "WAITING_FOR_FINGERPRINT_2FA",
        uid: rfidUid,
        name: user.user_FirstName
      });
    }

    // ── 2FA Verification ────────────────────────────────────────────────────
    if (is2FA) {
      console.log(`[2FA-DEBUG] User: ${user.user_FirstName}, DB FingerId: ${user.user_FingerprintId} (${typeof user.user_FingerprintId}), Scanned FingerId: ${scannedFingerId} (${typeof scannedFingerId})`);
      
      const dbFingerId = parseInt(user.user_FingerprintId);
      const inputFingerId = parseInt(scannedFingerId);

      if (isNaN(dbFingerId) || dbFingerId !== inputFingerId) {
        console.log(`[2FA] Mismatch for ${user.user_FirstName}: Scanned card matches, but Fingerprint Slot ${inputFingerId} does not belong to this user (DB has ${dbFingerId}).`);
        
        await logTransaction(user.user_Id, null, "2FA_FAILURE", `2FA Mismatch: RFID matched but Fingerprint slot ${scannedFingerId} is incorrect.`, {
          uid: maskUid(rfidUid, true),
          fingerprintSlot: scannedFingerId,
          result: "Denied",
          status: "Suspicious"
        }, req);

        return res.status(401).json({ success: false, message: "2FA Verification Failed" });
      }
      console.log(`[2FA] Success for ${user.user_FirstName} (RFID + Fingerprint Slot ${scannedFingerId})`);
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

    // ── 30-SECOND SAFETY (Duplicate Protection) ─────────────────────────────
    if (lastLogs[0]) {
      const lastLogTime = new Date(`${todayStr}T${lastLogs[0].time_Logged}`);
      const diffMs = now - lastLogTime;
      const diffSecs = Math.floor(diffMs / 1000);

      if (diffSecs < 30) {
        console.log(`[SAFETY] ${user.user_FirstName} tapped too rapidly. Wait ${30 - diffSecs}s.`);
        return res.status(400).json({ 
          success: false, 
          message: "Too fast! Wait 30s", 
          name: user.user_FirstName 
        });
      }
    }

    // 3. Validation based on explicit action from ESP32
    // If fingerprint_scan or 2fa_verify, we determine the final action
    if (action === "fingerprint_scan") {
      action = isCurrentlyIn ? "clock_out" : "clock_in";
    } else if (action === "2fa_verify") {
      if (terminalType === "BACK") {
        action = "clock_out";
      } else if (terminalType === "FRONT") {
        action = "clock_in";
      } else {
        // Fallback to toggle if terminalType is unknown
        action = isCurrentlyIn ? "clock_out" : "clock_in";
      }
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
  captureSession = { isCapturing: true, scannedUid: null, expiresAt: Date.now() + 25000 };
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
    if (Date.now() - startTime > 25000) {
      clearInterval(checkInterval);
      captureSession.isCapturing = false;
      return res.status(408).json({ error: "Scan timeout. Please try again." });
    }
  }, 500);
};

exports.generateFingerprint = async (req, res) => {
  const { userId } = req.query;
  console.log(`[FP-ADMIN] Starting enrollment session for User: ${userId || "temp_registration"}`);
  
  try {
    const result = await sequelize.query(
      `SELECT MAX("user_FingerprintId") AS "maxSlot" FROM "User"`,
      { type: QueryTypes.SELECT }
    );
    const nextSlot = (result[0].maxSlot ? parseInt(result[0].maxSlot) : 0) + 1;
    
    // Explicitly reset the session to ensure no stale data
    fpCaptureSession = { 
      isCapturing: true, 
      scannedSlot: nextSlot, 
      userId: userId || "temp_registration",
      expiresAt: Date.now() + 55000, 
      success: false,
      template: null
    };

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (!fpCaptureSession.isCapturing) {
        clearInterval(checkInterval);
        if (fpCaptureSession.success) {
          console.log(`[FP-ADMIN] Enrollment SUCCESS for Slot ${fpCaptureSession.scannedSlot}`);
          return res.status(200).json({ 
            fingerprintId: fpCaptureSession.scannedSlot,
            template: fpCaptureSession.template 
          });
        } else {
          console.log(`[FP-ADMIN] Enrollment FAILED on device for Slot ${fpCaptureSession.scannedSlot}`);
          return res.status(400).json({ error: "Enrollment failed. Ensure finger is placed correctly." });
        }
      }

      if (Date.now() - startTime > 55000) {
        clearInterval(checkInterval);
        fpCaptureSession.isCapturing = false;
        console.log(`[FP-ADMIN] Enrollment TIMEOUT`);
        return res.status(408).json({ error: "Scan timeout. Please try again." });
      }
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ESP32 Endpoints
exports.getFingerprintSession = async (req, res) => {
  // 1. Check in-memory session (Direct Scan via generateFingerprint)
  if (fpCaptureSession.isCapturing && Date.now() < fpCaptureSession.expiresAt) {
    return res.status(200).json({
      active: true,
      slotId: fpCaptureSession.scannedSlot,
      userId: fpCaptureSession.userId || "temp_registration"
    });
  }

  // 2. Check Database session (Proxy Scan via Registration Modal)
  try {
    const regSession = await System_State.findOne({ where: { key: 'REGISTRATION_SESSION' } });
    if (regSession) {
      const sessionData = JSON.parse(regSession.value);
      if (sessionData.type === 'FP') {
        // ONLY promote if there isn't ALREADY an active session being tracked
        if (!fpCaptureSession.isCapturing || Date.now() > fpCaptureSession.expiresAt) {
          const result = await sequelize.query(
            `SELECT MAX("user_FingerprintId") AS "maxSlot" FROM "User"`,
            { type: QueryTypes.SELECT }
          );
          const nextSlot = (result[0].maxSlot ? parseInt(result[0].maxSlot) : 0) + 1;

          fpCaptureSession = { 
            isCapturing: true, 
            scannedSlot: nextSlot, 
            userId: sessionData.userId,
            expiresAt: Date.now() + 60000, 
            success: false,
            template: null
          };
        }

        return res.status(200).json({
          active: true,
          slotId: fpCaptureSession.scannedSlot,
          userId: sessionData.userId
        });
      }
    }
  } catch (err) {
    console.error("[GET FP SESSION ERROR]:", err);
  }

  return res.status(200).json({ active: false });
};

exports.confirmFingerprintEnroll = async (req, res) => {
  const { slotId, success, template, userId } = req.body;
  const sessionUserId = fpCaptureSession.userId;
  console.log(`[FP-RECEIVE] Slot: ${slotId}, Success: ${success}, User (from body): ${userId}, User (from session): ${sessionUserId}`);
  
  if (template) {
    console.log(`[FP-RECEIVE] Template received, length: ${template.length}`);
   } else {
     console.log(`[FP-RECEIVE] NO TEMPLATE DATA IN PACKET`);
   }

  // Check if session is active. We allow slotId 0 if it comes from the device as a wildcard
  const isCorrectSlot = (parseInt(slotId) === fpCaptureSession.scannedSlot) || (parseInt(slotId) === 0);

  if (fpCaptureSession.isCapturing && isCorrectSlot) {
    const finalSlotId = fpCaptureSession.scannedSlot; // Use the server-assigned slot ID
    fpCaptureSession.success = success;
    fpCaptureSession.isCapturing = false; // STOP the session so ESP32 doesn't loop
    
    if (success && template) {
      // If userId is provided, we can link it immediately, otherwise it's handled by the registration flow
      let targetUserIdRaw = userId || sessionUserId;
      console.log(`[FP-LINK] Attempting to link to User: ${targetUserIdRaw}`);

      const targetUserId = parseInt(targetUserIdRaw);
      if (targetUserIdRaw && targetUserIdRaw !== "temp_registration" && !isNaN(targetUserId)) {
        try {
          const [result, metadata] = await sequelize.query(
            `UPDATE "User" SET 
              "user_FingerprintTemplate" = :template,
              "user_FingerprintId" = :slotId
             WHERE "user_Id" = :targetUserId`,
            { replacements: { template, slotId: finalSlotId, targetUserId }, type: QueryTypes.UPDATE }
          );
          console.log(`[FP-LINK] Success! Slot ${finalSlotId} saved for user ${targetUserId}`);
        } catch (err) {
          console.error(`[FP-LINK] FAILED to save to DB: ${err.message}`);
        }
      } else {
        console.log(`[FP-LINK] Skipping DB update (Target: ${targetUserIdRaw}). Template stored in session.`);
        // Store template in session for the frontend to pick up during new user registration
        fpCaptureSession.template = template;
      }
    }

    return res.status(200).json({ success: true });
  }
  console.log(`[FP-RECEIVE] Rejected: Session active? ${fpCaptureSession.isCapturing}, Slot matches? ${isCorrectSlot}`);
  return res.status(400).json({ success: false, message: "No active session for this slot." });
};

exports.getFingerprintTemplate = async (req, res) => {
  const { uid } = req.params;

  // Handle capture mode even during template fetch (for ESP32 Front reader logic)
  if (captureSession.isCapturing && Date.now() < captureSession.expiresAt) {
    console.log(`[RFID] Captured UID during template fetch: ${uid}`);
    captureSession.scannedUid = uid;
    captureSession.isCapturing = false;
    return res.status(200).json({ success: true, isCapture: true, template: "CAPTURE_OK" });
  }

  try {
    const [user] = await sequelize.query(
      `SELECT "user_FingerprintTemplate" FROM "User" WHERE "user_MachipId" = :uid AND "deletedAt" IS NULL LIMIT 1`,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    if (!user) {
      console.log(`[FP DOWNLOAD] User not found for UID: ${uid}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`[FP DOWNLOAD] User found. Template length: ${user.user_FingerprintTemplate ? user.user_FingerprintTemplate.length : "EMPTY/NULL"}`);

    // Return 200 even if template is null, so ESP32 knows the user exists but has no 2FA template
    return res.status(200).json({ 
      success: true, 
      template: user.user_FingerprintTemplate || null 
    });
  } catch (error) {
    console.error("[FP DOWNLOAD ERROR]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
