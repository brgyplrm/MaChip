const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { sendRequestNotificationEmail } = require("./emailService");

/**
 * Checks for requests pending for more than 8 hours and escalates them via email.
 */
async function checkPendingRequests() {
  console.log("[ESCALATION] Checking for stalled pending requests...");
  try {
    // 1. Find requests that are Pending (1) or Recommended (4) and older than 8 hours
    // We use CURRENT_TIMESTAMP - interval '8 hours'
    const stalledRequests = await sequelize.query(
      `SELECT 
        er."emp_reqId", 
        er."createdAt", 
        rt."reqTypeName", 
        u."user_FirstName" || ' ' || u."user_LastName" as "requesterName",
        er."emp_reqTypeId"
       FROM "emp_Request" er
       JOIN "User" u ON er."user_Id" = u."user_Id"
       JOIN "request_Type" rt ON er."emp_reqTypeId" = rt."reqTypeId"
       WHERE er."emp_reqStatusId" IN (1, 4)
       AND er."createdAt" < (CURRENT_TIMESTAMP - INTERVAL '8 hours')
       AND (er."last_escalated_at" IS NULL OR er."last_escalated_at" < (CURRENT_TIMESTAMP - INTERVAL '12 hours'))`,
      { type: QueryTypes.SELECT }
    );

    if (stalledRequests.length === 0) {
      console.log("[ESCALATION] No stalled requests found.");
      return;
    }

    // 2. Find Admins (1) and Supervisor 1 (Let's assume Supervisor 1 has a specific property or we notify all Admins)
    // The requirement says "admin 1 and supervisor 1"
    const approversToNotify = await sequelize.query(
      `SELECT "user_Email", "user_FirstName", "user_RoleId" FROM "User" WHERE "user_RoleId" = 1 AND "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    for (const req of stalledRequests) {
      console.log(`[ESCALATION] Escalating request #${req.emp_reqId} by ${req.requesterName}`);
      
      for (const approver of approversToNotify) {
        if (approver.user_Email) {
          await sendRequestNotificationEmail({
            toEmail: approver.user_Email,
            approverName: approver.user_FirstName,
            requesterName: req.requesterName,
            requestType: req.reqTypeName,
            dateStr: new Date(req.createdAt).toLocaleDateString(),
            duration: "PENDING > 8 HOURS",
            isEscalation: true
          });
        }
      }

      // Update the request to mark it as escalated so we don't spam
      await sequelize.query(
        `UPDATE "emp_Request" SET "last_escalated_at" = CURRENT_TIMESTAMP WHERE "emp_reqId" = :emp_reqId`,
        { replacements: { emp_reqId: req.emp_reqId }, type: QueryTypes.UPDATE }
      );
    }

  } catch (error) {
    console.error("[ESCALATION ERROR]:", error.message);
  }
}

module.exports = { checkPendingRequests };
