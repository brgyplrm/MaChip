const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/config/sequelize');

async function check() {
  try {
    const [types] = await sequelize.query('SELECT * FROM "request_Type" ORDER BY "reqTypeId"');
    console.log('Request Types:');
    console.table(types);

    const [status] = await sequelize.query('SELECT * FROM "request_Status" ORDER BY "statusId"');
    console.log('Request Statuses:');
    console.table(status);
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

check();
