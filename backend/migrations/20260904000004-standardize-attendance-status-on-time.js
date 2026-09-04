'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE "attendance_status" SET "statusName" = 'On Time' WHERE "statusId" = 1`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `UPDATE "attendance_status" SET "statusName" = 'Present' WHERE "statusId" = 1`
    );
  }
};
