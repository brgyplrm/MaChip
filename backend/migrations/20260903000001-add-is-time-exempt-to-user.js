'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');
    if (!tableInfo.is_time_exempt) {
      await queryInterface.addColumn('User', 'is_time_exempt', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');
    if (tableInfo.is_time_exempt) {
      await queryInterface.removeColumn('User', 'is_time_exempt');
    }
  }
};
