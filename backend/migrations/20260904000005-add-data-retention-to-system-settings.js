'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (!tableInfo.archivedRetentionYears) {
      await queryInterface.addColumn('SystemSettings', 'archivedRetentionYears', {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    if (tableInfo.archivedRetentionYears) {
      await queryInterface.removeColumn('SystemSettings', 'archivedRetentionYears');
    }
  }
};
