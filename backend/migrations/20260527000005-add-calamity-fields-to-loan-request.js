'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Loan_Request');
    if (!tableInfo.calamityArea) await queryInterface.addColumn('Loan_Request', 'calamityArea', { type: Sequelize.STRING(255), allowNull: true });
    if (!tableInfo.damageProof_File) await queryInterface.addColumn('Loan_Request', 'damageProof_File', { type: Sequelize.STRING(255), allowNull: true });
    if (!tableInfo.netPaySufficient) await queryInterface.addColumn('Loan_Request', 'netPaySufficient', { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false });
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Loan_Request');
    if (tableInfo.calamityArea) await queryInterface.removeColumn('Loan_Request', 'calamityArea');
    if (tableInfo.damageProof_File) await queryInterface.removeColumn('Loan_Request', 'damageProof_File');
    if (tableInfo.netPaySufficient) await queryInterface.removeColumn('Loan_Request', 'netPaySufficient');
  }
};
