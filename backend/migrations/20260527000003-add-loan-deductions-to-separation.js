'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Payroll_Separation', 'loanDeductions', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
    await queryInterface.addColumn('Payroll_Separation', 'netAmount', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Payroll_Separation', 'loanDeductions');
    await queryInterface.removeColumn('Payroll_Separation', 'netAmount');
  }
};
