'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    if (await tableExists('User_Hardware')) {
      const uhTable = await queryInterface.describeTable('User_Hardware');
      
      if (!uhTable.user_FingerprintId2) {
        await queryInterface.addColumn('User_Hardware', 'user_FingerprintId2', {
          type: Sequelize.INTEGER,
          allowNull: true,
          unique: true
        });
      }

      if (!uhTable.user_FingerprintTemplate2) {
        await queryInterface.addColumn('User_Hardware', 'user_FingerprintTemplate2', {
          type: Sequelize.TEXT,
          allowNull: true
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Keep columns for schema stability
  }
};
