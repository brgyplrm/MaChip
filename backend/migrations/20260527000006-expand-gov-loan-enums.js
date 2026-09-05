'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new specific loan types to the ENUM
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Payroll_GovernmentLoans_government_type" ADD VALUE 'SSS Calamity'`);
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Payroll_GovernmentLoans_government_type" ADD VALUE 'Pag-IBIG MPL'`);
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Payroll_GovernmentLoans_government_type" ADD VALUE 'Pag-IBIG Calamity'`);
    } catch (e) {
      // Ignore if they already exist
      console.log("ENUMs might already exist:", e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Postgres doesn't easily allow removing ENUM values, so down is a no-op
  }
};
