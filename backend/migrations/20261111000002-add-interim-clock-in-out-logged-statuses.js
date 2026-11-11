'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "logged_status" ("statusId", "statusName")
      VALUES 
        (10, 'Clock IN'),
        (11, 'Clock OUT')
      ON CONFLICT ("statusId") DO NOTHING;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DELETE FROM "logged_status" WHERE "statusId" IN (10, 11);
    `);
  }
};
