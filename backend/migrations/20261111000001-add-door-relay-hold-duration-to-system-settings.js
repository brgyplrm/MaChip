'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.doorRelayHoldDurationSec) {
      await queryInterface.addColumn('SystemSettings', 'doorRelayHoldDurationSec', {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.doorRelayHoldDurationSec) {
      await queryInterface.removeColumn('SystemSettings', 'doorRelayHoldDurationSec');
    }
  }
};
