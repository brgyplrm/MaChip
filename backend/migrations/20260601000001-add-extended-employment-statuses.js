'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "employementStatus" ("statusId", "statusName")
      VALUES 
        (4, 'Terminated'),
        (5, 'Retired')
      ON CONFLICT ("statusId") DO UPDATE SET "statusName" = EXCLUDED."statusName";
      DELETE FROM "employementStatus" WHERE "statusId" = 6;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Keep for referential integrity
  }
};
