'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    
    const newColumns = [
      { name: 'lunchBreakMode', type: Sequelize.STRING, defaultValue: 'FIXED' },
      { name: 'lunchStart', type: Sequelize.TIME, defaultValue: '12:00:00' },
      { name: 'lunchEnd', type: Sequelize.TIME, defaultValue: '13:00:00' },
      { name: 'gracePeriod', type: Sequelize.TIME, defaultValue: '08:35:00' },
      { name: 'flexibleBreakDuration', type: Sequelize.INTEGER, defaultValue: 60 },
      { name: 'flexibleBreakThreshold', type: Sequelize.INTEGER, defaultValue: 300 }, // 5 hours in minutes
    ];

    for (const col of newColumns) {
      if (!tableInfo[col.name]) {
        await queryInterface.addColumn('SystemSettings', col.name, {
          type: col.type,
          defaultValue: col.defaultValue,
          allowNull: true,
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const columnsToRemove = [
      'lunchBreakMode', 'lunchStart', 'lunchEnd', 
      'gracePeriod', 'flexibleBreakDuration', 'flexibleBreakThreshold'
    ];
    for (const col of columnsToRemove) {
      await queryInterface.removeColumn('SystemSettings', col);
    }
  }
};
