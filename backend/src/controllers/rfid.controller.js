const { sequelize, User, Notification, System_State, User_Hardware } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("../utils/systemTime.js");
const { logAudit, logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");
const { resolveLeaveConflict, calculateAndStoreAttendanceUnits } = require("../utils/attendanceHelper.js");
const { decrypt } = require("../utils/encryption.js");

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
  userId: null,
  expiresAt: null
};

// Global state for Fingerprint registration
let fpCaptureSession = {
  isCapturing: false,
  scannedSlot: null,
  userId: null,
  expiresAt: null,
  success: false,
  template: null,
  type: "FP"
};

// Queue slot deletion for cancelled enrollments or separated/deleted employees
let pendingDeleteSlots = [];

exports.queueSlotDeletion = (slotId) => {
  if (slotId !== null && slotId !== undefined) {
    const parsed = parseInt(slotId);
    if (!isNaN(parsed) && parsed > 0) {
      if (!pendingDeleteSlots.includes(parsed)) {
        pendingDeleteSlots.push(parsed);
      }
      console.log(`[HARDWARE] Queued deletion for fingerprint slot ${parsed}. Pending queue: [${pendingDeleteSlots.join(", ")}]`);
    }
  }
};

// Global state for Visitor Access
let visitorAccessSession = {
  isPending: false,
  expiresAt: null,
  adminId: null
};

// Heartbeat state to track ESP32 connectivity
let lastEsp32Heartbeat = null;

// Global anti-rapid tap cache (UID -> timestamp)
const recentTaps = new Map();
const RAPID_TAP_COOLDOWN = 10000; // 10 seconds

// Biometric brute-force tracking & card lockout cache (UID -> { count, lockedUntil, firstFailAt })
const biometricFailures = new Map();
const MAX_BIOMETRIC_FAILURES = 3;
const BIOMETRIC_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const BIOMETRIC_WINDOW = 3 * 60 * 1000; // 3 minutes

exports.getHardwareStatus = (req, res) => {
  const now = Date.now();
  const isConnected = lastEsp32Heartbeat && (now - lastEsp32Heartbeat < 10000); // Connected if seen in last 10s
  
  res.status(200).json({
    connected: isConnected,
    lastSeen: lastEsp32Heartbeat ? new Date(lastEsp32Heartbeat).toISOString() : null,
    msSinceLastSeen: lastEsp32Heartbeat ? (now - lastEsp32Heartbeat) : null
  });
};

exports.clearFingerprintSession = async (req, res) => {
  console.log("[ENROLL] Clearing all enrollment sessions (RFID/FP)");

  // Only queue hardware rollback deletion IF the enrollment was cancelled/failed BEFORE completion
  if (fpCaptureSession.scannedSlot && !fpCaptureSession.success) {
    if (!pendingDeleteSlots.includes(fpCaptureSession.scannedSlot)) {
      pendingDeleteSlots.push(fpCaptureSession.scannedSlot);
    }
    console.log(`[ENROLL ROLLBACK] Queued hardware deletion for cancelled slot ${fpCaptureSession.scannedSlot}`);
  } else if (fpCaptureSession.scannedSlot && fpCaptureSession.success) {
    console.log(`[ENROLL SUCCESS] Enrollment completed successfully for slot ${fpCaptureSession.scannedSlot}. Preserving hardware template.`);
  }

  // Clear in-memory FP session
  fpCaptureSession.isCapturing = false;
  fpCaptureSession.scannedSlot = null;
  fpCaptureSession.userId = null;
  fpCaptureSession.expiresAt = null;
  fpCaptureSession.success = false;
  fpCaptureSession.template = null;
  fpCaptureSession.type = null;

  // Clear in-memory RFID session
  captureSession.isCapturing = false;
  captureSession.scannedUid = null;
  captureSession.expiresAt = null;

  // Clear in-memory Visitor session
  visitorAccessSession.isPending = false;
  visitorAccessSession.expiresAt = null;
  visitorAccessSession.adminId = null;

  // Clear database registration session
  try {
    if (System_State) {
      await System_State.destroy({ where: { key: 'REGISTRATION_SESSION' } });
    } else {
      console.warn("[ENROLL CLEAR] System_State model not loaded yet.");
    }
  } catch (err) {
    console.error("[ENROLL CLEAR ERROR]", err);
  }

  if (res) {
    return res.status(200).json({ 
      success: true, 
      message: "Enrollment session cleared",
      enrollmentMode: false,
      cleared: true
    });
  }
};
exports.getSessionStatus = async (req, res) => {
  const deviceId = req.headers["x-esp32-id"] || "esp32-01";
  
  res.json({
    success: true,
    deviceId,
    hasActiveSession: fpCaptureSession.isCapturing || captureSession.isCapturing,
    session: {
      fpActive: fpCaptureSession.isCapturing,
      fpUserId: fpCaptureSession.userId,
      fpType: fpCaptureSession.type,
      rfidActive: captureSession.isCapturing
    }
  });
};

exports.scanRFID = async (req, res) => {
  let { uid, action, terminalType, cardCounter } = req.body; 

  // Update heartbeat
  lastEsp32Heartbeat = Date.now();

  if (!uid) {
    return res.status(400).json({ success: false, message: "No UID provided" });
  }

  const baseCardUid = uid.split("|")[0].trim().toUpperCase();

  // ── BIOMETRIC BRUTE-FORCE LOCKOUT CHECK ─────────────────────────────────
  const lockout = biometricFailures.get(baseCardUid);
  if (lockout && lockout.lockedUntil > Date.now()) {
    const remainingSec = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
    console.warn(`[SECURITY] Card ${baseCardUid} blocked: temporarily locked for ${remainingSec}s due to consecutive biometric failures.`);
    return res.status(200).json({
      success: false,
      mode: "CARD_LOCKED",
      message: `Card Locked (${remainingSec}s)`,
      error: `Security Lockout: Too many failed biometric attempts. Wait ${remainingSec} seconds.`
    });
  }

  // ── REGISTRATION / CAPTURE INTERCEPT (PRIORITY #1) ───────────────────────
  // If the system is in Registration/Capture mode, we INTERCEPT ALL scans.
  try {
    const regSession = await System_State.findOne({ where: { key: 'REGISTRATION_SESSION' } });
    const isGenericCapture = captureSession.isCapturing && (Date.now() < captureSession.expiresAt);

    if (regSession || isGenericCapture) {
      console.log(`[RFID-ADMIN] Intercept Triggered. UID: ${uid}`);
      
      captureSession.scannedUid = uid;
      captureSession.isCapturing = false;
      
      // Clear database session to release hardware
      if (regSession) {
        await System_State.destroy({ where: { key: 'REGISTRATION_SESSION' } });
      }
      
      return res.status(200).json({
        success: false, // Prevents solenoid activation
        isCapture: true, 
        mode: 'RFID_REG_SUCCESS',
        rfid: uid,
        message: "CAPTURE OK"
      });
    }
  } catch (err) {
    console.error("[SCAN-INTERCEPT ERROR]:", err);
  }

  // ── ANTI-RAPID TAP PROTECTION ───────────────────────────────────────────
  const nowTime = Date.now();
  const tapKey = `${uid}_${action || terminalType}`;
  const lastTapTime = recentTaps.get(tapKey);
  if (lastTapTime && (nowTime - lastTapTime < RAPID_TAP_COOLDOWN)) {
    const waitTime = Math.ceil((RAPID_TAP_COOLDOWN - (nowTime - lastTapTime)) / 1000);
    console.log(`[RAPID-TAP] Blocked UID: ${uid} for ${action || terminalType}. Wait ${waitTime}s.`);
    return res.status(200).json({ 
      success: false, 
      message: `Too fast! Wait ${waitTime}s`,
      mode: "RAPID_TAP"
    });
  }
  recentTaps.set(tapKey, nowTime);

  // Periodically cleanup Map to prevent memory leaks
  if (recentTaps.size > 2000) {
    for (const [key, time] of recentTaps.entries()) {
      if (nowTime - time > RAPID_TAP_COOLDOWN) recentTaps.delete(key);
    }
  }

  // ── SECURITY ACTION CHECK (from ESP32) ───────────────────────────────────
  if (action === "unenrolled_card_attempt" || action === "suspicious_biometric_fail") {
    const isBiometric = action === "suspicious_biometric_fail";
    const type = isBiometric ? "Unauthorized scan" : "Unrecognized card or scan";
    const eventType = isBiometric ? "UNAUTHORIZED_SCAN" : "UNRECOGNIZED_SCAN";
    
    console.log(`[SECURITY-LOG] ${type} for UID: ${uid} on ${terminalType || "FRONT"}`);
    
    const masked = maskUid(baseCardUid, false);
    const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

    if (isBiometric) {
      const nowMs = Date.now();
      let record = biometricFailures.get(baseCardUid);
      if (!record || (nowMs - record.firstFailAt > BIOMETRIC_WINDOW)) {
        record = { count: 1, lockedUntil: 0, firstFailAt: nowMs };
      } else {
        record.count++;
      }

      if (record.count >= MAX_BIOMETRIC_FAILURES) {
        record.lockedUntil = nowMs + BIOMETRIC_LOCKOUT_DURATION;
        console.error(`[SECURITY ALERT] Card ${baseCardUid} locked out for 5 minutes due to ${record.count} consecutive biometric failures!`);
        
        try {
          const admins = await User.findAll({ where: { user_RoleId: 1, deletedAt: null } });
          const notifications = admins.map(admin => ({
            user_Id: admin.user_Id,
            title: "Security Alert: Card Locked Out",
            message: `Card ${masked} was temporarily locked for 5 minutes after ${record.count} consecutive failed biometric attempts at Front Terminal.`,
            isRead: false
          }));
          await Notification.bulkCreate(notifications);
        } catch (notifErr) {
          console.error("[LOCKOUT] Failed to notify admins:", notifErr);
        }
      }
      biometricFailures.set(baseCardUid, record);
    }

    await logTransaction(null, null, eventType, `${type} detected on device ${deviceIp}`, { 
      uid: masked,
      deviceIp,
      result: "Security Alert",
      action: action,
      terminalType
    }, req);

    return res.status(200).json({ success: true, message: "Security alert recorded" });
  }

  // ── ENROLLMENT ACTION CHECK ─────────────────────────────────────────────
  if (action === "enroll") {
    return res.status(200).json({ 
      success: true,
      mode: "WAITING_FOR_FINGERPRINT",
      message: "Ready for fingerprint enrollment"
    });
  }

  // If action is auto_detect but not capturing, it's a normal clock_in/out
  if (action === "auto_detect") {
    action = terminalType === "BACK" ? "clock_out" : "clock_in";
  }

  try {
    const now = await getSystemTime();
    const todayStr = formatDateLocal(now);
    const timeStr = now.toTimeString().split(" ")[0];

    // --- LOGICAL WORK DAY (LWD) LOGIC ---
    let workDate = todayStr;
    const hour = now.getHours();
    // If user is Evening Shift (2) and it is early morning (before 10 AM)
    // we attribute this log to the PREVIOUS day (the shift start date).
    // Note: We'll check the user shift below after finding them.
    // So for now, we'll keep workDate = todayStr and adjust it later if needed.
    // Actually, it's better to find the user FIRST.
    // ------------------------------------

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

    // 1. Find User by MachipId (Case-Insensitive) or FingerprintId via Hardware join
    let user;
    const { SystemSettings } = require("../config/sequelize.js");
    const settings = await SystemSettings.findOne();

    if (action === "fingerprint_scan") {
      const { Op } = require("sequelize");
      user = await User.findOne({
        include: [{
          model: sequelize.models.User_Hardware,
          as: 'hardware',
          where: {
            [Op.or]: [
              { user_FingerprintId: parseInt(uid) },
              { user_FingerprintId2: parseInt(uid) }
            ]
          }
        }],
        where: { deletedAt: null }
      });
    } else {
      user = await User.findOne({
        include: [{
          model: sequelize.models.User_Hardware,
          as: 'hardware',
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('hardware.user_MachipId')), rfidUid.toLowerCase())
        }],
        where: { deletedAt: null }
      });
    }

    if (!user) {
      const isFP = action === "fingerprint_scan";
      const type = isFP ? "Unauthorized scan" : "Unrecognized card or scan";
      const eventType = isFP ? "UNAUTHORIZED_SCAN" : "UNRECOGNIZED_SCAN";
      
      console.log(`[SECURITY] Unenrolled ${type} attempt: ${uid}`);
      const masked = isFP ? `Slot ${uid}` : maskUid(uid, false);
      const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

      // Mark as UNRECOGNIZED_SCAN or UNAUTHORIZED_SCAN for unauthorized users
      await logTransaction(null, null, eventType, `${type} (${masked}) detected on device ${deviceIp}`, { 
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
          title: type,
          message: `A ${type.toLowerCase()} (ID: ${masked}) was detected on device ${deviceIp} at ${now.toLocaleTimeString()}. Possible unauthorized access attempt.`,
          isRead: false
        }));
        await Notification.bulkCreate(notifications);
      } catch (notifErr) {
        console.error(`[${type}] Failed to create notifications:`, notifErr);
      }

      // Return 200 to stop ESP32 retries, but with success: false
      return res.status(200).json({ 
        success: false, 
        error: "Card not enrolled",
        mode: "CARD_NOT_ENROLLED"
      });
    }

    if (user.user_EmploymentStatusId === 5 || user.user_EmploymentStatusId === 6) {
      console.log(`[SECURITY] Access denied for inactive/separated employee: ${user.user_FirstName} ${user.user_LastName} (ID: ${user.user_Id})`);
      return res.status(200).json({ 
        success: false, 
        error: "Access Denied: Inactive / Separated Account",
        mode: "ACCOUNT_INACTIVE" 
      });
    }

    const hardware = user.hardware;
    const target_user_Id = user.user_Id;

    // ── RFID ROLLING CODE ANTI-REPLAY VERIFICATION ───────────────────────────
    if (cardCounter !== undefined && cardCounter !== null) {
      const parsedCounter = parseInt(cardCounter);
      const dbCounter = hardware ? (hardware.card_counter || 0) : 0;

      if (!isNaN(parsedCounter) && parsedCounter > 0) {
        if (dbCounter > 0 && parsedCounter <= dbCounter) {
          console.error(`[SECURITY ALERT] REPLAY ATTACK DETECTED for user ${user.user_FirstName} (ID: ${user.user_Id}). Received Counter: ${parsedCounter}, Stored Counter: ${dbCounter}`);
          const masked = maskUid(rfidUid, false);
          const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

          await logTransaction(user.user_Id, null, "REPLAY_ATTACK_DETECTED", `Replay or clone attack detected on card ${masked}. Counter ${parsedCounter} <= ${dbCounter}`, {
            uid: masked,
            receivedCounter: parsedCounter,
            storedCounter: dbCounter,
            deviceIp,
            threatLevel: "CRITICAL"
          }, req);

          try {
            const admins = await User.findAll({ where: { user_RoleId: 1, deletedAt: null } });
            for (const admin of admins) {
              await Notification.create({
                user_Id: admin.user_Id,
                title: "Security Alert: RFID Replay Detected",
                message: `CRITICAL: Potential RFID clone or replay attack detected for ${user.user_FirstName} ${user.user_LastName} (ID: ${masked}). Received counter: ${parsedCounter}, Expected: > ${dbCounter}. Access denied.`,
                isRead: false
              });
            }
          } catch (notifErr) {
            console.error("[REPLAY] Failed to notify admins:", notifErr);
          }

          return res.status(200).json({
            success: false,
            mode: "REPLAY_ATTACK",
            message: "Replay Attack Detected",
            employeeName: user.user_FirstName,
            name: user.user_FirstName,
            error: "Security Alert: Counter replay detected."
          });
        }

        // Counter is monotonic and valid! Update card_counter using raw SQL per GEMINI.md
        await sequelize.query(
          `UPDATE "User_Hardware" SET "card_counter" = :parsedCounter, "updatedAt" = NOW() WHERE "user_Id" = :target_user_Id`,
          { replacements: { parsedCounter, target_user_Id: user.user_Id }, type: QueryTypes.UPDATE }
        );
      }
    } else if (hardware && hardware.card_counter > 0) {
      console.warn(`[SECURITY] Card ${rfidUid} has rolling code in DB (${hardware.card_counter}), but scan arrived without counter.`);
      await logTransaction(user.user_Id, null, "SUSPICIOUS_SCAN", `Card scanned without rolling counter token despite having rolling protection active.`, {
        uid: maskUid(rfidUid, true),
        expectedMinCounter: hardware.card_counter + 1,
        deviceIp: req.ip || "Unknown"
      }, req);
    }

    // --- APPLY LWD AFTER FINDING USER ---
    const isNightShiftActive = Boolean(settings?.enableNightShift && user.user_ShiftId === 2);
    if (isNightShiftActive && hour < 10) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      workDate = formatDateLocal(yesterday);
    }
    const todayStart = new Date(workDate + "T00:00:00");
    const todayEnd   = new Date(workDate + "T23:59:59");
    // ------------------------------------

    // ── 2. DETERMINE FINAL ACTION ────────────────────────────────────────────
    // Fetch granular daily status directly from user_logging for highest reliability
    const lastLogs = await sequelize.query(
      `SELECT "logged_StatusId" FROM "user_logging"
       WHERE "user_id" = :target_user_Id AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT }
    );
    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;
    
    // Statuses indicating the user is physically inside: 1 (Morning In), 3 (Afternoon In), 5 (Overtime In)
    const isCurrentlyIn = [1, 3, 5].includes(lastStatus);

    console.log(`[DEBUG-POLICY] User: ${user.user_FirstName}, LastStatus: ${lastStatus || "NONE"}, isCurrentlyIn: ${isCurrentlyIn}`);

    // Normalize action
    if (action === "auto_detect" || action === "fingerprint_scan" || action === "2fa_verify") {
      if (terminalType === "BACK") {
        action = "clock_out";
      } else if (terminalType === "FRONT") {
        action = "clock_in";
      } else {
        // Safe fallback if terminalType is missing (e.g. legacy firmware)
        action = isCurrentlyIn ? "clock_out" : "clock_in";
      }
    }

    console.log(`[ATTENDANCE-DEBUG] User: ${user.user_FirstName}, Requested Action: ${action}, IsIn: ${isCurrentlyIn}, Terminal: ${terminalType}`);

    // ── 3. STRICT POLICY VALIDATION ──────────────────────────────────────────
    if (action === "clock_in") {
      if (isCurrentlyIn) {
        console.log(`[POLICY] Denied: ${user.user_FirstName} is already inside.`);
        await logTransaction(
          user.user_Id, 
          null, 
          "ACCESS_DENIED", 
          `Passback Denied: ${user.user_FirstName} ${user.user_LastName} is already inside.`, 
          { reason: "Already Inside", terminal: terminalType || "FRONT" }, 
          req
        );
        return res.status(200).json({ 
          success: false, 
          error: "Person is already inside",
          message: "Person is already inside", 
          mode: "ALREADY_INSIDE",
          employeeName: user.user_FirstName, 
          name: user.user_FirstName 
        });
      }
    } else if (action === "clock_out") {
      if (!isCurrentlyIn) {
        console.log(`[POLICY] Denied: ${user.user_FirstName} is already outside.`);
        await logTransaction(
          user.user_Id, 
          null, 
          "ACCESS_DENIED", 
          `Passback Denied: ${user.user_FirstName} ${user.user_LastName} is already outside.`, 
          { reason: "Already Outside", terminal: terminalType || "BACK" }, 
          req
        );
        return res.status(200).json({ 
          success: false, 
          error: "Person is already outside",
          message: "Person is already outside", 
          mode: "ALREADY_OUTSIDE",
          employeeName: user.user_FirstName, 
          name: user.user_FirstName 
        });
      }
    }

    // ── 4. 2FA FLOW TRIGGER (STRICT 2FA ENFORCEMENT) ──────────────────────────
    const hasTemplate = hardware && (hardware.user_FingerprintTemplate || hardware.user_FingerprintTemplate2);
    if (!is2FA && action === "clock_in" && (terminalType === "FRONT" || !terminalType)) {
      if (hasTemplate) {
        console.log(`[2FA] Requesting Biometric Verification for ${user.user_FirstName}`);
        return res.status(200).json({
          success: true,
          mode: "WAITING_FOR_FINGERPRINT_2FA",
          uid: rfidUid,
          userId: user.user_Id,
          userName: user.user_FirstName,
          expectedFingerId: parseInt(hardware.user_FingerprintId),
          expectedFingerId2: hardware.user_FingerprintId2 ? parseInt(hardware.user_FingerprintId2) : null
        });
      } else {
        console.log(`[2FA REJECT] ${user.user_FirstName} has no enrolled fingerprint in database.`);
        return res.status(200).json({
          success: false,
          message: "Fingerprint Required",
          employeeName: user.user_FirstName,
          name: user.user_FirstName,
          mode: "FINGERPRINT_REQUIRED"
        });
      }
    }

    // ── 5. 2FA Verification (FingerID Check) ─────────────────────────────────
    if (is2FA) {
      const dbFingerId = parseInt(hardware?.user_FingerprintId);
      const dbFingerId2 = hardware?.user_FingerprintId2 ? parseInt(hardware.user_FingerprintId2) : null;
      const inputFingerId = parseInt(scannedFingerId);

      const isMatch = (!isNaN(dbFingerId) && dbFingerId === inputFingerId) || (!isNaN(dbFingerId2) && dbFingerId2 === inputFingerId);

      if (!isMatch) {
        console.log(`[2FA] Mismatch for ${user.user_FirstName}`);
        const nowMs = Date.now();
        let record = biometricFailures.get(baseCardUid);
        if (!record || (nowMs - record.firstFailAt > BIOMETRIC_WINDOW)) {
          record = { count: 1, lockedUntil: 0, firstFailAt: nowMs };
        } else {
          record.count++;
        }
        if (record.count >= MAX_BIOMETRIC_FAILURES) {
          record.lockedUntil = nowMs + BIOMETRIC_LOCKOUT_DURATION;
          console.error(`[SECURITY ALERT] Card ${baseCardUid} locked out for 5 minutes due to ${record.count} consecutive biometric failures!`);
        }
        biometricFailures.set(baseCardUid, record);

        await logTransaction(user.user_Id, null, "UNAUTHORIZED_SCAN", `Unauthorized scan (2FA Mismatch).`, { uid: maskUid(rfidUid, true), scannedFingerId }, req);
        return res.status(200).json({ success: false, message: "2FA Verification Failed" });
      }
      console.log(`[2FA] Success for ${user.user_FirstName}`);
      biometricFailures.delete(baseCardUid);
    }

    // ── 6. PROCESS ATTENDANCE RECORDING ──────────────────────────────────────
    const fivePMThirty = new Date(now); fivePMThirty.setHours(17, 30, 0, 0);
    const fiveAMThirty = new Date(now); fiveAMThirty.setHours(5, 30, 0, 0);

    const approvedOTResult = await sequelize.query(
      `SELECT ot.* FROM "Overtime_Request" ot JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       WHERE ot."user_Id" = :target_user_Id AND ot."OT_DateOf" = :workDate AND er."emp_reqStatusId" = 2`,
      { replacements: { target_user_Id, workDate }, type: QueryTypes.SELECT }
    );
    const approvedOT = approvedOTResult[0];
    const hasApprovedOT = !!approvedOT;

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

    // Determine nextStatus based on action and current time (Lunch logic + OT logic)
    let nextStatus;
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Dynamic Lunch Window from Settings
    const lStartStr = settings?.lunchStartThreshold || "11:30:00";
    const lEndStr   = settings?.lunchEndThreshold   || "13:30:00";
    const lStart = parseInt(lStartStr.split(":")[0]) * 60 + parseInt(lStartStr.split(":")[1]);
    const lEnd   = parseInt(lEndStr.split(":")[0])   * 60 + parseInt(lEndStr.split(":")[1]);

    const isLunchWindow = totalMinutes >= lStart && totalMinutes < lEnd;

    // Check prior login today (Morning or Afternoon) - exclude irregular off-hours scans
    const priorLoginToday = await sequelize.query(
      `SELECT * FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "logged_StatusId" IN (1, 3)
       AND ("attendance_StatusId" IS NULL OR "attendance_StatusId" != 8)
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );
    const hasPriorClockIn = !!priorLoginToday[0];

    // Check if there was any prior scan flagged as Irregular today
    const priorIrregular = await sequelize.query(
      `SELECT 1 FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "attendance_StatusId" = 8
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       LIMIT 1`,
      { replacements: { target_user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );
    const hadPriorIrregular = priorIrregular.length > 0;

    const isNightShiftAllowed = Boolean(settings?.enableNightShift && user.user_ShiftId === 2);
    const isSuspiciousWindow = (now >= fivePMThirty || now < fiveAMThirty);
    const isPastOT = hasApprovedOT && isPastOTWindow;

    // Irregular if outside regular hours without approved OT, or past OT window, or prior irregular session during suspicious window
    const isIrregular = (!isWithinOTWindow && isSuspiciousWindow && !isNightShiftAllowed) ||
                        isPastOT ||
                        (hadPriorIrregular && isSuspiciousWindow);

    if (action === "clock_in") {
      if (hasApprovedOT && isWithinOTWindow) {
        nextStatus = 5; // Overtime IN
      } else if (lastStatus === 2 && !isSuspiciousWindow && hasPriorClockIn) {
        nextStatus = 3; // Afternoon IN (from lunch)
      } else if (!hasPriorClockIn) {
        // First regular entry of the day
        if (totalMinutes < 720) {
          // Arrived before 12:00 PM noon -> Morning IN
          nextStatus = 1;
        } else {
          // Arrived at or after 12:00 PM -> Afternoon IN (PM arrival)
          nextStatus = 3;
        }
      } else {
        nextStatus = 1; // Morning IN (or initial entry)
      }
    } else {
      if (lastStatus === 5) {
        nextStatus = 6; // Overtime OUT
      } else if (lastStatus === 1 && totalMinutes < 780) {
        // Clocking out in the morning or during lunch (< 1:00 PM) -> Morning OUT
        nextStatus = 2; // Lunch Out (Morning OUT)
      } else {
        // Clocking out from Afternoon IN or end of day -> Afternoon OUT
        nextStatus = 4; // Clock Out (Afternoon OUT)
      }
    }

    if (isIrregular && action === "clock_in") {
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
      attendanceVal = 8; // Irregular (Applied to BOTH Clock In and Clock Out during irregular activity)
    } else if (nextStatus === 5 && hasApprovedOT && isWithinOTWindow) {
      attendanceVal = 1; // On-Time (for approved Overtime)
    } else if (nextStatus === 1) {
      // Dynamic Grace Period from Settings
      const graceTimeStr = settings?.gracePeriod || "08:35:00";
      const graceTime = new Date(`${workDate}T${graceTimeStr}`);
      if (now <= graceTime) {
        attendanceVal = 1; // On-Time
      } else if (now > graceTime && now < fivePMThirty) {
        attendanceVal = 2; // Late
      }
    } else if (nextStatus === 3 && !hasPriorClockIn) {
      attendanceVal = 4; // Half Day (PM arrival)
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
    const isEntry = [1, 3, 5].includes(nextStatus);
    const reportLoggedStatus = isEntry ? 1 : 2;

    const existingReport = await sequelize.query(
      `SELECT * FROM "employee_Logging_report"
       WHERE "user_id" = :target_user_Id AND "log_Date" = :workDate
       LIMIT 1`,
      { replacements: { target_user_Id, workDate }, type: QueryTypes.SELECT },
    );

    if (!existingReport[0]) {
      await sequelize.query(
        `INSERT INTO "employee_Logging_report"
          ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr",
           "attendance_StatusId", "logged_StatusId")
         VALUES
          (:target_user_Id, :workDate, :inArr, :outArr, :attendance_StatusId, :reportLoggedStatus)`,
        {
          replacements: {
            target_user_Id,
            workDate,
            inArr: isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            outArr: !isEntry ? JSON.stringify([timeStr]) : JSON.stringify([]),
            attendance_StatusId: attendanceVal,
            reportLoggedStatus,
          },
          type: QueryTypes.INSERT,
        },
      );
      calculateAndStoreAttendanceUnits(target_user_Id, workDate).catch(err => console.error("[RFID-CALC-ERR]", err));
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
             "attendance_StatusId" = CASE 
                WHEN "attendance_StatusId" IS NULL OR "attendance_StatusId" = 3 OR ("attendance_StatusId" = 8 AND :attendance_StatusId IN (1, 2, 4, 6)) THEN :attendance_StatusId 
                ELSE "attendance_StatusId" 
             END
         WHERE "user_id" = :target_user_Id AND "log_Date" = :workDate`,
        {
          replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), reportLoggedStatus, attendance_StatusId: attendanceVal, target_user_Id, workDate },
          type: QueryTypes.UPDATE,
        },
      );
      calculateAndStoreAttendanceUnits(target_user_Id, workDate).catch(err => console.error("[RFID-CALC-ERR]", err));
    }

    // ── 7. RESOLVE LEAVE CONFLICTS (VOID LOGIC) ──────────────────────────────
    if (!isEntry) {
      // Triggered on Clock Out, Lunch Out, or OT Out
      resolveLeaveConflict(target_user_Id, workDate)
        .then(res => {
          if (res.refundAmount > 0) console.log(`[LEAVE-AUTO] ${res.message} for user ${target_user_Id}`);
        })
        .catch(err => console.error("[LEAVE-AUTO] Error resolving leave conflict:", err));
    }

    const statusLabels = { 1: "Clock In", 2: "Lunch Out", 3: "Lunch In", 4: "Clock Out", 5: "Overtime In", 6: "Overtime Out" };
    const attendanceResult = attendanceVal === 1 ? "On-Time" : attendanceVal === 2 ? "Late" : attendanceVal === 8 ? "Irregular" : "N/A";
    const esp32Ip = req.ip || req.socket.remoteAddress || "Unknown ESP32";

    // 6. Log Transaction
    const method = action === "fingerprint_scan" ? "Fingerprint" : "RFID";
    const isIrregularEvent = isIrregular; // Use the isIrregular flag defined earlier
    const punchLabel = [1, 3, 5].includes(nextStatus) ? "Clock In" : "Clock Out";
    
    if (isIrregularEvent) {
      await logTransaction(target_user_Id, null, "IRREGULAR_LOG", `Irregular ${punchLabel} at ${timeStr}`, { 
        status: statusLabels[nextStatus], 
        punchDirection: punchLabel,
        time: timeStr, 
        method: method,
        deviceIp: esp32Ip
      }, req);
    } else {
      await logTransaction(target_user_Id, null, `${method.toUpperCase()}_SCAN`, `${statusLabels[nextStatus]} via ${method}`, { 
        uid: action === "fingerprint_scan" ? `Slot ${uid}` : maskUid(rfidUid, true),
        status: statusLabels[nextStatus], 
        time: timeStr,
        role: "Employee",
        result: attendanceResult,
        deviceIp: esp32Ip
      }, req);
    }

    // [SOCKET] Trigger real-time UI updates
    const io = getIO();
    io.emit("NEW_ATTENDANCE_LOG", { userId: target_user_Id, status: isIrregularEvent ? `Irregular ${punchLabel}` : statusLabels[nextStatus] });
    io.to(`user_${target_user_Id}`).emit("NOTIFICATION_UPDATE");

    return res.status(200).json({
      success: true,
      employeeName: user.user_FirstName,
      name: user.user_FirstName,
      message: isIrregularEvent ? `Irregular ${punchLabel}` : statusLabels[nextStatus]
    });

  } catch (error) {
    console.error("[SCAN ERROR - CRITICAL]:", error);
    // Log the stack trace for debugging
    if (error.stack) console.error(error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
};

exports.generateRfid = async (req, res) => {
  const { userId } = req.query;
  const targetUserId = userId || "temp_registration";
  console.log(`[RFID-ADMIN] >>> STARTING RFID capture for User: ${targetUserId}`);
  
  captureSession = { 
    isCapturing: true, 
    scannedUid: null, 
    userId: targetUserId,
    expiresAt: Date.now() + 25000 
  };
  
  const startTime = Date.now();
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (captureSession.scannedUid) {
      const uid = captureSession.scannedUid;
      console.log(`[RFID-ADMIN] Detected UID: ${uid} after ${attempts} checks.`);
      captureSession.scannedUid = null;
      captureSession.isCapturing = false;
      clearInterval(checkInterval);
      
      User.findOne({ 
        include: [{
          model: User_Hardware,
          as: 'hardware',
          where: { user_MachipId: uid }
        }],
        where: { deletedAt: null } 
      }).then(user => {
        if (user) {
          console.log(`[RFID-ADMIN] UID ${uid} is ALREADY assigned to user ${user.user_Id}`);
          return res.status(400).json({ error: "MaChip ID is already assigned to another user.", rfid: uid });
        }
        console.log(`[RFID-ADMIN] UID ${uid} is available for assignment.`);
        return res.status(200).json({ rfid: uid });
      }).catch(err => {
        console.error("[RFID-ADMIN] DB Error during duplicate check:", err);
        res.status(500).json({ error: "Internal Server Error" });
      });
      return;
    }

    if (Date.now() - startTime > 25000) {
      console.log(`[RFID-ADMIN] Capture TIMEOUT after 25s.`);
      clearInterval(checkInterval);
      captureSession.isCapturing = false;
      return res.status(408).json({ error: "Scan timeout. Please try again." });
    }
  }, 500);
};

exports.generateFingerprint = async (req, res) => {
  const { userId } = req.query;
  const targetUserId = userId || "temp_registration";
  console.log(`[FP-ADMIN] >>> STARTING enrollment session for User: ${targetUserId}`);
  
  try {
    const result = await sequelize.query(
      `SELECT MAX(slot) AS "maxSlot" FROM (
         SELECT uh."user_FingerprintId" AS slot FROM "User_Hardware" uh
         INNER JOIN "User" u ON uh."user_Id" = u."user_Id"
         WHERE u."deletedAt" IS NULL 
           AND uh."user_FingerprintId" IS NOT NULL 
           AND uh."user_FingerprintTemplate" IS NOT NULL 
           AND TRIM(uh."user_FingerprintTemplate") != ''
         UNION ALL
         SELECT uh."user_FingerprintId2" AS slot FROM "User_Hardware" uh
         INNER JOIN "User" u ON uh."user_Id" = u."user_Id"
         WHERE u."deletedAt" IS NULL 
           AND uh."user_FingerprintId2" IS NOT NULL 
           AND uh."user_FingerprintTemplate2" IS NOT NULL 
           AND TRIM(uh."user_FingerprintTemplate2") != ''
       ) sub`,
      { type: QueryTypes.SELECT }
    );
    const maxSlotValue = result[0] ? result[0].maxSlot : null;
    const nextSlot = (maxSlotValue && !isNaN(parseInt(maxSlotValue))) ? parseInt(maxSlotValue) + 1 : 1;
    
    // Explicitly reset the session to ensure no stale data
    fpCaptureSession = { 
      isCapturing: true, 
      scannedSlot: nextSlot, 
      userId: targetUserId,
      expiresAt: Date.now() + 60000, // 60s timeout
      success: false,
      template: null,
      type: "FP"
    };

    console.log(`[FP-ADMIN] Session initialized. Slot: ${nextSlot}, Expires: ${new Date(fpCaptureSession.expiresAt).toLocaleTimeString()}`);

    const targetSlot = nextSlot;
    const startTime = Date.now();
    
    // We use a longer initial wait to ensure the ESP32 has time to pick up the session
    // and the sensor can initialize.
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      
      // If session is no longer capturing, it means it was completed by confirmFingerprintEnroll OR manually cleared
      if (!fpCaptureSession.isCapturing) {
        clearInterval(checkInterval);
        console.log(`[FP-ADMIN] Session ended. Success: ${fpCaptureSession.success}, Attempts: ${attempts}`);
        
        if (fpCaptureSession.success) {
          return res.status(200).json({ 
            fingerprintId: fpCaptureSession.scannedSlot,
            template: fpCaptureSession.template 
          });
        } else {
          const errorMsg = fpCaptureSession.errorMessage || "Enrollment failed or was cancelled. Ensure the sensor is connected and finger is placed correctly.";
          return res.status(400).json({ error: errorMsg });
        }
      }

      // Check for timeout
      if (Date.now() > fpCaptureSession.expiresAt) {
        clearInterval(checkInterval);
        fpCaptureSession.isCapturing = false;
        console.log(`[FP-ADMIN] Session TIMEOUT after ${Math.floor((Date.now() - startTime)/1000)}s`);
        return res.status(408).json({ error: "Scan timeout. Please ensure the ESP32 is online and try again." });
      }

      // Log progress occasionally
      if (attempts % 5 === 0) {
        console.log(`[FP-ADMIN] Waiting for ESP32... (${Math.floor((Date.now() - startTime)/1000)}s elapsed)`);
      }
    }, 1000);
  } catch (error) {
    console.error("[FP-GENERATE ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
};

// ESP32 Endpoints
exports.factoryResetHardware = async (req, res) => {
  try {
    // Clear orphan/stale fingerprint IDs and templates in User_Hardware
    await sequelize.query(
      `UPDATE "User_Hardware" 
       SET "user_FingerprintId" = NULL, "user_FingerprintTemplate" = NULL,
           "user_FingerprintId2" = NULL, "user_FingerprintTemplate2" = NULL 
       WHERE "user_Id" IN (SELECT "user_Id" FROM "User" WHERE "deletedAt" IS NOT NULL)
          OR (("user_FingerprintTemplate" IS NULL OR TRIM("user_FingerprintTemplate") = '')
              AND ("user_FingerprintTemplate2" IS NULL OR TRIM("user_FingerprintTemplate2") = ''))`
    );

    // Initialize special session for R307 sensor flash wipe
    fpCaptureSession = { 
      isCapturing: true, 
      scannedSlot: 0, 
      userId: "SYSTEM_RESET",
      expiresAt: Date.now() + 30000,
      success: false,
      template: null,
      type: "CLEAR_ALL"
    };

    console.log(`[HARDWARE] Factory reset session initialized. Clearing R307 sensor and DB orphans...`);
    res.status(200).json({ message: "Hardware reset command queued. R307 memory and orphan DB slots will be wiped." });
  } catch (error) {
    console.error("[FACTORY RESET ERROR]:", error);
    res.status(500).json({ error: "Failed to initialize hardware reset." });
  }
};

exports.getFingerprintSession = async (req, res) => {
  // 0. Check for Hardware Slot Deletion command (Rollback cancelled enrollment or separated/deleted employee)
  if (pendingDeleteSlots.length > 0) {
    const slotToDelete = pendingDeleteSlots.shift();
    console.log(`[HARDWARE] Sending DELETE_SLOT command for slot ${slotToDelete} to ESP32.`);
    return res.status(200).json({
      active: true,
      slotId: slotToDelete,
      userId: "DELETION",
      type: "DELETE_SLOT"
    });
  }

  // 1. Check in-memory session (Direct Scan via Edit User Modal);
  const now = Date.now();
  if (!lastEsp32Heartbeat || (now - lastEsp32Heartbeat > 60000)) {
    console.log(`[HARDWARE] ESP32 Heartbeat received at ${new Date(now).toLocaleTimeString()} from ${req.ip}`);
  }
  lastEsp32Heartbeat = now;

  // 0. Check Visitor Access (High Priority)
  if (visitorAccessSession.isPending && Date.now() < visitorAccessSession.expiresAt) {
    // Consume the trigger immediately so it doesn't loop
    visitorAccessSession.isPending = false;
    
    return res.status(200).json({
      active: true,
      slotId: 0,
      userId: 999,
      type: "VISITOR_OPEN"
    });
  }

  // 1. Check in-memory session (Direct Scan via generateFingerprint)
  if (fpCaptureSession.isCapturing && Date.now() < fpCaptureSession.expiresAt) {
    return res.status(200).json({
      active: true,
      slotId: fpCaptureSession.scannedSlot,
      userId: fpCaptureSession.userId || "temp_registration",
      type: fpCaptureSession.type
    });
  }

  // 1.5 Check RFID Capture mode (Direct Scan via generateRfid)
  if (captureSession.isCapturing && Date.now() < captureSession.expiresAt) {
     return res.status(200).json({
      active: true,
      slotId: 1,
      userId: captureSession.userId || "temp_registration",
      type: "RFID"
    });
  }

  // 2. Check Database session (Proxy Scan via Registration Modal)
  try {
    // 2.1 Check for System-wide Hardware Reset Signal (from db:reset)
    const resetSignal = await System_State.findOne({ where: { key: 'HARDWARE_RESET_SIGNAL' } });
    if (resetSignal) {
      await System_State.destroy({ where: { key: 'HARDWARE_RESET_SIGNAL' } });
      
      fpCaptureSession = { 
        isCapturing: true, 
        scannedSlot: 0, 
        userId: "SYSTEM_RESET",
        expiresAt: Date.now() + 30000,
        success: false,
        template: null,
        type: "CLEAR_ALL"
      };
      
      console.log(`[HARDWARE] DB-RESET Signal detected. Triggering CLEAR_ALL on next poll.`);
      return res.status(200).json({
        active: true,
        slotId: 0,
        userId: "SYSTEM_RESET",
        type: "CLEAR_ALL"
      });
    }

    const regSession = await System_State.findOne({ where: { key: 'REGISTRATION_SESSION' } });
    if (regSession) {
      const sessionData = JSON.parse(regSession.value);
      if (sessionData.type === 'FP' || sessionData.type === 'RFID') {
        // ONLY promote if there isn't ALREADY an active session being tracked
        if (!fpCaptureSession.isCapturing || Date.now() > fpCaptureSession.expiresAt) {
          const result = await sequelize.query(
            `SELECT MAX(slot) AS "maxSlot" FROM (
               SELECT uh."user_FingerprintId" AS slot FROM "User_Hardware" uh
               INNER JOIN "User" u ON uh."user_Id" = u."user_Id"
               WHERE u."deletedAt" IS NULL 
                 AND uh."user_FingerprintId" IS NOT NULL 
                 AND uh."user_FingerprintTemplate" IS NOT NULL 
                 AND TRIM(uh."user_FingerprintTemplate") != ''
               UNION ALL
               SELECT uh."user_FingerprintId2" AS slot FROM "User_Hardware" uh
               INNER JOIN "User" u ON uh."user_Id" = u."user_Id"
               WHERE u."deletedAt" IS NULL 
                 AND uh."user_FingerprintId2" IS NOT NULL 
                 AND uh."user_FingerprintTemplate2" IS NOT NULL 
                 AND TRIM(uh."user_FingerprintTemplate2") != ''
             ) sub`,
            { type: QueryTypes.SELECT }
          );
          const maxSlotVal = result[0] ? result[0].maxSlot : null;
          const nextSlot = (sessionData.type === 'FP') 
            ? ((maxSlotVal && !isNaN(parseInt(maxSlotVal))) ? parseInt(maxSlotVal) + 1 : 1) 
            : 1;

          fpCaptureSession = { 
            isCapturing: true, 
            scannedSlot: sessionData.type === 'FP' ? nextSlot : 1, 
            userId: sessionData.userId,
            expiresAt: Date.now() + 60000, 
            success: false,
            template: null,
            type: sessionData.type
          };
        }

        return res.status(200).json({
          active: true,
          slotId: fpCaptureSession.scannedSlot,
          userId: sessionData.userId,
          type: sessionData.type // Always return current session type from DB
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

  // Handle captureSession for RFID New User Wizard
  if (captureSession.isCapturing && template) {
      console.log(`[FP-RECEIVE] Handled via captureSession (RFID Wizard): ${template}`);
      captureSession.scannedUid = template;
      captureSession.isCapturing = false;
      return res.status(200).json({ success: true });
  }

  // Check if session is active. We allow any slotId during an active session to support hardware-side deduplication
  if (fpCaptureSession.isCapturing) {
    // Priority: 1. Body slotId (if > 0), 2. Session assigned slot
    const finalSlotId = (slotId && parseInt(slotId) > 0) ? parseInt(slotId) : fpCaptureSession.scannedSlot;
    
    fpCaptureSession.success = success;
    fpCaptureSession.isCapturing = false; // STOP the session so ESP32 doesn't loop
    
    // Clear the database registration session as well
    try {
      await System_State.destroy({ where: { key: 'REGISTRATION_SESSION' } });
      console.log("[FP-CONFIRM] Cleared REGISTRATION_SESSION from database");
    } catch (err) {
      console.error("[FP-CONFIRM] Failed to clear REGISTRATION_SESSION:", err);
    }

    // Check for deduplication signal from ESP32 (sent with success = false)
    if (template && typeof template === "string" && template.startsWith("DUPLICATE:")) {
      const duplicateSlotId = template.split(":")[1];
      console.log(`[FP-CONFIRM] Duplicate detected! Slot: ${duplicateSlotId}`);
      
      fpCaptureSession.success = false;
      fpCaptureSession.isCapturing = false;

      let targetUserIdRaw = userId || sessionUserId;
      const targetUserId = (targetUserIdRaw && targetUserIdRaw !== "temp_registration" && !isNaN(parseInt(targetUserIdRaw))) 
        ? parseInt(targetUserIdRaw) 
        : null;

      try {
        const [existingUser] = await sequelize.query(
          `SELECT u."user_Id", u."user_FirstName", u."user_LastName",
                  h."user_FingerprintId", h."user_FingerprintId2"
           FROM "User" u
           INNER JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
           WHERE (h."user_FingerprintId" = :slotId OR h."user_FingerprintId2" = :slotId) AND u."deletedAt" IS NULL
           LIMIT 1`,
          { replacements: { slotId: duplicateSlotId }, type: QueryTypes.SELECT }
        );

        if (existingUser) {
          if (targetUserId && existingUser.user_Id === targetUserId) {
            if (existingUser.user_FingerprintId === parseInt(duplicateSlotId)) {
              fpCaptureSession.errorMessage = `This finger is already registered as your Primary fingerprint (Slot #${duplicateSlotId}). Fallback must be a different finger.`;
            } else if (existingUser.user_FingerprintId2 === parseInt(duplicateSlotId)) {
              fpCaptureSession.errorMessage = `This finger is already registered as your Fallback fingerprint (Slot #${duplicateSlotId}).`;
            } else {
              fpCaptureSession.errorMessage = `This finger is already registered for your account (Slot #${duplicateSlotId}).`;
            }
          } else {
            fpCaptureSession.errorMessage = `This finger is already registered to ${existingUser.user_FirstName} ${existingUser.user_LastName} (Slot #${duplicateSlotId}).`;
          }
        } else {
          fpCaptureSession.errorMessage = `This finger is already registered in the scanner memory (Slot #${duplicateSlotId}).`;
        }
      } catch (err) {
        console.error("[FP-CONFIRM] Error querying duplicate user:", err);
        fpCaptureSession.errorMessage = `Duplicate fingerprint detected (Slot #${duplicateSlotId}).`;
      }
      return res.status(200).json({ success: true, duplicateSlot: duplicateSlotId });
    }

    if (!success) {
      fpCaptureSession.success = false;
      fpCaptureSession.isCapturing = false;
      if (!fpCaptureSession.errorMessage) {
        fpCaptureSession.errorMessage = "Enrollment was cancelled or failed on the sensor. Please try again.";
      }
      return res.status(200).json({ success: false, message: fpCaptureSession.errorMessage });
    }

    if (success && template) {
      // ALWAYS store the template and slot in the session so the frontend polling endpoint can pick it up
      fpCaptureSession.template = template;
      fpCaptureSession.scannedSlot = finalSlotId;
      
      // Also update captureSession for frontend polling compatibility if it's RFID
      if (fpCaptureSession.type === 'RFID') {
          captureSession.scannedUid = template;
          captureSession.isCapturing = false;
      }

      // If userId is provided, we can link it immediately, otherwise it's handled by the registration flow
      let targetUserIdRaw = userId || sessionUserId;
      console.log(`[FP-LINK] Attempting to link to User: ${targetUserIdRaw} (Type: ${fpCaptureSession.type}) - Using Slot: ${finalSlotId}`);

      const targetUserId = parseInt(targetUserIdRaw);
      if (targetUserIdRaw && targetUserIdRaw !== "temp_registration" && !isNaN(targetUserId)) {
        try {
          const now = await getSystemTime();
          const nowStr = now.toISOString();

          if (fpCaptureSession.type === 'RFID') {
            await sequelize.query(
              `INSERT INTO "User_Hardware" ("user_Id", "user_MachipId", "card_counter", "createdAt", "updatedAt")
               VALUES (:targetUserId, :template, 0, :now, :now)
               ON CONFLICT ("user_Id") DO UPDATE SET
                "user_MachipId" = EXCLUDED."user_MachipId",
                "card_counter" = 0,
                "updatedAt" = EXCLUDED."updatedAt"`,
              { replacements: { template, targetUserId, now: nowStr }, type: QueryTypes.INSERT }
            );
            console.log(`[FP-LINK] Success! RFID ${template} saved for user ${targetUserId}`);
          } else {
            await sequelize.query(
              `INSERT INTO "User_Hardware" ("user_Id", "user_FingerprintTemplate", "user_FingerprintId", "createdAt", "updatedAt")
               VALUES (:targetUserId, :template, :slotId, :now, :now)
               ON CONFLICT ("user_Id") DO UPDATE SET
                "user_FingerprintTemplate" = EXCLUDED."user_FingerprintTemplate",
                "user_FingerprintId" = EXCLUDED."user_FingerprintId",
                "updatedAt" = EXCLUDED."updatedAt"`,
              { replacements: { template, slotId: finalSlotId, targetUserId, now: nowStr }, type: QueryTypes.INSERT }
            );
            console.log(`[FP-LINK] Success! FP Slot ${finalSlotId} saved for user ${targetUserId}`);
          }
        } catch (err) {
          console.error(`[FP-LINK] FAILED to save to DB: ${err.message}`);
        }
      } else {
        console.log(`[FP-LINK] Skipping DB update (Target: ${targetUserIdRaw}).`);
      }
    }

    return res.status(200).json({ success: true, slotId: finalSlotId });
  }
  console.log(`[FP-RECEIVE] Rejected: Session active? ${fpCaptureSession.isCapturing}`);
  return res.status(400).json({ success: false, message: "No active session." });
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
      `SELECT u."user_Id", h."user_FingerprintTemplate" 
       FROM "User" u
       INNER JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE h."user_MachipId" = :uid AND u."deletedAt" IS NULL LIMIT 1`,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );

    if (!user) {
      console.log(`[FP DOWNLOAD] User not found for UID: ${uid}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if user is currently clocked in. If so, we don't return a template
    // because 2FA is only required for clocking in.
    const now = await getSystemTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const lastLogs = await sequelize.query(
      `SELECT "logged_StatusId" FROM "user_logging"
       WHERE "user_id" = :target_user_Id
       AND "log_Date" BETWEEN :todayStart AND :todayEnd
       ORDER BY "user_loggingId" DESC
       LIMIT 1`,
      { replacements: { target_user_Id: user.user_Id, todayStart, todayEnd }, type: QueryTypes.SELECT },
    );

    const lastStatus = lastLogs[0] ? lastLogs[0].logged_StatusId : null;
    const isCurrentlyIn = lastStatus === 1 || lastStatus === 3 || lastStatus === 5;

    if (isCurrentlyIn) {
      console.log(`[FP DOWNLOAD] User ${user.user_Id} already clocked in. Skipping 2FA template.`);
      return res.status(200).json({ success: true, template: null });
    }

    console.log(`[FP DOWNLOAD] User found. Template length: ${user.user_FingerprintTemplate ? user.user_FingerprintTemplate.length : "EMPTY/NULL"}`);

    let finalTemplate = null;
    if (user.user_FingerprintTemplate) {
      finalTemplate = decrypt(user.user_FingerprintTemplate);
    }

    // Return 200 even if template is null, so ESP32 knows the user exists but has no 2FA template
    return res.status(200).json({ 
      success: true, 
      template: finalTemplate 
    });
  } catch (error) {
    console.error("[FP DOWNLOAD ERROR]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.triggerVisitorAccess = async (req, res) => {
  const adminId = req.user?.user_Id || 1; 
  const { reason } = req.body || {};
  
  console.log(`[VISITOR] Triggered by Admin: ${adminId}, Reason: ${reason || "N/A"}`);
  
  visitorAccessSession = {
    isPending: true,
    expiresAt: Date.now() + 30000, 
    adminId: adminId,
    reason: reason || null
  };

  try {
    const now = await getSystemTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const timeStr = now.toTimeString().split(" ")[0];

    const [insertResult] = await sequelize.query(
      `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "reason", "admin_id")
       VALUES (999, :log_Date, :time_Logged, 8, :reason, :adminId)
       RETURNING "user_loggingId"`,
      {
        replacements: { log_Date: todayStart, time_Logged: timeStr, reason: reason || null, adminId },
        type: QueryTypes.INSERT
      }
    );
    const loggingId = insertResult?.[0]?.user_loggingId;

    try {
      await logAudit(
        req,
        adminId,
        "Visitor Access",
        "VISITOR_DOOR_RELEASE",
        "user_logging",
        loggingId,
        null,
        { reason: reason || "Manual visitor entry authorized", time: timeStr, adminId }
      );
    } catch (auditErr) {
      console.error("[VISITOR AUDIT ERROR]:", auditErr);
    }

    const io = getIO();
    io.emit("OPEN_DOOR", { type: "VISITOR", adminId, reason: reason || null });
    io.emit("NEW_ATTENDANCE_LOG", { 
      userId: 999, 
      status: "Visitor Access: Opening", 
      reason: reason || null,
      adminId: adminId 
    });

    res.status(200).json({ success: true, message: "Visitor access triggered" });
  } catch (error) {
    console.error("[VISITOR ERROR]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.confirmVisitorAccess = async (req, res) => {
  console.log(`[VISITOR] Hardware confirmed door closed`);
  
  if (!visitorAccessSession.isPending) {
    // If it was already cleared by timeout, we still allow logging if it's within a reasonable window
    // but for simplicity, let's just log it.
  }

  visitorAccessSession.isPending = false;

  try {
    const now = await getSystemTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const timeStr = now.toTimeString().split(" ")[0];

    await sequelize.query(
      `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId")
       VALUES (999, :log_Date, :time_Logged, 9)`,
      {
        replacements: { log_Date: todayStart, time_Logged: timeStr },
        type: QueryTypes.INSERT
      }
    );

    const io = getIO();
    io.emit("NEW_ATTENDANCE_LOG", { userId: 999, status: "Visitor Access: Door Closed" });

    res.status(200).json({ success: true, message: "Visitor access completed" });
  } catch (error) {
    console.error("[VISITOR CONFIRM ERROR]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
