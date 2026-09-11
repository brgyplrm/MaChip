'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      INSERT INTO "request_Type" ("reqTypeId", "reqTypeName")
      VALUES 
        (1, 'Overtime'),
        (2, 'Onfield Work'),
        (3, 'Vacation Leave'),
        (4, 'Sick Leave'),
        (5, 'Time Adjustment'),
        (6, 'Emergency Leave'),
        (7, 'Half-Day Leave'),
        (8, 'Maternity Leave'),
        (9, 'Paternity Leave'),
        (10, 'Solo Parent Leave'),
        (11, 'VAWC Leave'),
        (12, 'Special Leave for Women'),
        (13, 'Loan Certification'),
        (14, 'Loan Enrollment')
      ON CONFLICT ("reqTypeId") DO UPDATE SET "reqTypeName" = EXCLUDED."reqTypeName";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Keep for referential integrity
  }
};
