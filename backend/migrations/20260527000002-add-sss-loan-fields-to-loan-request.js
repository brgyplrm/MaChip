'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Loan_Request');
    if (!tableInfo.loanReferenceNo) await queryInterface.addColumn('Loan_Request', 'loanReferenceNo', { type: Sequelize.STRING(100), allowNull: true });
    if (!tableInfo.loanApprovalDate) await queryInterface.addColumn('Loan_Request', 'loanApprovalDate', { type: Sequelize.DATEONLY, allowNull: true });
    if (!tableInfo.monthlyAmortization) await queryInterface.addColumn('Loan_Request', 'monthlyAmortization', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    if (!tableInfo.totalLoanTerm) await queryInterface.addColumn('Loan_Request', 'totalLoanTerm', { type: Sequelize.INTEGER, allowNull: true });
    if (!tableInfo.amortizationStartMonth) await queryInterface.addColumn('Loan_Request', 'amortizationStartMonth', { type: Sequelize.STRING(50), allowNull: true });
    if (!tableInfo.totalOutstandingBalance) await queryInterface.addColumn('Loan_Request', 'totalOutstandingBalance', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Loan_Request', 'loanReferenceNo');
    await queryInterface.removeColumn('Loan_Request', 'loanApprovalDate');
    await queryInterface.removeColumn('Loan_Request', 'monthlyAmortization');
    await queryInterface.removeColumn('Loan_Request', 'totalLoanTerm');
    await queryInterface.removeColumn('Loan_Request', 'amortizationStartMonth');
    await queryInterface.removeColumn('Loan_Request', 'totalOutstandingBalance');
  }
};
