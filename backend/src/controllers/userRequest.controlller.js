const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const path = require("path");
const { getSystemTime, formatForSQL, formatDateLocal } = require("../utils/systemTime");
const { 
  sendOnfieldEmail, 
  sendRequestNotificationEmail, 
  sendRequestStatusEmail 
} = require("../utils/emailService");
const { logAudit, logTransaction } = require("../utils/logger");
const { getIO } = require("../config/socket");
const { Notification, User } = require("../config/sequelize.js");
const { calculateAmortization, generateSchedule, calculateSSSRatedInterest } = require("../utils/financialHelper");

// ── Notify Supervisor (Escalation) ───────────────────────────────────────────
exports.notifySupervisor = async (req, res) => {
  const { requestId } = req.params;
  try {
    const [request] = await sequelize.query(
      `SELECT er.*, u."user_FirstName", u."user_LastName" 
       FROM "emp_Request" er
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqId" = :requestId`,
      { replacements: { requestId }, type: QueryTypes.SELECT }
    );

    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.emp_reqStatusId !== 1) return res.status(400).json({ error: "Only pending requests can be escalated." });

    const now = await getSystemTime();
    const filedAt = new Date(request.createdAt);
    const diffHrs = (now - filedAt) / 3600000;

    if (diffHrs < 4) {
      return res.status(400).json({ error: `Please wait at least 4 hours before notifying supervisor (Current: ${diffHrs.toFixed(1)} hrs).` });
    }

    const admins = await sequelize.query(
      `SELECT "user_Id", "user_Email" FROM "User" WHERE "user_RoleId" IN (1, 2) AND "deletedAt" IS NULL AND "user_Id" != 999`,
      { type: QueryTypes.SELECT }
    );

    const msg = `Urgent: Request #${requestId} from ${request.user_FirstName} ${request.user_LastName} has been pending for ${diffHrs.toFixed(1)} hours.`;
    
    for (const admin of admins) {
      await Notification.create({
        user_Id: admin.user_Id,
        title: "Pending Request Escalation",
        message: msg,
        isRead: false
      });
    }

    await sequelize.query(
      `UPDATE "emp_Request" SET "last_escalated_at" = :now WHERE "emp_reqId" = :requestId`,
      { replacements: { now: formatForSQL(now), requestId }, type: QueryTypes.UPDATE }
    );

    res.status(200).json({ message: "Supervisors have been notified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Ping Approver (Admin / Accountant Oversight) ───────────────────────────
exports.pingApprover = async (req, res) => {
  const { requestId } = req.params;
  const { adminNote } = req.body || {};
  const currentAdmin = req.user;

  try {
    const requestRows = await sequelize.query(
      `SELECT er.*, rt."reqTypeName", u."user_FirstName", u."user_LastName", u."user_Email", u."department"
       FROM "emp_Request" er
       JOIN "User" u ON er."user_Id" = u."user_Id"
       LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       WHERE er."emp_reqId" = :requestId`,
      { replacements: { requestId }, type: QueryTypes.SELECT }
    );

    if (!requestRows || requestRows.length === 0) {
      return res.status(404).json({ error: "Request not found." });
    }

    const request = requestRows[0];

    // Status 3/4 = Approved, 5 = Rejected, 6 = Cancelled
    if ([3, 4, 5, 6].includes(request.emp_reqStatusId)) {
      return res.status(400).json({ error: "Cannot ping approver for an already finalized request." });
    }

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);

    const senderId = currentAdmin ? parseInt(currentAdmin.user_Id) : 0;

    // Identify target approvers based on current bottleneck status
    let approvers = [];
    if (request.emp_reqStatusId === 1) {
      // Status 1: Waiting for Supervisor / Department Head recommendation
      if (request.department) {
        approvers = await sequelize.query(
          `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email"
           FROM "User"
           WHERE "user_RoleId" = 2 
             AND "department" = :dept 
             AND "deletedAt" IS NULL 
             AND "user_Id" != 999 
             AND "user_Id" != :senderId`,
          { replacements: { dept: request.department, senderId }, type: QueryTypes.SELECT }
        );
      }

      // If no department supervisor found, fall back to any active supervisor
      if (!approvers || approvers.length === 0) {
        approvers = await sequelize.query(
          `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email"
           FROM "User"
           WHERE "user_RoleId" = 2 
             AND "deletedAt" IS NULL 
             AND "user_Id" != 999 
             AND "user_Id" != :senderId`,
          { replacements: { senderId }, type: QueryTypes.SELECT }
        );
      }

      // If still no supervisor in the company, fall back to Admin Managers
      if (!approvers || approvers.length === 0) {
        approvers = await sequelize.query(
          `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email"
           FROM "User"
           WHERE "user_RoleId" = 1 
             AND "deletedAt" IS NULL 
             AND "user_Id" != 999 
             AND "user_Id" != :senderId`,
          { replacements: { senderId }, type: QueryTypes.SELECT }
        );
      }
    } else {
      // Status 2 or others: Waiting for Admin / Accountant Approval
      approvers = await sequelize.query(
        `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email"
         FROM "User"
         WHERE "user_RoleId" IN (1, 4) 
           AND "deletedAt" IS NULL 
           AND "user_Id" != 999 
           AND "user_Id" != :senderId`,
        { replacements: { senderId }, type: QueryTypes.SELECT }
      );

      if (!approvers || approvers.length === 0) {
        approvers = await sequelize.query(
          `SELECT "user_Id", "user_FirstName", "user_LastName", "user_Email"
           FROM "User"
           WHERE "user_RoleId" = 1 
             AND "deletedAt" IS NULL 
             AND "user_Id" != 999 
             AND "user_Id" != :senderId`,
          { replacements: { senderId }, type: QueryTypes.SELECT }
        );
      }
    }

    if (!approvers || approvers.length === 0) {
      return res.status(400).json({ error: "No pending approvers found to ping (all eligible recipients are either inactive or the sender)." });
    }

    let adminName = "Administrator";
    if (senderId) {
      const senderRows = await sequelize.query(
        `SELECT "user_FirstName", "user_LastName" FROM "User" WHERE "user_Id" = :senderId LIMIT 1`,
        { replacements: { senderId }, type: QueryTypes.SELECT }
      );
      if (senderRows && senderRows.length > 0 && senderRows[0].user_FirstName) {
        adminName = `${senderRows[0].user_FirstName} ${senderRows[0].user_LastName || ""}`.trim();
      }
    }

    const reqType = request.reqTypeName || "Request";
    const empName = `${request.user_FirstName} ${request.user_LastName}`;
    const dateFormatted = request.date_Filed ? new Date(request.date_Filed).toLocaleDateString() : new Date().toLocaleDateString();
    const duration = request.Total_Hrs ? `${request.Total_Hrs} hrs` : (request.NoDays ? `${request.NoDays} days` : null);

    const msg = `Attention: ${adminName} has pinged you regarding ${reqType} #${requestId} for ${empName}.${adminNote ? ` Note: "${adminNote}"` : ""}`;

    // 1. Create in-app notifications
    for (const approver of approvers) {
      await Notification.create({
        user_Id: approver.user_Id,
        title: `Pending Action: ${reqType} #${requestId}`,
        message: msg,
        targetId: parseInt(requestId, 10),
        isRead: false
      });
    }

    // 2. Real-time WebSockets
    try {
      const io = getIO();
      if (io) {
        for (const approver of approvers) {
          const notifPayload = {
            title: `Pending Action: ${reqType} #${requestId}`,
            message: msg,
            requestId: parseInt(requestId, 10),
            targetId: parseInt(requestId, 10),
            targetUserId: parseInt(approver.user_Id, 10)
          };
          io.to(`user_${approver.user_Id}`).emit("new_notification", notifPayload);
          io.to(`user_${approver.user_Id}`).emit("NOTIFICATION_UPDATE");
          // Broadcast fallback with targetUserId check
          io.emit("NEW_NOTIFICATION", notifPayload);
        }
      }
    } catch (sockErr) {
      console.warn("[SOCKET PING WARN]:", sockErr.message);
    }

    // 3. Send Email Notifications
    for (const approver of approvers) {
      if (approver.user_Email) {
        try {
          await sendRequestNotificationEmail({
            toEmail: approver.user_Email,
            approverName: `${approver.user_FirstName} ${approver.user_LastName}`,
            requesterName: empName,
            requestType: reqType,
            dateStr: dateFormatted,
            duration,
            isEscalation: true
          });
        } catch (emailErr) {
          console.warn(`[EMAIL PING WARN] for ${approver.user_Email}:`, emailErr.message);
        }
      }
    }

    // 4. Update request timestamp
    await sequelize.query(
      `UPDATE "emp_Request" SET "last_escalated_at" = :now WHERE "emp_reqId" = :requestId`,
      { replacements: { now: nowStr, requestId }, type: QueryTypes.UPDATE }
    );

    // 5. Audit Log
    const adminId = currentAdmin ? currentAdmin.user_Id : 1;
    await logAudit(req, adminId, "Requests Oversight", "PING_APPROVER", "emp_Request", requestId, null, {
      pingedApprovers: approvers.map(a => a.user_Id),
      adminNote: adminNote || null
    });

    return res.status(200).json({
      message: `Reminder successfully sent to ${approvers.length} pending approver(s)!`,
      pingedCount: approvers.length
    });
  } catch (err) {
    console.error("[PING APPROVER ERROR]:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ── Update User Request (Editing) ─────────────────────────────────────────────
exports.UpdateUserRequest = async (req, res) => {
  const { requestId } = req.params;
  const {
    emp_reqTypeId, OT_DateOf, HrFrom, HrTo, Total_Hrs, reason,
    StartDate, EndDate, NoDays, WithPayID, DateonField, NoHrs,
    destination, remarks, resend, modificationReason
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const [request] = await sequelize.query(
      `SELECT er.*, rt."reqTypeName" 
       FROM "emp_Request" er 
       JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       WHERE er."emp_reqId" = :requestId`,
      { replacements: { requestId }, type: QueryTypes.SELECT, transaction: t }
    );

    if (!request) {
      await t.rollback();
      return res.status(404).json({ error: "Request not found." });
    }

    if ([2, 3].includes(request.emp_reqStatusId) && req.user?.user_RoleId !== 1) {
      await t.rollback();
      return res.status(403).json({ error: "Finalized requests (Approved/Rejected) can only be edited by Admins." });
    }

    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const typeId = parseInt(emp_reqTypeId || request.emp_reqTypeId);
    const effectiveReason = reason || remarks || request.remarks || "";
    const effectiveWithPay = WithPayID ? parseInt(WithPayID) : 1;

    let statusId = request.emp_reqStatusId;
    if (resend || request.emp_reqStatusId === 5) statusId = 1;

    await sequelize.query(
      `UPDATE "emp_Request" SET "remarks" = :remarks, "emp_reqStatusId" = :statusId, "updatedAt" = :now WHERE "emp_reqId" = :requestId`,
      { replacements: { remarks: remarks || request.remarks || "", statusId, now: nowStr, requestId }, type: QueryTypes.UPDATE, transaction: t }
    );

    if (typeId === 1) {
      await sequelize.query(
        `UPDATE "Overtime_Request" SET "OT_DateOf" = :OT_DateOf, "HrFrom" = :HrFrom, "HrTo" = :HrTo, "Total_Hrs" = :Total_Hrs, "reason" = :reason WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            OT_DateOf: OT_DateOf || request.OT_DateOf || null, 
            HrFrom: HrFrom || request.HrFrom || null, 
            HrTo: HrTo || request.HrTo || null, 
            Total_Hrs: Total_Hrs || request.Total_Hrs || 0, 
            reason: effectiveReason, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 2) {
      await sequelize.query(
        `UPDATE "Onfield_Work" SET "DateonField" = :DateonField, "NoHrs" = :NoHrs, "destination" = :destination, "reason" = :reason WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            DateonField: DateonField || request.DateonField || null, 
            NoHrs: NoHrs || request.NoHrs || 0, 
            destination: destination || request.destination || "", 
            reason: effectiveReason, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 3) {
      await sequelize.query(
        `UPDATE "Vacation_Leave" SET "StartDate" = :StartDate, "EndDate" = :EndDate, "NoDays" = :NoDays, "reason" = :reason, "WithPayID" = :WithPayID WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            StartDate: StartDate || request.StartDate || null, 
            EndDate: EndDate || request.EndDate || null, 
            NoDays: NoDays || request.NoDays || 1, 
            reason: effectiveReason, 
            WithPayID: effectiveWithPay, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 4) {
      await sequelize.query(
        `UPDATE "Sick_Leave" SET "StartDate" = :StartDate, "EndDate" = :EndDate, "NoDays" = :NoDays, "reason" = :reason, "WithPayID" = :WithPayID WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            StartDate: StartDate || request.StartDate || null, 
            EndDate: EndDate || request.EndDate || null, 
            NoDays: NoDays || request.NoDays || 1, 
            reason: effectiveReason, 
            WithPayID: effectiveWithPay, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 6) {
      await sequelize.query(
        `UPDATE "Emergency_Leave" SET "DateOfLeave" = :StartDate, "NoDays" = :NoDays, "reason" = :reason, "WithPayID" = :WithPayID WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            StartDate: StartDate || request.StartDate || request.DateOfLeave || null, 
            NoDays: NoDays || request.NoDays || 1,
            reason: effectiveReason, 
            WithPayID: effectiveWithPay, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 7) {
      await sequelize.query(
        `UPDATE "HalfDay_Leave" SET "DateOfLeave" = :StartDate, "reason" = :reason, "WithPayID" = :WithPayID, "period" = :period WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            StartDate: StartDate || request.StartDate || request.DateOfLeave || null, 
            reason: effectiveReason, 
            WithPayID: effectiveWithPay, 
            period: req.body.period || request.period || "Morning", 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 5) {
      await sequelize.query(
        `UPDATE "LogCorrection_Request" SET "logDate" = :logDate, "claimedIn" = :claimedIn, "claimedOut" = :claimedOut, "reason" = :reason WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            logDate: req.body.logDate || request.logDate || null, 
            claimedIn: req.body.claimedIn || request.claimedIn || null, 
            claimedOut: req.body.claimedOut || request.claimedOut || null, 
            reason: effectiveReason, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if ([8, 9, 10, 11, 12].includes(typeId)) {
      await sequelize.query(
        `UPDATE "Statutory_Leave" SET "StartDate" = :StartDate, "EndDate" = :EndDate, "NoDays" = :NoDays, "reason" = :reason, "WithPayID" = :WithPayID WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            StartDate: StartDate || request.StartDate || null, 
            EndDate: EndDate || request.EndDate || null, 
            NoDays: NoDays || request.NoDays || 1, 
            reason: effectiveReason, 
            WithPayID: effectiveWithPay, 
            requestId 
          }, 
          transaction: t 
        }
      );
    } else if (typeId === 13 || typeId === 14) {
      const { 
        agency, 
        loanType, 
        amountRequested, 
        monthsToPay, 
        loanReferenceNo, 
        monthlyAmortization, 
        totalOutstandingBalance,
        loanApprovalDate,
        amortizationStartMonth,
        calamityArea,
        pagibigTAV,
        deductionFrequency
      } = req.body;

      let effectiveAmortizationStartMonth = amortizationStartMonth;
      if ((!effectiveAmortizationStartMonth || effectiveAmortizationStartMonth.trim() === "") && (loanApprovalDate || request.loanApprovalDate)) {
        const approvalDate = new Date(loanApprovalDate || request.loanApprovalDate);
        if (!isNaN(approvalDate.getTime())) {
          let monthsToAdd = 1;
          const effAgency = agency || request.agency;
          const effLoanType = loanType || request.loanType;
          if (effAgency === "SSS") {
            monthsToAdd = (effLoanType === "Emergency Loan") ? 6 : 2;
          } else if (effAgency === "Pag-IBIG") {
            monthsToAdd = (effLoanType === "Calamity Loan") ? 4 : 1;
          }
          const startMonth = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + monthsToAdd, 1);
          const yyyy = startMonth.getFullYear();
          const mm = String(startMonth.getMonth() + 1).padStart(2, '0');
          effectiveAmortizationStartMonth = `${yyyy}-${mm}`;
        }
      }

      await sequelize.query(
        `UPDATE "Loan_Request" SET 
          "agency" = :agency, 
          "loanType" = :loanType, 
          "amountRequested" = :amountRequested, 
          "monthsToPay" = :monthsToPay, 
          "loanReferenceNo" = :loanReferenceNo,
          "monthlyAmortization" = :monthlyAmortization,
          "totalOutstandingBalance" = :totalOutstandingBalance,
          "loanApprovalDate" = :loanApprovalDate,
          "amortizationStartMonth" = :amortizationStartMonth,
          "calamityArea" = :calamityArea,
          "pagibigTAV" = :pagibigTAV,
          "deductionFrequency" = :deductionFrequency,
          "updatedAt" = :now 
        WHERE "emp_reqId" = :requestId`,
        { 
          replacements: { 
            agency: agency || request.agency || "SSS", 
            loanType: loanType || request.loanType || "", 
            amountRequested: amountRequested || null, 
            monthsToPay: monthsToPay || null, 
            loanReferenceNo: loanReferenceNo || null,
            monthlyAmortization: monthlyAmortization || null,
            totalOutstandingBalance: totalOutstandingBalance || null,
            loanApprovalDate: loanApprovalDate || null,
            amortizationStartMonth: effectiveAmortizationStartMonth || null,
            calamityArea: calamityArea || null,
            pagibigTAV: pagibigTAV || null,
            deductionFrequency: deductionFrequency || request.deductionFrequency || 'semi-monthly',
            now: nowStr, 
            requestId 
          }, 
          transaction: t 
        }
      );
    }

    // ── Notify Employee ──────────────────────────────────────────────────────
    const notifyMsg = `Your ${request.reqTypeName} request (#${requestId}) has been modified by the admin.${modificationReason ? ` Reason: ${modificationReason}` : ""}`;
    await Notification.create({
      user_Id: request.user_Id,
      title: "Request Modified",
      message: notifyMsg,
      isRead: false
    }, { transaction: t });

    // Send Email
    if (request.user_Email) {
      const dateStr = StartDate ? (EndDate ? `${StartDate} to ${EndDate}` : StartDate) : 
                      OT_DateOf ? OT_DateOf : 
                      logDate ? logDate : 
                      DateonField || "N/A";
      
      const [wp] = await sequelize.query(`SELECT "withPayName" FROM "withPay" WHERE "withPayId" = :WithPayID`, { replacements: { WithPayID }, type: QueryTypes.SELECT, transaction: t });

      sendRequestStatusEmail({
        email: request.user_Email,
        name: `${request.user_FirstName} ${request.user_LastName}`,
        requestType: request.reqTypeName,
        status: "Modified by Admin",
        dateStr,
        reason: modificationReason,
        withPayName: wp?.withPayName
      }).catch(err => console.error("[MOD STATUS EMAIL FAILED]:", err.message));
    }

    await t.commit();

    const io = getIO();
    io.to(`user_${request.user_Id}`).emit("NOTIFICATION_UPDATE");

    res.status(200).json({ message: "Request updated successfully." });
  } catch (err) {
    if (t) await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

exports.getCalendarReport = async (req, res) => {
  let { startDate, endDate, user_Id } = req.query;
  startDate = (startDate && startDate !== "undefined" && startDate !== "null" && startDate !== "") ? startDate : "1970-01-01";
  endDate = (endDate && endDate !== "undefined" && endDate !== "null" && endDate !== "") ? endDate : "2099-12-31";
  try {
    const replacements = { startDate, endDate };
    let userFilter = "";

    if (user_Id && user_Id !== "All Employees" && user_Id !== "undefined" && user_Id !== "null" && user_Id !== "") {
      userFilter = ` AND er."user_Id" = :user_Id`;
      replacements.user_Id = user_Id;
    }

    // 1. Fetch Holidays (Holidays are global)
    const holidays = await sequelize.query(
      `SELECT "holidayId" as "id", 'Holiday' as "type", "date", "name", "type" as "details", NULL as "endDate"
       FROM "Holiday"
       WHERE "date" BETWEEN :startDate AND :endDate`,
      { replacements: { startDate, endDate }, type: QueryTypes.SELECT }
    );

    // 1.5 Fetch Due Dates (Due dates are global)
    const dueDates = await sequelize.query(
      `SELECT "dueDateId" as "id", 'Due Date' as "type", "date", "name", "details", NULL as "endDate"
       FROM "DueDate"
       WHERE "date" BETWEEN :startDate AND :endDate`,
      { replacements: { startDate, endDate }, type: QueryTypes.SELECT }
    );

    // 2. Fetch Field Work
    const fieldWorks = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Field Work' as "type", ow."DateonField" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", ow."destination" as "details", NULL as "endDate", ow."NoHrs" as "hours"
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
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", vl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Vacation Leave' as "details", vl."EndDate" as "endDate", vl."NoDays" as "hours"
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
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", sl."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Sick Leave' as "details", sl."EndDate" as "endDate", sl."NoDays" as "hours"
       FROM "Sick_Leave" sl
       JOIN "emp_Request" er ON sl."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND (sl."StartDate" BETWEEN :startDate AND :endDate OR sl."EndDate" BETWEEN :startDate AND :endDate)
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 4.5 Fetch Emergency Leaves
    const emergencyLeaves = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", el."DateOfLeave" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", 'Emergency Leave' as "details", el."DateOfLeave" as "endDate", el."NoDays" as "hours"
       FROM "Emergency_Leave" el
       JOIN "emp_Request" er ON el."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND el."DateOfLeave" BETWEEN :startDate AND :endDate
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 4.6 Fetch Half-Day Leaves
    const halfDayLeaves = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", hd."DateOfLeave" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", ('Half-Day Leave (' || hd."period" || ')') as "details", hd."DateOfLeave" as "endDate", 0.5 as "hours"
       FROM "HalfDay_Leave" hd
       JOIN "emp_Request" er ON hd."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND hd."DateOfLeave" BETWEEN :startDate AND :endDate
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 4.7 Fetch Statutory Leaves
    const statutoryLeaves = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Leave' as "type", st."StartDate" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", rt."reqTypeName" as "details", st."EndDate" as "endDate", st."NoDays" as "hours"
       FROM "Statutory_Leave" st
       JOIN "emp_Request" er ON st."emp_reqId" = er."emp_reqId"
       JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND (st."StartDate" BETWEEN :startDate AND :endDate OR st."EndDate" BETWEEN :startDate AND :endDate)
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 5. Fetch Overtime
    const overtime = await sequelize.query(
      `SELECT er."emp_reqId" as "id", 'Overtime' as "type", ot."OT_DateOf" as "date", u."user_FirstName" || ' ' || u."user_LastName" as "name", CAST(ot."Total_Hrs" AS TEXT) || ' hrs OT' as "details", NULL as "endDate", ot."Total_Hrs" as "hours"
       FROM "Overtime_Request" ot
       JOIN "emp_Request" er ON ot."emp_reqId" = er."emp_reqId"
       JOIN "User" u ON er."user_Id" = u."user_Id"
       WHERE er."emp_reqStatusId" = 2 
       AND ot."OT_DateOf" BETWEEN :startDate AND :endDate
       ${userFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const allEvents = [...holidays, ...dueDates, ...fieldWorks, ...vacationLeaves, ...sickLeaves, ...emergencyLeaves, ...halfDayLeaves, ...statutoryLeaves, ...overtime].sort((a, b) => {
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
  
  // Handle both single and multiple file uploads (for backward compatibility and new Calamity fields)
  let proof_File = null;
  let damageProof_File = null;

  if (req.file) {
    proof_File = `requestsFiles/${req.file.filename}`;
  } else if (req.files) {
    if (req.files['proofFile'] && req.files['proofFile'].length > 0) {
      proof_File = `requestsFiles/${req.files['proofFile'][0].filename}`;
    }
    if (req.files['damageProofFile'] && req.files['damageProofFile'].length > 0) {
      damageProof_File = `requestsFiles/${req.files['damageProofFile'][0].filename}`;
    }
  }

  if (!finalUserId || !finalReqTypeId) {
    return res
      .status(400)
      .json({ error: "User Id and Request Type are required" });
  }

  const t = await sequelize.transaction();

  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const todayStr = formatDateLocal(now);

    const rawRemarks = remarks || reason || purpose || null;
    const rawReason = reason || purpose || remarks || "No reason provided";

    const finalRemarks = Array.isArray(rawRemarks) ? rawRemarks[0] : rawRemarks;
    const finalReason = Array.isArray(rawReason) ? rawReason[0] : rawReason;

    // --- LOAN-SPECIFIC REMARKS ENHANCEMENT ---
    let enhancedRemarks = finalRemarks;
    if (finalReqTypeId === 14 && req.body.agency === "Pag-IBIG" && req.body.loanType === "Calamity Loan") {
       enhancedRemarks = `Pag-IBIG Calamity Loan for ${req.body.calamityArea}. ${finalRemarks || ""}`;
    }

    let systemRemarks = [];

    // --- HOLIDAY ADJACENCY & INTERVENING RULE (SANDWICH RULE) ---
    // Applies strictly to discretionary company leaves: Vacation (3) and Half-day (7).
    // Emergency Leave (6), statutory leaves (8-12), and Sick Leave (4) are strictly exempt.
    if ([3, 7].includes(finalReqTypeId)) {
      const leaveDateStart = StartDate || req.body.DateOfLeave;
      const leaveDateEnd = EndDate || req.body.DateOfLeave;

      if (leaveDateStart && leaveDateEnd) {
        // Query holidays in a 4-day window around the leave period to catch intervening and weekend-adjacent holidays
        const holidaysNear = await sequelize.query(
          `SELECT "name", "date", "type" FROM "Holiday" 
           WHERE "date" >= (:startDate::date - INTERVAL '4 days')
             AND "date" <= (:endDate::date + INTERVAL '4 days')
           ORDER BY "date" ASC`,
          { 
            replacements: { startDate: leaveDateStart, endDate: leaveDateEnd }, 
            type: QueryTypes.SELECT,
            transaction: t
          }
        );

        if (holidaysNear.length > 0) {
          const sDateStr = (typeof leaveDateStart === "string" ? leaveDateStart : leaveDateStart.toISOString()).split("T")[0];
          const eDateStr = (typeof leaveDateEnd === "string" ? leaveDateEnd : leaveDateEnd.toISOString()).split("T")[0];
          const sDateObj = new Date(sDateStr + "T00:00:00");
          const eDateObj = new Date(eDateStr + "T00:00:00");

          // 1. Intervening holidays (falling within requested leave range)
          const interveningHolidays = holidaysNear.filter(h => {
            const hDate = typeof h.date === "string" ? h.date.split("T")[0] : new Date(h.date).toISOString().split("T")[0];
            return hDate >= sDateStr && hDate <= eDateStr;
          });

          if (interveningHolidays.length > 0) {
            const holDetails = interveningHolidays
              .map(h => {
                const hd = typeof h.date === "string" ? h.date.split("T")[0] : new Date(h.date).toISOString().split("T")[0];
                return `${h.name} (${hd}) [${h.type}]`;
              })
              .join(", ");
            systemRemarks.push(
              `Warning: Leave period spans official holiday(s): ${holDetails}. Holiday pay and leave balance deduction policy applies (Sandwich Rule).`
            );
          }

          // 2. Adjacent holidays (before start or after end, accounting for weekends)
          const nonIntervening = holidaysNear.filter(h => {
            const hDate = typeof h.date === "string" ? h.date.split("T")[0] : new Date(h.date).toISOString().split("T")[0];
            return hDate < sDateStr || hDate > eDateStr;
          });

          for (const h of nonIntervening) {
            const hDate = typeof h.date === "string" ? h.date.split("T")[0] : new Date(h.date).toISOString().split("T")[0];
            const hDateObj = new Date(hDate + "T00:00:00");
            const diffBeforeDays = Math.round((sDateObj - hDateObj) / (1000 * 60 * 60 * 24));
            const diffAfterDays = Math.round((hDateObj - eDateObj) / (1000 * 60 * 60 * 24));

            // Check preceding adjacency:
            // If startDate is Monday (1), preceding working day was Friday (3 days), Saturday (2 days), or Sunday (1 day)
            // If startDate is Sunday (0), preceding was Saturday (1 day) or Friday (2 days)
            // Otherwise, preceding day is 1 day before
            let isPrecedingAdjacent = false;
            const startDayOfWeek = sDateObj.getDay();
            if (diffBeforeDays === 1) {
              isPrecedingAdjacent = true;
            } else if (startDayOfWeek === 1 && (diffBeforeDays === 2 || diffBeforeDays === 3)) {
              isPrecedingAdjacent = true;
            } else if (startDayOfWeek === 0 && diffBeforeDays === 2) {
              isPrecedingAdjacent = true;
            }

            // Check following adjacency:
            // If endDate is Friday (5), following working day is Monday (3 days) or weekend (1-2 days)
            // If endDate is Saturday (6), following is Monday (2 days) or Sunday (1 day)
            // Otherwise, following day is 1 day after
            let isFollowingAdjacent = false;
            const endDayOfWeek = eDateObj.getDay();
            if (diffAfterDays === 1) {
              isFollowingAdjacent = true;
            } else if (endDayOfWeek === 5 && (diffAfterDays === 2 || diffAfterDays === 3)) {
              isFollowingAdjacent = true;
            } else if (endDayOfWeek === 6 && diffAfterDays === 2) {
              isFollowingAdjacent = true;
            }

            if (isPrecedingAdjacent) {
              systemRemarks.push(
                `Warning: Leave is adjacent to preceding official holiday: ${h.name} (${hDate}) [${h.type}]. Sandwich Rule applies.`
              );
            } else if (isFollowingAdjacent) {
              systemRemarks.push(
                `Warning: Leave is adjacent to following official holiday: ${h.name} (${hDate}) [${h.type}]. Sandwich Rule applies.`
              );
            }
          }
        }
      }
    }
    // ------------------------------------------
    const currentYear = now.getFullYear();

    // --- STATUTORY ELIGIBILITY CHECKS ---
    if ([8, 9, 10, 11, 12].includes(finalReqTypeId)) {
      const userRes = await sequelize.query(
        `SELECT "user_Gender", "civil_status", "is_solo_parent", "hireDate" FROM "User" WHERE "user_Id" = :userId`,
        { replacements: { userId: finalUserId }, type: QueryTypes.SELECT, transaction: t }
      );
      const user = userRes[0] || {};
      const userGender = (user.user_Gender || "").trim().toLowerCase();
      const civilStatus = (user.civil_status || "").trim().toLowerCase();
      const isSoloParent = Boolean(user.is_solo_parent === true || user.is_solo_parent === "true" || user.is_solo_parent === 1 || user.is_solo_parent === "1");

      if (finalReqTypeId === 8 && userGender !== "female") {
        await t.rollback();
        console.log(`[MATERNITY-DEBUG-ERROR] User ID ${finalUserId} failed Maternity eligibility: Gender is ${user.user_Gender}`);
        return res.status(400).json({ error: "Only female employees are eligible for Maternity Leave." });
      }

      // --- NEW: Maternity Leave DOLE Logic ---
      if (finalReqTypeId === 8) {
        const maxDays = isSoloParent ? 120 : 105;
        if (finalNoDays > maxDays) {
          await t.rollback();
          console.log(`[MATERNITY-DEBUG-ERROR] User ID ${finalUserId} requested ${finalNoDays} days, exceeding max ${maxDays} days.`);
          return res.status(400).json({ 
            error: `Maternity leave duration cannot exceed ${maxDays} days (${isSoloParent ? '105 days + 15 days Solo Parent' : '105 days'}). For miscarriage, please file for 60 days.` 
          });
        }

        // Tenure Check (6 Months) - Warning Only
        const hireDate = new Date(user.hireDate);
        const tenureMonths = (new Date(todayStr) - hireDate) / (1000 * 60 * 60 * 24 * 30.44);
        if (tenureMonths < 6) {
          systemRemarks.push(`Warning: Employee has only rendered ${tenureMonths.toFixed(1)} months of service. DOLE Maternity leave typically requires 6 months. HR manual verification recommended.`);
        }

        // SSS 3-Month Check
        const leaveStart = StartDate || req.body.DateOfLeave;
        if (leaveStart) {
          const sssCheck = await sequelize.query(
            `SELECT COUNT(DISTINCT p."periodId") as sss_count
             FROM "Payroll" p
             JOIN "Payroll_Deductions" pd ON p."payrollId" = pd."payrollId"
             WHERE p."user_Id" = :userId 
             AND p."period_Start" >= (:leaveStart::date - INTERVAL '12 months')
             AND p."period_Start" < :leaveStart::date
             AND pd."SSS_Ded" > 0`,
            {
              replacements: { userId: finalUserId, leaveStart },
              type: QueryTypes.SELECT,
              transaction: t
            }
          );

          const sssCount = parseInt(sssCheck[0].sss_count || 0);
          if (sssCount < 3) {
            systemRemarks.push(`Warning: Only ${sssCount} SSS contribution(s) found in the system for the 12 months prior to the leave start date. DOLE requires at least 3. HR manual verification required.`);
          }
        }
      }
      // ----------------------------------------

      if (finalReqTypeId === 9) {
        if (userGender !== "male" || civilStatus !== "married") {
          await t.rollback();
          console.log(`[PATERNITY-DEBUG-ERROR] User ID ${finalUserId} failed Paternity eligibility: Gender ${user.user_Gender}, Status ${user.civil_status}`);
          return res.status(400).json({ error: "Only married male employees are eligible for Paternity Leave (RA 8187)." });
        }
        
        const maxPaternityDays = 7;
        if (finalNoDays > maxPaternityDays) {
          await t.rollback();
          return res.status(400).json({ error: `Paternity leave cannot exceed ${maxPaternityDays} days for each delivery.` });
        }

        systemRemarks.push("Note: Paternity leave is valid for the first 4 deliveries of the legitimate spouse only. HR to verify delivery count.");
      }

      if (finalReqTypeId === 10) {
        if (!isSoloParent) {
          await t.rollback();
          console.log(`[SOLO-PARENT-DEBUG-ERROR] User ID ${finalUserId} failed: is_solo_parent is false.`);
          return res.status(400).json({ error: "You must be registered as a Solo Parent to avail of this leave." });
        }

        const maxSoloParentDays = 7;
        if (finalNoDays > maxSoloParentDays) {
          await t.rollback();
          return res.status(400).json({ error: `Solo Parent leave cannot exceed ${maxSoloParentDays} days per year (RA 11861).` });
        }
      }

      if (finalReqTypeId === 11) {
        if (userGender !== "female") {
          await t.rollback();
          console.log(`[VAWC-DEBUG-ERROR] User ID ${finalUserId} failed: Gender is ${user.user_Gender}.`);
          return res.status(400).json({ error: "Only female employees are eligible for VAWC Leave (RA 9262)." });
        }

        const maxVAWCDays = 10;
        if (finalNoDays > maxVAWCDays) {
          await t.rollback();
          return res.status(400).json({ error: `VAWC leave cannot exceed ${maxVAWCDays} days. Extension requires a protection order.` });
        }
      }

      if (finalReqTypeId === 12) {
        if (userGender !== "female") {
          await t.rollback();
          console.log(`[SPECIAL-WOMEN-DEBUG-ERROR] User ID ${finalUserId} failed: Gender is ${user.user_Gender}.`);
          return res.status(400).json({ error: "Only female employees are eligible for Special Leave for Women (RA 9710)." });
        }

        const maxSpecialDays = 60; // 2 months
        if (finalNoDays > maxSpecialDays) {
          await t.rollback();
          return res.status(400).json({ error: `Special Leave for Women cannot exceed ${maxSpecialDays} days (2 months) per year.` });
        }
      }

      // Tenure checks (6 months for Solo Parent and Special Leave)
      if ([10, 12].includes(finalReqTypeId)) {
        const hireDate = new Date(user.hireDate);
        const tenureMonths = (new Date(todayStr) - hireDate) / (1000 * 60 * 60 * 24 * 30.44);
        if (tenureMonths < 6) {
          await t.rollback();
          console.log(`[STATUTORY-TENURE-DEBUG-ERROR] User ID ${finalUserId} failed tenure: ${tenureMonths.toFixed(1)} months (Type ${finalReqTypeId}).`);
          return res.status(400).json({ error: "You must have at least 6 months of continuous service to avail of this benefit." });
        }
      }

      // Mandatory attachment check (8: Maternity, 9: Paternity, 10: Solo Parent, 11: VAWC, 12: Special Women)
      if ([8, 9, 10, 11, 12].includes(finalReqTypeId) && !proof_File) {
        await t.rollback();
        return res.status(400).json({ error: "Supporting documentation (Medical Cert/SPIC/Barangay Cert/Court Order) is mandatory for this request." });
      }
    }

    let userLeaveBalance = null;

    // Emergency Leave is strictly limited to 1 day per application
    if (finalReqTypeId === 6) {
      const requestedELDays = finalNoDays || parseFloat(req.body.NoDays) || parseFloat(req.body.noDays) || 1;
      if (requestedELDays > 1) {
        await t.rollback();
        return res.status(400).json({ error: "Emergency Leave is strictly limited to a maximum of 1 day per application." });
      }
    }

    // Check Leave Balances if applicable before creating parent request
    if ([3, 4, 6, 7, 10].includes(finalReqTypeId)) {
      const checkDays = [7, 10].includes(finalReqTypeId) ? 0.5 : (finalReqTypeId === 6 ? 1 : finalNoDays);
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
          `INSERT INTO "Leave_Balance" ("user_Id", "year", "VL_balance", "SL_balance", "SoloParent_balance", "VL_used", "SL_used", "SoloParent_used", "createdAt", "updatedAt")
           VALUES (:userId, :year, 7, 7, 7, 0, 0, 0, :now, :now)`,
          {
            replacements: { userId: finalUserId, year: currentYear, now: nowStr },
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

      userLeaveBalance = balanceResult[0];
      const balance = userLeaveBalance;
      if (finalReqTypeId === 3) {
        // ... (existing VL logic)
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
      } else if (finalReqTypeId === 4 && balance.SL_balance < checkDays) {
        systemRemarks.push(`Insufficient SL Balance (Current: ${balance.SL_balance})`);
      } else if (finalReqTypeId === 10 && balance.SoloParent_balance < checkDays) {
        systemRemarks.push(`Insufficient Solo Parent Balance (Current: ${balance.SoloParent_balance})`);
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
          remarks: enhancedRemarks,
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
      const explicitWithPay = req.body.WithPayID || req.body.withPayId;
      const defaultWithPay = (userLeaveBalance && parseFloat(userLeaveBalance.VL_balance) >= finalNoDays) ? 1 : 2;
      const finalWithPayID = (explicitWithPay !== undefined && explicitWithPay !== null && explicitWithPay !== "") ? parseInt(explicitWithPay) : defaultWithPay;

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
            WithPayID: finalWithPayID,
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
      const explicitWithPay = req.body.WithPayID || req.body.withPayId;
      const defaultWithPay = (userLeaveBalance && parseFloat(userLeaveBalance.SL_balance) >= finalNoDays) ? 1 : 2;
      const finalWithPayID = (explicitWithPay !== undefined && explicitWithPay !== null && explicitWithPay !== "") ? parseInt(explicitWithPay) : defaultWithPay;

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
            WithPayID: finalWithPayID,
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
      const { DateOfLeave, reason: reqReason, StartDate: sDate } = req.body;
      const effectiveDateOfLeave = DateOfLeave || sDate || StartDate;
      const effectiveNoDays = 1; // Strictly 1 day for Emergency Leave
      const elResult = await sequelize.query(
        `INSERT INTO "Emergency_Leave"
        ("emp_reqId", "user_Id", "DateOfLeave", "NoDays", "reason", "WithPayID")
        VALUES (:emp_reqId, :userId, :DateOfLeave, :NoDays, :reason, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            DateOfLeave: effectiveDateOfLeave,
            NoDays: effectiveNoDays,
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
    // Statutory Leaves (8: Maternity, 9: Paternity, 10: Solo Parent, 11: VAWC, 12: Special Women)
    else if ([8, 9, 10, 11, 12].includes(finalReqTypeId)) {
      const sDate = StartDate || req.body.DateOfLeave;
      const eDate = EndDate || req.body.DateOfLeave;
      
      const insertCols = ["emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "proof_File", "reason", "WithPayID"];
      const insertVals = [emp_reqId, finalUserId, sDate, eDate, finalNoDays, proof_File, finalReason, 1];
      
      console.log(`[MATERNITY-DEBUG-COUNT] Columns: ${insertCols.length}, Values: ${insertVals.length}`);
      console.log(`[MATERNITY-DEBUG-DATA]`, {
        emp_reqId,
        userId: finalUserId,
        StartDate: sDate,
        EndDate: eDate,
        NoDays: finalNoDays,
        proof_File,
        reason: finalReason,
        WithPayID: 1
      });

      const statResult = await sequelize.query(
        `INSERT INTO "Statutory_Leave"
        ("emp_reqId", "user_Id", "StartDate", "EndDate", "NoDays", "proof_File", "reason", "WithPayID")
        VALUES (:emp_reqId, :userId, :StartDate, :EndDate, :NoDays, :proof_File, :reason, :WithPayID)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            StartDate: sDate,
            EndDate: eDate,
            NoDays: finalNoDays,
            proof_File: proof_File,
            reason: finalReason,
            WithPayID: 1, // Default: With Pay for statutory leaves
          },
          type: QueryTypes.INSERT,
          transaction: t
        },
      );
      childData = statResult[0][0];
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
    } 
    // Loan Request (13: Certification, 14: Enrollment)
    else if (finalReqTypeId === 13 || finalReqTypeId === 14) {
      const { 
        agency, 
        loanType, 
        amountRequested, 
        monthsToPay,
        loanReferenceNo,
        loanApprovalDate,
        monthlyAmortization,
        totalLoanTerm,
        amortizationStartMonth,
        totalOutstandingBalance,
        calamityArea,
        netPaySufficient
      } = req.body;
      const isEnrollment = finalReqTypeId === 14;

      console.log("[DEBUG_LOAN_ENROLLMENT] Incoming Payload:", { agency, loanType, isEnrollment, amountRequested, monthsToPay, loanReferenceNo, loanApprovalDate, monthlyAmortization, totalLoanTerm, amortizationStartMonth, totalOutstandingBalance, proof_File });

      if (!agency || !loanType) {
        await t.rollback();
        return res.status(400).json({ error: "Agency and Loan Type are required for loan requests." });
      }

      // Auto-derive amortizationStartMonth if not explicitly provided but approval date is present
      let effectiveAmortizationStartMonth = amortizationStartMonth;
      if ((!effectiveAmortizationStartMonth || effectiveAmortizationStartMonth.trim() === "") && loanApprovalDate) {
        const approvalDate = new Date(loanApprovalDate);
        if (!isNaN(approvalDate.getTime())) {
          let monthsToAdd = 1;
          if (agency === "SSS") {
            monthsToAdd = (loanType === "Emergency Loan") ? 6 : 2;
          } else if (agency === "Pag-IBIG") {
            monthsToAdd = (loanType === "Calamity Loan") ? 4 : 1;
          }
          const startMonth = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + monthsToAdd, 1);
          const yyyy = startMonth.getFullYear();
          const mm = String(startMonth.getMonth() + 1).padStart(2, '0');
          effectiveAmortizationStartMonth = `${yyyy}-${mm}`;
        }
      }

      if (isEnrollment && agency === "SSS" && loanType === "Salary Loan") {
         if (!loanReferenceNo || !loanApprovalDate || !monthlyAmortization || !totalLoanTerm || !effectiveAmortizationStartMonth || !totalOutstandingBalance || !proof_File) {
            console.log("[DEBUG_LOAN_ENROLLMENT] Failed Salary Loan Validation");
            await t.rollback();
            return res.status(400).json({ error: "All SSS Salary Loan fields and the Disclosure Statement upload are mandatory." });
         }
      } else if (isEnrollment && agency === "SSS" && loanType === "Calamity Loan") {
         if (!calamityArea || !loanReferenceNo || !loanApprovalDate || !totalOutstandingBalance || !monthlyAmortization || !proof_File || !damageProof_File || !netPaySufficient) {
            console.log("[DEBUG_LOAN_ENROLLMENT] Failed Calamity Loan Validation");
            await t.rollback();
            return res.status(400).json({ error: "All SSS Calamity Loan fields and both file uploads are mandatory." });
         }
      } else if (isEnrollment && agency === "SSS" && loanType === "Emergency Loan") {
         if (!amountRequested || !monthsToPay || !monthlyAmortization || !loanReferenceNo || !loanApprovalDate || !effectiveAmortizationStartMonth || !proof_File) {
            console.log("[DEBUG_LOAN_ENROLLMENT] Failed Emergency Loan Validation");
            await t.rollback();
            return res.status(400).json({ error: "All SSS Emergency Loan fields and the Disclosure Statement upload are mandatory." });
         }
      } else if (isEnrollment && agency === "Pag-IBIG" && loanType === "Multi-Purpose Loan (MPL)") {
         if (!amountRequested || !monthsToPay || !monthlyAmortization || !loanReferenceNo || !loanApprovalDate || !effectiveAmortizationStartMonth || !proof_File) {
            await t.rollback();
            return res.status(400).json({ error: "All Pag-IBIG MPL fields and the Loan Voucher upload are mandatory." });
         }
      } else if (isEnrollment && agency === "Pag-IBIG" && loanType === "Calamity Loan") {
         if (!amountRequested || !monthsToPay || !monthlyAmortization || !loanReferenceNo || !loanApprovalDate || !effectiveAmortizationStartMonth || !proof_File || !calamityArea) {
            await t.rollback();
            return res.status(400).json({ error: "All Pag-IBIG Calamity Loan fields and the Loan Voucher upload are mandatory." });
         }
      } else if (isEnrollment && agency === "SSS" && loanType === "SSS Conso Loan") {
         if (!totalOutstandingBalance || !monthlyAmortization || !loanReferenceNo || !loanApprovalDate || !effectiveAmortizationStartMonth || !totalLoanTerm || !proof_File) {
            console.log("[DEBUG_LOAN_ENROLLMENT] Failed Conso Loan Validation. Missing field:", {
               totalOutstandingBalance: !!totalOutstandingBalance,
               monthlyAmortization: !!monthlyAmortization,
               loanReferenceNo: !!loanReferenceNo,
               loanApprovalDate: !!loanApprovalDate,
               amortizationStartMonth: !!effectiveAmortizationStartMonth,
               totalLoanTerm: !!totalLoanTerm,
               proof_File: !!proof_File
            });
            await t.rollback();
            return res.status(400).json({ error: "All SSS Conso Loan fields and the Disclosure Statement upload are mandatory." });
         }
      } else if (isEnrollment && (!amountRequested || (agency !== "Company" && !proof_File))) {
        console.log("[DEBUG_LOAN_ENROLLMENT] Failed Generic Validation. Field values:", { amountRequested: !!amountRequested, proof_File: !!proof_File, agency });
        await t.rollback();
        return res.status(400).json({ error: "Amount and Voucher/Proof File are mandatory for loan enrollment." });
      }

      console.log("[DEBUG_LOAN_ENROLLMENT] Validation passed, executing insert...");

      const { 
        mscCount,
        avgMSC,
        consoDP,
        pagibigTAV,
        deductionFrequency
      } = req.body;

      const loanReqResult = await sequelize.query(
        `INSERT INTO "Loan_Request"
        ("emp_reqId", "user_Id", "agency", "loanType", "amountRequested", "monthsToPay", "isEnrollment", "proof_File", 
         "loanReferenceNo", "loanApprovalDate", "monthlyAmortization", "totalLoanTerm", "amortizationStartMonth", "totalOutstandingBalance",
         "calamityArea", "damageProof_File", "netPaySufficient", "mscCount", "avgMSC", "consoDP", "pagibigTAV", "deductionFrequency",
         "createdAt", "updatedAt")
        VALUES (:emp_reqId, :userId, :agency, :loanType, :amountRequested, :monthsToPay, :isEnrollment, :proof_File, 
                :loanReferenceNo, :loanApprovalDate, :monthlyAmortization, :totalLoanTerm, :amortizationStartMonth, :totalOutstandingBalance,
                :calamityArea, :damageProof_File, :netPaySufficient, :mscCount, :avgMSC, :consoDP, :pagibigTAV, :deductionFrequency,
                :now, :now)
        RETURNING *`,
        {
          replacements: {
            emp_reqId,
            userId: finalUserId,
            agency,
            loanType,
            amountRequested: amountRequested || 0,
            monthsToPay: monthsToPay || 0,
            isEnrollment,
            proof_File: proof_File || null,
            loanReferenceNo: loanReferenceNo || null,
            loanApprovalDate: loanApprovalDate || null,
            monthlyAmortization: monthlyAmortization || 0,
            totalLoanTerm: totalLoanTerm || 0,
            amortizationStartMonth: effectiveAmortizationStartMonth || null,
            totalOutstandingBalance: totalOutstandingBalance || 0,
            calamityArea: calamityArea || null,
            damageProof_File: damageProof_File || null,
            netPaySufficient: netPaySufficient === 'true' || netPaySufficient === true,
            mscCount: mscCount || null,
            avgMSC: avgMSC || 0,
            consoDP: consoDP || 0,
            pagibigTAV: pagibigTAV || 0,
            deductionFrequency: deductionFrequency || 'semi-monthly',
            now: nowStr
          },
          type: QueryTypes.INSERT,
          transaction: t
        }
      );
      childData = loanReqResult[0][0];
    }
    else {
      await t.rollback();
      return res.status(400).json({ error: "Invalid Request Type" });
    }

    // Commit transaction BEFORE notifications to ensure data is persistent
    await t.commit();
    let transactionFinished = true;

    // 4. Notifications
    const typeNameMap = { 
      1: "Overtime", 2: "Onfield Work", 3: "Vacation Leave", 4: "Sick Leave", 
      5: "Log Correction", 6: "Emergency Leave", 7: "Half-Day Leave",
      8: "Maternity Leave", 9: "Paternity Leave", 10: "Solo Parent Leave",
      11: "VAWC Leave", 12: "Special Leave for Women",
      13: "Loan Certification", 14: "Loan Enrollment"
    };
    const typeName = typeNameMap[finalReqTypeId] || "Request";

    // Fetch requester details for the approver notifications
    const requesterResult = await sequelize.query(
      `SELECT "user_FirstName", "user_LastName", "user_RoleId" FROM "User" WHERE "user_Id" = :userId`,
      { replacements: { userId: finalUserId }, type: QueryTypes.SELECT }
    );
    const requester = requesterResult[0];
    if (!requester) {
      console.error(`[UserCreateRequest] User ID ${finalUserId} not found for notification.`);
      return res.status(200).json({
        message: "Request created successfully (Notification skipped: User not found)",
        data: {
          request: newRequest,
          details: childData,
        },
      });
    }
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
          message: finalReqTypeId === 13 
            ? `Your request for ${childData.agency} loan certification has been submitted. The admin will be notified to certify your application on the portal.`
            : `Your ${typeName} request has been submitted and is currently pending review.`,
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
      } else if (finalReqTypeId === 13 || finalReqTypeId === 14) {
        dateStr = todayStr;
        duration = `${childData.agency} - ${childData.loanType}`;
      }

      for (const approver of approvers) {
        // 1. In-App Notification
        const customMsg = finalReqTypeId === 13 
          ? `Action Required: ${requesterName} is requesting certification for an ${childData.agency} ${childData.loanType} loan. Please check the employer portal.`
          : `${requesterName} has submitted a ${typeName} request that requires your review.`;

        await sequelize.query(
          `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
           VALUES (:userId, :title, :message, false, :targetId, :now, :now)`,
          {
            replacements: {
              userId: approver.user_Id,
              title: finalReqTypeId === 13 ? "Loan Certification Nudge" : "New Request for Review",
              message: customMsg,
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
    console.error("[UserCreateRequest ERROR]:", error);
    if (t && typeof transactionFinished === 'undefined') {
      try {
        await t.rollback();
      } catch (rbErr) {
        console.error("[UserCreateRequest Rollback Error]:", rbErr.message);
      }
    }
    if ([8, 9, 10, 11, 12].includes(finalReqTypeId)) {
      console.log(`[STATUTORY-DEBUG-ERROR] Internal Error for User ID ${finalUserId} (Type ${finalReqTypeId}):`, error.message);
    }
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
        st."StartDate" as "ST_StartDate",
        st."EndDate" as "ST_EndDate",
        st."NoDays" as "ST_NoDays",
        st."proof_File" as "ST_proof_File",
        wpst."withPayName" as "ST_withPayName",
        ow."DateonField" as "DateonField",
        ow."NoDays" as "OW_NoDays",
        ow."NoHrs" as "OW_NoHrs",
        lc."logDate" as "LC_logDate",
        lc."currentIn" as "LC_currentIn",
        lc."currentOut" as "LC_currentOut",
        lc."claimedIn" as "LC_claimedIn",
        lc."claimedOut" as "LC_claimedOut",
        lc."correctionCategory" as "LC_correctionCategory",
        lr."agency" as "LR_agency",
        lr."loanType" as "LR_loanType",
        lr."amountRequested" as "LR_amount",
        lr."monthsToPay" as "LR_months",
        lr."loanReferenceNo" as "LR_reference",
        lr."loanApprovalDate" as "LR_approvalDate",
        lr."monthlyAmortization" as "LR_amortization",
        lr."totalLoanTerm" as "LR_term",
        lr."amortizationStartMonth" as "LR_startMonth",
        lr."totalOutstandingBalance" as "LR_balance",
        lr."isEnrollment" as "LR_isEnrollment",
        lr."calamityArea" as "LR_calamityArea",
        lr."damageProof_File" as "LR_damageProof",
        lr."netPaySufficient" as "LR_netPaySufficient",
        lr."pagibigTAV" as "LR_pagibigTAV",
        lr."deductionFrequency" as "LR_deductionFrequency",
        lr."proof_File" as "LR_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        lb."SoloParent_balance",
        lb."VL_used",
        lb."SL_used",
        lb."SoloParent_used",
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
      LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
      LEFT JOIN "withPay" wpst ON st."WithPayID" = wpst."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      LEFT JOIN "Loan_Request" lr ON er."emp_reqId" = lr."emp_reqId"
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
  const { startDate, endDate } = req.query;
  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    let dateFilter = "";
    const replacements = { currentYear };

    if (startDate && endDate) {
      dateFilter = ` AND er."date_Filed"::date BETWEEN :startDate AND :endDate`;
      replacements.startDate = startDate;
      replacements.endDate = endDate;
    }

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
        vl."WithPayID" as "VL_WithPayID",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."WithPayID" as "SL_WithPayID",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        el."DateOfLeave" as "EL_DateOfLeave",
        el."NoDays" as "EL_NoDays",
        el."WithPayID" as "EL_WithPayID",
        wpel."withPayName" as "EL_withPayName",
        hd."DateOfLeave" as "HD_DateOfLeave",
        hd."period" as "HD_period",
        hd."timeRange" as "HD_timeRange",
        hd."WithPayID" as "HD_WithPayID",
        wphd."withPayName" as "HD_withPayName",
        st."StartDate" as "ST_StartDate",
        st."EndDate" as "ST_EndDate",
        st."NoDays" as "ST_NoDays",
        st."proof_File" as "ST_proof_File",
        wpst."withPayName" as "ST_withPayName",
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
        lr."agency" as "LR_agency",
        lr."loanType" as "LR_loanType",
        lr."amountRequested" as "LR_amount",
        lr."monthsToPay" as "LR_months",
        lr."loanReferenceNo" as "LR_reference",
        lr."loanApprovalDate" as "LR_approvalDate",
        lr."monthlyAmortization" as "LR_amortization",
        lr."totalLoanTerm" as "LR_term",
        lr."amortizationStartMonth" as "LR_startMonth",
        lr."totalOutstandingBalance" as "LR_balance",
        lr."isEnrollment" as "LR_isEnrollment",
        lr."calamityArea" as "LR_calamityArea",
        lr."damageProof_File" as "LR_damageProof",
        lr."netPaySufficient" as "LR_netPaySufficient",
        lr."pagibigTAV" as "LR_pagibigTAV",
        lr."deductionFrequency" as "LR_deductionFrequency",
        lr."proof_File" as "LR_proof_File",
        lb."VL_balance",
        lb."SL_balance",
        lb."SoloParent_balance",
        lb."VL_used",
        lb."SL_used",
        lb."SoloParent_used",
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
      LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
      LEFT JOIN "withPay" wpst ON st."WithPayID" = wpst."withPayId"
      LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
      LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
      LEFT JOIN "Loan_Request" lr ON er."emp_reqId" = lr."emp_reqId"
      LEFT JOIN "Leave_Balance" lb ON er."user_Id" = lb."user_Id" AND lb."year" = :currentYear
      WHERE 1=1 ${dateFilter}
      ORDER BY er."createdAt" DESC`,
      {
        replacements,
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

  let transaction = null;
  try {
    const now = await getSystemTime();
    const nowStr = formatForSQL(now);
    const todayStr = formatDateLocal(now);

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

    // Start database transaction
    transaction = await sequelize.transaction();

    let appliedLogCorrection = null;
    let appliedLeave = null;
    let enrolledLoan = null;
    let datesToRecalculateUnits = [];

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
      transaction,
    });

    // --- LEAVE BALANCE DEDUCTION/REVERSAL ---
    const leaveTypes = [3, 4, 6, 7, 8, 9, 10, 11, 12];
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
        else if ([8, 9, 10, 11, 12].includes(typeId)) tableName = "Statutory_Leave";

        const childRes = await sequelize.query(
          `SELECT "NoDays" FROM "${tableName}" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
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
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SL_balance" = GREATEST(0, "SL_balance" - :noDays),
                 "SL_used" = "SL_used" + :noDays
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 10) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SoloParent_balance" = GREATEST(0, "SoloParent_balance" - :noDays),
                 "SoloParent_used" = "SoloParent_used" + :noDays
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 6) {
          // EL: Deduct from SL first, then VL
          const balRes = await sequelize.query(
            `SELECT "SL_balance", "VL_balance" FROM "Leave_Balance" WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { userId, year: currentYear }, type: QueryTypes.SELECT, transaction }
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
              { replacements: { slDeduct, vlDeduct, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
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
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 10) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SoloParent_balance" = "SoloParent_balance" + :noDays,
                 "SoloParent_used" = GREATEST(0, "SoloParent_used" - :noDays)
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Leave_Balance"
             SET "SL_balance" = "SL_balance" + :noDays,
                 "SL_used" = GREATEST(0, "SL_used" - :noDays)
             WHERE "user_Id" = :userId AND "year" = :year`,
            { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
          );
        } else if (typeId === 6) {
           let toRestore = noDays;
           await sequelize.query(
             `UPDATE "Leave_Balance"
              SET "SL_balance" = "SL_balance" + :noDays,
                  "SL_used" = GREATEST(0, "SL_used" - :noDays)
              WHERE "user_Id" = :userId AND "year" = :year`,
             { replacements: { noDays, userId, year: currentYear }, type: QueryTypes.UPDATE, transaction }
           );
        }
      }
    }

    // --- AUTO-UPDATE ATTENDANCE FOR LOG CORRECTION ---
    if (finalStatusId === 2 && isLogCorrection) {
      const lcDetails = await sequelize.query(
        `SELECT * FROM "LogCorrection_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
      );

      if (lcDetails.length > 0) {
        const { logDate, claimedIn, claimedOut } = lcDetails[0];
        
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
          type: QueryTypes.INSERT,
          transaction
        });

        // 2. Insert into user_logging for audit trail (In and Out)
        if (claimedIn) {
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :logDate, :claimedIn, 1, 1)`,
            { replacements: { userId: requesterId, logDate, claimedIn }, type: QueryTypes.INSERT, transaction }
          );
        }
        if (claimedOut) {
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :logDate, :claimedOut, 2, 1)`,
            { replacements: { userId: requesterId, logDate, claimedOut }, type: QueryTypes.INSERT, transaction }
          );
        }

        appliedLogCorrection = { requesterId, operatorId, logDate, claimedIn, claimedOut, emp_reqId };
      }
    }
    // --------------------------------------------------

    // --- AUTO-UPDATE ATTENDANCE FOR APPROVED LEAVES ---
    if (finalStatusId === 2 && [3, 4, 6, 7, 8, 9, 10, 11, 12].includes(Number(typeId))) {
      let leaveDatesResult = [];
      if (typeId === 3) {
        leaveDatesResult = await sequelize.query(
          `SELECT "StartDate"::text as "startDate", "EndDate"::text as "endDate" FROM "Vacation_Leave" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
        );
      } else if (typeId === 4) {
        leaveDatesResult = await sequelize.query(
          `SELECT "StartDate"::text as "startDate", "EndDate"::text as "endDate" FROM "Sick_Leave" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
        );
      } else if (typeId === 6) {
        leaveDatesResult = await sequelize.query(
          `SELECT "DateOfLeave"::text as "startDate", "DateOfLeave"::text as "endDate", "NoDays" FROM "Emergency_Leave" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
        );
      } else if (typeId === 7) {
        leaveDatesResult = await sequelize.query(
          `SELECT "DateOfLeave"::text as "startDate", "DateOfLeave"::text as "endDate" FROM "HalfDay_Leave" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
        );
      } else if ([8, 9, 10, 11, 12].includes(Number(typeId))) {
        leaveDatesResult = await sequelize.query(
          `SELECT "StartDate"::text as "startDate", "EndDate"::text as "endDate" FROM "Statutory_Leave" WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
        );
      }

      if (leaveDatesResult.length > 0) {
        const { startDate, endDate, NoDays } = leaveDatesResult[0];
        const statusId = (Number(typeId) === 7) ? 4 : 5; // 4 for Half Day, 5 for On Leave
        
        let start = new Date(startDate);
        let end = new Date(endDate);
        if (typeId === 6 && NoDays && Number(NoDays) > 1) {
          end.setDate(start.getDate() + Number(NoDays) - 1);
        }

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const ey = end.getFullYear();
        const em = end.getMonth();
        const ed = end.getDate();
        let curr = new Date(Date.UTC(sy, sm - 1, sd));
        const endUTC = new Date(Date.UTC(ey, em, ed));

        while (curr <= endUTC) {
          const dateStr = curr.toISOString().split('T')[0];
          
          if (statusId === 4) {
            await sequelize.query(`
              INSERT INTO "employee_Logging_report" 
                ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
              VALUES (:userId, :dateStr, '[]', '[]', 4, 2)
              ON CONFLICT ("user_id", "log_Date") 
              DO UPDATE SET 
                "attendance_StatusId" = 4,
                "logged_StatusId" = 2
            `, { replacements: { userId: requesterId, dateStr }, type: QueryTypes.INSERT, transaction });
          } else {
            await sequelize.query(`
              INSERT INTO "employee_Logging_report" 
                ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
              VALUES (:userId, :dateStr, '[]', '[]', :statusId, 2)
              ON CONFLICT ("user_id", "log_Date") 
              DO UPDATE SET 
                "attendance_StatusId" = :statusId,
                "logged_StatusId" = 2
            `, { replacements: { userId: requesterId, dateStr, statusId }, type: QueryTypes.INSERT, transaction });
          }

          // If user_logging had an Absent record (status 3), repair it to statusId
          await sequelize.query(`
            UPDATE "user_logging" 
            SET "attendance_StatusId" = :statusId 
            WHERE "user_id" = :userId AND "log_Date"::date = :dateStr::date AND "attendance_StatusId" = 3
          `, { replacements: { statusId, userId: requesterId, dateStr }, type: QueryTypes.UPDATE, transaction });

          // Ensure audit log exists in user_logging
          const existingLogs = await sequelize.query(`
            SELECT "user_loggingId" FROM "user_logging" WHERE "user_id" = :userId AND "log_Date"::date = :dateStr::date LIMIT 1
          `, { replacements: { userId: requesterId, dateStr }, type: QueryTypes.SELECT, transaction });

          if (existingLogs.length === 0) {
            await sequelize.query(`
              INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
              VALUES (:userId, :dateStr, '17:30:00', 7, :statusId)
            `, { replacements: { userId: requesterId, dateStr, statusId }, type: QueryTypes.INSERT, transaction });
          }

          datesToRecalculateUnits.push({ userId: requesterId, dateStr });
          curr.setUTCDate(curr.getUTCDate() + 1);
        }

        appliedLeave = { 
          requesterId, 
          operatorId, 
          emp_reqId, 
          startDate, 
          endDate: end.toISOString().split('T')[0], 
          statusId 
        };
      }
    }
    // --------------------------------------------------

    // --- AUTO-CREATE LOAN DEDUCTION FOR ENROLLMENT ---
    if (finalStatusId === 2 && typeId === 14) {
      const loanDetails = await sequelize.query(
        `SELECT * FROM "Loan_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
      );

      if (loanDetails.length > 0) {
        const { 
          agency, loanType, amountRequested, monthsToPay, proof_File,
          loanReferenceNo, loanApprovalDate, monthlyAmortization, totalLoanTerm,
          amortizationStartMonth, totalOutstandingBalance, deductionFrequency
        } = loanDetails[0];

        const frequency = deductionFrequency || 'semi-monthly';
        const isMonthlyFreq = (frequency === 'monthly');
        
        const totalAmount = parseFloat(amountRequested) || parseFloat(totalOutstandingBalance) || 0;
        const months = parseInt(monthsToPay) || parseInt(totalLoanTerm) || 12;
        
        // --- HIGH ACCURACY FINANCIAL MATH ---
        // 1. Determine Rates
        let annualRate = 0;
        let feeRate = 0;

        if (agency === 'SSS') {
          annualRate = (loanType === 'Calamity Loan') ? 0.06 : 0.10;
          feeRate = 0.01;
        } else if (agency === 'Pag-IBIG') {
          annualRate = (loanType === "Calamity Loan") ? 0.0595 : 0.105;
          feeRate = 0;
        } else if (agency === 'Company') {
          annualRate = 0;
          feeRate = 0;
        }

        // 2. Calculate Upfront Deductions (SSS)
        const serviceFeeAmount = totalAmount * feeRate;
        const proRatedInterest = (agency === 'SSS') 
          ? calculateSSSRatedInterest(totalAmount, annualRate, loanApprovalDate || todayStr) 
          : 0;
        const netDisbursement = totalAmount - serviceFeeAmount - proRatedInterest;

        // 3. Generate Amortization Schedule
        const schedule = generateSchedule(totalAmount, annualRate, months);
        const amortMonthly = schedule[0]?.totalPayment || (totalAmount / months);
        const perCutoff = amortMonthly / 2;
        const effectiveDeductionPerCutoff = isMonthlyFreq ? amortMonthly : perCutoff;

        // Map agency/type to deductionType enum
        let dedType = 'multipurpose';
        let govDbType = 'Multi-Purpose'; 
        
        if (agency === 'SSS') {
          if (loanType === 'Calamity Loan') { dedType = 'calamity'; govDbType = 'SSS Calamity'; }
          else if (loanType === 'Emergency Loan') { dedType = 'sss_emergency'; govDbType = 'SSS Emergency'; }
          else if (loanType === 'SSS Conso Loan') { dedType = 'sss_conso'; govDbType = 'SSS Conso Loan'; }
          else { dedType = 'sss_loan'; govDbType = 'SSS'; }
        }
        else if (agency === 'Pag-IBIG') {
          if (loanType === 'Calamity Loan') { dedType = 'hdmf_calamity'; govDbType = 'Pag-IBIG Calamity'; }
          else { dedType = 'hdmf_loan'; govDbType = 'Pag-IBIG MPL'; }
        }
        else if (agency === 'Company') {
          dedType = 'eastwest';
          govDbType = 'Company'; 
          // (Cash advance logic remains flat/one-time)
          const today = new Date();
          const targetDateStr = today.getDate() <= 15 
            ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
            : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

          await sequelize.query(
            `INSERT INTO "Payroll_Eastwest" ("user_Id", "date", "amount", "createdAt", "updatedAt")
             VALUES (:userId, :date, :amount, :now, :now)
             ON CONFLICT ("user_Id", "date") DO UPDATE SET "amount" = "Payroll_Eastwest"."amount" + EXCLUDED."amount"`,
            { replacements: { userId: requesterId, date: targetDateStr, amount: totalAmount, now: nowStr }, transaction }
          );
        }

        // 4. Update Loan_Request with finalized math
        await sequelize.query(
          `UPDATE "Loan_Request" SET 
            "interestRate" = :rate, "serviceFee" = :fee, 
            "proRatedInterest" = :proRated, "netDisbursement" = :net,
            "monthlyAmortization" = :amort
           WHERE "emp_reqId" = :emp_reqId`,
          { replacements: { rate: annualRate, fee: feeRate, proRated: proRatedInterest, net: netDisbursement, amort: amortMonthly, emp_reqId }, transaction }
        );

        // 5. Insert into master Loan_Deductions table
        await sequelize.query(
          `INSERT INTO "Loan_Deductions" 
            ("userId", "deductionType", "status", "contractDate", "monthsToPay", "deductionPerCutoff", "totalAmount", "remainingBalance", "provider", "reference", "notes", "deductionFrequency", "createdBy", "createdAt", "updatedAt")
          VALUES 
            (:userId, :dedType, 'active', :contractDate, :months, :perCutoff, :total, :balance, :agency, :reference, :notes, :frequency, :adminId, :now, :now)`,
          {
            replacements: {
              userId: requesterId, dedType,
              contractDate: loanApprovalDate || nowStr.split(' ')[0],
              months, perCutoff: effectiveDeductionPerCutoff, total: totalAmount, balance: totalAmount,
              agency, reference: loanReferenceNo || null,
              notes: `${agency} ${loanType} (${isMonthlyFreq ? 'Monthly' : 'Semi-Monthly'}) via Request #${emp_reqId}`,
              frequency,
              adminId: operatorId, now: nowStr
            },
            type: QueryTypes.INSERT,
            transaction
          }
        );

        // --- CONSOLIDATION LOGIC FOR SSS ---
        if (loanType === 'SSS Conso Loan') {
          console.log(`[CONSO-DEBUG] Processing SSS Consolidation for User ${requesterId}...`);
          
          // 1. Mark old active SSS loans as completed
          const oldSSSLoanTypes = ['sss_loan', 'calamity', 'sss_emergency'];
          await sequelize.query(
            `UPDATE "Loan_Deductions" 
             SET "status" = 'completed', 
                 "notes" = CONCAT("notes", ' | Consolidated into Conso Loan via Req#', :emp_reqId),
                 "updatedAt" = :now
             WHERE "userId" = :userId 
               AND "deductionType" IN (:types)
               AND "status" = 'active'`,
            { replacements: { userId: requesterId, types: oldSSSLoanTypes, emp_reqId, now: nowStr }, type: QueryTypes.UPDATE, transaction }
          );

          // 2. Remove future ledger records for old SSS loans
          const oldSSSGovTypes = ['SSS', 'SSS Salary', 'SSS Calamity', 'SSS Emergency'];
          await sequelize.query(
            `DELETE FROM "Payroll_GovernmentLoans"
             WHERE "user_Id" = :userId
               AND "government_type" IN (:govTypes)
               AND "date" > :nowDate`,
            { replacements: { userId: requesterId, govTypes: oldSSSGovTypes, nowDate: nowStr.split(' ')[0] }, type: QueryTypes.DELETE, transaction }
          );
          
          console.log(`[CONSO-DEBUG] SSS Consolidation complete for User ${requesterId}.`);
        }

        // 6. Generate detailed ledger records
        if (agency === 'SSS' || agency === 'Pag-IBIG') {
          try {
            let currentYear, currentMonth;
            if (agency === 'SSS') {
              const startTarget = new Date(now.getFullYear(), now.getMonth() + (loanType === 'Emergency Loan' ? 7 : 2), 1);
              currentYear = startTarget.getFullYear(); currentMonth = startTarget.getMonth();
            } else {
              // Pag-IBIG: 2-month grace period (starts on the 3rd month)
              const startTarget = new Date(now.getFullYear(), now.getMonth() + 3, 1);
              currentYear = startTarget.getFullYear(); currentMonth = startTarget.getMonth();
            }

            for (let i = 0; i < months; i++) {
              const monthData = schedule[i];
              const loopDate = new Date(currentYear, currentMonth + i, 1);
              const year = loopDate.getFullYear(); const month = loopDate.getMonth();
              const d15 = `${year}-${String(month + 1).padStart(2, '0')}-15`;
              const dEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

              if (isMonthlyFreq) {
                // Monthly deduction: single deduction on 15th
                await sequelize.query(
                  `INSERT INTO "Payroll_GovernmentLoans" 
                    ("user_Id", "government_type", "date", "amount", "principalPaid", "interestPaid", "createdAt", "updatedAt")
                   VALUES (:userId, :govType, :date, :amount, :pPaid, :iPaid, :now, :now)
                   ON CONFLICT ("user_Id", "date", "government_type") DO NOTHING`,
                  {
                    replacements: {
                      userId: requesterId, govType: govDbType, date: d15, 
                      amount: amortMonthly, pPaid: monthData.principalPortion, iPaid: monthData.interestPortion, 
                      now: nowStr
                    },
                    type: QueryTypes.INSERT,
                    transaction
                  }
                );
              } else {
                // Semi-monthly deduction: split equally between 15th and end of month
                for (const sDate of [d15, dEnd]) {
                  await sequelize.query(
                    `INSERT INTO "Payroll_GovernmentLoans" 
                      ("user_Id", "government_type", "date", "amount", "principalPaid", "interestPaid", "createdAt", "updatedAt")
                     VALUES (:userId, :govType, :date, :amount, :pPaid, :iPaid, :now, :now)
                     ON CONFLICT ("user_Id", "date", "government_type") DO NOTHING`,
                    {
                      replacements: {
                        userId: requesterId, govType: govDbType, date: sDate, 
                        amount: perCutoff, pPaid: monthData.principalPortion / 2, iPaid: monthData.interestPortion / 2, 
                        now: nowStr
                      },
                      type: QueryTypes.INSERT,
                      transaction
                    }
                  );
                }
              }
            }
          } catch (schedErr) {
            console.error("[LOAN_SCHEDULE_GEN_ERROR]:", schedErr.message);
          }
        }
        enrolledLoan = { requesterId, operatorId, agency, totalAmount, emp_reqId };
      }
    }
    // --------------------------------------------------

    const newRequestResult = await sequelize.query(
      `SELECT * FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`,
      { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
    );
    const newRequest = newRequestResult[0];

    // 2. If it's a Leave request and withPayId is provided, update the child table
    if (withPayId) {
      const requestTypeRes = await sequelize.query(
        `SELECT "emp_reqTypeId" FROM "emp_Request" WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction },
      );

      if (requestTypeRes.length > 0) {
        const typeId = requestTypeRes[0].emp_reqTypeId;
        if (typeId === 3) {
          await sequelize.query(
            `UPDATE "Vacation_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE, transaction },
          );
        } else if (typeId === 4) {
          await sequelize.query(
            `UPDATE "Sick_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE, transaction },
          );
        } else if (typeId === 6) {
          await sequelize.query(
            `UPDATE "Emergency_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE, transaction },
          );
        } else if (typeId === 7) {
          await sequelize.query(
            `UPDATE "HalfDay_Leave" SET "WithPayID" = :withPayId WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { withPayId, emp_reqId }, type: QueryTypes.UPDATE, transaction },
          );
        } else if ([8, 9, 10, 11, 12].includes(typeId)) {
          await sequelize.query(
            `UPDATE "Statutory_Leave" SET "WithPayID" = 1 WHERE "emp_reqId" = :emp_reqId`,
            { replacements: { emp_reqId }, type: QueryTypes.UPDATE, transaction },
          );
        }
      }
    }

    // 3. Create notification for the user
    const [requestInfo] = await sequelize.query(
      `SELECT er."user_Id", rt."reqTypeName", er."emp_reqTypeId", u."user_Email", u."user_FirstName", u."user_LastName",
              ow."DateonField", ow."destination", ow."NoHrs",
              vl."StartDate" as "VL_S", vl."EndDate" as "VL_E", wpvl."withPayName" as "VL_W",
              sl."StartDate" as "SL_S", sl."EndDate" as "SL_E", wpsl."withPayName" as "SL_W",
              el."DateOfLeave" as "EL_D", wpel."withPayName" as "EL_W",
              hd."DateOfLeave" as "HD_D", wphd."withPayName" as "HD_W",
              ot."OT_DateOf" as "OT_D",
              lc."logDate" as "LC_D"
       FROM "emp_Request" er
       LEFT JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       LEFT JOIN "User" u ON er."user_Id" = u."user_Id"
       LEFT JOIN "Onfield_Work" ow ON er."emp_reqId" = ow."emp_reqId"
       LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
       LEFT JOIN "withPay" wpvl ON vl."WithPayID" = wpvl."withPayId"
       LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
       LEFT JOIN "withPay" wpsl ON sl."WithPayID" = wpsl."withPayId"
       LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
       LEFT JOIN "withPay" wpel ON el."WithPayID" = wpel."withPayId"
       LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
       LEFT JOIN "withPay" wphd ON hd."WithPayID" = wphd."withPayId"
       LEFT JOIN "Overtime_Request" ot ON er."emp_reqId" = ot."emp_reqId"
       LEFT JOIN "LogCorrection_Request" lc ON er."emp_reqId" = lc."emp_reqId"
       WHERE er."emp_reqId" = :emp_reqId`,
      { replacements: { emp_reqId }, type: QueryTypes.SELECT, transaction }
    );

    let statusName = "Pending";
    if (finalStatusId === 2) statusName = "Approved";
    else if (finalStatusId === 3) statusName = "Rejected";
    else if (finalStatusId === 5) statusName = "Returned for Correction";

    if (requestInfo) {
      await sequelize.query(
        `INSERT INTO "Notification" ("user_Id", "title", "message", "isRead", "targetId", "createdAt", "updatedAt")
         VALUES (:userId, :title, :message, false, :targetId, :now, :now)`,
        {
          replacements: {
            userId: requestInfo.user_Id,
            title: `Request ${statusName}`,
            message: `Your ${requestInfo.reqTypeName} request has been ${statusName.toLowerCase()}.${remarks ? ` Admin Note: ${remarks}` : ""}`,
            targetId: emp_reqId,
            now: nowStr,
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );
    }

    // Atomic transaction commit
    await transaction.commit();
    transaction = null;

    // Post-commit audit and transaction logging
    await logAudit(req, processedBy, "Requests", "UPDATE_REQUEST_STATUS", "emp_Request", emp_reqId, oldRequest, newRequest);

    if (appliedLogCorrection) {
      await logTransaction(
        appliedLogCorrection.requesterId,
        appliedLogCorrection.operatorId,
        "LOG_CORRECTION_APPLIED",
        `Time logs corrected for ${appliedLogCorrection.logDate} via approved request #${appliedLogCorrection.emp_reqId}`,
        { logDate: appliedLogCorrection.logDate, claimedIn: appliedLogCorrection.claimedIn, claimedOut: appliedLogCorrection.claimedOut }
      );
    }

    if (appliedLeave) {
      await logTransaction(
        appliedLeave.requesterId,
        appliedLeave.operatorId,
        "LEAVE_ATTENDANCE_APPLIED",
        `Attendance updated to On Leave (${appliedLeave.statusId === 4 ? 'Half Day' : 'On Leave'}) for approved request #${appliedLeave.emp_reqId}`,
        { startDate: appliedLeave.startDate, endDate: appliedLeave.endDate, statusId: appliedLeave.statusId }
      );
    }

    for (const item of datesToRecalculateUnits) {
      try {
        const { calculateAndStoreAttendanceUnits } = require("../utils/attendanceHelper");
        await calculateAndStoreAttendanceUnits(item.userId, item.dateStr);
      } catch (syncErr) {
        console.error(`[LEAVE-SYNC-ERR] Failed calculating units for ${item.userId} on ${item.dateStr}:`, syncErr.message);
      }
    }

    if (enrolledLoan) {
      await logTransaction(
        enrolledLoan.requesterId,
        enrolledLoan.operatorId,
        "LOAN_ENROLLED",
        `${enrolledLoan.agency} loan enrolled for ${enrolledLoan.totalAmount} via approved request #${enrolledLoan.emp_reqId}`,
        { agency: enrolledLoan.agency, totalAmount: enrolledLoan.totalAmount }
      );
    }

    if (requestInfo) {
      // B. Send Email Notification
      const dateStr = requestInfo.VL_S ? `${requestInfo.VL_S} to ${requestInfo.VL_E}` :
                      requestInfo.SL_S ? `${requestInfo.SL_S} to ${requestInfo.SL_E}` :
                      requestInfo.EL_D ? requestInfo.EL_D :
                      requestInfo.HD_D ? requestInfo.HD_D :
                      requestInfo.OT_D ? requestInfo.OT_D :
                      requestInfo.LC_D ? requestInfo.LC_D :
                      requestInfo.DateonField || "N/A";

      const withPayName = requestInfo.VL_W || requestInfo.SL_W || requestInfo.EL_W || requestInfo.HD_W || null;

      if (requestInfo.user_Email) {
        sendRequestStatusEmail({
          email: requestInfo.user_Email,
          name: `${requestInfo.user_FirstName} ${requestInfo.user_LastName}`,
          requestType: requestInfo.reqTypeName,
          status: statusName,
          dateStr,
          reason: remarks,
          withPayName
        }).catch(err => console.error("[STATUS EMAIL FAILED]:", err.message));
      }

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

      // C. Retroactive Attendance Recalculation Hook (Overtime, Onfield, HalfDay)
      if ([1, 2, 7].includes(Number(requestInfo.emp_reqTypeId))) {
        try {
          const { calculateAndStoreAttendanceUnits } = require("../utils/attendanceHelper");
          const targetDateRaw = requestInfo.OT_D || requestInfo.DateonField || requestInfo.HD_D;
          if (targetDateRaw) {
            const targetDateStr = typeof targetDateRaw === 'string' ? targetDateRaw.substring(0, 10) : targetDateRaw.toISOString().split('T')[0];
            calculateAndStoreAttendanceUnits(requestInfo.user_Id, targetDateStr)
              .then(() => console.log(`[ATTENDANCE-AUTO-SYNC] Synchronized attendance units for User ${requestInfo.user_Id} on ${targetDateStr}`))
              .catch(err => console.error(`[ATTENDANCE-AUTO-SYNC-ERR]`, err));
          }
        } catch (syncErr) {
          console.error("[AUTO-SYNC-ERR]", syncErr);
        }
      }
    }

    // [SOCKET] Trigger real-time UI updates
    try {
      const io = getIO();
      if (io && requestInfo) {
        io.emit("REQUEST_STATUS_UPDATED");
        io.to(`user_${requestInfo.user_Id}`).emit("NOTIFICATION_UPDATE");
      }
    } catch (socketErr) {
      // Gracefully ignore if socket server is not bound
    }

    res.status(200).json({ message: "Request status updated successfully" });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        console.error("[UpdateStatusRequest] Rollback failed:", rbErr.message);
      }
    }
    console.error("[UpdateStatusRequest] Error:", error);
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
      // Count all pending requests (1) from staff except their own
      query = `
        SELECT COUNT(*)::int as count 
        FROM "emp_Request" er
        JOIN "User" u ON er."user_Id" = u."user_Id"
        WHERE er."emp_reqStatusId" = 1 
        AND er."user_Id" != :userId
        AND u."user_RoleId" = 3
        AND u."deletedAt" IS NULL
      `;
    } else if (roleId === 1 || roleId === 4) { // Admin or Accountant
      // Count pending (1) and recommended (4) requests except their own
      query = `
        SELECT COUNT(*)::int as count 
        FROM "emp_Request" er
        WHERE er."emp_reqStatusId" IN (1, 4) 
        AND er."user_Id" != :userId
      `;
    } else {
      // Regular Employee (3) sees 0 pending for them to process
      return res.status(200).json({ count: 0 });
    }

    const result = await sequelize.query(query, { 
      replacements, 
      type: QueryTypes.SELECT 
    });
    
    res.status(200).json({ count: result[0]?.count || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.GetLeaveBalance = async (req, res) => {
  const { userId } = req.params;

  try {
    const now = await getSystemTime();
    const currentYear = now.getFullYear();

    const [user] = await sequelize.query(
      `SELECT "is_solo_parent" FROM "User" WHERE "user_Id" = :userId`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const isSoloParent = Boolean(user && (user.is_solo_parent === true || user.is_solo_parent === "true" || user.is_solo_parent === 1 || user.is_solo_parent === "1"));

    const balanceResult = await sequelize.query(
      `SELECT * FROM "Leave_Balance" WHERE "user_Id" = :userId and "year" = :year`,
      {
        replacements: { userId, year: currentYear },
        type: QueryTypes.SELECT,
      },
    );

    if (balanceResult.length === 0) {
      // Return defaults if no balance record yet
      const responseData = {
        VL_total: 7,
        VL_used: 0,
        VL_balance: 7,
        SL_total: 7,
        SL_used: 0,
        SL_balance: 7,
      };
      if (isSoloParent) {
        responseData.SoloParent_total = 7;
        responseData.SoloParent_used = 0;
        responseData.SoloParent_balance = 7;
      }
      return res.status(200).json(responseData);
    }

    const balance = balanceResult[0];
    const spUsed = parseFloat(balance.SoloParent_used || 0);
    const spBal = balance.SoloParent_balance !== null && balance.SoloParent_balance !== undefined ? parseFloat(balance.SoloParent_balance) : 0;
    const effectiveSpBal = (isSoloParent && spBal === 0 && spUsed === 0) ? 7 : spBal;

    const responseData = {
      VL_total: (parseFloat(balance.VL_used || 0) + parseFloat(balance.VL_balance || 0)) || 7,
      VL_used: balance.VL_used || 0,
      VL_balance: balance.VL_balance,
      SL_total: (parseFloat(balance.SL_used || 0) + parseFloat(balance.SL_balance || 0)) || 7,
      SL_used: balance.SL_used || 0,
      SL_balance: balance.SL_balance,
    };

    // Solo Parent balance strictly exclusive to registered Solo Parents
    if (isSoloParent) {
      responseData.SoloParent_total = (spUsed + effectiveSpBal) || 7;
      responseData.SoloParent_used = spUsed;
      responseData.SoloParent_balance = effectiveSpBal;
    }

    res.status(200).json(responseData);
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
        vl."WithPayID" as "VL_WithPayID",
        wpvl."withPayName" as "VL_withPayName",
        sl."StartDate" as "SL_StartDate",
        sl."EndDate" as "SL_EndDate",
        sl."NoDays" as "SL_NoDays",
        sl."WithPayID" as "SL_WithPayID",
        sl."proof_File" as "SL_proof_File",
        wpsl."withPayName" as "SL_withPayName",
        el."DateOfLeave" as "EL_DateOfLeave",
        el."NoDays" as "EL_NoDays",
        el."WithPayID" as "EL_WithPayID",
        wpel."withPayName" as "EL_withPayName",
        hd."DateOfLeave" as "HD_DateOfLeave",
        hd."period" as "HD_period",
        hd."timeRange" as "HD_timeRange",
        hd."WithPayID" as "HD_WithPayID",
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
        lr."agency" as "LR_agency",
        lr."loanType" as "LR_loanType",
        lr."amountRequested" as "LR_amount",
        lr."monthsToPay" as "LR_months",
        lr."loanReferenceNo" as "LR_reference",
        lr."loanApprovalDate" as "LR_approvalDate",
        lr."monthlyAmortization" as "LR_amortization",
        lr."totalLoanTerm" as "LR_term",
        lr."amortizationStartMonth" as "LR_startMonth",
        lr."totalOutstandingBalance" as "LR_balance",
        lr."isEnrollment" as "LR_isEnrollment",
        lr."calamityArea" as "LR_calamityArea",
        lr."damageProof_File" as "LR_damageProof",
        lr."netPaySufficient" as "LR_netPaySufficient",
        lr."pagibigTAV" as "LR_pagibigTAV",
        lr."deductionFrequency" as "LR_deductionFrequency",
        lr."proof_File" as "LR_proof_File",
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
      LEFT JOIN "Loan_Request" lr ON er."emp_reqId" = lr."emp_reqId"
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

    // Role check: If regular employee (role 3), verify that they own the request
    if (req.user && Number(req.user.user_RoleId) === 3 && Number(request[0].user_Id) !== Number(req.user.user_Id)) {
      return res.status(403).json({ error: "Access denied. You can only view your own request details." });
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

    // 1. Fetch all active users with their hardware info (exclude visitor placeholder 999)
    const users = await sequelize.query(
      `SELECT u."user_Id", u."user_FirstName", u."user_LastName", h."user_MachipId", u."dailyRate"
       FROM "User" u
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE u."deletedAt" IS NULL 
         AND u."user_Id" != 999 
         AND COALESCE(h."user_MachipId", '') != 'MACJ-999'
       ORDER BY u."user_LastName" ASC`,
      { type: QueryTypes.SELECT }
    );

    // 2. Fetch Leave Balances
    const balances = await sequelize.query(
      `SELECT * FROM "Leave_Balance" WHERE "year" = :currentYear`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    // 3. Fetch Approved Leave Requests (VL/SL/EL/HD/Statutory)
    const leaves = await sequelize.query(
      `SELECT er."user_Id", er."emp_reqTypeId", 
              vl."StartDate" as "vS", vl."EndDate" as "vE", vl."NoDays" as "vD", 
              sl."StartDate" as "sS", sl."EndDate" as "sE", sl."NoDays" as "sD", 
              el."DateOfLeave" as "eS", el."NoDays" as "eD", 
              hd."DateOfLeave" as "hS",
              st."StartDate" as "stS", st."EndDate" as "stE", st."NoDays" as "stD"
       FROM "emp_Request" er
       LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
       LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
       LEFT JOIN "Emergency_Leave" el ON er."emp_reqId" = el."emp_reqId"
       LEFT JOIN "HalfDay_Leave" hd ON er."emp_reqId" = hd."emp_reqId"
       LEFT JOIN "Statutory_Leave" st ON er."emp_reqId" = st."emp_reqId"
       WHERE er."emp_reqStatusId" = 2 
       AND er."emp_reqTypeId" IN (3, 4, 6, 7, 8, 9, 10, 11, 12)
       AND (
         EXTRACT(YEAR FROM vl."StartDate") = :currentYear OR
         EXTRACT(YEAR FROM sl."StartDate") = :currentYear OR
         EXTRACT(YEAR FROM el."DateOfLeave") = :currentYear OR
         EXTRACT(YEAR FROM hd."DateOfLeave") = :currentYear OR
         EXTRACT(YEAR FROM st."StartDate") = :currentYear
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
      `SELECT "user_id", "log_Date", "attendance_StatusId", "time_Logged_inArr"
       FROM "employee_Logging_report"
       WHERE EXTRACT(YEAR FROM "log_Date") = :currentYear`,
      { replacements: { currentYear }, type: QueryTypes.SELECT }
    );

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const settings = await sequelize.query(`SELECT "vlRate", "slRate" FROM "SystemSettings" LIMIT 1`, { type: QueryTypes.SELECT });
    const vlRate = settings[0]?.vlRate ?? 1.0;
    const slRate = settings[0]?.slRate ?? 1.0;

    const summary = users.map(user => {
      const userBalance = balances.find(b => b.user_Id === user.user_Id) || { VL_balance: 7, SL_balance: 7, SoloParent_balance: 0 };
      
      const resData = {
        user_Id: user.user_Id,
        machipId: report => report.user_MachipId, // Placeholder, will fix below
        name: `${user.user_LastName} ${user.user_FirstName.charAt(0)}.`,
        vl: Array(12).fill(0),
        sl: Array(12).fill(0),
        sp: Array(12).fill(0), // New: Solo Parent
        ot: Array(12).fill(0),
        lates: Array(12).fill(0),
        absences: Array(12).fill(0),
        vlRemaining: userBalance.VL_balance,
        slRemaining: userBalance.SL_balance,
        spRemaining: userBalance.SoloParent_balance,
        dailyRate: user.dailyRate || 0,
      };

      // Fix machipId
      resData.machipId = user.user_MachipId;

      // Process Leaves
      leaves.filter(l => l.user_Id === user.user_Id).forEach(l => {
        const date = l.vS || l.sS || l.eS || l.hS || l.stS;
        if (!date) return;
        const month = new Date(date).getMonth();
        if (l.emp_reqTypeId === 3) resData.vl[month] += (l.vD || 0);
        else if (l.emp_reqTypeId === 4) resData.sl[month] += (l.sD || 0);
        else if (l.emp_reqTypeId === 6) resData.sl[month] += (l.eD || 0); // EL deducts from SL first
        else if (l.emp_reqTypeId === 7) resData.vl[month] += 0.5;
        else if (l.emp_reqTypeId === 10) resData.sp[month] += (l.stD || 0); // Solo Parent
        else if ([8, 9, 11, 12].includes(l.emp_reqTypeId)) {
          // Other statutory leaves (Maternity, etc.) could be tracked separately or as SL
          resData.sl[month] += (l.stD || 0); 
        }
      });

      // Process OT
      ots.filter(o => o.user_Id === user.user_Id).forEach(o => {
        const month = new Date(o.OT_DateOf).getMonth();
        resData.ot[month] += parseFloat(o.Total_Hrs || 0);
      });

      // Process Attendance
      attendanceStats.filter(a => a.user_id === user.user_Id).forEach(a => {
        const month = new Date(a.log_Date).getMonth();
        if (a.attendance_StatusId === 2) {
          try {
            const inArr = JSON.parse(a.time_Logged_inArr || "[]");
            if (inArr.length > 0) {
              const [h, m] = inArr[0].split(":").map(Number);
              const loginTime = h * 60 + m;
              const gracePeriodEnd = 8 * 60 + 35; // 8:35 AM
              if (loginTime > gracePeriodEnd) {
                resData.lates[month] += (loginTime - gracePeriodEnd);
              }
            }
          } catch (e) {
            // fallback to 1 if parsing fails? No, keep 0.
          }
        }
        else if (a.attendance_StatusId === 3) {
          const aDateStr = typeof a.log_Date === 'string' ? a.log_Date.substring(0, 10) : new Date(a.log_Date).toISOString().split('T')[0];
          const hasApprovedLeave = leaves.some(l => {
            if (l.user_Id !== user.user_Id) return false;
            const sDate = (l.vS || l.sS || l.eS || l.hS || l.stS || '').substring(0, 10);
            const eDate = (l.vE || l.sE || l.eS || l.hS || l.stE || sDate || '').substring(0, 10);
            return sDate && eDate && aDateStr >= sDate && aDateStr <= eDate;
          });
          if (!hasApprovedLeave) {
            resData.absences[month] += 1;
          }
        }
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

  try {
    if (!req.user || !req.user.user_Id) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const currentUserId = parseInt(req.user.user_Id, 10);
    const currentUserRoleId = parseInt(req.user.user_RoleId, 10);
    const currentUserRoleName = req.user.user_Role;

    const request = await sequelize.query(
      `SELECT "emp_reqId", "user_Id", "emp_reqTypeId", "emp_reqStatusId" 
       FROM "emp_Request" 
       WHERE "emp_reqId" = :requestId`,
      { replacements: { requestId }, type: QueryTypes.SELECT }
    );

    if (request.length === 0) {
      return res.status(404).json({ error: "Request not found." });
    }

    const reqRecord = request[0];
    const isStaffOrAdmin = [1, 2, 4].includes(currentUserRoleId) || 
      ["Admin Manager", "Supervisor", "Admin Accountant", "Admin"].includes(currentUserRoleName);
    const isOwner = currentUserId === parseInt(reqRecord.user_Id, 10);

    // Enforce ownership / staff authorization
    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to delete this request." });
    }

    // Employees can only delete their own Pending (1) or Resubmit (5) requests
    if (!isStaffOrAdmin && ![1, 5].includes(parseInt(reqRecord.emp_reqStatusId, 10))) {
      return res.status(400).json({ error: "Cannot delete a request that has already been approved or processed." });
    }

    await sequelize.transaction(async (t) => {
      const typeId = reqRecord.emp_reqTypeId;
      if (typeId === 1) await sequelize.query(`DELETE FROM "Overtime_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 2) await sequelize.query(`DELETE FROM "Onfield_Work" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 3) await sequelize.query(`DELETE FROM "Vacation_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 4) await sequelize.query(`DELETE FROM "Sick_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 5) await sequelize.query(`DELETE FROM "LogCorrection_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 6) await sequelize.query(`DELETE FROM "Emergency_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 7) await sequelize.query(`DELETE FROM "HalfDay_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if ([8, 9, 10, 11, 12].includes(typeId)) await sequelize.query(`DELETE FROM "Statutory_Leave" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
      else if (typeId === 13 || typeId === 14) await sequelize.query(`DELETE FROM "Loan_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });

      await sequelize.query(`DELETE FROM "emp_Request" WHERE "emp_reqId" = :requestId`, { replacements: { requestId }, transaction: t });
    });

    // Append-only audit log
    await logAudit(
      req,
      currentUserId,
      "Requests",
      "DELETE_REQUEST",
      "emp_Request",
      requestId,
      reqRecord,
      null
    );

    res.status(200).json({ message: "Request deleted successfully." });
  } catch (error) {
    console.error("[DELETE REQUEST ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
};