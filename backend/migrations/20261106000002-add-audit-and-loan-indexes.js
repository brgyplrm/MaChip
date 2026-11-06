'use strict';

/**
 * Migration: 20261106000002-add-audit-and-loan-indexes.js
 * Adds high-frequency indexes on Audit_Log, Transaction_Log, Loan_Deductions, and Loan_Deduction_History.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const safeAddIndex = async (tableName, fields, options) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
        console.log(`[INDEX SUCCESS] Created index ${options.name} on ${tableName}`);
      } catch (err) {
        console.warn(`[INDEX NOTICE] Index ${options.name} on ${tableName} already exists or skipped:`, err.message);
      }
    };

    // 1. Audit_Log (Paginated audit logs & security filter)
    await safeAddIndex('Audit_Log', ['createdAt'], {
      name: 'idx_audit_log_created_at'
    });
    await safeAddIndex('Audit_Log', ['module', 'action'], {
      name: 'idx_audit_log_module_action'
    });
    await safeAddIndex('Audit_Log', ['user_Id', 'createdAt'], {
      name: 'idx_audit_log_user_created'
    });

    // 2. Transaction_Log (Paginated system transactions)
    await safeAddIndex('Transaction_Log', ['createdAt'], {
      name: 'idx_trans_log_created_at'
    });
    await safeAddIndex('Transaction_Log', ['event_Type'], {
      name: 'idx_trans_log_event_type'
    });
    await safeAddIndex('Transaction_Log', ['user_Id', 'createdAt'], {
      name: 'idx_trans_log_user_created'
    });

    // 3. Loan_Deductions & History
    await safeAddIndex('Loan_Deductions', ['user_Id', 'status'], {
      name: 'idx_loan_deductions_user_status'
    });
    await safeAddIndex('Loan_Deduction_History', ['type', 'date'], {
      name: 'idx_loan_deduction_history_type_date'
    });
  },

  down: async (queryInterface, Sequelize) => {
    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await queryInterface.removeIndex(tableName, indexName);
      } catch (err) {
        // Ignored during down migration
      }
    };

    await safeRemoveIndex('Audit_Log', 'idx_audit_log_created_at');
    await safeRemoveIndex('Audit_Log', 'idx_audit_log_module_action');
    await safeRemoveIndex('Audit_Log', 'idx_audit_log_user_created');
    await safeRemoveIndex('Transaction_Log', 'idx_trans_log_created_at');
    await safeRemoveIndex('Transaction_Log', 'idx_trans_log_event_type');
    await safeRemoveIndex('Transaction_Log', 'idx_trans_log_user_created');
    await safeRemoveIndex('Loan_Deductions', 'idx_loan_deductions_user_status');
    await safeRemoveIndex('Loan_Deduction_History', 'idx_loan_deduction_history_type_date');
  }
};
