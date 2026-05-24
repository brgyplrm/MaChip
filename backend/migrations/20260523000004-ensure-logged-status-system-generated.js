'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Ensure logged_status has 'System Generated' (7)
    await queryInterface.sequelize.query(`
      INSERT INTO "logged_status" ("statusId", "statusName")
      VALUES (7, 'System Generated')
      ON CONFLICT ("statusId") DO UPDATE SET "statusName" = EXCLUDED."statusName";
    `);

    // 2. Ensure all other standard logged statuses exist (1-6)
    await queryInterface.sequelize.query(`
      INSERT INTO "logged_status" ("statusId", "statusName")
      VALUES 
        (1, 'Clock In'),
        (2, 'Clock Out'),
        (3, 'Out For Lunch'),
        (4, 'In From Lunch'),
        (5, 'Overtime-In'),
        (6, 'Overtime-Out')
      ON CONFLICT ("statusId") DO NOTHING;
    `);

    // 3. Ensure attendance_status has 'Exempt' (6) and others
    await queryInterface.sequelize.query(`
      INSERT INTO "attendance_status" ("statusId", "statusName")
      VALUES 
        (1, 'On-Time'),
        (2, 'Late'),
        (3, 'Absent'),
        (4, 'On-Leave'),
        (5, 'On-Field'),
        (6, 'Exempt')
      ON CONFLICT ("statusId") DO NOTHING;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // We don't want to remove these as they are core to the system
  }
};
