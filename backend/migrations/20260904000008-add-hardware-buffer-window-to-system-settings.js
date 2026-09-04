'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.hardwareBufferWindow) {
      await queryInterface.addColumn('SystemSettings', 'hardwareBufferWindow', {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.hardwareBufferWindow) {
      await queryInterface.removeColumn('SystemSettings', 'hardwareBufferWindow');
    }
  }
};
