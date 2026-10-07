'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    if (await tableExists('User_Hardware')) {
      const uhTable = await queryInterface.describeTable('User_Hardware');
      
      if (!uhTable.card_counter) {
        await queryInterface.addColumn('User_Hardware', 'card_counter', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Retain column for schema stability
  }
};
