'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Synchronize User.position_id and User.department with Position table records based on title
    await queryInterface.sequelize.query(`
      UPDATE "User" u
      SET "position_id" = p."positionId",
          "department" = p."department"
      FROM "Position" p
      WHERE TRIM(LOWER(u."position")) = TRIM(LOWER(p."title"))
        AND (u."position_id" IS DISTINCT FROM p."positionId" OR u."department" IS DISTINCT FROM p."department");
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // No-op rollback
  }
};
