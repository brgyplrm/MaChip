const { sequelize, User, Notification, System_State, User_Hardware } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("../utils/systemTime.js");
const { logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");
const { resolveLeaveConflict } = require("../utils/attendanceHelper.js");
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
  let { uid, action, terminalType } = req.body; 

  // Update heartbeat
  lastEsp32Heartbeat = Date.now();

  if (!uid) {
    return res.status(400).json({ success: false, message: "No UID provided" });
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
    const type = action === "unenrolled_card_attempt" ? "Unenrolled Card" : "Biometric Failure";
    console.log(`[SECURITY-LOG] ${type} for UID: ${uid} on ${terminalType || "FRONT"}`);
    
    const masked = maskUid(uid, false);
    const deviceIp = req.ip || req.socket.remoteAddress || "Unknown ESP32";

    await logTransaction(null, null, "SUSPICIOUS_SCAN", `${type} detected on device ${deviceIp}`, { 
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
      user = await User.findOne({
        include: [{
          model: sequelize.models.User_Hardware,
          as: 'hardware',
          where: { user_FingerprintId: parseInt(uid) }
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
      const type = action === "fingerprint_scan" ? "Fingerprint" : "MaChip";
      console.log(`[SECURITY] Unenrolled ${type} attempt: ${uid}`);
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

      // Return 200 to stop ESP32 retries, but with success: false
      return res.status(200).json({ 
        success: false, 
        error: "Card not enrolled",
        mode: "CARD_NOT_ENROLLED" 
      });
    }

    const hardware = user.hardware;
    const target_user_Id = user.user_Id;

    // --- APPLY LWD AFTER FINDING USER ---
    if (user.user_ShiftId === 2 && hour < 10) {
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
    
    // Statuses indicating the user is physically inside: 1 (Clock In), 4 (In From Lunch), 5 (Overtime In)
    const isCurrentlyIn = [1, 4, 5].includes(lastStatus);

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
        console.log(`[POLICY] Denied: ${user.user_FirstName} is already clocked in.`);
        return res.status(200).json({ success: false, message: "already clock-in", name: user.user_FirstName });
      }
    } else if (action === "clock_out") {
      if (!isCurrentlyIn) {
        console.log(`[POLICY] Denied: ${user.user_FirstName} is already clocked out.`);
        return res.status(200).json({ success: false, message: "already clock-out", name: user.user_FirstName });
      }
    }

    // ── 4. 2FA FLOW TRIGGER ──────────────────────────────────────────────────
    const hasTemplate = hardware && hardware.user_FingerprintTemplate;
    // Only trigger 2FA for RFID 'clock_in' on FRONT readers if user has a template
    if (!is2FA && action === "clock_in" && (terminalType === "FRONT" || !terminalType) && hasTemplate) {
      console.log(`[2FA] Requesting Biometric Verification for ${user.user_FirstName}`);
      return res.status(200).json({
        success: true,
        mode: "WAITING_FOR_FINGERPRINT_2FA",
        uid: rfidUid,
        userId: user.user_Id,
        userName: user.user_FirstName,
        expectedFingerId: parseInt(hardware.user_FingerprintId)
      });
    }

    // ── 5. 2FA Verification (FingerID Check) ─────────────────────────────────
    if (is2FA) {
      const dbFingerId = parseInt(hardware?.user_FingerprintId);
      const inputFingerId = parseInt(scannedFingerId);

      if (isNaN(dbFingerId) || dbFingerId !== inputFingerId) {
        console.log(`[2FA] Mismatch for ${user.user_FirstName}`);
        await logTransaction(user.user_Id, null, "2FA_FAILURE", `2FA Mismatch.`, { uid: maskUid(rfidUid, true), scannedFingerId }, req);
        return res.status(200).json({ success: false, message: "2FA Verification Failed" });
      }
      console.log(`[2FA] Success for ${user.user_FirstName}`);
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

    if (action === "clock_in") {
      nextStatus = (isLunchWindow && lastStatus === 3) ? 4 : (hasApprovedOT && isWithinOTWindow ? 5 : 1);
    } else {
      nextStatus = (isLunchWindow && [1, 4].includes(lastStatus)) ? 3 : (lastStatus === 5 ? 6 : 2);
    }

    // ... (rest of the code remains until recording attendance)

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

    const isSuspiciousWindow = (now >= fivePMThirty || now < fiveAMThirty);
    const isLateNightFirstIn = (nextStatus === 1 && isSuspiciousWindow && !hasPriorClockIn && !isWithinOTWindow);
    const isUnauthorizedReEntry = (nextStatus === 1 && hasPriorClockIn && isSuspiciousWindow && !isWithinOTWindow);
    const isPastOTEntry = (nextStatus === 1 && hasApprovedOT && isPastOTWindow);

    if (isLateNightFirstIn || isUnauthorizedReEntry || isPastOTEntry) {
      const admins = await User.findAll({ where: { user_RoleId: 1 }, attributes: ["user_Id"] });
      const timeFmt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let msg = `[SYSTEM NOTICE] Suspicious activity: ${user.user_FirstName} ${user.user_LastName} `;
      if (isPastOTEntry) msg += `clocked in at ${timeFmt}, past OT window (Ended ${approvedOT.HrTo}).`;
      else if (isLateNightFirstIn) msg += `logged in at ${timeFmt} (Outside 5:30 AM - 5:30 PM) without prior record or approved OT.`;
      else if (isUnauthorizedReEntry) msg += `clocked in again at ${timeFmt} (Suspicious Hours: 5:30 PM - 5:30 AM) after logging out, without approved OT.`;
      for (const admin of admins) await Notification.create({ user_Id: admin.user_Id, title: "Suspicious Activity", message: msg, isRead: false });
    }

    let attendanceVal = null;
    if (user.user_RoleId === 1) {
      attendanceVal = 6; // Exempt
    } else if (nextStatus === 1) {
      // Dynamic Grace Period from Settings
      const graceTimeStr = settings?.gracePeriod || "08:35:00";
      const graceTime = new Date(`${workDate}T${graceTimeStr}`);
      
      if (now <= graceTime) attendanceVal = 1; // On-Time
      else if (now > graceTime && now < fivePMThirty) attendanceVal = 2; // Late
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
                WHEN "attendance_StatusId" IS NULL OR "attendance_StatusId" = 3 THEN :attendance_StatusId 
                ELSE "attendance_StatusId" 
             END
         WHERE "user_id" = :target_user_Id AND "log_Date" = :workDate`,
        {
          replacements: { inArr: JSON.stringify(inArr), outArr: JSON.stringify(outArr), reportLoggedStatus, attendance_StatusId: attendanceVal, target_user_Id, workDate },
          type: QueryTypes.UPDATE,
        },
      );
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

    const statusLabels = { 1: "Clock In", 2: "Clock Out", 3: "Out For Lunch", 4: "In From Lunch", 5: "Overtime-In", 6: "Overtime-Out" };
    const attendanceResult = attendanceVal === 1 ? "On-Time" : attendanceVal === 2 ? "Late" : "N/A";
    const esp32Ip = req.ip || req.socket.remoteAddress || "Unknown ESP32";

    // 6. Log Transaction
    const method = action === "fingerprint_scan" ? "Fingerprint" : "RFID";
    const isSuspicious = isLateNightFirstIn || isUnauthorizedReEntry || isPastOTEntry;
    
    if (isSuspicious) {
      await logTransaction(target_user_Id, null, "ATTENDANCE_LOG_SUSPICIOUS", `Suspicious ${statusLabels[nextStatus]} at ${timeStr}`, { 
        status: statusLabels[nextStatus], 
        time: timeStr, 
        method: method,
        deviceIp: esp32Ip
      }, req);
    } else {
      await logTransaction(target_user_Id, null, `${method.toUpperCase()}_SCAN`, `${statusLabels[nextStatus]} via ${method}`, { 
        uid: action === "fingerprint_scan" ? `Slot ${uid}` : maskUid(uid, true),
        status: statusLabels[nextStatus], 
        time: timeStr,
        role: "Employee",
        result: attendanceResult,
        deviceIp: esp32Ip
      }, req);
    }

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
      `SELECT MAX("user_FingerprintId") AS "maxSlot" FROM "User_Hardware"`,
      { type: QueryTypes.SELECT }
    );
    const maxSlotValue = result[0].maxSlot;
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
    // Initialize a special session type for clearing all fingerprints
    fpCaptureSession = { 
      isCapturing: true, 
      scannedSlot: 0, 
      userId: "SYSTEM_RESET",
      expiresAt: Date.now() + 30000, // 30s timeout
      success: false,
      template: null,
      type: "CLEAR_ALL"
    };

    console.log(`[HARDWARE] Factory reset session initialized. Waiting for ESP32 polling...`);
    
    res.status(200).json({ message: "Hardware reset command queued. Ensure the ESP32 is online." });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize hardware reset." });
  }
};

exports.getFingerprintSession = async (req, res) => {
  // Update heartbeat
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
            `SELECT MAX("user_FingerprintId") AS "maxSlot" FROM "User_Hardware"`,
            { type: QueryTypes.SELECT }
          );
          const nextSlot = (result[0].maxSlot ? parseInt(result[0].maxSlot) : 0) + 1;

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

    if (success && template) {
      // Check for deduplication signal from ESP32
      if (template.startsWith("DUPLICATE:")) {
        const duplicateSlotId = template.split(":")[1];
        console.log(`[FP-CONFIRM] Duplicate detected! Slot: ${duplicateSlotId}`);
        
        fpCaptureSession.success = false;
        fpCaptureSession.isCapturing = false;

        try {
          const [existingUser] = await sequelize.query(
            `SELECT u."user_FirstName", u."user_LastName" 
             FROM "User" u
             INNER JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
             WHERE h."user_FingerprintId" = :slotId AND u."deletedAt" IS NULL`,
            { replacements: { slotId: duplicateSlotId }, type: QueryTypes.SELECT }
          );

          if (existingUser) {
            fpCaptureSession.errorMessage = `This finger is already registered to ${existingUser.user_FirstName} ${existingUser.user_LastName}.`;
          } else {
            fpCaptureSession.errorMessage = "This finger is already registered to another user (Slot " + duplicateSlotId + ").";
          }
        } catch (err) {
          fpCaptureSession.errorMessage = "Duplicate fingerprint detected.";
        }
        return res.status(200).json({ success: true });
      }

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
              `INSERT INTO "User_Hardware" ("user_Id", "user_MachipId", "createdAt", "updatedAt")
               VALUES (:targetUserId, :template, :now, :now)
               ON CONFLICT ("user_Id") DO UPDATE SET
                "user_MachipId" = EXCLUDED."user_MachipId",
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
    const isCurrentlyIn = lastStatus === 1 || lastStatus === 4 || lastStatus === 5;

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
  
  console.log(`[VISITOR] Triggered by Admin: ${adminId}`);
  
  visitorAccessSession = {
    isPending: true,
    expiresAt: Date.now() + 30000, 
    adminId: adminId
  };

  try {
    const now = await getSystemTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const timeStr = now.toTimeString().split(" ")[0];

    await sequelize.query(
      `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId")
       VALUES (999, :log_Date, :time_Logged, 8)`,
      {
        replacements: { log_Date: todayStart, time_Logged: timeStr },
        type: QueryTypes.INSERT
      }
    );

    const io = getIO();
    io.emit("OPEN_DOOR", { type: "VISITOR", adminId });
    io.emit("NEW_ATTENDANCE_LOG", { userId: 999, status: "Visitor Access: Opening" });

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
