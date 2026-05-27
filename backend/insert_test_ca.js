const { sequelize } = require('./src/config/sequelize.js');

async function test() {
  try {
    const now = new Date().toISOString();
    await sequelize.query(`
      INSERT INTO "Payroll_Cash_Advances" ("user_Id", "date", "amount", "createdAt", "updatedAt")
      VALUES (3, '2026-05-31', 5999, '${now}', '${now}')
      ON CONFLICT ("user_Id", "date") DO UPDATE SET "amount" = EXCLUDED.amount
    `);
    console.log("Inserted test record for Jim Tejeros.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();