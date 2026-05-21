'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Update the request type name in the lookup table
    await queryInterface.bulkUpdate('request_Type', 
      { reqTypeName: 'Time Adjustment' }, 
      { reqTypeId: 5 }
    );

    // 2. Rename the table
    await queryInterface.renameTable('LogCorrection_Request', 'TimeAdjustment_Request');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameTable('TimeAdjustment_Request', 'LogCorrection_Request');

    await queryInterface.bulkUpdate('request_Type', 
      { reqTypeName: 'Log Correction' }, 
      { reqTypeId: 5 }
    );
  }
};
