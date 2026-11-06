'use strict';

/**
 * Migration: 20261106000004-add-audit-append-only-triggers.js
 * Enforces CTPAT compliance by attaching PostgreSQL triggers to Audit_Log
 * and Transaction_Log that forbid UPDATE and DELETE operations at the database engine level.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create or replace the reusable trigger function
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'CTPAT Security Violation: % is strictly append-only. UPDATE and DELETE operations are forbidden.', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Attach trigger to Audit_Log
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_log_immutable'
        ) THEN
          CREATE TRIGGER trg_audit_log_immutable
          BEFORE UPDATE OR DELETE ON "Audit_Log"
          FOR EACH ROW
          EXECUTE FUNCTION prevent_audit_modification();
        END IF;
      END $$;
    `);

    // 3. Attach trigger to Transaction_Log
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_trans_log_immutable'
        ) THEN
          CREATE TRIGGER trg_trans_log_immutable
          BEFORE UPDATE OR DELETE ON "Transaction_Log"
          FOR EACH ROW
          EXECUTE FUNCTION prevent_audit_modification();
        END IF;
      END $$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "Audit_Log";`);
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_trans_log_immutable ON "Transaction_Log";`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS prevent_audit_modification();`);
  }
};
