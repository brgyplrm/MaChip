const { sequelize } = require('./src/config/sequelize.js');

async function migrate() {
  try {
    await sequelize.query(`ALTER TYPE "enum_Loan_Deductions_deductionType" ADD VALUE IF NOT EXISTS 'hdmf_calamity'`);
    console.log("Database ENUM 'hdmf_calamity' added successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}
migrate();
