'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Payroll_Earnings', 'nightOT_Hrs', {
      type: Sequelize.FLOAT,
      defaultValue: 0
    });
    await queryInterface.addColumn('Payroll_Earnings', 'nightOT_Amnt', {
      type: Sequelize.FLOAT,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Payroll_Earnings', 'nightOT_Hrs');
    await queryInterface.removeColumn('Payroll_Earnings', 'nightOT_Amnt');
  }
};
