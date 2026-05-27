'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Loan_Request', 'calamityArea', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('Loan_Request', 'damageProof_File', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('Loan_Request', 'netPaySufficient', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Loan_Request', 'calamityArea');
    await queryInterface.removeColumn('Loan_Request', 'damageProof_File');
    await queryInterface.removeColumn('Loan_Request', 'netPaySufficient');
  }
};
