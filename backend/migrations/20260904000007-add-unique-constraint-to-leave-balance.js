'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add unique constraint on (user_Id, year) to prevent duplicate records per year
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Leave_Balance_user_Id_year_key'
        ) THEN
          ALTER TABLE "Leave_Balance" 
          ADD CONSTRAINT "Leave_Balance_user_Id_year_key" UNIQUE ("user_Id", "year");
        END IF;
      END $$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Leave_Balance" DROP CONSTRAINT IF EXISTS "Leave_Balance_user_Id_year_key";
    `);
  }
};
