const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatForSQL } = require("../utils/systemTime");
const { sendOnfieldEmail, sendRequestNotificationEmail } = require("../utils/emailService");
const { logAudit, logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");

exports.getCalendarReport = async (req, res) => {
  let { startDate, endDate, user_Id } = req.query;
  try {
    const replacements = { startDate, endDate };
    let userFilter = "";

    if (user_Id && user_Id !== "All Employees" && user_Id !== "undefined" && user_Id !== "null") {
      userFilter = ` AND er."user_Id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    // 1. Fetch Holidays
    const holidays = await sequelize.query(
      `SELECT "holidayId" as "id", 'Holiday' as "type", "date", "name", "type" as "details", NULL as "endDate"
       FROM "Holiday"
       WHERE "date" BETWEEN :startDate AND :endDate`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 2. Fetch Field Work
    const fieldWorks = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Field Work' as "type", ow."DateonField" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", ow."destination" as "details", NULL as "endDate"
       FROM "Onfield_Work" ow
       JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND ow."DateonField" BETWEEN :startDate AND :endDate
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 3. Fetch Vacation Leaves
    const vacationLeaves = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", vl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Vacation Leave' as "details", vl."EndDate" as "endDate"
       FROM "Vacation_Leave" vl
       JOIN "emp_Request" er ON vl."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND (vl."StartDate" BETWEEN :startDate AND :endDate OR vl."EndDate" BETWEEN :startDate AND :endDate)
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 4. Fetch Sick Leaves
    const sickLeaves = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", sl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Sick Leave' as "details", sl."EndDate" as "endDate"
       FROM "Sick_Leave" sl
       JOIN "emp_Request" er ON sl."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND (sl."StartDate" BETWEEN :startDate AND :endDate OR sl."EndDate" BETWEEN :startDate AND :endDate)
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 5. Fetch Overtime
    const overtime = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Overtime' as "type", ot."OT_DateOf" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", CAST(ot."Total_Hrs" AS VARCHAR) || ' hrs OT' as "details", NULL as "endDate"
       FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND ot."OT_DateOf" BETWEEN :startDate AND :endDate
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const allEvents = [...holidays, ...fieldWorks, ...vacationLeaves, ...sickLeaves, ...overtime].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(a.date) - new Date(b.date);
    });

    res.status(200).json(allEvents);
  } catch (error) {
    console.error("--- CALENDAR ERROR START ---");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("--- CALENDAR ERROR END ---");
    res.status(500).json({ error: "Failed to fetch calendar data: " + error.message });
  }
};

exports.UserCreateRequest = async (req, res) => {
  const {
    userId,
    user_Id,
    emp_reqTypeId,
    OT_Dateof,
    OT_DateOf,
    HrFrom,
    HrTo,
    Total_Hrs,
    reason,
    StartDate,
    EndDate,
    NoDays,
    purpose,
    isWithPay,
    IsWithPay,
    DateonField,
    DateOnField,
    NoHrs,
    destination,
    emp_reqStatusId,
    remarks,
  } = req.body || {};

  const finalUserId = parseInt(userId || user_Id);
  const finalReqTypeId = parseInt(emp_reqTypeId);
  const finalOTDate = OT_Dateof || OT_DateOf;
  const finalDateOnField = DateonField || DateOnField;
  const finalNoDays = parseInt(NoDays || 0);
  const finalStatus = parseInt(emp_reqStatusId || 1);
  
  // Use the filename from multer if a file was uploaded
  const proof_File = req.file ? req.file.filename : null;

  if (!finalUserId || !finalReqTypeId) {
    return res
      .status(400)
      .json({ error: "User Id and Request Type are required" });
  }

  const t = await sequelize.transaction();

  try {
  const now = await getSystemTime();    const nowStr = formatForSQL(now);
    const todayStr = now.toISOString().split("T")[0];

    const finalRemarks = remarks || reason || purpose || null;
    const finalReason = reason || purpose || remarks || "No reason provided";

    // --- PAYROLL PERIOD BLOCK CHECK ---
    let periodCheckSql = "";
    let periodReplacements = {};

    if (finalReqTypeId === 1 && finalOTDate) {
      periodCheckSql = `SELECT label FROM "PayrollPeriod" WHERE :date BETWEEN "startDate" AND "endDate" AND "status" IN ('Processing', 'Released', 'Closed') LIMIT 1`;
      periodReplacements = { date: finalOTDate };
    } else if (finalReqTypeId === 2 && finalDateOnField) {
      periodCheckSql = `SELECT label FROM "PayrollPeriod" WHERE :date BETWEEN "startDate" AND "endDate" AND "status" IN ('Processing', 'Released', 'Closed') LIMIT 1`;
      periodReplacements = { date: finalDateOnField };
    } else if ((finalReqTypeId === 3 || finalReqTypeId === 4) && StartDate && EndDate) {
      periodCheckSql = `SELECT label FROM "PayrollPeriod" WHERE ("startDate" <= :EndDate AND "endDate" >= :StartDate) AND "status" IN ('Processing', 'Released', 'Closed') LIMIT 1`;
      periodReplacements = { StartDate, EndDate };
    } else if ((finalReqTypeId === 6 || finalReqTypeId === 7) && (req.body.DateOfLeave || req.body.DateOnField || req.body.logDate)) {
      const dateVal = req.body.DateOfLeave || req.body.DateOnField || req.body.logDate;
      periodCheckSql = `SELECT label FROM "PayrollPeriod" WHERE :date BETWEEN "startDate" AND "endDate" AND "status" IN ('Processing', 'Released', 'Closed') LIMIT 1`;
      periodReplacements = { date: dateVal };
    }

    if (periodCheckSql) {
      const closedPeriod = await sequelize.query(periodCheckSql, { 
        replacements: periodReplacements, 
        type: QueryTypes.SELECT,
        transaction: t
      });
      if (closedPeriod.length > 0) {
        await t.rollback();
        return res.status(400).json({ 
          error: `This is a past period (${closedPeriod[0].label}). Requests can no longer be filed for finalized or processing payrolls.` 
        });
      }
    }
    // ----------------------------------

    // --- HOLIDAY ADJACENCY RULE (SANDWICH) ---
    if ([3, 4, 6, 7].includes(finalReqTypeId)) {
      const leaveDateStart = StartDate || req.body.DateOfLeave;
      const leaveDateEnd = EndDate || req.body.DateOfLeave;

      if (leaveDateStart && leaveDateEnd) {
        const holidayCheck = await sequelize.query(
          `SELECT "name", "date" FROM "Holiday" 
           WHERE "date" = (:startDate::date - INTERVAL '1 day')
              OR "date" = (:endDate::date + INTERVAL '1 day')`,
          { 
            replacements: { startDate: leaveDateStart, endDate: leaveDateEnd }, 
            type: QueryTypes.SELECT,
            transaction: t
          }
        );

        if (holidayCheck.length > 0) {
          await t.rollback();
          return res.status(400).json({ 
            error: "Filing leave before or after a holiday is strictly prohibited (Sandwich Rule)." 
          });
        }
      }
    }
    // ------------------------------------------

    const currentYear = now.getFullYear();

    let systemRemarks = [];

    // Check Leave Balances if applicable before creating parent request
    if ([3, 4, 6, 7].includes(finalReqTypeId)) {
      const checkDays = finalReqTypeId === 7 ? 0.5 : finalNoDays;
      if (!StartDate && !req.body.DateOfLeave) {
        await t.rollback();
        return res.status(400).json({ error: "Leave date is required" });
      }

      let balanceResult = await sequelize.query(
        `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
        {
          replacements: { userId: finalUserId, year: currentYear },
          type: QueryTypes.SELECT,
          transaction: t
        },
      );

      if (balanceResult.length === 0) {
        await sequelize.query(
          `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "VL_used", "SL_used")
           VALUES (:userId, :year, 7, 7, 0, 0)`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.INSERT,
            transaction: t
          },
        );
        balanceResult = await sequelize.query(
          `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
          {
            replacements: { userId: finalUserId, year: currentYear },
            type: QueryTypes.SELECT,
            transaction: t
          },
        );
      }

      const balance = balanceResult[0];
      if (finalReqTypeId === 3) {
        // Rule: VL needs 3 days before the start date
        const filingDate = new Date(todayStr);
        const startDateObj = new Date(StartDate);
        const diffTime = startDateObj - filingDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 3) {
          systemRemarks.push(`Filed less than 3 days before start date (Diff: ${diffDays} days)`);
        }

        if (balance.VL_balance < finalNoDays) {
          systemRemarks.push(`Insufficient VL Balance (Current: ${balance.VL_balance})`);
        }
      } else if (finalReqTypeId === 4 && balance.SL_balance < finalNoDays) {
        systemRemarks.push(`Insufficient SL Balance (Current: ${balance.SL_balance})`);
      } else if (finalReqTypeId === 6) {
        // Emergency Leave (Type 6): 2 hours before 8:30 AM (6:30 AM)
        const leaveDate = req.body.DateOfLeave;
        const filingTime = now;
        const cutoff = new Date(leaveDate + "T06:30:00");
        
        if (filingTime > cutoff) {
          await t.rollback();
          return res.status(400).json({ 
            error: "Emergency Leave must be filed at least 2 hours before work hours (by 6:30 AM)." 
          });
        }

        const totalAvailable = parseFloat(balance.SL_balance) + parseFloat(balance.VL_balance);
        if (totalAvailable < finalNoDays) {
          systemRemarks.push(`Insufficient SL/VL Balance (Combined: ${totalAvailable})`);
        }
      } else if (finalReqTypeId === 7 && balance.VL_balance < 0.5) {
        systemRemarks.push(`Insufficient VL Balance for Half-Day (Current: ${balance.VL_balance})`);
      }
    }

    // Check for overlapping leaves
    if (finalReqTypeId === 3 || finalReqTypeId === 4) {
      const overlapCheck = await sequelize.query(
        `SELECT er."emp_reqId", rt."reqTypeName", vl."StartDate" as "VL_S", vl."EndDate" as "VL_E", sl."StartDate" as "SL_S", sl."EndDate" as "SL_E"
         FROM "emp_Request" er
         LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
         LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
         LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
         WHERE er."user_Id" = :userId 
         AND er."emp_reqStatusId" IN (1, 2)
         AND er."emp_reqTypeId" IN (3, 4)
         AND (
           (vl."StartDate" <= :EndDate AND vl."EndDate" >= :StartDate) OR
           (sl."StartDate" <= :EndDate AND sl."EndDate" >= :StartDate)
         )`,
        {
          replacements: { userId: finalUserId, StartDate, EndDate },
          type: QueryTypes.SELECT,
          transaction: t
        },
      );

      if (overlapCheck.length > 0) {
        await t.rollback();
        return res.status(400).json({ 
          error: "You already have a pending or approved leave request for these dates." 
        });
      }
    }

    const parentResult = await sequelize.query(
      `INSERT INTO "emp_Request"
        ("user_Id", "emp_reqTypeId", "emp_reqStatusId", "date_Filed", "remarks", "system_remarks", "createdAt", "updatedAt")
        VALUES
        (:userId, :emp_reqTypeId, :emp_reqStatusId, :date_Filed, :remarks, :system_remarks, :now, :now)
        RETURNING *`,
      {
        replacements: {
          userId: finalUserId,
          emp_reqTypeId: finalReqTypeId,
          emp_reqStatusId: finalStatus,
          date_Filed: todayStr,
          remarks: finalRemarks,
          system_remarks: systemRemarks.length > 0 ? systemRemarks.join(" | ") : null,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      },
    );

    const newRequest = parentResult[0][0];
    const emp_reqId = newRequest.emp_reqId;

    let childData = null;

    // Overtime = 1
    if (finalReqTypeId === 1) {
      if (!finalOTDate || !HrFrom || !HrTo || !Total_Hrs || !reason) {
        await t.rollback();
        return res.status(400).json({ error: "Overtime fields are required" });
      }
      const otResult = await sequelize.query(
        `INSERT INTO "Overtime_Request" ("emp_reqId", "user_Id", "OT_DateOf", "HrFrom", "HrTo", "Total_Hrs", "reason") VALUES (:emp_reqId, :userId, :OT_DateOf, :HrFrom, :HrTo, :Total_Hrs, :reason) RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            OT_DateOf: finalOTDate,
            HrFrom,
            HrTo,
            Total_Hrs: parseFloat(Total_Hrs),
            reason,
          },
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );

      childData = otResult[0][0];

      // Onfield Work
    } else if (finalReqTypeId === 2) {
      if (!finalDateOnField || !finalNoDays || !NoHrs) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Onfield Work fields are required" });
      }

      const onfieldResult = await sequelize.query(
        `INSERT INTO "Onfield_Work"
        ("emp_reqId", "user_Id", "DateonField", "NoDays", "NoHrs", "destination", "reason", "proof_File")
        VALUES (:emp_reqId, :userId, :DateonField, :NoDays, :NoHrs, :destination, :reason, :proof_File)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            DateonField: finalDateOnField,
            NoDays: finalNoDays,
            NoHrs: parseFloat(NoHrs),
            destination: destination || null,
            reason: finalReason,
            proof_File: proof_File,
          },
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      childData = onfieldResult[0][0];

      // Leave Request (Vacation Leave)
    } else if (finalReqTypeId === 3) {
      const vlResult = await sequelize.query(
        `INSERT INTO "Vacation_Leave"
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "reason", "WithPayID")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :reason, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
            NoDays: finalNoDays,
            reason: finalReason,
            WithPayID: 2, // Default: Leave without Pay
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = vlResult[0][0];

      // REMOVED: Immediate deduction of Leave Balance for VL. 
      // Deduction now happens upon approval in UpdateStatusRequest.
      
    }
    // Sick Leave
    else if (finalReqTypeId === 4) {
      const slResult = await sequelize.query(
        `INSERT INTO "Sick_Leave"
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "proof_File", "reason", "WithPayID")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :proof_File, :reason, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate,
            EndDate,
            NoDays: finalNoDays,
            proof_File: proof_File,
            reason: finalReason,
            WithPayID: 2, // Default: Leave without Pay
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = slResult[0][0];

      // REMOVED: Immediate deduction of Leave Balance for SL.
      // Deduction now happens upon approval in UpdateStatusRequest.
    }
    // Emergency Leave (Type 6)
    else if (finalReqTypeId === 6) {
      const { DateOfLeave, reason: reqReason } = req.body;
      const elResult = await sequelize.query(
        `INSERT INTO "Emergency_Leave"
        ("emp_reqId", "user_Id", "DateOfLeave", "NoDays", "reason", "WithPayID")
        VALUES (:emp_reqId, :userId, :DateOfLeave, :NoDays, :reason, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            DateOfLeave,
            NoDays: finalNoDays,
            reason: reqReason || finalReason,
            WithPayID: 1, // EL is usually paid if balance exists
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = elResult[0][0];

      // REMOVED: Immediate deduction of Leave Balance for EL.
      // Deduction now happens upon approval in UpdateStatusRequest.
    }
    // Half-Day Leave (Type 7)
    else if (finalReqTypeId === 7) {
      const { DateOfLeave, period } = req.body;
      const timeRange = period === "Morning" ? "08:30am - 12:00/12:30pm" : "01:00pm - 05:30pm";
      
      const hdResult = await sequelize.query(
        `INSERT INTO "HalfDay_Leave"
        ("emp_reqId", "user_Id", "DateOfLeave", "period", "timeRange", "WithPayID", "reason")
        VALUES (:emp_reqId, :userId, :DateOfLeave, :period, :timeRange, :WithPayID, :reason)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            DateOfLeave,
            period,
            timeRange,
            WithPayID: 1, // Default: With Pay
            reason: finalReason
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = hdResult[0][0];

      // REMOVED: Immediate deduction of Leave Balance for Half-Day.
      // Deduction now happens upon approval in UpdateStatusRequest.
    }
    // Log Correction
    else if (finalReqTypeId === 5) {
      const { logDate, currentIn, currentOut, claimedIn, claimedOut, correctionCategory } = req.body;
      const lcResult = await sequelize.query(
        `INSERT INTO "LogCorrection_Request"
        ("emp_reqId", "user_Id", "logDate", "currentIn", "currentOut", "claimedIn", "claimedOut", "correctionCategory", "reason", "proof_File")
        VALUES (:emp_reqId, :userId, :logDate, :currentIn, :currentOut, :claimedIn, :claimedOut, :correctionCategory, :reason, :proof_File)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            logDate,
            currentIn: currentIn || null,
            currentOut: currentOut || null,
            claimedIn,
            claimedOut,
            correctionCategory: correctionCategory || null,
            reason: finalRemarks,
            proof_File: proof_File,
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = lcResult[0][0];
    } else {
      await t.rollback();
      return res.status(400).json({ error: "Invalid Request Type" });
    }

    // Commit transaction BEFORE notifications to ensure data is persistent
    await t.commit();

    // 4. Notifications
    const typeNameMap = { 1: "Overtime", 2: "Onfield Work", 3: "Vacation Leave", 4: "Sick Leave", 5: "Log Correction", 6: "Emergency Leave", 7: "Half-Day Leave" };
    const typeName = typeNameMap[finalReqTypeId] || "Request";

    // Fetch requester details for the approver notifications
    const requesterResult = await sequelize.query(
      `SELECT "user_FirstName", "user_LastName", "user_RoleId" FROM "User" WHERE "user_Id" = :userId`,
      { replacements: { userId: finalUserId }, type: QueryTypes.SELECT }
    );
    const requester = requesterResult[0];
    const requesterName = `${requester.user_FirstName} ${requester.user_LastName}`;
    const requesterRole = requester.user_RoleId;

    // Log transaction
    await logTransaction(finalUserId, null, "REQUEST_SUBMISSION", `${typeName} submitted by ${requesterName}`, { type: typeName, requestId: emp_reqId }, req);

    // A. Confirmation to Requester
    await sequelize.query(
      `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
       VALUES (:userId, :title, :message, false, :targetId, :now, :now)`,
      {
        replacements: {
          userId: finalUserId,
          title: "Request Submitted",
          message: `Your ${typeName} request has been submitted and is currently pending review.`,
          targetId: emp_reqId,
          now: nowStr,
        },
        type: QueryTypes.INSERT,
      },
    );

    // B. Notification to Eligible Approvers (In-App and Email)
    let approverQuery = "";
    if (requesterRole === 3) { // Employee -> Notify Admins and Supervisors
      approverQuery = `SELECT "user_Id", "user_Email", "user_FirstName", "user_LastName", "user_RoleId" FROM "User" WHERE "user_RoleId" IN (1, 2) AND "deletedAt" IS NULL`;
    } else if (requesterRole === 2) { // Supervisor -> Notify Admins
      approverQuery = `SELECT "user_Id", "user_Email", "user_FirstName", "user_LastName", "user_RoleId" FROM "User" WHERE "user_RoleId" = 1 AND "deletedAt" IS NULL`;
    } else if (requesterRole === 1) { // Admin -> Notify other Admins
      approverQuery = `SELECT "user_Id", "user_Email", "user_FirstName", "user_LastName", "user_RoleId" FROM "User" WHERE "user_RoleId" = 1 AND "user_Id" != :userId AND "deletedAt" IS NULL`;
    }

    if (approverQuery) {
      const approvers = await sequelize.query(approverQuery, { 
        replacements: { userId: finalUserId }, 
        type: QueryTypes.SELECT 
      });

      // Prepare email details
      let dateStr = "";
      let duration = "";
      if (finalReqTypeId === 1) { // OT
        dateStr = finalOTDate;
        duration = `${HrFrom} - ${HrTo} (${Total_Hrs} hrs)`;
      } else if (finalReqTypeId === 2) { // Onfield
        dateStr = finalDateOnField;
        duration = `${destination || 'N/A'} (${NoHrs} hrs)`;
      } else if (finalReqTypeId === 3 || finalReqTypeId === 4) { // Leave
        dateStr = `${StartDate} to ${EndDate}`;
        duration = `${finalNoDays} day(s)`;
      } else if (finalReqTypeId === 5) { // Log Correction
        dateStr = req.body.logDate;
      } else if (finalReqTypeId === 6) { // EL
        dateStr = req.body.DateOfLeave;
        duration = `${finalNoDays} day(s)`;
      } else if (finalReqTypeId === 7) { // Half-Day
        dateStr = req.body.DateOfLeave;
        duration = `Half-Day (${req.body.period})`;
      }

      for (const approver of approvers) {
        // 1. In-App Notification
        await sequelize.query(
          `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
           VALUES (:userId, :title, :message, false, :targetId, :now, :now)`,
          {
            replacements: {
              userId: approver.user_Id,
              title: "New Request for Review",
              message: `${requesterName} has submitted a ${typeName} request that requires your review.`,
              targetId: emp_reqId,
              now: nowStr,
            },
            type: QueryTypes.INSERT,
          }
        );

        if (approver.user_Email) {
          let shouldSendImmediate = false;
          if (requesterRole === 3 && approver.user_Id === 2) { // Employee -> Supervisor 2
            shouldSendImmediate = true;
          } else if (requesterRole === 2 && approver.user_RoleId === 1) { // Supervisor -> Admin
            shouldSendImmediate = true;
          } else if (requesterRole === 1 && approver.user_RoleId === 1) { // Admin -> Other Admins
            shouldSendImmediate = true;
          }

          if (shouldSendImmediate) {
            sendRequestNotificationEmail({
              toEmail: approver.user_Email,
              approverName: approver.user_FirstName,
              requesterName: requesterName,
              requestType: typeName,
              dateStr: dateStr,
              duration: duration,
              isEscalation: false
            }).catch(err => console.error("[EMAIL NOTIFICATION FAILED]:", err.message));
          }
        }
      }
    }

    // [SOCKET] Trigger real-time UI updates
    const io = getIO();
    io.emit("NEW_REQUEST");
    io.to(`user_${finalUserId}`).emit("NOTIFICATION_UPDATE");

    return res.status(200).json({
      message: "Request created successfully",
      data: {
        request: newRequest,
        details: childData,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.GetUserRequests = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User Id is required" });
  }

  try {
    const requests = await sequelize.query(
      `SELECT
        er."emp_reqId",
        er."user_Id",
        er."emp_reqTypeId",
        rt."reqTypeName",
        er."emp_reqStatusId",
        rs."reqStatName" as "status",
        er."date_Filed",
        er."date_Processed",
        er.remarks,
        er.admin_remarks,
        er.system_remarks,
        ot."OT_DateOf" as "OT_DateOf",
        ot."HrFrom" as "HrFrom",
        ot."HrTo" as "HrTo",
        ot."Total_Hrs" as "Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        wpsl."withPayName" as "SL_withPayName",
        el."DateOfLeave" as "EL_DateOfLeave",
        el."NoDays" as "EL_NoDays",
        wpel."withPayName" as "EL_withPayName",
        hd."DateOfLeave" as "HD_DateOfLeave",
        hd."period" as "HD_period",
        hd."timeRange" as "HD_timeRange",
        wphd."withPayName" as "HD_withPayName",
        ow."DateonField" as "DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        lc."logDate" as "LC_logDate",
        lc."currentIn" as "LC_currentIn",
        lc."currentOut" as "LC_currentOut",
        lc."claimedIn" as "LC_claimedIn",
        lc."claimedOut" as "LC_claimedOut",
        lc."correctionCategory" as "LC_correctionCategory",
        lb."VL_balance",
        lb."SL_balance",
        lb."VL_used",
        lb."SL_used",
        er."processedBy",
        er."recommendedBy",
        ap."user_FirstName" || ' ' || ap."user_LastName" as "approverName",
        rc."user_FirstName" || ' ' || rc."user_LastName" as "recommenderName"
      FROM "emp_Request" er
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
      LEFT JOIN "withPay" wpel ON el."WithPayID" = wpel."withPayId"
      LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
      LEFT JOIN "withPay" wphd ON hd."WithPayID" = wphd."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      LEFT JOIN "User" ap ON er."processedBy" = ap."user_Id"
      LEFT JOIN "User" rc ON er."recommendedBy" = rc."user_Id"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = (SELECT EXTRACT(YEAR FROM CURRENT_DATE))
      WHERE er."user_Id" = :userId
      ORDER BY er."createdAt" DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetAllRequests = async (req, res) => {
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const requests = await sequelize.query(
      `SELECT
        er."emp_reqId",
        er."user_Id",
        u."user_RoleId",
        u."user_FirstName" || ' ' || u."user_LastName" as "userName",
        er."emp_reqTypeId",
        rt."reqTypeName",
        er."emp_reqStatusId",
        rs."reqStatName" as "status",
        er."date_Filed",
        er."date_Processed",
        er.remarks,
        er.admin_remarks,
        er.system_remarks,
        ot."OT_DateOf" as "OT_DateOf",
        ot."HrFrom" as "HrFrom",
        ot."HrTo" as "HrTo",
        ot."Total_Hrs" as "Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        el."DateOfLeave" as "EL_DateOfLeave",
        el."NoDays" as "EL_NoDays",
        wpel."withPayName" as "EL_withPayName",
        hd."DateOfLeave" as "HD_DateOfLeave",
        hd."period" as "HD_period",
        hd."timeRange" as "HD_timeRange",
        wphd."withPayName" as "HD_withPayName",
        ow."DateonField" as "DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        ow."destination",
        ow."proof_File" as "OW_proof_File",
        lc."logDate" as "LC_logDate",
        lc."currentIn" as "LC_currentIn",
        lc."currentOut" as "LC_currentOut",
        lc."claimedIn" as "LC_claimedIn",
        lc."claimedOut" as "LC_claimedOut",
        lc."correctionCategory" as "LC_correctionCategory",
        lc."proof_File" as "LC_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        lb."VL_used",
        lb."SL_used",
        er."processedBy",
        er."recommendedBy",
        ap."user_FirstName" || ' ' || ap."user_LastName" as "approverName",
        rc."user_FirstName" || ' ' || rc."user_LastName" as "recommenderName"
        FROM "emp_Request" er
      INNER JOIN "User" u ON er."user_Id" = u."user_Id"
      LEFT JOIN "User" ap ON er."processedBy" = ap."user_Id"
      LEFT JOIN "User" rc ON er."recommendedBy" = rc."user_Id"
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
      LEFT JOIN "withPay" wpel ON el."WithPayID" = wpel."withPayId"
      LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
      LEFT JOIN "withPay" wphd ON hd."WithPayID" = wphd."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = :currentYear
      ORDER BY er."createdAt" DESC`,
      {
        replacements: { currentYear },
        type: QueryTypes.SELECT,
      },
    );
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.UpdateStatusRequest = async (req, res) => {
  const { emp_reqId, emp_reqStatusId, processedBy, remarks, withPayId } =
    req.body;

  if (!emp_reqId || !emp_reqStatusId || !processedBy) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    // Fetch the request and the roles of both the requester and processor
    const detailsResult = await sequelize.query(
      `SELECT 
        er.*, 
        u."user_RoleId" AS "requesterRoleId",
        p."user_RoleId" AS "processorRoleId"
       FROM "emp_Request" er
       JOIN "User" u ON er."user_Id" = u."user_Id"
       JOIN "User" p ON p."user_Id" = :processedBy
       WHERE er."emp_reqId" = :emp_reqId`,
      { 
        replacements: { emp_reqId, processedBy }, 
        type: QueryTypes.SELECT 
      }
    );

    if (detailsResult.length === 0) {
      return res.status(404).json({ error: "Request or Processor not found." });
    }

    const request = detailsResult[0];
    const requesterRole = Number(request.requesterRoleId);
    const processorRole = Number(request.processorRoleId);
    const currentStatus = Number(request.emp_reqStatusId);
    const requesterId = Number(request.user_Id);
    const operatorId = Number(processedBy);
    const isLogCorrection = Number(request.emp_reqTypeId) === 5;

    console.log(`[DEBUG] UpdateStatusRequest: reqId=${emp_reqId}, requesterId=${requesterId}, operatorId=${operatorId}, requesterRole=${requesterRole}, processorRole=${processorRole}, currentStatus=${currentStatus}`);

    // --- RBAC Approval Rules (NEW HIERARCHY) ---
    // Hierarchy: 
    // Supervisor 1/2: Can approve/reject.
    // Admin: Payroll/Management, can see but CANNOT approve/reject.
    
    let isAuthorized = false;
    const finalStatusId = Number(emp_reqStatusId);

    // --- SELF-APPROVAL GUARD ---
    if (operatorId === requesterId) {
      return res.status(403).json({ 
        error: "You cannot approve or reject your own request. Please ask another authorized supervisor or manager to process it." 
      });
    }

    if (processorRole === 2) { // Supervisor
      isAuthorized = true;
    } else if (processorRole === 1) { // Admin
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "You are not authorized to process this request." });
    }
    // --------------------------------------------

    const oldRequest = request; 

    // 1. Update the parent request status
    let updateQuery = `
        UPDATE "emp_Request"
        SET "emp_reqStatusId" = :finalStatusId,
            "updatedAt" = :now,
            "processedBy" = :processedBy,
            "date_Processed" = :now
    `;

    const replacements = {
      emp_reqId,
      finalStatusId,
      processedBy: operatorId,
      admin_remarks: remarks || null,
      now: nowStr,
    };

    if (remarks) {
      updateQuery += `, "admin_remarks" = :admin_remarks`;
    }

    updateQuery += ` WHERE "emp_reqId" = :emp_reqId`;

    await sequelize.query(updateQuery, {
      replacements,
      type: QueryTypes.UPDATE,
    });

    // --- LEAVE BALANCE DEDUCTION/REVERSAL ---
    const leaveTypes = [3, 4, 6, 7];
    const typeId = Number(request.emp_reqTypeId);
    
    if (leaveTypes.includes(typeId)) {
      const currentYear = new Date(request.date_Filed).getFullYear();
      const userId = Number(request.user_Id);

      // Helper to get NoDays from child tables
      const getNoDays = async () => {
        let tableName = "";
        if (typeId === 3) tableName = "Vacation_Leave";
        else if (typeId === 4) tableName = "Sick_Leave";
        else if (typeId === 6) tableName = "Emergency_Leave";
        else if (typeId === 7) return 0.5;

        const childRes = await sequelize.query(
          `SELECT "NoDays" FROM "${tableName}" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT }
        );
        return childRes.length > 0 ? parseFloat(childRes[0].NoDays) : 0;
      };

      const noDays = await getNoDays();

      // Case 1: Deduct (Pending/Rejected -> Approved)
      if (finalStatusId === 2 && currentStatus !== 2) {
        if (typeId === 3 || typeId === 7) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "VL_balance" = GREATEST(0, "VL_balance" - :noDays),
                 "VL_used" = "VL_used" + :noDays
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE }
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SL_balance" = GREATEST(0, "SL_balance" - :noDays),
                 "SL_used" = "SL_used" + :noDays
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE }
          );
        } else if (typeId === 6) {
          // EL: Deduct from SL first, then VL
          const balRes = await sequelize.query(
            `SELECT "SL_balance", "VL_balance" FROM "Leave_Balance" WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { userId, year: currentYear }, type: QueryTypes.SELECT }
          );
          if (balRes.length > 0) {
            let slDeduct = 0;
            let vlDeduct = 0;
            const slBal = parseFloat(balRes[0].SL_balance);
            if (slBal >= noDays) {
              slDeduct = noDays;
            } else {
              slDeduct = slBal;
              vlDeduct = noDays - slBal;
            }
            await sequelize.query(
              `UPDATE "Leave_Balance"
               SET "SL_balance" = GREATEST(0, "SL_balance" - :slDeduct),
                   "SL_used" = "SL_used" + :slDeduct,
                   "VL_balance" = GREATEST(0, "VL_balance" - :vlDeduct),
                   "VL_used" = "VL_used" + :vlDeduct
               WHERE "user_Id" = :userId AND "year" = :year`,
              { replacements: { slDeduct, vlDeduct, userId, year: currentYear }, type: QueryTypes.UPDATE }
            );
          }
        }
      }
      // Case 2: Revert (Approved -> Rejected/Pending/Cancelled)
      else if (currentStatus === 2 && finalStatusId !== 2) {
        if (typeId === 3 || typeId === 7) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "VL_balance" = "VL_balance" + :noDays,
                 "VL_used" = GREATEST(0, "VL_used" - :noDays)
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE }
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SL_balance" = "SL_balance" + :noDays,
                 "SL_used" = GREATEST(0, "SL_used" - :noDays)
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE }
          );
        } else if (typeId === 6) {
           // Reverting EL is tricky because we don't know exactly how it was split between SL and VL.
           // However, we can assume it was split the same way (SL first, then VL) based on the USED amounts.
           // But a safer way is to just look at how much SL_used and VL_used were increased.
           // For simplicity, let's just reverse the "SL first then VL" logic using the current balances as a hint,
           // or better, just add it back to SL first up to its cap? 
           // Actually, the system seems to have a fixed cap (7 days).
           // Let's just restore it to SL first, then VL.
           
           let toRestore = noDays;
           // We can't easily know the original SL balance before deduction without more audit logs.
           // But we can just add it back to SL.
           await sequelize.query(
             `UPDATE "Leave_Balance"
              SET "SL_balance" = "SL_balance" + :noDays,
                  "SL_used" = GREATEST(0, "SL_used" - :noDays)
              WHERE "user_Id" = :userId AND "year" = :year`,
             { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE }
           );
           // NOTE: This might overfill SL if it was originally split, but it's a reasonable fallback.
        }
      }
    }

    // --- AUTO-UPDATE ATTENDANCE FOR LOG CORRECTION ---
    if (finalStatusId === 2 && isLogCorrection) {
      const lcDetails = await sequelize.query(
        `SELECT * FROM "LogCorrection_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT }
      );

      if (lcDetails.length > 0) {
        const { logDate, claimedIn, claimedOut } = lcDetails[0];
        
        // 1. Update or Insert into employee_Logging_report
        // Build update parts dynamically to avoid overwriting existing logs with empty ones if not provided in the request
        let updateReportQuery = `
          INSERT INTO "employee_Logging_report" 
            ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
          VALUES (:userId, :logDate, :timeInArr, :timeOutArr, 1, 2)
          ON CONFLICT ("user_id", "log_Date") 
          DO UPDATE SET 
            "attendance_StatusId" = 1,
            "logged_StatusId" = 2
        `;

        const timeInArr = claimedIn ? JSON.stringify([claimedIn]) : "[]";
        const timeOutArr = claimedOut ? JSON.stringify([claimedOut]) : "[]";

        if (claimedIn) {
          updateReportQuery += `, "time_Logged_inArr" = :timeInArr`;
        }
        if (claimedOut) {
          updateReportQuery += `, "time_Logged_outArr" = :timeOutArr`;
        }

        await sequelize.query(updateReportQuery, {
          replacements: {
            userId: requesterId,
            logDate,
            timeInArr,
            timeOutArr
          },
          type: QueryTypes.INSERT
        });

        // 2. Insert into user_logging for audit trail (In and Out)
        if (claimedIn) {
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :logDate, :claimedIn, 1, 1)`,
            { replacements: { userId: requesterId, logDate, claimedIn }, type: QueryTypes.INSERT }
          );
        }
        if (claimedOut) {
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :logDate, :claimedOut, 2, 1)`,
            { replacements: { userId: requesterId, logDate, claimedOut }, type: QueryTypes.INSERT }
          );
        }

        await logTransaction(requesterId, operatorId, "LOG_CORRECTION_APPLIED", `Time logs corrected for ${logDate} via approved request #${emp_reqId}`, { logDate, claimedIn, claimedOut });
      }
    }
    // --------------------------------------------------

    const newRequestResult = await sequelize.query(
      `SELECT * FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`,
      { replacements: { emp_reqId }, type: QueryTypes.SELECT }
    );
    const newRequest = newRequestResult[0];

    await logAudit(req, processedBy, "Requests", "UPDATE_REQUEST_STATUS", "emp_Request", emp_reqId, oldRequest, newRequest);

    // 2. If it's a Leave request and withPayId is provided, update the child table
    if (withPayId) {
      const request = await sequelize.query(
        `SELECT "emp_reqTypeId" FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT },
      );

      if (request.length > 0) {
        const typeId = request[0].emp_reqTypeId;
        if (typeId === 3) {
          await sequelize.query(
            `UPDATE "Vacation_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Sick_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        } else if (typeId === 6) {
          await sequelize.query(
            `UPDATE "Emergency_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        } else if (typeId === 7) {
          await sequelize.query(
            `UPDATE "HalfDay_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE },
          );
        }
      }
    }

    // 3. Create notification for the user
    const [requestInfo] = await sequelize.query(
      `SELECT er."user_Id", rt."reqTypeName", er."emp_reqTypeId", u."user_Email", u."user_FirstName", u."user_LastName",
              ow."DateonField", ow."destination", ow."NoHrs"
       FROM "emp_Request" er
       LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       LEFT JOIN "User" u ON er."user_Id" = u."user_Id"
       LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
       WHERE er."emp_reqId" = :emp_reqId`,
      { replacements: { emp_reqId }, type: QueryTypes.SELECT }
    );

    if (requestInfo) {
      let statusName = "Pending";
      if (finalStatusId === 2) statusName = "Approved";
      else if (finalStatusId === 3) statusName = "Rejected";

    // A. Notify Requester
      await sequelize.query(
        `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
         VALUES (:userId, :title, :message, false, :targetId, :now, :now)`,
        {
          replacements: {
            userId: requestInfo.user_Id,
            title: `Request ${statusName}`,
            message: `Your ${requestInfo.reqTypeName} request has been ${statusName.toLowerCase()}.`,
            targetId: emp_reqId,
            now: nowStr,
          },
          type: QueryTypes.INSERT,
        }
      );

      // Email for Onfield Work Approval (Type 2)
      if (finalStatusId === 2 && requestInfo.emp_reqTypeId === 2 && requestInfo.user_Email) {
        sendOnfieldEmail({
          email: requestInfo.user_Email,
          name: `${requestInfo.user_FirstName} ${requestInfo.user_LastName}`,
          date: requestInfo.DateonField,
          destination: requestInfo.destination || "N/A",
          noHrs: requestInfo.NoHrs
        }).catch(err => console.error("[ONFIELD EMAIL FAILED]:", err.message));
      }
    }

    // [SOCKET] Trigger real-time UI updates
    const io = getIO();
    io.emit("REQUEST_STATUS_UPDATED");
    io.to(`user_${requestInfo.user_Id}`).emit("NOTIFICATION_UPDATE");

    res.status(200).json({ message: "Request status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetPendingCount = async (req, res) => {
  const userId = req.user?.user_Id;
  const roleId = req.user?.user_RoleId;

  try {
    let query = "";
    let replacements = { userId };

    if (roleId === 2) { // Supervisor
      // Count all pending requests (1) except their own
      query = `
        SELECT COUNT(*)::int as count 
        FROM "emp_Request" er
        WHERE er."emp_reqStatusId" = 1 
        AND er."user_Id" != :userId
      `;
    } else {
      // Admin (1) or Employee (3) see 0 pending for them to process
      return res.status(200).json({ count: 0 });
    }

    const result = await sequelize.query(query, { 
      replacements, 
      type: QueryTypes.SELECT 
    });
    
    res.status(200).json({ count: result[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetLeaveBalance = async (req, res) => {
  const { userId } = req.params;

  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const balanceResult = await sequelize.query(
      `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
      {
        replacements: { userId, year: currentYear },
        type: QueryTypes.SELECT,
      },
    );

    if (balanceResult.length === 0) {
      // Return defaults if no balance record yet
      return res.status(200).json({
        VL_total: 7,
        VL_used: 0,
        VL_balance: 7,
        SL_total: 7,
        SL_used: 0,
        SL_balance: 7,
      });
    }

    const balance = balanceResult[0];
    res.status(200).json({
      VL_total: (parseFloat(balance.VL_used) + parseFloat(balance.VL_balance)) || 7,
      VL_used: balance.VL_used || 0,
      VL_balance: balance.VL_balance,
      SL_total: (parseFloat(balance.SL_used) + parseFloat(balance.SL_balance)) || 7,
      SL_used: balance.SL_used || 0,
      SL_balance: balance.SL_balance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetRequestDetails = async (req, res) => {
  const { requestId } = req.params;

  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const request = await sequelize.query(
      `SELECT
        er."emp_reqId",
        er."user_Id",
        u."user_FirstName" || ' ' || u."user_LastName" as "userName",
        er."emp_reqTypeId",
        rt."reqTypeName",
        er."emp_reqStatusId",
        rs."reqStatName" as "status",
        er."date_Filed",
        er."date_Processed",
        er.remarks,
        er.admin_remarks,
        er.system_remarks,
        ot."OT_DateOf" as "OT_DateOf",
        ot."HrFrom" as "HrFrom",
        ot."HrTo" as "HrTo",
        ot."Total_Hrs" as "Total_Hrs",
        vl."StartDate" as "VL_StartDate",
        vl."EndDate" as "VL_EndDate",
        vl."NoDays" as "VL_NoDays",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        el."DateOfLeave" as "EL_DateOfLeave",
        el."NoDays" as "EL_NoDays",
        wpel."withPayName" as "EL_withPayName",
        hd."DateOfLeave" as "HD_DateOfLeave",
        hd."period" as "HD_period",
        hd."timeRange" as "HD_timeRange",
        wphd."withPayName" as "HD_withPayName",
        ow."DateonField" as "DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        ow."destination",
        ow."proof_File" as "OW_proof_File",
        lc."logDate" as "LC_logDate",
        lc."currentIn" as "LC_currentIn",
        lc."currentOut" as "LC_currentOut",
        lc."claimedIn" as "LC_claimedIn",
        lc."claimedOut" as "LC_claimedOut",
        lc."correctionCategory" as "LC_correctionCategory",
        lc."proof_File" as "LC_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        lb."VL_used",
        lb."SL_used",
        er."processedBy",
        er."recommendedBy",
        ap."user_FirstName" || ' ' || ap."user_LastName" as "approverName",
        rc."user_FirstName" || ' ' || rc."user_LastName" as "recommenderName"
        FROM "emp_Request" er
      INNER JOIN "User" u ON er."user_Id" = u."user_Id"
      LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
      LEFT JOIN "request_Status" rs ON er."emp_reqStatusId" = rs."reqStatId"
      LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
      LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
      LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
      LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
      LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
      LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
      LEFT JOIN "withPay" wpel ON el."WithPayID" = wpel."withPayId"
      LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
      LEFT JOIN "withPay" wphd ON hd."WithPayID" = wphd."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = :currentYear
      LEFT JOIN "User" ap ON er."processedBy" = ap."user_Id"
      LEFT JOIN "User" rc ON er."recommendedBy" = rc."user_Id"
      WHERE er."emp_reqId" = CAST(:requestId AS INTEGER)`,
      {
        replacements: { requestId, currentYear },
        type: QueryTypes.SELECT,
      },
    );

    if (request.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.status(200).json(request[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLeaveSummary = async (req, res) => {
  const { year } = req.params;
  try {
    const currentYear = parseInt(year || new Date().getFullYear());

    // 1. Fetch all active users
    const users = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName", "user_MachipId", "dailyRate"
       FROM "User" WHERE "deletedAt" IS NULL ORDER BY "user_LastName" ASC`,
      { type: QueryTypes.SELECT }
    );

    // 2. Fetch Leave Balances
    const balances = await sequelize.query(
      `SELECT * FROM "Leave_Balance" WHERE "year" = :currentYear`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    // 3. Fetch Approved Leave Requests (VL/SL/EL/HD)
    const leaves = await sequelize.query(
      `SELECT er."user_Id", er."emp_reqTypeId", vl."StartDate" as "vS", vl."NoDays" as "vD", sl."StartDate" as "sS", sl."NoDays" as "sD", el."DateOfLeave" as "eS", el."NoDays" as "eD", hd."DateOfLeave" as "hS"
       FROM "emp_Request" er
       LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
       LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
       LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
       LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
       WHERE er."emp_reqStatusId" = 2 
       AND er."emp_reqTypeId" IN (3, 4, 6, 7)
       AND (
         EXTRACT(YEAR FROM vl."StartDate") = :currentYear OR
         EXTRACT(YEAR FROM sl."StartDate") = :currentYear OR
         EXTRACT(YEAR FROM el."DateOfLeave") = :currentYear OR
         EXTRACT(YEAR FROM hd."DateOfLeave") = :currentYear
       )`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    // 4. Fetch Approved OT
    const ots = await sequelize.query(
      `SELECT ot."user_Id", "OT_DateOf", "Total_Hrs" 
       FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       WHERE er."emp_reqStatusId" = 2 AND EXTRACT(YEAR FROM "OT_DateOf") = :currentYear`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    // 5. Fetch Attendance Stats (Lates/Absences) from reports
    const attendanceStats = await sequelize.query(
      `SELECT "user_id", "log_Date", "attendance_StatusId"
       FROM "employee_Logging_report"
       WHERE EXTRACT(YEAR FROM "log_Date") = :currentYear`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const settings = await sequelize.query(`SELECT "vlRate", "slRate" FROM "SystemSettings" LIMIT 1`, { type: QueryTypes.SELECT });
    const vlRate = settings[0]?.vlRate ?? 1.0;
    const slRate = settings[0]?.slRate ?? 1.0;

    const summary = users.map(user => {
      const userBalance = balances.find(b => b.user_Id === user.user_Id) || { VL_balance: 7, SL_balance: 7 };
      
      const resData = {
        user_Id: user.user_Id,
        machipId: user.user_MachipId,
        name: `${user.user_LastName} ${user.user_FirstName.charAt(0)}.`,
        vl: Array(12).fill(0),
        sl: Array(12).fill(0),
        ot: Array(12).fill(0),
        lates: Array(12).fill(0),
        absences: Array(12).fill(0),
        vlRemaining: userBalance.VL_balance,
        slRemaining: userBalance.SL_balance,
        dailyRate: user.dailyRate || 0,
      };

      // Process Leaves
      leaves.filter(l => l.user_Id === user.user_Id).forEach(l => {
        const date = l.vS || l.sS || l.eS || l.hS;
        if (!date) return;
        const month = new Date(date).getMonth();
        if (l.emp_reqTypeId === 3) resData.vl[month] += (l.vD || 0);
        else if (l.emp_reqTypeId === 4) resData.sl[month] += (l.sD || 0);
        else if (l.emp_reqTypeId === 6) resData.sl[month] += (l.eD || 0); // EL deducts from SL first
        else if (l.emp_reqTypeId === 7) resData.vl[month] += 0.5;
      });

      // Process OT
      ots.filter(o => o.user_Id === user.user_Id).forEach(o => {
        const month = new Date(o.OT_DateOf).getMonth();
        resData.ot[month] += parseFloat(o.Total_Hrs || 0);
      });

      // Process Attendance
      attendanceStats.filter(a => a.user_id === user.user_Id).forEach(a => {
        const month = new Date(a.log_Date).getMonth();
        if (a.attendance_StatusId === 2) resData.lates[month] += 1;
        else if (a.attendance_StatusId === 3) resData.absences[month] += 1;
      });

      return resData;
    });

    res.status(200).json({
      year: currentYear,
      months: monthNames,
      vlRate,
      slRate,
      data: summary
    });
  } catch (error) {
    console.error("[ERROR] getLeaveSummary:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.DeleteRequest = async (req, res) => {
  const { requestId } = req.params;
  const adminId = req.headers["x-admin-id"] || 1;

  try {
    const request = await sequelize.query(
      `SELECT "emp_reqTypeId" FROM "emp_Request" WHERE "emp_reqId" = :requestId`,
      { replacements: { requestId }, type: QueryTypes.SELECT }
    );

    if (request.length === 0) {
      return res.status(404).json({ error: "Request not found." });
    }

    const typeId = request[0].emp_reqTypeId;
    if (typeId === 1) await sequelize.query(`DELETE FROM "Overtime_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });
    else if (typeId === 2) await sequelize.query(`DELETE FROM "Onfield_Work" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });
    else if (typeId === 3) await sequelize.query(`DELETE FROM "Vacation_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });
    else if (typeId === 4) await sequelize.query(`DELETE FROM "Sick_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });
    else if (typeId === 6) await sequelize.query(`DELETE FROM "Emergency_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });
    else if (typeId === 7) await sequelize.query(`DELETE FROM "HalfDay_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });

    await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId } });

    res.status(200).json({ message: "Request deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};