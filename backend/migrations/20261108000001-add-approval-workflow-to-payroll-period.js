'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('PayrollPeriod');

    if (!tableInfo.checklistData) {
      await queryInterface.addColumn('PayrollPeriod', 'checklistData', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      });
    }

    if (!tableInfo.submittedBy) {
      await queryInterface.addColumn('PayrollPeriod', 'submittedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'user_Id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!tableInfo.submittedAt) {
      await queryInterface.addColumn('PayrollPeriod', 'submittedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!tableInfo.approvedBy) {
      await queryInterface.addColumn('PayrollPeriod', 'approvedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'user_Id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!tableInfo.approvedAt) {
      await queryInterface.addColumn('PayrollPeriod', 'approvedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!tableInfo.rejectionReason) {
      await queryInterface.addColumn('PayrollPeriod', 'rejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!tableInfo.scheduledReleaseAt) {
      await queryInterface.addColumn('PayrollPeriod', 'scheduledReleaseAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('PayrollPeriod');

    if (tableInfo.scheduledReleaseAt) {
      await queryInterface.removeColumn('PayrollPeriod', 'scheduledReleaseAt');
    }
    if (tableInfo.rejectionReason) {
      await queryInterface.removeColumn('PayrollPeriod', 'rejectionReason');
    }
    if (tableInfo.approvedAt) {
      await queryInterface.removeColumn('PayrollPeriod', 'approvedAt');
    }
    if (tableInfo.approvedBy) {
      await queryInterface.removeColumn('PayrollPeriod', 'approvedBy');
    }
    if (tableInfo.submittedAt) {
      await queryInterface.removeColumn('PayrollPeriod', 'submittedAt');
    }
    if (tableInfo.submittedBy) {
      await queryInterface.removeColumn('PayrollPeriod', 'submittedBy');
    }
    if (tableInfo.checklistData) {
      await queryInterface.removeColumn('PayrollPeriod', 'checklistData');
    }
  }
};
