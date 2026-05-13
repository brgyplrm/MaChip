const { sequelize } = require('./backend/src/config/sequelize');
const { QueryTypes } = require('sequelize');
async function run() {
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
         h."user_MachipId",
         ls."statusName" AS "loggedStatusName",
         att."statusName" AS "attendanceStatusName"
       FROM "user_logging" ul
       LEFT JOIN "User" u ON u."user_Id" = ul."user_id"
       LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       LEFT JOIN "logged_status" ls ON ls."statusId" = ul."logged_StatusId"
       LEFT JOIN "attendance_status" att ON att."statusId" = ul."attendance_StatusId"
       ORDER BY ul."user_loggingId" DESC`,
      { type: QueryTypes.SELECT },
    );
    console.log("Count:", logs.length);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
