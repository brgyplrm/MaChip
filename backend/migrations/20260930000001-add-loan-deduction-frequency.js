'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // 1. Add deductionFrequency to Loan_Request
    if (await tableExists('Loan_Request')) {
      const lrTable = await queryInterface.describeTable('Loan_Request');
      if (!lrTable.deductionFrequency) {
        await queryInterface.addColumn('Loan_Request', 'deductionFrequency', {
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'semi-monthly'
        });
      }
    }

    // 2. Add deductionFrequency to Loan_Deductions
    if (await tableExists('Loan_Deductions')) {
      const ldTable = await queryInterface.describeTable('Loan_Deductions');
      if (!ldTable.deductionFrequency) {
        await queryInterface.addColumn('Loan_Deductions', 'deductionFrequency', {
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'semi-monthly'
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Keep columns for schema stability
  }
};
