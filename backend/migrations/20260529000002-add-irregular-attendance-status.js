'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "attendance_status" ("statusId", "statusName")
      VALUES (8, 'Irregular')
      ON CONFLICT ("statusId") DO NOTHING;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DELETE FROM "attendance_status" WHERE "statusId" = 8;
    `);
  }
};
