'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "employementStatus" ("statusId", "statusName")
      VALUES 
        (1, 'Regular'),
        (2, 'Probationary'),
        (3, 'Intern')
      ON CONFLICT ("statusId") DO UPDATE SET "statusName" = EXCLUDED."statusName";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Keep them for referential integrity
  }
};
