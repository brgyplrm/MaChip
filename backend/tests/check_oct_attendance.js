const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { sequelize } = require('../src/config/sequelize');
const { QueryTypes } = require('sequelize');

async function check() {
  try {
    const user = await sequelize.query(
      `SELECT "user_Id", "user_FirstName", "user_LastName" FROM "User" WHERE "user_Id" = 1003`,
      { type: QueryTypes.SELECT }
    );
    console.log('User:', user);

    const reqs = await sequelize.query(
      `SELECT * FROM "emp_Request" WHERE "user_Id" = 1003 ORDER BY "emp_reqId" DESC`,
      { type: QueryTypes.SELECT }
    );
    console.log('Requests for 1003:', JSON.stringify(reqs, null, 2));

    const ids = reqs.map(r => r.emp_reqId);
    if (ids.length > 0) {
      const vl = await sequelize.query(
        `SELECT * FROM "Vacation_Leave" WHERE "emp_reqId" IN (:ids)`,
        { replacements: { ids }, type: QueryTypes.SELECT }
      );
      console.log('VL records:', JSON.stringify(vl, null, 2));
    }

    const attStatuses = await sequelize.query(`SELECT * FROM "attendance_status"`, { type: QueryTypes.SELECT });
    console.log('attendance_status table:', attStatuses);

    const reports = await sequelize.query(
      `SELECT
         r.*,
         a."statusName" AS "attendanceStatusName",
         l."statusName" AS "loggedStatusName"
       FROM "employee_Logging_report" r
       LEFT JOIN "attendance_status" a ON a."statusId" = r."attendance_StatusId"
       LEFT JOIN "logged_status" l ON l."statusId" = r."logged_StatusId"
       WHERE r."user_id" = 1003 AND r."log_Date" >= '2026-10-01' AND r."log_Date" <= '2026-10-15'
       ORDER BY r."log_Date" ASC`,
      { type: QueryTypes.SELECT }
    );
    console.log('Reports for Oct 1-15:');
    const [s] = await sequelize.query(`SELECT "workHourThreshold" FROM "SystemSettings"`, { type: QueryTypes.SELECT });
    console.log('workHourThreshold:', s);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
check();
