const { sequelize } = require('./src/config/sequelize.js');

async function test() {
  try {
    const res = await sequelize.query('SELECT * FROM "Payroll_Cash_Advances"');
    console.log("Current Cash Advances:", JSON.stringify(res[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();