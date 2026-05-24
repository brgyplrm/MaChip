'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const RATE_MAP = {
      1: { old: 1538.46, new: 2692.31 }, // Kael Voss
      2: { old: 1730.77, new: 2307.70 }, // Dingdong KashTayo
      3: { old: 685.39, new: 2692.31 },  // Jim Tejeros
      5: { old: 744.53, new: 769.23 },   // Wardell Curry
      19: { old: 744.53, new: 769.23 },  // Junemar Santos
      20: { old: 744.53, new: 769.23 },  // Loonie Medina
      22: { old: 683.46, new: 721.93 },  // Thomas Brady
      24: { old: 744.53, new: 769.23 },  // Illia Topuria
      25: { old: 695.00, new: 714.23 },  // Paddy Pimblett
      26: { old: 695.00, new: 714.23 }   // Conor McGregor
    };

    const now = new Date();

    for (const [id, rates] of Object.entries(RATE_MAP)) {
      await queryInterface.sequelize.query(
        `UPDATE "User" 
         SET "dailyRate" = :newRate, 
             "previousDailyRate" = :oldRate, 
             "rateUpdatedAt" = :now 
         WHERE "user_Id" = :userId`,
        {
          replacements: { 
            newRate: rates.new, 
            oldRate: rates.old, 
            now, 
            userId: id 
          }
        }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverting rates is complex because we don't know the exact previous values for everyone,
    // but we can at least clear the rateUpdatedAt or reset to old if needed.
    // Given this is a seed migration, down usually resets to a known safe state.
  }
};
