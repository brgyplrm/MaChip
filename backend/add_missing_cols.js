const { sequelize } = require('./src/config/sequelize.js');
const { QueryTypes } = require('sequelize');

async function fix() {
  try {
    console.log("Adding consoDP, pagibigTAV, mscCount, avgMSC to Loan_Request table...");
    await sequelize.query(`ALTER TABLE "Loan_Request" ADD COLUMN IF NOT EXISTS "consoDP" NUMERIC DEFAULT 0`);
    await sequelize.query(`ALTER TABLE "Loan_Request" ADD COLUMN IF NOT EXISTS "pagibigTAV" NUMERIC DEFAULT 0`);
    await sequelize.query(`ALTER TABLE "Loan_Request" ADD COLUMN IF NOT EXISTS "mscCount" VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE "Loan_Request" ADD COLUMN IF NOT EXISTS "avgMSC" NUMERIC DEFAULT 0`);
    console.log("Table columns updated successfully.");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exit(1);
  }
}
fix();
