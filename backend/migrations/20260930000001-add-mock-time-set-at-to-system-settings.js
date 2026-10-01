'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.mockTimeSetAt) {
      await queryInterface.addColumn('SystemSettings', 'mockTimeSetAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.mockTimeSetAt) {
      await queryInterface.removeColumn('SystemSettings', 'mockTimeSetAt');
    }
  }
};
