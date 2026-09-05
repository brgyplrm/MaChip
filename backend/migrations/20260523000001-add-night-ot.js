'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Payroll_Earnings');
    if (!tableInfo.nightOT_Hrs) {
      await queryInterface.addColumn('Payroll_Earnings', 'nightOT_Hrs', {
        type: Sequelize.FLOAT,
        defaultValue: 0
      });
    }
    if (!tableInfo.nightOT_Amnt) {
      await queryInterface.addColumn('Payroll_Earnings', 'nightOT_Amnt', {
        type: Sequelize.FLOAT,
        defaultValue: 0
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Payroll_Earnings');
    if (tableInfo.nightOT_Hrs) await queryInterface.removeColumn('Payroll_Earnings', 'nightOT_Hrs');
    if (tableInfo.nightOT_Amnt) await queryInterface.removeColumn('Payroll_Earnings', 'nightOT_Amnt');
  }
};
