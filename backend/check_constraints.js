const { sequelize } = require('./src/config/sequelize.js');

async function test() {
  try {
    const res = await sequelize.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE conrelid = '"Payroll_Cash_Advances"'::regclass
    `);
    console.log("Constraints:", JSON.stringify(res[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();