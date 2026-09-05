'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Payroll_Separation');
    if (!tableInfo.loanDeductions) await queryInterface.addColumn('Payroll_Separation', 'loanDeductions', { type: Sequelize.FLOAT, defaultValue: 0, allowNull: false });
    if (!tableInfo.netAmount) await queryInterface.addColumn('Payroll_Separation', 'netAmount', { type: Sequelize.FLOAT, defaultValue: 0, allowNull: false });
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Payroll_Separation');
    if (tableInfo.loanDeductions) await queryInterface.removeColumn('Payroll_Separation', 'loanDeductions');
    if (tableInfo.netAmount) await queryInterface.removeColumn('Payroll_Separation', 'netAmount');
  }
};
