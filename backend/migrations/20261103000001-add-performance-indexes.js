'use strict';

/**
 * Migration: 20261103000001-add-performance-indexes.js
 * Adds high-impact composite B-Tree indexes across attendance, requests, payroll, and user tables.
 * Eliminates sequential table scans, accelerates dashboard metrics, and speeds up batch payroll.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper to safely add an index if it doesn't already exist
    const safeAddIndex = async (tableName, fields, options) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
        console.log(`[INDEX SUCCESS] Created index ${options.name} on ${tableName}`);
      } catch (err) {
        console.warn(`[INDEX NOTICE] Index ${options.name} on ${tableName} already exists or skipped:`, err.message);
      }
    };

    // 1. user_logging (Attendance Punches)
    await safeAddIndex('user_logging', ['user_id', 'log_Date'], {
      name: 'idx_user_logging_user_date'
    });
    await safeAddIndex('user_logging', ['log_Date'], {
      name: 'idx_user_logging_date'
    });
    await safeAddIndex('user_logging', ['attendance_StatusId', 'logged_StatusId'], {
      name: 'idx_user_logging_statuses'
    });

    // 2. employee_Logging_report (Consolidated Daily Work Units)
    await safeAddIndex('employee_Logging_report', ['user_id', 'log_Date'], {
      name: 'idx_emp_logging_report_user_date'
    });
    await safeAddIndex('employee_Logging_report', ['log_Date'], {
      name: 'idx_emp_logging_report_date'
    });
    await safeAddIndex('employee_Logging_report', ['attendance_StatusId'], {
      name: 'idx_emp_logging_report_status'
    });

    // 3. emp_Request (Leave, Overtime & On-field Requests)
    await safeAddIndex('emp_Request', ['user_Id', 'emp_reqStatusId'], {
      name: 'idx_emp_request_user_status'
    });
    await safeAddIndex('emp_Request', ['emp_reqTypeId', 'emp_reqStatusId'], {
      name: 'idx_emp_request_type_status'
    });
    await safeAddIndex('emp_Request', ['date_Filed'], {
      name: 'idx_emp_request_date_filed'
    });

    // 4. Payroll (Semi-Monthly Records & Batch Processing)
    await safeAddIndex('Payroll', ['user_Id', 'period_Start', 'period_End'], {
      name: 'idx_payroll_user_period'
    });
    await safeAddIndex('Payroll', ['status', 'period_Start'], {
      name: 'idx_payroll_status_period'
    });

    // 5. Holiday (Calendar Lookups in Period Calculations)
    await safeAddIndex('Holiday', ['date'], {
      name: 'idx_holiday_date'
    });

    // 6. Notification (Unread Notification Badge Polling)
    await safeAddIndex('Notification', ['user_Id', 'isRead'], {
      name: 'idx_notification_user_unread'
    });

    // 7. User (Paranoid Active Personnel Partial Index)
    try {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_user_active_role 
        ON "User" ("user_RoleId") 
        WHERE "deletedAt" IS NULL;
      `);
      console.log('[INDEX SUCCESS] Created partial index idx_user_active_role on User');
    } catch (err) {
      console.warn('[INDEX NOTICE] Partial index idx_user_active_role notice:', err.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await queryInterface.removeIndex(tableName, indexName);
      } catch (err) {
        // Ignored during down migration
      }
    };

    await safeRemoveIndex('user_logging', 'idx_user_logging_user_date');
    await safeRemoveIndex('user_logging', 'idx_user_logging_date');
    await safeRemoveIndex('user_logging', 'idx_user_logging_statuses');

    await safeRemoveIndex('employee_Logging_report', 'idx_emp_logging_report_user_date');
    await safeRemoveIndex('employee_Logging_report', 'idx_emp_logging_report_date');
    await safeRemoveIndex('employee_Logging_report', 'idx_emp_logging_report_status');

    await safeRemoveIndex('emp_Request', 'idx_emp_request_user_status');
    await safeRemoveIndex('emp_Request', 'idx_emp_request_type_status');
    await safeRemoveIndex('emp_Request', 'idx_emp_request_date_filed');

    await safeRemoveIndex('Payroll', 'idx_payroll_user_period');
    await safeRemoveIndex('Payroll', 'idx_payroll_status_period');

    await safeRemoveIndex('Holiday', 'idx_holiday_date');
    await safeRemoveIndex('Notification', 'idx_notification_user_unread');

    try {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_user_active_role;`);
    } catch (e) {}
  }
};
