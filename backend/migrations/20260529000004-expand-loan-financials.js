'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Expansion for Loan_Request (Financial Transparency)
    await queryInterface.addColumn('Loan_Request', 'interestRate', {
      type: Sequelize.FLOAT,
      defaultValue: 0.10, // 10% standard SSS
      allowNull: true
    });
    await queryInterface.addColumn('Loan_Request', 'serviceFee', {
      type: Sequelize.FLOAT,
      defaultValue: 0.01, // 1% standard
      allowNull: true
    });
    await queryInterface.addColumn('Loan_Request', 'proRatedInterest', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0,
      allowNull: true
    });
    await queryInterface.addColumn('Loan_Request', 'netDisbursement', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });

    // 2. Expansion for Payroll_GovernmentLoans (Diminishing Ledger)
    await queryInterface.addColumn('Payroll_GovernmentLoans', 'principalPaid', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0,
      allowNull: true
    });
    await queryInterface.addColumn('Payroll_GovernmentLoans', 'interestPaid', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns if rolled back
    await queryInterface.removeColumn('Loan_Request', 'interestRate');
    await queryInterface.removeColumn('Loan_Request', 'serviceFee');
    await queryInterface.removeColumn('Loan_Request', 'proRatedInterest');
    await queryInterface.removeColumn('Loan_Request', 'netDisbursement');
    await queryInterface.removeColumn('Payroll_GovernmentLoans', 'principalPaid');
    await queryInterface.removeColumn('Payroll_GovernmentLoans', 'interestPaid');
  }
};
