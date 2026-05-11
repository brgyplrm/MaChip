const { sequelize } = require('./backend/src/config/sequelize');
async function run() {
  try {
    const [l] = await sequelize.query("SELECT * FROM \"logged_status\" LIMIT 1");
    console.log("logged_status:", l);
    const [a] = await sequelize.query("SELECT * FROM \"attendance_status\" LIMIT 1");
    console.log("attendance_status:", a);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
