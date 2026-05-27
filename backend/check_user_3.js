const { sequelize } = require('./src/config/sequelize.js');
const { QueryTypes } = require('sequelize');

async function test() {
  try {
    const res = await sequelize.query('SELECT "user_FirstName", "user_LastName", "dailyRate" FROM "User" WHERE "user_Id" = 3', { type: QueryTypes.SELECT });
    console.log("User 3 Details:", res[0]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();