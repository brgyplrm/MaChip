const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("./systemTime.js");

/**
 * Ensures all users who haven't logged in for the current system date
 * are marked as absent if it's past the cutoff time (5:30 PM),
 * marked as 'On-Field' if they have approved field work,
 * or skipped if they have an approved leave request.
 */
async function ensureAbsentsMarked() {
  try {
    const now = await getSystemTime();
    
    // Manual format to YYYY-MM-DD in LOCAL time (Asia/Manila)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    
    const dayOfWeek = now.getDay(); // 0 = Sunday

    console.log(`[DEBUG] ensureAbsentsMarked triggered for: ${todayStr} (Day: ${dayOfWeek})`);

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
      if (existingReport.length === 0) {
        // 3. Check for approved On-Field Work FIRST (This happens regardless of cutoff time)
        const onfieldResult = await sequelize.query(
          `SELECT ow.* FROM "Onfield_Work" ow
           JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
           WHERE er."user_Id" = :userId 
           AND ow."DateonField" = :todayStr
           AND er."emp_reqStatusId" = 2 -- Approved
           LIMIT 1`,
          { replacements: { userId, todayStr }, type: QueryTypes.SELECT }
        );

        if (onfieldResult.length > 0) {
          console.log(`[DEBUG] Auto-crediting On-Field Work for user ${userId} on ${todayStr}`);
          
          // Insert start log (Status 1 = Clock In)
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, '08:30:00', 1, 5)
             ON CONFLICT DO NOTHING`, 
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
          
          // Insert end log (Status 2 = Clock Out)
          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, '17:30:00', 2, 5)
             ON CONFLICT DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
          
          // Create summary report (Status 5 = On-Field)
          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '["08:30:00"]', '["17:30:00"]', 5, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );
          continue; 
        }

        // 4. Check if they have ANY logs (just in case they have logs but no report)
        const logs = await sequelize.query(
          `SELECT * FROM "user_logging"
           WHERE "user_id" = :userId AND "log_Date" = :todayStr
           LIMIT 1`,
          { replacements: { userId, todayStr }, type: QueryTypes.SELECT }
        );

        if (logs.length === 0) {
          // 5. Only mark as Absent (status 3) if past cutoff and not a Sunday
          if (now >= cutoffTime && dayOfWeek !== 0) {
            // Check if user is actually on leave - if so, don't mark as absent
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
              console.log(`[DEBUG] Marking user ${userId} as Absent for ${todayStr}`);
              // Mark as Absent (status 3)
              await sequelize.query(
                `INSERT INTO "user_logging"
                  ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
                 VALUES (:userId, :todayStr, '17:30:00', 2, 3)
                 ON CONFLICT DO NOTHING`,
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
    console.error("[ERROR] ensureAbsentsMarked:", error);
  }
}

module.exports = { ensureAbsentsMarked };
