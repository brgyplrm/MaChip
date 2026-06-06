'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const addAuditIdColumn = async (tableName) => {
      await queryInterface.addColumn(tableName, 'auditId', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null temporarily in case there are existing rows
        references: {
          model: 'ReferenceTable_Audit',
          key: 'auditId',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    };

    await addAuditIdColumn('SSS_ContributionTable');
    await addAuditIdColumn('Philhealth_ContributionTable');
    await addAuditIdColumn('PagIBIG_ContributionTable');
    await addAuditIdColumn('WithholdingTax_Table');
  },

  down: async (queryInterface, Sequelize) => {
    const removeAuditIdColumn = async (tableName) => {
      await queryInterface.removeColumn(tableName, 'auditId');
    };

    await removeAuditIdColumn('WithholdingTax_Table');
    await removeAuditIdColumn('PagIBIG_ContributionTable');
    await removeAuditIdColumn('Philhealth_ContributionTable');
    await removeAuditIdColumn('SSS_ContributionTable');
  },
};
