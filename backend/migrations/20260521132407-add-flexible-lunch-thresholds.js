'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('SystemSettings');
    
    if (!tableInfo['lunchStartThreshold']) {
      await queryInterface.addColumn('SystemSettings', 'lunchStartThreshold', {
        type: Sequelize.TIME,
        defaultValue: '11:30:00',
        allowNull: true,
      });
    }
    
    if (!tableInfo['lunchEndThreshold']) {
      await queryInterface.addColumn('SystemSettings', 'lunchEndThreshold', {
        type: Sequelize.TIME,
        defaultValue: '13:30:00',
        allowNull: true,
      });
    }

    if (!tableInfo['lunchDuration']) {
      await queryInterface.addColumn('SystemSettings', 'lunchDuration', {
        type: Sequelize.INTEGER,
        defaultValue: 60,
        allowNull: true,
      });
    }

    // Ensure gracePeriod exists (from previous migration but just in case)
    if (!tableInfo['gracePeriod']) {
      await queryInterface.addColumn('SystemSettings', 'gracePeriod', {
        type: Sequelize.TIME,
        defaultValue: '08:35:00',
        allowNull: true,
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('SystemSettings', 'lunchStartThreshold');
    await queryInterface.removeColumn('SystemSettings', 'lunchEndThreshold');
    await queryInterface.removeColumn('SystemSettings', 'lunchDuration');
    // We don't remove gracePeriod as it might have been there before
  }
};
