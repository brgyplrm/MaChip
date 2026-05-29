'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Find some active users
    const users = await queryInterface.sequelize.query(
      `SELECT "user_Id" FROM "User" WHERE "deletedAt" IS NULL AND "dailyRate" > 0 LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (users.length === 0) return;

    const now = new Date();

    // 2. Seed SSS Conso and Emergency loans
    const loanSeeds = [];
    
    // User 1: SSS Conso Loan
    if (users[0]) {
      loanSeeds.push({
        userId: users[0].user_Id,
        deductionType: 'sss_conso',
        totalAmount: 50000,
        remainingBalance: 45000,
        monthsToPay: 24,
        deductionPerCutoff: 1041.67,
        status: 'active',
        contractDate: now,
        provider: 'SSS',
        notes: 'SSS Consolidated Loan - Test Data',
        createdAt: now,
        updatedAt: now
      });
    }

    // User 2: SSS Emergency Loan
    if (users[1]) {
      loanSeeds.push({
        userId: users[1].user_Id,
        deductionType: 'sss_emergency',
        totalAmount: 20000,
        remainingBalance: 15000,
        monthsToPay: 12,
        deductionPerCutoff: 1666.67,
        status: 'active',
        contractDate: now,
        provider: 'SSS',
        notes: 'SSS Emergency Loan - Test Data',
        createdAt: now,
        updatedAt: now
      });
    }

    // User 3: Pag-IBIG Calamity
    if (users[2]) {
      loanSeeds.push({
        userId: users[2].user_Id,
        deductionType: 'hdmf_calamity',
        totalAmount: 15000,
        remainingBalance: 12000,
        monthsToPay: 24,
        deductionPerCutoff: 625,
        status: 'active',
        contractDate: now,
        provider: 'Pag-IBIG',
        notes: 'Pag-IBIG Calamity Loan - Test Data',
        createdAt: now,
        updatedAt: now
      });
    }

    if (loanSeeds.length > 0) {
      await queryInterface.bulkInsert('Loan_Deductions', loanSeeds);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Loan_Deductions', null, {});
  }
};
