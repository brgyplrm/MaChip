'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('WithholdingTax_Table', 'periodType', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'semi-monthly',
    });
    await queryInterface.addColumn('ReferenceTable_Audit', 'periodType', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ReferenceTable_Audit', 'periodType');
    await queryInterface.removeColumn('WithholdingTax_Table', 'periodType');
  },
};
