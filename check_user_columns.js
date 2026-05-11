const { sequelize } = require('./backend/src/config/sequelize');
async function run() {
  try {
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User'
    `);
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
