'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Payroll_Retirement');
    if (!tableInfo.loanDeductions) await queryInterface.addColumn('Payroll_Retirement', 'loanDeductions', { type: Sequelize.FLOAT, defaultValue: 0, allowNull: false });
    if (!tableInfo.netAmount) await queryInterface.addColumn('Payroll_Retirement', 'netAmount', { type: Sequelize.FLOAT, defaultValue: 0, allowNull: false });
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Payroll_Retirement');
    if (tableInfo.loanDeductions) await queryInterface.removeColumn('Payroll_Retirement', 'loanDeductions');
    if (tableInfo.netAmount) await queryInterface.removeColumn('Payroll_Retirement', 'netAmount');
  }
};
