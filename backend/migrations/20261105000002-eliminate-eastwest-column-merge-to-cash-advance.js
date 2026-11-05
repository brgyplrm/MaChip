'use strict';

/**
 * Migration: Eliminate eastwest_Loan column system-wide and merge into advances_Amnt
 *
 * 1. Merges Payroll_Deductions.eastwest_Loan into advances_Amnt, then drops eastwest_Loan.
 * 2. Merges User_Deduction_Profile.eastwest_Loan into advances_Amnt, then drops eastwest_Loan.
 * 3. Consolidates any duplicate (user_Id, date) in Payroll_Cash_Advances into a single 'Cash Advance' row.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    // Helper to check column existence
    const columnExists = async (table, col) => {
      const [results] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = :table AND column_name = :col`,
        { replacements: { table, col } }
      );
      return results.length > 0;
    };

    console.log('[MIGRATION] Starting elimination of eastwest_Loan column system-wide...');

    // 1. Merge and drop in Payroll_Deductions
    if (await columnExists('Payroll_Deductions', 'eastwest_Loan')) {
      await sequelize.query(`
        UPDATE "Payroll_Deductions"
        SET "advances_Amnt" = COALESCE("advances_Amnt", 0) + COALESCE("eastwest_Loan", 0)
      `);
      console.log('[MIGRATION] Merged Payroll_Deductions.eastwest_Loan into advances_Amnt.');

      await queryInterface.removeColumn('Payroll_Deductions', 'eastwest_Loan');
      console.log('[MIGRATION] Dropped column eastwest_Loan from Payroll_Deductions.');
    }

    // 2. Merge and drop in User_Deduction_Profile
    if (await columnExists('User_Deduction_Profile', 'eastwest_Loan')) {
      await sequelize.query(`
        UPDATE "User_Deduction_Profile"
        SET "advances_Amnt" = COALESCE("advances_Amnt", 0) + COALESCE("eastwest_Loan", 0)
      `);
      console.log('[MIGRATION] Merged User_Deduction_Profile.eastwest_Loan into advances_Amnt.');

      await queryInterface.removeColumn('User_Deduction_Profile', 'eastwest_Loan');
      console.log('[MIGRATION] Dropped column eastwest_Loan from User_Deduction_Profile.');
    }

    // 3. Consolidate Payroll_Cash_Advances records:
    // If an employee has both 'Eastwest Loan' and 'Cash Advance' on the same date, merge their amounts
    const [duplicates] = await sequelize.query(`
      SELECT "user_Id", "date", SUM("amount") as "totalAmount", COUNT(*) as cnt
      FROM "Payroll_Cash_Advances"
      GROUP BY "user_Id", "date"
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      // Keep the lowest caId, update its amount to totalAmount and type to 'Cash Advance'
      const [rows] = await sequelize.query(
        `SELECT "caId" FROM "Payroll_Cash_Advances" 
         WHERE "user_Id" = :user_Id AND "date" = :date 
         ORDER BY "caId" ASC`,
        { replacements: { user_Id: dup.user_Id, date: dup.date } }
      );
      const keepId = rows[0].caId;
      const deleteIds = rows.slice(1).map(r => r.caId);

      // Delete duplicate rows FIRST so we do not violate unique constraint
      await sequelize.query(
        `DELETE FROM "Payroll_Cash_Advances" WHERE "caId" IN (:deleteIds)`,
        { replacements: { deleteIds } }
      );

      // Then update the remaining row
      await sequelize.query(
        `UPDATE "Payroll_Cash_Advances"
         SET "amount" = :totalAmount, "type" = 'Cash Advance', "notes" = 'Consolidated Cash Advance & Personal Loan'
         WHERE "caId" = :keepId`,
        { replacements: { totalAmount: dup.totalAmount, keepId } }
      );
    }

    // Ensure all remaining rows have type = 'Cash Advance'
    await sequelize.query(`
      UPDATE "Payroll_Cash_Advances"
      SET "type" = 'Cash Advance'
      WHERE "type" != 'Cash Advance'
    `);
    console.log('[MIGRATION] Consolidated all Payroll_Cash_Advances rows to type = "Cash Advance".');

    // Update constraint to UNIQUE ("user_Id", "date")
    await sequelize.query(`
      ALTER TABLE "Payroll_Cash_Advances"
      DROP CONSTRAINT IF EXISTS "Payroll_Cash_Advances_user_Id_date_type_key",
      DROP CONSTRAINT IF EXISTS "Payroll_Cash_Advances_user_Id_date_key";
    `);
    await sequelize.query(`
      ALTER TABLE "Payroll_Cash_Advances"
      ADD CONSTRAINT "Payroll_Cash_Advances_user_Id_date_key" UNIQUE ("user_Id", "date");
    `);
    console.log('[MIGRATION] Re-applied UNIQUE ("user_Id", "date") constraint on Payroll_Cash_Advances.');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add eastwest_Loan column if needed
    await queryInterface.addColumn('Payroll_Deductions', 'eastwest_Loan', {
      type: Sequelize.FLOAT,
      defaultValue: 0
    });
    await queryInterface.addColumn('User_Deduction_Profile', 'eastwest_Loan', {
      type: Sequelize.FLOAT,
      defaultValue: 0
    });
  }
};
