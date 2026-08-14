'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sysTable = await queryInterface.describeTable('SystemSettings');
    if (!sysTable.payrollGracePeriodDays) {
      await queryInterface.addColumn('SystemSettings', 'payrollGracePeriodDays', {
        type: Sequelize.INTEGER,
        defaultValue: 7,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const sysTable = await queryInterface.describeTable('SystemSettings');
    if (sysTable.payrollGracePeriodDays) {
      await queryInterface.removeColumn('SystemSettings', 'payrollGracePeriodDays');
    }
  }
};
