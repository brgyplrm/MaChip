'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const positionUpdates = [
      { title: 'PRESIDENT', department: 'ADMIN', baseDailyRate: 2692.31 },
      { title: 'LCB/MANAGER', department: 'ADMIN', baseDailyRate: 2307.70 },
      { title: 'ACCOUNTING STAFF', department: 'FINANCE', baseDailyRate: 2692.31 },
      { title: 'SUPERVISOR', department: 'FORWARDING', baseDailyRate: 769.23 },
      { title: 'DECLARANT', department: 'OPERATION', baseDailyRate: 769.23 },
      { title: 'MESSENGER', department: 'OPERATION', baseDailyRate: 721.93 },
    ];

    await queryInterface.sequelize.query(`SELECT setval(pg_get_serial_sequence('"Position"', 'positionId'), COALESCE((SELECT MAX("positionId") FROM "Position"), 1));`);

    const now = new Date();

    for (const pos of positionUpdates) {
      const baseMonthlyPay = Math.round(pos.baseDailyRate * 26 * 100) / 100;

      const [existing] = await queryInterface.sequelize.query(
        `SELECT "positionId" FROM "Position" WHERE "title" = :title AND "department" = :dept LIMIT 1`,
        { replacements: { title: pos.title, dept: pos.department }, type: Sequelize.QueryTypes.SELECT }
      );

      if (existing) {
        await queryInterface.sequelize.query(
          `UPDATE "Position" 
           SET "baseDailyRate" = :rate, "baseMonthlyPay" = :monthly, "updatedAt" = :now 
           WHERE "positionId" = :id`,
          { replacements: { rate: pos.baseDailyRate, monthly: baseMonthlyPay, now, id: existing.positionId } }
        );
      } else {
        await queryInterface.sequelize.query(
          `INSERT INTO "Position" ("title", "department", "baseDailyRate", "baseMonthlyPay", "createdAt", "updatedAt")
           VALUES (:title, :dept, :rate, :monthly, :now, :now)`,
          { replacements: { title: pos.title, dept: pos.department, rate: pos.baseDailyRate, monthly: baseMonthlyPay, now } }
        );
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Reverting to previous known rates
    const revertRates = [
      { title: 'ACCOUNTING STAFF', department: 'FINANCE', baseDailyRate: 769.23, baseMonthlyPay: 20000 },
    ];

    for (const pos of revertRates) {
      await queryInterface.sequelize.query(
        `UPDATE "Position" 
         SET "baseDailyRate" = :rate, "baseMonthlyPay" = :monthly, "updatedAt" = NOW()
         WHERE "title" = :title AND "department" = :dept`,
        {
          replacements: {
            title: pos.title,
            dept: pos.department,
            rate: pos.baseDailyRate,
            monthly: pos.baseMonthlyPay
          }
        }
      );
    }
  }
};
