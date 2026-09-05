'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.nightGracePeriod) {
      await queryInterface.addColumn('SystemSettings', 'nightGracePeriod', {
        type: Sequelize.TIME,
        defaultValue: '20:35:00',
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('SystemSettings', 'nightGracePeriod');
  }
};
