'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const positionsToSeed = [
      { title: 'PRESIDENT', department: 'ADMIN', baseMonthlyPay: 70000, baseDailyRate: 2692.31, createdAt: new Date(), updatedAt: new Date() },
      { title: 'LCB/MANAGER', department: 'ADMIN', baseMonthlyPay: 60000, baseDailyRate: 2307.70, createdAt: new Date(), updatedAt: new Date() },
      { title: 'ACCOUNTING STAFF', department: 'FINANCE', baseMonthlyPay: 20000, baseDailyRate: 769.23, createdAt: new Date(), updatedAt: new Date() },
      { title: 'SUPERVISOR', department: 'FORWARDING', baseMonthlyPay: 20000, baseDailyRate: 769.23, createdAt: new Date(), updatedAt: new Date() },
      { title: 'DECLARANT', department: 'OPERATION', baseMonthlyPay: 20000, baseDailyRate: 769.23, createdAt: new Date(), updatedAt: new Date() },
      { title: 'MESSENGER', department: 'OPERATION', baseMonthlyPay: 18770, baseDailyRate: 721.93, createdAt: new Date(), updatedAt: new Date() },
    ];

    for (const pos of positionsToSeed) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT "positionId" FROM "Position" WHERE "title" = '${pos.title}' AND "department" = '${pos.department}' LIMIT 1`
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('Position', [pos]);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Position', null, {});
  }
};
