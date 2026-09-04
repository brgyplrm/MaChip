'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user_logging');

    // 1. Add reason column if missing
    if (!tableInfo.reason) {
      await queryInterface.addColumn('user_logging', 'reason', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null
      });
    }

    // 2. Add admin_id column with foreign key to User if missing
    if (!tableInfo.admin_id) {
      await queryInterface.addColumn('user_logging', 'admin_id', {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'User',
          key: 'user_Id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // 3. Backfill past visitor access records from Audit_Log if available
    try {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('Audit_Log')) {
        await queryInterface.sequelize.query(`
          UPDATE "user_logging" ul
          SET "reason" = (al."new_Value"->>'reason'),
              "admin_id" = al."user_Id"
          FROM "Audit_Log" al
          WHERE al."action" = 'VISITOR_DOOR_RELEASE'
            AND ul."user_id" = 999
            AND ul."logged_StatusId" = 8
            AND ul."reason" IS NULL
            AND (
              (al."target_Id" = ul."user_loggingId")
              OR (al."createdAt"::date = ul."log_Date"::date AND abs(extract(epoch from (al."createdAt"::time - ul."time_Logged"))) < 60)
            );
        `);
      }
    } catch (backfillErr) {
      console.warn('[MIGRATION WARNING] Visitor access audit backfill skipped:', backfillErr.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('user_logging');

    if (tableInfo.admin_id) {
      await queryInterface.removeColumn('user_logging', 'admin_id');
    }

    if (tableInfo.reason) {
      await queryInterface.removeColumn('user_logging', 'reason');
    }
  }
};
