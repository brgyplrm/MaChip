'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');

    // 1. Attendance Cutoff Buffer Days
    if (!tableInfo.payrollCutoffBufferDays) {
      await queryInterface.addColumn('SystemSettings', 'payrollCutoffBufferDays', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2
      });
    }

    // 2. Post-Cutoff Processing Deadline Days
    if (!tableInfo.payrollProcessingDeadlineDays) {
      await queryInterface.addColumn('SystemSettings', 'payrollProcessingDeadlineDays', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3
      });
    }

    // 3. Automated Batch Release Flag
    if (!tableInfo.payrollAutoRelease) {
      await queryInterface.addColumn('SystemSettings', 'payrollAutoRelease', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }

    // 4. Proactive Cutoff Reminder Alerts Flag
    if (!tableInfo.payrollRemindersEnabled) {
      await queryInterface.addColumn('SystemSettings', 'payrollRemindersEnabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }

    // 5. Weekend Payday Adjustment Policy
    if (!tableInfo.payrollWeekendRule) {
      await queryInterface.addColumn('SystemSettings', 'payrollWeekendRule', {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'PRECEDING_FRIDAY'
      });
    }

    // 6. Withholding Tax Assessment Method Toggle
    if (!tableInfo.taxEvaluationMode) {
      await queryInterface.addColumn('SystemSettings', 'taxEvaluationMode', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'PROJECTED_MONTHLY'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');

    if (tableInfo.taxEvaluationMode) {
      await queryInterface.removeColumn('SystemSettings', 'taxEvaluationMode');
    }
    if (tableInfo.payrollWeekendRule) {
      await queryInterface.removeColumn('SystemSettings', 'payrollWeekendRule');
    }
    if (tableInfo.payrollRemindersEnabled) {
      await queryInterface.removeColumn('SystemSettings', 'payrollRemindersEnabled');
    }
    if (tableInfo.payrollAutoRelease) {
      await queryInterface.removeColumn('SystemSettings', 'payrollAutoRelease');
    }
    if (tableInfo.payrollProcessingDeadlineDays) {
      await queryInterface.removeColumn('SystemSettings', 'payrollProcessingDeadlineDays');
    }
    if (tableInfo.payrollCutoffBufferDays) {
      await queryInterface.removeColumn('SystemSettings', 'payrollCutoffBufferDays');
    }
  }
};
