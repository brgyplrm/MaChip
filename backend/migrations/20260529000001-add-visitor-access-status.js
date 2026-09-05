'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add Visitor Access statuses to logged_status
    await queryInterface.sequelize.query(`
      INSERT INTO "logged_status" ("statusId", "statusName")
      VALUES 
        (8, 'Visitor Access: Opening'),
        (9, 'Visitor Access: Door Closed')
      ON CONFLICT ("statusId") DO NOTHING;
    `);

    // 2. Create a "Visitor" user if it doesn't exist
    // We'll use ID 999 for the Visitor user
    const [visitor] = await queryInterface.sequelize.query(
      'SELECT "user_Id" FROM "User" WHERE "user_Id" = 999'
    );

    if (!visitor || visitor.length === 0) {
      const now = new Date().toISOString();
      await queryInterface.sequelize.query(`
        INSERT INTO "User" (
          "user_Id", "user_FirstName", "user_LastName", "user_Email", "user_Password", 
          "user_RoleId", "user_EmploymentStatusId", "createdAt", "updatedAt"
        ) VALUES (
          999, 'Visitor', 'Access', 'visitor@machip.system', 'SYSTEM_RESERVED', 
          1, 1, '${now}', '${now}'
        ) ON CONFLICT ("user_Id") DO NOTHING;
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Optionally remove the statuses, but we keep the user for data integrity
    await queryInterface.sequelize.query(`
      DELETE FROM "logged_status" WHERE "statusId" IN (8, 9);
    `);
  }
};
