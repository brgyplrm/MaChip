'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.workHourThreshold) {
      await queryInterface.addColumn('SystemSettings', 'workHourThreshold', {
        type: Sequelize.FLOAT,
        defaultValue: 4.0,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.workHourThreshold) {
      await queryInterface.removeColumn('SystemSettings', 'workHourThreshold');
    }
  }
};
