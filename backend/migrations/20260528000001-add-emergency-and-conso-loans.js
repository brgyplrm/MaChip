'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Payroll_GovernmentLoans_government_type" ADD VALUE IF NOT EXISTS 'SSS Emergency'`);
      console.log("Added SSS Emergency to Payroll_GovernmentLoans");
    } catch (e) {
      console.log("Enum SSS Emergency might already exist:", e.message);
    }

    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Payroll_GovernmentLoans_government_type" ADD VALUE IF NOT EXISTS 'SSS Conso Loan'`);
      console.log("Added SSS Conso Loan to Payroll_GovernmentLoans");
    } catch (e) {
      console.log("Enum SSS Conso Loan might already exist:", e.message);
    }

    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Loan_Deductions_deductionType" ADD VALUE IF NOT EXISTS 'sss_emergency'`);
      console.log("Added sss_emergency to Loan_Deductions");
    } catch (e) {
      console.log("Enum sss_emergency might already exist:", e.message);
    }

    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Loan_Deductions_deductionType" ADD VALUE IF NOT EXISTS 'sss_conso'`);
      console.log("Added sss_conso to Loan_Deductions");
    } catch (e) {
      console.log("Enum sss_conso might already exist:", e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Postgres doesn't easily allow removing ENUM values, so down is a no-op
  }
};
