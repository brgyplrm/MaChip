'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');

    if (!tableInfo.resetPasswordToken) {
      await queryInterface.addColumn('User', 'resetPasswordToken', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null
      });
    }

    if (!tableInfo.resetPasswordExpires) {
      await queryInterface.addColumn('User', 'resetPasswordExpires', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');

    if (tableInfo.resetPasswordExpires) {
      await queryInterface.removeColumn('User', 'resetPasswordExpires');
    }

    if (tableInfo.resetPasswordToken) {
      await queryInterface.removeColumn('User', 'resetPasswordToken');
    }
  }
};
