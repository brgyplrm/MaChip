'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Payroll_Retirement', 'loanDeductions', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
    await queryInterface.addColumn('Payroll_Retirement', 'netAmount', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Payroll_Retirement', 'loanDeductions');
    await queryInterface.removeColumn('Payroll_Retirement', 'netAmount');
  }
};
