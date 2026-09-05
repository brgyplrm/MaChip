'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Loan_Request');
    if (!tableInfo.mscCount) await queryInterface.addColumn('Loan_Request', 'mscCount', { type: Sequelize.STRING(20), allowNull: true });
    if (!tableInfo.avgMSC) await queryInterface.addColumn('Loan_Request', 'avgMSC', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
    if (!tableInfo.consoDP) await queryInterface.addColumn('Loan_Request', 'consoDP', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
    if (!tableInfo.pagibigTAV) await queryInterface.addColumn('Loan_Request', 'pagibigTAV', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Loan_Request');
    if (tableInfo.mscCount) await queryInterface.removeColumn('Loan_Request', 'mscCount');
    if (tableInfo.avgMSC) await queryInterface.removeColumn('Loan_Request', 'avgMSC');
    if (tableInfo.consoDP) await queryInterface.removeColumn('Loan_Request', 'consoDP');
    if (tableInfo.pagibigTAV) await queryInterface.removeColumn('Loan_Request', 'pagibigTAV');
  }
};
