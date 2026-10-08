const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/config/sequelize');

async function inspect() {
  try {
    const [payrolls] = await sequelize.query(`
      SELECT "period_Start", "period_End", "status", COUNT(*) as count 
      FROM "Payroll" 
      WHERE "period_Start" >= '2026-08-01' 
      GROUP BY "period_Start", "period_End", "status" 
      ORDER BY "period_Start" ASC
    `);
    console.log('Payrolls Aug-Oct 2026:');
    console.table(payrolls);

    const [logs] = await sequelize.query(`
      SELECT SUBSTRING("log_Date"::text, 1, 7) as month, COUNT(*) as cnt 
      FROM "user_logging" 
      WHERE "log_Date" >= '2026-08-01' 
      GROUP BY month 
      ORDER BY month ASC
    `);
    console.log('user_logging by month:');
    console.table(logs);

    const [reports] = await sequelize.query(`
      SELECT SUBSTRING("log_Date"::text, 1, 7) as month, COUNT(*) as cnt 
      FROM "employee_Logging_report" 
      WHERE "log_Date" >= '2026-08-01' 
      GROUP BY month 
      ORDER BY month ASC
    `);
    console.log('employee_Logging_report by month:');
    console.table(reports);

    const [requests] = await sequelize.query(`
      SELECT SUBSTRING("date_Filed"::text, 1, 7) as month, COUNT(*) as cnt 
      FROM "emp_Request" 
      WHERE "date_Filed" >= '2026-08-01' 
      GROUP BY month 
      ORDER BY month ASC
    `);
    console.log('emp_Request by month:');
    console.table(requests);

    // Also inspect max dates in each
    const [maxLog] = await sequelize.query(`SELECT MIN("log_Date") as min_d, MAX("log_Date") as max_d FROM "user_logging" WHERE "log_Date" >= '2026-09-01'`);
    console.log('user_logging date range Sept-Oct:', maxLog[0]);

    const [maxRep] = await sequelize.query(`SELECT MIN("log_Date") as min_d, MAX("log_Date") as max_d FROM "employee_Logging_report" WHERE "log_Date" >= '2026-09-01'`);
    console.log('employee_Logging_report date range Sept-Oct:', maxRep[0]);

  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

inspect();
