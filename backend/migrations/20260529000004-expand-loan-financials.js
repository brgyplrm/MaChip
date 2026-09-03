'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Expansion for Loan_Request (Financial Transparency)
    const lrTable = await queryInterface.describeTable('Loan_Request');
    if (!lrTable.interestRate) await queryInterface.addColumn('Loan_Request', 'interestRate', { type: Sequelize.FLOAT, defaultValue: 0.10, allowNull: true });
    if (!lrTable.serviceFee) await queryInterface.addColumn('Loan_Request', 'serviceFee', { type: Sequelize.FLOAT, defaultValue: 0.01, allowNull: true });
    if (!lrTable.proRatedInterest) await queryInterface.addColumn('Loan_Request', 'proRatedInterest', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, allowNull: true });
    if (!lrTable.netDisbursement) await queryInterface.addColumn('Loan_Request', 'netDisbursement', { type: Sequelize.DECIMAL(12, 2), allowNull: true });

    // 2. Expansion for Payroll_GovernmentLoans (Diminishing Ledger)
    const pglTable = await queryInterface.describeTable('Payroll_GovernmentLoans');
    if (!pglTable.principalPaid) await queryInterface.addColumn('Payroll_GovernmentLoans', 'principalPaid', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, allowNull: true });
    if (!pglTable.interestPaid) await queryInterface.addColumn('Payroll_GovernmentLoans', 'interestPaid', { type: Sequelize.DECIMAL(12, 2), defaultValue: 0, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    const lrTable = await queryInterface.describeTable('Loan_Request');
    if (lrTable.interestRate) await queryInterface.removeColumn('Loan_Request', 'interestRate');
    if (lrTable.serviceFee) await queryInterface.removeColumn('Loan_Request', 'serviceFee');
    if (lrTable.proRatedInterest) await queryInterface.removeColumn('Loan_Request', 'proRatedInterest');
    if (lrTable.netDisbursement) await queryInterface.removeColumn('Loan_Request', 'netDisbursement');

    const pglTable = await queryInterface.describeTable('Payroll_GovernmentLoans');
    if (pglTable.principalPaid) await queryInterface.removeColumn('Payroll_GovernmentLoans', 'principalPaid');
    if (pglTable.interestPaid) await queryInterface.removeColumn('Payroll_GovernmentLoans', 'interestPaid');
  }
};
