const { sequelize, Notification, User } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("../utils/systemTime.js");
const { logAudit, logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");

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
    const isLunchWindow = totalMinutes >= 690 && totalMinutes < 810; // 11:30 AM to 1:30 PM

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
      if (now.getHours() < 9) {
        attendanceVal = 1; // On-Time
      } else if (now < fivePMThirty) {
        attendanceVal = 2; // Late
      } else {
        attendanceVal = 3; // Absent (timed in after shift ended)
      }
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

    // ── AUTO-CANCEL LEAVES IF CLOCKING IN ──────────────────────────────────
    if (nextStatus === 1 || nextStatus === 4) {
      const activeLeaves = await sequelize.query(
        `SELECT er."emp_reqId", er."emp_reqTypeId", vl."NoDays" as "vlDays", sl."NoDays" as "slDays", el."NoDays" as "elDays", hd."NoDays" as "hdDays"
         FROM "emp_Request" er
         LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
         LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
         LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
         LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
         WHERE er."user_Id" = :target_user_Id 
         AND er."emp_reqStatusId" IN (1, 2)
         AND er."emp_reqTypeId" IN (3, 4, 6, 7)
         AND (
           (vl."StartDate" <= :todayStr AND vl."EndDate" >= :todayStr) OR
           (sl."StartDate" <= :todayStr AND sl."EndDate" >= :todayStr) OR
           (el."DateOfLeave" = :todayStr) OR
           (hd."DateOfLeave" = :todayStr)
         )`,
        { replacements: { target_user_Id, todayStr }, type: QueryTypes.SELECT }
      );

      for (const leave of activeLeaves) {
        console.log(`[SYSTEM] Auto-canceling leave #${leave.emp_reqId} for user ${target_user_Id} due to clock-in.`);
        
        // 1. Update status to Canceled (4)
        await sequelize.query(
          `UPDATE "emp_Request" SET "emp_reqStatusId" = 4, "system_remarks" = COALESCE("system_remarks" || ' | ', '') || 'Auto-canceled due to clock-in'
           WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId: leave.emp_reqId }, type: QueryTypes.UPDATE }
        );

        // 2. Refund Balance
        const noDays = leave.vlDays || leave.slDays || leave.elDays || leave.hdDays || 0;
        if (noDays > 0) {
          const balanceField = (leave.emp_reqTypeId === 3 || leave.emp_reqTypeId === 7) ? "VL" : "SL";
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "${balanceField}_balance" = "${balanceField}_balance" + :noDays,
                 "${balanceField}_used" = GREATEST(0, "${balanceField}_used" - :noDays)
             WHERE "user_Id" = :target_user_Id AND "year" = :year`,
            { replacements: { noDays, target_user_Id, year: now.getFullYear() }, type: QueryTypes.UPDATE }
          );
        }

        await Notification.create({
          user_Id: target_user_Id,
          title: "Leave Auto-Canceled",
          message: `Your leave request (#${leave.emp_reqId}) has been automatically canceled because you clocked in today.`,
          isRead: false
        });
      }
    }
    // ───────────────────────────────────────────────────────────────────────

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
      const cleanInArr = isEntry ? [finalTimeStr] : [];
      const cleanOutArr = !isEntry ? [finalTimeStr] : [];

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
            inArr: JSON.stringify(cleanInArr),
            outArr: JSON.stringify(cleanOutArr),
            attendance_StatusId: attendanceVal,
            reportLoggedStatus,
          },
          type: QueryTypes.INSERT,
        },
      );
    } else {
      const inArr  = JSON.parse(existingReport[0].time_Logged_inArr  || "[]").filter(Boolean);
      const outArr = JSON.parse(existingReport[0].time_Logged_outArr || "[]").filter(Boolean);

      if (isEntry && !inArr.includes(finalTimeStr)) inArr.push(finalTimeStr);
      else if (!isEntry && !outArr.includes(finalTimeStr)) outArr.push(finalTimeStr);

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

    // [SOCKET] Trigger real-time UI updates
    const io = getIO();
    io.emit("NEW_ATTENDANCE_LOG", { userId: target_user_Id, status: statusLabels[nextStatus] });
    io.to(`user_${target_user_Id}`).emit("NOTIFICATION_UPDATE");

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
  const { startDate, endDate } = req.query; // Optional filters

  try {
    
    // Fetch logs
    let query = `
      SELECT
         r.*,
         a."statusName" AS "attendanceStatusName",
         l."statusName" AS "loggedStatusName"
       FROM "employee_Logging_report" r
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
               ow."DateonField",
               ot."OT_DateOf", ot."HrFrom", ot."HrTo", ot."Total_Hrs"
        FROM "emp_Request" er
        LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
        LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
        LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
        LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
        WHERE er."user_Id" = :user_Id AND er."emp_reqStatusId" = 2
    `;

    const approvedRequests = await sequelize.query(requestQuery, { 
        replacements: { user_Id }, 
        type: QueryTypes.SELECT 
    });

    const calculateHours = (inArr, outArr, approvedOT, morningIn, afternoonIn, isOnField, ot_In, ot_Out) => {
      if (isOnField) return 8.0;
      if (inArr.length === 0) return 0;

      let totalHrs = 0;

      // 1. Morning Session (Fixed 4.0 hrs minus late deduction)
      if (morningIn && morningIn !== "—") {
        totalHrs += 4.0;
        const [h, m] = morningIn.split(":").map(Number);
        const loginTime = h * 60 + m;
        const gracePeriodEnd = 8 * 60 + 35; // 8:35 AM

        if (loginTime > gracePeriodEnd) {
          totalHrs -= ((loginTime - gracePeriodEnd) / 60);
        }
      }

      // 2. Afternoon Session (Fixed 4.0 hrs, no late deduction)
      if (afternoonIn && afternoonIn !== "—") {
        totalHrs += 4.0;
      }

      // 3. Overtime Validation
      // If OT is approved AND the user actually has OT logs
      if (approvedOT && approvedOT.Total_Hrs && ot_In !== "—" && ot_Out !== "—") {
        const [h1, m1, s1] = ot_In.split(":").map(Number);
        const [h2, m2, s2] = ot_Out.split(":").map(Number);
        
        const inMinutes = h1 * 60 + m1;
        const outMinutes = h2 * 60 + m2;
        
        let actualOTMinutes = outMinutes - inMinutes;
        if (actualOTMinutes < 0) actualOTMinutes += 24 * 60; // Handle midnight crossover
        
        const actualOTHrs = actualOTMinutes / 60;
        const approvedOTHrs = parseFloat(approvedOT.Total_Hrs);
        
        // Credit the minimum of what was approved vs what was actually worked
        totalHrs += Math.min(approvedOTHrs, actualOTHrs);
      }

      return Math.max(0, totalHrs);
    };

    const dailyRows = reports.map((report) => {
      const inArr = JSON.parse(report.time_Logged_inArr || "[]").sort();
      const outArr = JSON.parse(report.time_Logged_outArr || "[]").sort();
      const dateStr = report.log_Date.split('T')[0];

      const dayOT = approvedRequests.find(req => req.emp_reqTypeId === 1 && req.OT_DateOf === dateStr);
      const isOnField = approvedRequests.some(req => req.emp_reqTypeId === 2 && req.DateonField === dateStr);
      
      let morning_In = inArr[0] || "—";
      let morning_Out = "—", afternoon_In = "—", afternoon_Out = "—", ot_In = "—", ot_Out = "—";

      if (isOnField) {
        morning_In = "08:30:00";
        morning_Out = "12:00:00";
        afternoon_In = "13:00:00";
        afternoon_Out = "17:30:00";
      } else {
        let regularIns = [...inArr], regularOuts = [...outArr];
        let overtimeIns = [], overtimeOuts = [];

        if (dayOT) {
          overtimeIns = inArr.filter(t => t >= dayOT.HrFrom);
          overtimeOuts = outArr.filter(t => t >= dayOT.HrFrom);
          regularIns = inArr.filter(t => t < dayOT.HrFrom);
          regularOuts = outArr.filter(t => t < dayOT.HrFrom);
        }

        if (regularOuts.length > 0) {
          if (regularIns.length > 1) {
              morning_Out = regularOuts[0];
              afternoon_In = regularIns[1];
              afternoon_Out = regularOuts[regularOuts.length - 1];
          } else {
              afternoon_Out = regularOuts[regularOuts.length - 1];
          }
        }

        if (overtimeIns.length > 0) ot_In = overtimeIns[0];
        if (overtimeOuts.length > 0) ot_Out = overtimeOuts[overtimeOuts.length - 1];
      }

      const hoursWorked = calculateHours(inArr, outArr, dayOT, morning_In, afternoon_In, isOnField, ot_In, ot_Out);

      // Map for generic table compatibility (History card)
      const time_In = morning_In;
      const lastOut = ot_Out !== "—" ? ot_Out : afternoon_Out;
      const time_Out = lastOut;

      return {
        sessionId: `${report.user_id}-${report.log_Date}`,
        log_Date: report.log_Date,
        morning_In,
        morning_Out,
        afternoon_In,
        afternoon_Out,
        ot_In,
        ot_Out,
        time_In,
        time_Out,
        inArr,
        outArr,
        hoursWorked: hoursWorked.toFixed(2),
        logStatus: report.loggedStatusName,
        attendanceStatus: report.attendanceStatusName || "—",
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

    res.status(200).json({
      attendance: {
        absent: parseInt(attendanceStats[0].absentCount || 0),
        onTime: parseInt(attendanceStats[0].onTimeCount || 0),
        late: parseInt(attendanceStats[0].lateCount || 0),
        monthName: now.toLocaleString('default', { month: 'long' })
      },
      leaveBalance: leaveBalance[0] ? {
        ...leaveBalance[0],
        VL_total: (parseFloat(leaveBalance[0].VL_used) + parseFloat(leaveBalance[0].VL_balance)) || 7,
        SL_total: (parseFloat(leaveBalance[0].SL_used) + parseFloat(leaveBalance[0].SL_balance)) || 7
      } : {
        VL_total: 7, VL_used: 0, VL_balance: 7,
        SL_total: 7, SL_used: 0, SL_balance: 7
      },
      recentLogs: recentLogs.map(log => ({
        date: log.log_Date,
        status: log.attendanceStatus || "—",
        timeIn: JSON.parse(log.time_Logged_inArr || "[]")[0] || "—",
        timeOut: JSON.parse(log.time_Logged_outArr || "[]").pop() || "—"
      })),
      monthlyRequests: recentRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Dashboard Stats ───────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];
    const roleId = req.user?.user_RoleId;
    const currentUserId = req.user?.user_Id;
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

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
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 5) AS "onFieldCount",
         COUNT(*) FILTER (WHERE "time_Logged_inArr" <> '[]') AS "enteredCount",
         COUNT(*) FILTER (WHERE "time_Logged_outArr" <> '[]') AS "exitedCount"
       FROM "employee_Logging_report"
       WHERE "log_Date" = :todayStr`,
      { replacements: { todayStr }, type: QueryTypes.SELECT },
    );

    const yesterdayStats = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 1) AS "onTimeCount",
         COUNT(*) FILTER (WHERE "attendance_StatusId" = 2) AS "lateArrivalsCount"
       FROM "employee_Logging_report"
       WHERE "log_Date" = :yesterdayStr`,
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

    // Projected Monthly Payroll (Sum of all user's dailyRate * 22 days)
    const payrollResult = await sequelize.query(
      `SELECT SUM("dailyRate" * 22) as projected FROM "User" WHERE "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );
    const projectedPayroll = Math.round(parseFloat(payrollResult[0].projected || 0));

    res.status(200).json({
      totalEmployees,
      officeOccupancy: parseInt(stats[0].officeOccupancy || 0),
      onTimeCount: parseInt(stats[0].onTimeCount || 0),
      lateArrivalsCount: parseInt(stats[0].lateArrivalsCount || 0),
      absentCount: parseInt(stats[0].absentCount || 0),
      onLeaveCount: parseInt(stats[0].onLeaveCount || 0),
      onFieldCount: parseInt(stats[0].onFieldCount || 0),
      enteredCount: parseInt(stats[0].enteredCount || 0),
      exitedCount: parseInt(stats[0].exitedCount || 0),
      onTimeChange,
      lateArrivalsChange,
      pendingCount,
      projectedPayroll
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Get Office Occupancy ──────────────────────────────────────────────────────
exports.getOfficeOccupancy = async (req, res) => {
  try {
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

// ── Get Attendance Report Internal ──────────────────────────────────────────
const getAttendanceReportInternal = async (startDate, endDate, user_Id) => {
  let query = `
    SELECT
      r.*,
      u."user_Id" as "actual_user_Id",
      u."user_FirstName",
      u."user_LastName",
      u."user_MachipId",
      a."statusName" AS "attendanceStatusName",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."HrFrom" ELSE NULL END AS "ot_HrFrom",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."HrTo" ELSE NULL END AS "ot_HrTo",
      CASE WHEN er."emp_reqStatusId" = 2 THEN ot."Total_Hrs" ELSE NULL END AS "ot_Total_Hrs"
    FROM "employee_Logging_report" r
    LEFT JOIN "User" u ON u."user_Id" = r."user_id"
    LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
    LEFT JOIN "Overtime_Request" ot ON ot."user_Id" = r."user_id" AND ot."OT_DateOf"::date = r."log_Date"::date
    LEFT JOIN "emp_Request" er ON er."emp_reqId" = ot."emp_reqId"
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

  const calculateHours = (inArr, outArr, approvedOT, morningIn, afternoonIn, isOnField) => {
    if (isOnField) return 8.0;
    if (inArr.length === 0) return 0;

    let totalHrs = 0;

    // 1. Morning Session (Fixed 4.0 hrs minus late deduction)
    if (morningIn && morningIn !== "—") {
      totalHrs += 4.0;
      const [h, m] = morningIn.split(":").map(Number);
      const loginTime = h * 60 + m;
      const gracePeriodEnd = 8 * 60 + 35; // 8:35 AM

      if (loginTime > gracePeriodEnd) {
        totalHrs -= ((loginTime - gracePeriodEnd) / 60);
      }
    }

    // 2. Afternoon Session (Fixed 4.0 hrs, no late deduction)
    if (afternoonIn && afternoonIn !== "—") {
      totalHrs += 4.0;
    }

    // 3. Overtime
    if (approvedOT && approvedOT.Total_Hrs) {
      totalHrs += parseFloat(approvedOT.Total_Hrs);
    }

    return Math.max(0, totalHrs);
  };

  // 2. Fetch ALL approved requests for these users in this period
  const requestQuery = `
      SELECT er."user_Id", er."emp_reqTypeId", 
             vl."StartDate" as "vStart", vl."EndDate" as "vEnd", 
             sl."StartDate" as "sStart", sl."EndDate" as "sEnd", 
             ow."DateonField",
             ot."OT_DateOf", ot."HrFrom", ot."HrTo", ot."Total_Hrs"
      FROM "emp_Request" er
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      WHERE er."emp_reqStatusId" = 2
        AND (
          (er."emp_reqTypeId" = 1 AND ot."OT_DateOf" BETWEEN :startDate AND :endDate) OR
          (er."emp_reqTypeId" = 2 AND ow."DateonField" BETWEEN :startDate AND :endDate) OR
          (er."emp_reqTypeId" = 3 AND (vl."StartDate" <= :endDate AND vl."EndDate" >= :startDate)) OR
          (er."emp_reqTypeId" = 4 AND (sl."StartDate" <= :endDate AND sl."EndDate" >= :startDate))
        )
  `;

  const allApprovedRequests = await sequelize.query(requestQuery, { 
      replacements: { startDate, endDate }, 
      type: QueryTypes.SELECT 
  });

  return reports
    .filter((r) => {
      const dateObj = new Date(r.log_Date);
      const dateStr = r.log_Date.split('T')[0];
      const userReqs = allApprovedRequests.filter(req => req.user_Id === r.user_id);
      
      if (dateObj.getDay() === 0) return true; // Keep Sundays in report data
      
      // Keep all records including Suspicious ones so they can be suggested for OT/Correction
      return true;
    })
    .map((r) => {
      // Robust parsing: Filter out nulls/empties and sort
      const parseLogs = (jsonStr) => {
        try {
          const arr = JSON.parse(jsonStr || "[]");
          return arr.filter(t => t && t !== "—").sort();
        } catch (e) { return []; }
      };

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

      const inArr = parseLogs(r.time_Logged_inArr);
      const outArr = parseLogs(r.time_Logged_outArr);
      const dateStr = formatDateOnly(r.log_Date);
      const dateObj = new Date(r.log_Date);
      
      const userReqs = allApprovedRequests.filter(req => Number(req.user_Id) === Number(r.user_id));
      
      const isOnField = userReqs.some(req => {
        if (Number(req.emp_reqTypeId) !== 2) return false;
        return formatDateOnly(req.DateonField) === dateStr;
      });

      let morning_In = "—", morning_Out = "—", afternoon_In = "—", afternoon_Out = "—", ot_In = "—", ot_Out = "—";
      let hoursWorked = 0;

      if (dateObj.getDay() === 0) {
        // Sunday: Keep all fields empty/dash
      } else if (isOnField) {
        morning_In = "08:30";
        morning_Out = "12:00";
        afternoon_In = "13:00";
        afternoon_Out = "17:30";
        hoursWorked = 8.0;
      } else {
        // Time-based slotting for more accurate display (Aligned with Edit Attendance logic)
        const hasApprovedOT = !!r.ot_HrFrom;
        const otStart = hasApprovedOT ? r.ot_HrFrom : "23:59:59";

        // Morning Session
        const mInCandidate = inArr.find(t => t.substring(0, 5) < "12:00");
        if (mInCandidate) {
          const [h, m] = mInCandidate.split(":").map(Number);
          morning_In = h < 8 ? "08:00" : mInCandidate.substring(0, 5);
        }
        morning_Out = outArr.find(t => t.substring(0, 5) >= "11:30" && t.substring(0, 5) < "13:30")?.substring(0, 5) || "—";

        // Afternoon Session
        afternoon_In = inArr.find(t => t.substring(0, 5) >= "12:30" && t.substring(0, 5) < otStart)?.substring(0, 5) || "—";
        afternoon_Out = outArr.find(t => t.substring(0, 5) >= "13:30" && t.substring(0, 5) < otStart)?.substring(0, 5) || (hasApprovedOT && afternoon_In !== "—" ? otStart.substring(0, 5) : "—");
        
        // Overtime Session (using joined data)
        if (hasApprovedOT) {
          // OT In defaults to the approved start time
          ot_In = otStart.substring(0, 5);
          // For OT Out, we take the last clock-out if it's after OT Start
          const lastOut = outArr.length > 0 ? outArr[outArr.length - 1].substring(0, 5) : "—";
          ot_Out = lastOut > ot_In ? lastOut : "—";
        }

        hoursWorked = calculateHours(inArr, outArr, { Total_Hrs: r.ot_Total_Hrs }, morning_In, afternoon_In, isOnField);
      }

      // Determine absolute first in and last out for standard report table
      let time_In = "—";
      let time_Out = "—";

      if (isOnField) {
        time_In = "08:30";
        time_Out = "17:30";
      } else if (inArr.length > 0) {
        const [h, m] = inArr[0].split(":").map(Number);
        time_In = h < 8 ? "08:00" : inArr[0].substring(0, 5);
        
        if (outArr.length > 0) {
          time_Out = outArr[outArr.length - 1].substring(0, 5);
        }
      }

      return {
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
        time_In,
        time_Out,
        inArr,
        outArr,
        hoursWorked: parseFloat(hoursWorked).toFixed(2),
        status: r.attendanceStatusName ?? "—",
        remarks: "",
      };
    });
};

exports.getAttendanceReportInternal = getAttendanceReportInternal;

// ── Get Attendance Report (Filtered) ──────────────────────────────────────────
exports.getAttendanceReport = async (req, res) => {
  const { startDate, endDate, user_Id } = req.query;
  try {
    const data = await getAttendanceReportInternal(startDate, endDate, user_Id);
    res.status(200).json(data);
  } catch (error) {
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
    const otStart = hasApprovedOT ? r.ot_HrFrom : "23:59:59";

    const morning_In = inArr.find(t => t.substring(0, 5) < "12:00")?.substring(0, 5) || "";
    const morning_Out = outArr.find(t => t.substring(0, 5) >= "11:30" && t.substring(0, 5) < "13:30")?.substring(0, 5) || "";
    
    const afternoon_In = inArr.find(t => t.substring(0, 5) >= "12:30" && t.substring(0, 5) < otStart)?.substring(0, 5) || "";
    const afternoon_Out = outArr.find(t => t.substring(0, 5) >= "13:30" && t.substring(0, 5) < otStart)?.substring(0, 5) || (hasApprovedOT && afternoon_In ? otStart.substring(0, 5) : "");
    
    // OT In defaults to the approved HrFrom if no specific log exists at that time
    const ot_In = hasApprovedOT ? (inArr.find(t => t.substring(0, 5) >= otStart)?.substring(0, 5) || otStart.substring(0, 5)) : "";
    const ot_Out = hasApprovedOT ? (outArr.find(t => t.substring(0, 5) >= otStart)?.substring(0, 5) || "") : "";

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
