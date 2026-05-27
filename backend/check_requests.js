const { sequelize } = require('./src/config/sequelize.js');
const { QueryTypes } = require('sequelize');

async function test() {
  try {
    const res = await sequelize.query(`
      SELECT er."emp_reqId", er."emp_reqStatusId", lr."agency", lr."amountRequested", lr."totalOutstandingBalance"
      FROM "emp_Request" er
      JOIN "Loan_Request" lr ON er."emp_reqId" = lr."emp_reqId"
      WHERE er."emp_reqTypeId" = 14
      ORDER BY er."createdAt" DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });
    console.log("Recent Loan Requests:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();