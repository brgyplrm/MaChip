'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');
    
    if (!tableInfo.user_Phone) {
      await queryInterface.addColumn('User', 'user_Phone', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    
    if (!tableInfo.user_Address) {
      await queryInterface.addColumn('User', 'user_Address', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.user_DOB) {
      await queryInterface.addColumn('User', 'user_DOB', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!tableInfo.user_Gender) {
      await queryInterface.addColumn('User', 'user_Gender', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('User');
    
    if (tableInfo.user_Phone) {
      await queryInterface.removeColumn('User', 'user_Phone');
    }
    
    if (tableInfo.user_Address) {
      await queryInterface.removeColumn('User', 'user_Address');
    }

    if (tableInfo.user_DOB) {
      await queryInterface.removeColumn('User', 'user_DOB');
    }

    if (tableInfo.user_Gender) {
      await queryInterface.removeColumn('User', 'user_Gender');
    }
  }
};
