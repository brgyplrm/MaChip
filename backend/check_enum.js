const { sequelize } = require('./src/config/sequelize.js');

async function test() {
  try {
    const res = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = 'enum_Loan_Deductions_deductionType'::regtype
    `);
    console.log("Enum Values:", res[0].map(r => r.enumlabel));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();