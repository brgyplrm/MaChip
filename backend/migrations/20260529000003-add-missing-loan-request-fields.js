'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Loan_Request', 'mscCount', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('Loan_Request', 'avgMSC', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Loan_Request', 'consoDP', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Loan_Request', 'pagibigTAV', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Loan_Request', 'mscCount');
    await queryInterface.removeColumn('Loan_Request', 'avgMSC');
    await queryInterface.removeColumn('Loan_Request', 'consoDP');
    await queryInterface.removeColumn('Loan_Request', 'pagibigTAV');
  }
};
