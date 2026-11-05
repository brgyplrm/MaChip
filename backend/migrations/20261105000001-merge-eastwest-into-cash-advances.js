'use strict';

/**
 * Migration: 20261105000001-merge-eastwest-into-cash-advances.js
 * Unifies Payroll_Eastwest into Payroll_Cash_Advances to eliminate redundant tables.
 * Adds 'type' column ('Cash Advance' vs 'Eastwest Loan') and composite unique constraint.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (name) => {
      try {
        await queryInterface.describeTable(name);
        return true;
      } catch (e) {
        return false;
      }
    };

    // 1. Update Payroll_Cash_Advances
    if (await tableExists('Payroll_Cash_Advances')) {
      const caInfo = await queryInterface.describeTable('Payroll_Cash_Advances');
      if (!caInfo.type) {
        await queryInterface.addColumn('Payroll_Cash_Advances', 'type', {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Cash Advance'
        });
      }

      // Drop old unique constraint on (user_Id, date)
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE "Payroll_Cash_Advances" DROP CONSTRAINT IF EXISTS "Payroll_Cash_Advances_user_Id_date_key"`
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE "Payroll_Cash_Advances" DROP CONSTRAINT IF EXISTS "user_ca_date_unique"`
        );
      } catch (err) {
        console.warn('[NOTICE] Could not drop old unique constraint, might already be removed:', err.message);
      }

      // Add new composite constraint on (user_Id, date, type)
      try {
        await queryInterface.addConstraint('Payroll_Cash_Advances', {
          fields: ['user_Id', 'date', 'type'],
          type: 'unique',
          name: 'Payroll_Cash_Advances_user_Id_date_type_key'
        });
      } catch (err) {
        console.warn('[NOTICE] Composite constraint already exists or skipped:', err.message);
      }
    }

    // 2. Migrate records from Payroll_Eastwest if it exists
    if (await tableExists('Payroll_Eastwest')) {
      await queryInterface.sequelize.query(`
        INSERT INTO "Payroll_Cash_Advances" ("user_Id", "date", "amount", "payrollId", "notes", "type", "createdAt", "updatedAt")
        SELECT "user_Id", "date", "amount", "payrollId", "notes", 'Eastwest Loan', "createdAt", "updatedAt"
        FROM "Payroll_Eastwest"
        ON CONFLICT ("user_Id", "date", "type") DO UPDATE SET 
          "amount" = EXCLUDED."amount",
          "notes" = EXCLUDED."notes",
          "payrollId" = EXCLUDED."payrollId",
          "updatedAt" = EXCLUDED."updatedAt"
      `);
      console.log('[MIGRATION] Migrated Payroll_Eastwest records into Payroll_Cash_Advances with type = "Eastwest Loan"');

      // 3. Drop table Payroll_Eastwest
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "Payroll_Eastwest" CASCADE`);
      console.log('[MIGRATION] Dropped table Payroll_Eastwest');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Recreate Payroll_Eastwest
    await queryInterface.createTable('Payroll_Eastwest', {
      eastwestId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_Id: {
        type: Sequelize.SMALLINT,
        allowNull: false
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      amount: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      payrollId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now')
      }
    });

    await queryInterface.addConstraint('Payroll_Eastwest', {
      fields: ['user_Id', 'date'],
      type: 'unique',
      name: 'Payroll_Eastwest_user_Id_date_key'
    });

    // 2. Restore data from Payroll_Cash_Advances where type = 'Eastwest Loan'
    await queryInterface.sequelize.query(`
      INSERT INTO "Payroll_Eastwest" ("user_Id", "date", "amount", "notes", "payrollId", "createdAt", "updatedAt")
      SELECT "user_Id", "date", "amount", "notes", "payrollId", "createdAt", "updatedAt"
      FROM "Payroll_Cash_Advances"
      WHERE "type" = 'Eastwest Loan'
      ON CONFLICT ("user_Id", "date") DO UPDATE SET "amount" = EXCLUDED."amount"
    `);

    // 3. Delete 'Eastwest Loan' rows from Payroll_Cash_Advances
    await queryInterface.sequelize.query(`
      DELETE FROM "Payroll_Cash_Advances" WHERE "type" = 'Eastwest Loan'
    `);

    // 4. Restore constraints on Payroll_Cash_Advances
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Payroll_Cash_Advances" DROP CONSTRAINT IF EXISTS "Payroll_Cash_Advances_user_Id_date_type_key"`
      );
      await queryInterface.addConstraint('Payroll_Cash_Advances', {
        fields: ['user_Id', 'date'],
        type: 'unique',
        name: 'Payroll_Cash_Advances_user_Id_date_key'
      });
      await queryInterface.removeColumn('Payroll_Cash_Advances', 'type');
    } catch (e) {
      console.warn('Down-migration constraint rollback notice:', e.message);
    }
  }
};
