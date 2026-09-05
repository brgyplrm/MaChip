'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const wtTable = await queryInterface.describeTable('WithholdingTax_Table');
    if (!wtTable.periodType) {
      await queryInterface.addColumn('WithholdingTax_Table', 'periodType', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'semi-monthly',
      });
    }

    const rtaTable = await queryInterface.describeTable('ReferenceTable_Audit');
    if (!rtaTable.periodType) {
      await queryInterface.addColumn('ReferenceTable_Audit', 'periodType', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const rtaTable = await queryInterface.describeTable('ReferenceTable_Audit');
    if (rtaTable.periodType) await queryInterface.removeColumn('ReferenceTable_Audit', 'periodType');
    const wtTable = await queryInterface.describeTable('WithholdingTax_Table');
    if (wtTable.periodType) await queryInterface.removeColumn('WithholdingTax_Table', 'periodType');
  },
};
