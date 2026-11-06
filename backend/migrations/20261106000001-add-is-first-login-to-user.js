'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');

    if (!tableInfo.is_first_login) {
      await queryInterface.addColumn('User', 'is_first_login', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');

    if (tableInfo.is_first_login) {
      await queryInterface.removeColumn('User', 'is_first_login');
    }
  }
};
