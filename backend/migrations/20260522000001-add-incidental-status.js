'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "attendance_status" ("statusId", "statusName")
      VALUES (7, 'Incidental Visit')
      ON CONFLICT ("statusId") DO UPDATE SET "statusName" = EXCLUDED."statusName";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DELETE FROM "attendance_status" WHERE "statusId" = 7;
    `);
  }
};
