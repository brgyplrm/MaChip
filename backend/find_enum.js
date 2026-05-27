const { sequelize } = require('./src/config/sequelize.js');

async function test() {
  try {
    const res = await sequelize.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname LIKE '%deductionType%'
    `);
    console.log("Found Enums:", JSON.stringify(res[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();