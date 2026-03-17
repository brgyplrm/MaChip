const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("./systemTime.js");

/**
 * Ensures all users who haven't logged in for the current system date
 * are marked as absent if it's past the cutoff time (5:30 PM),
 * or marked as 'On Leave' if they have an approved leave request.
 */
async function ensureAbsentsMarked() {
  try {
    const now = await getSystemTime();
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay(); // 0 = Sunday

    // 1. Get all active users
    const users = await sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "deletedAt" IS NULL`,
      { type: QueryTypes.SELECT }
    );

    const cutoffTime = new Date(now);
    cutoffTime.setHours(17, 30, 0, 0);

    for (const user of users) {
      const userId = user.user_Id;

      // 2. Check if the user already has a report for today
      const existingReport = await sequelize.query(
        `SELECT * FROM "employee_Logging_report"
         WHERE "user_id" = :userId AND "log_Date" = :todayStr
         LIMIT 1`,
        { replacements: { userId, todayStr }, type: QueryTypes.SELECT }
      );

      // If no report exists, it means they haven't logged in at all today
      if (!existingReport[0]) {
        const logs = await sequelize.query(
          `SELECT * FROM "user_logging"
           WHERE "user_id" = :userId AND "log_Date" = :todayStr
           LIMIT 1`,
          { replacements: { userId, todayStr }, type: QueryTypes.SELECT }
        );

        if (!logs[0]) {
          // Only mark as Absent (status 3) if past cutoff and not a Sunday
          if (now >= cutoffTime && dayOfWeek !== 0) {
            // Check if user is actually on leave - if so, don't mark as absent
            // We don't insert "On Leave" into the database here because the user
            // wants it to show ONLY in the individual Last Activity Log (handled in the controller)
            const leaveResult = await sequelize.query(
              `SELECT er."emp_reqTypeId"
               FROM "emp_Request" er
               LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
               LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
               WHERE er."user_Id" = :userId 
               AND er."emp_reqStatusId" = 2 -- Approved
               AND (
                 (:todayStr BETWEEN vl."StartDate" AND vl."EndDate") OR
                 (:todayStr BETWEEN sl."StartDate" AND sl."EndDate")
               )
               LIMIT 1`,
              { replacements: { userId, todayStr }, type: QueryTypes.SELECT }
            );

            if (leaveResult.length === 0) {
              // Mark as Absent (status 3)
              await sequelize.query(
                `INSERT INTO "user_logging"
                  ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
                 VALUES (:userId, :todayStr, '17:30:00', 2, 3)`,
                { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
              );

              await sequelize.query(
                `INSERT INTO "employee_Logging_report"
                  ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr",
                   "attendance_StatusId", "logged_StatusId")
                 VALUES (:userId, :todayStr, '[]', '[]', 3, 2)
                 ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
                { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in ensureAbsentsMarked:", error);
  }
}

module.exports = { ensureAbsentsMarked };
