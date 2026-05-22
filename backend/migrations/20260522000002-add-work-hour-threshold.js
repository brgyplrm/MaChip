'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('SystemSettings', 'workHourThreshold', {
      type: Sequelize.FLOAT,
      defaultValue: 4.0,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('SystemSettings', 'workHourThreshold');
  }
};
