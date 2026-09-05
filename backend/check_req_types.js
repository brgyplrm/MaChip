const { sequelize } = require('./src/config/sequelize');
const { QueryTypes } = require('sequelize');

async function check() {
  try {
    const results = await sequelize.query('SELECT * FROM "request_Type"', { type: QueryTypes.SELECT });
    console.log(results);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
