const { sequelize } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime } = require("./systemTime.js");
const { logTransaction } = require("./logger");

/**
 * Optimized version: Marks all users who haven't logged in for the current system date.
 * Uses bulk queries instead of a per-user loop to minimize database load.
 */
async function ensureAbsentsMarked() {
  try {
    const now = await getSystemTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const dayOfWeek = now.getDay(); // 0 = Sunday

    const cutoffTime = new Date(now);
    cutoffTime.setHours(17, 30, 0, 0);

    console.log(`[SYSTEM] Background Task: ensureAbsentsMarked triggered for ${todayStr}`);

    // 1. Process On-Field Work (Bulk)
    // Find all users who have approved on-field work today but no report yet
    const onFieldUsers = await sequelize.query(
      `SELECT u."user_Id"
       FROM "User" u
       JOIN "Onfield_Work" ow ON u."user_Id" = ow."user_Id"
       JOIN "emp_Request" er ON ow."emp_reqId" = er."emp_reqId"
       LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
       WHERE u."deletedAt" IS NULL 
         AND elr."user_id" IS NULL
         AND ow."DateonField" = :todayStr
         AND er."emp_reqStatusId" = 2`,
      { replacements: { todayStr }, type: QueryTypes.SELECT }
    );

    if (onFieldUsers.length > 0) {
      console.log(`[SYSTEM] Auto-crediting On-Field Work for ${onFieldUsers.length} users.`);
      for (const user of onFieldUsers) {
        const userId = user.user_Id;
        
        // Use individual inserts for simplicity but the set is now filtered and small
        await sequelize.query(
          `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
           VALUES (:userId, :todayStr, '08:30:00', 1, 5), (:userId, :todayStr, '17:30:00', 2, 5)
           ON CONFLICT DO NOTHING`, 
          { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
        );
        
        await sequelize.query(
          `INSERT INTO "employee_Logging_report" 
            ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
           VALUES (:userId, :todayStr, '["08:30:00"]', '["17:30:00"]', 5, 2)
           ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
          { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
        );

        await logTransaction(userId, null, "AUTO_ONFIELD_CREDIT", `Auto-credited On-Field Work for today`, { date: todayStr });
      }
    }

    // 2. Process Absents (Bulk) - Only past 5:30 PM and not Sunday
    if (now >= cutoffTime && dayOfWeek !== 0) {
      // Find all users who:
      // - Are active
      // - Have no report today
      // - Are NOT on approved leave today
      const absentUsers = await sequelize.query(
        `SELECT u."user_Id"
         FROM "User" u
         LEFT JOIN "employee_Logging_report" elr ON u."user_Id" = elr."user_id" AND elr."log_Date" = :todayStr
         WHERE u."deletedAt" IS NULL 
           AND elr."user_id" IS NULL
           AND NOT EXISTS (
             -- Check for Approved Leave (Vacation or Sick)
             SELECT 1 FROM "emp_Request" er
             LEFT JOIN "Vacation_Leave" vl ON er."emp_reqId" = vl."emp_reqId"
             LEFT JOIN "Sick_Leave" sl ON er."emp_reqId" = sl."emp_reqId"
             WHERE er."user_Id" = u."user_Id" 
               AND er."emp_reqStatusId" = 2
               AND (:todayStr BETWEEN vl."StartDate" AND vl."EndDate" OR :todayStr BETWEEN sl."StartDate" AND sl."EndDate")
           )`,
        { replacements: { todayStr }, type: QueryTypes.SELECT }
      );

      if (absentUsers.length > 0) {
        console.log(`[SYSTEM] Marking ${absentUsers.length} users as Absent.`);
        for (const user of absentUsers) {
          const userId = user.user_Id;

          await sequelize.query(
            `INSERT INTO "user_logging" ("user_id", "log_Date", "time_Logged", "logged_StatusId", "attendance_StatusId")
             VALUES (:userId, :todayStr, '17:30:00', 2, 3)
             ON CONFLICT DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );

          await sequelize.query(
            `INSERT INTO "employee_Logging_report" 
              ("user_id", "log_Date", "time_Logged_inArr", "time_Logged_outArr", "attendance_StatusId", "logged_StatusId")
             VALUES (:userId, :todayStr, '[]', '[]', 3, 2)
             ON CONFLICT ("user_id", "log_Date") DO NOTHING`,
            { replacements: { userId, todayStr }, type: QueryTypes.INSERT }
          );

          await logTransaction(userId, null, "AUTO_ABSENT_MARK", `Auto-marked as Absent for today`, { date: todayStr });
        }
      }
    }
  } catch (error) {
    console.error("[ERROR] ensureAbsentsMarked:", error);
  }
}

module.exports = { ensureAbsentsMarked };
