'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create SSS_ContributionTable
    await queryInterface.createTable('SSS_ContributionTable', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      range_Min: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      range_Max: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      monthlySalaryCredit: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      er_SS: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      ee_SS: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      er_EC: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      ee_EC: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      er_Provident: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      ee_Provident: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 2. Create Philhealth_ContributionTable
    await queryInterface.createTable('Philhealth_ContributionTable', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      range_Min: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      range_Max: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      rate: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      employeeShareRatio: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.5,
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 3. Create PagIBIG_ContributionTable
    await queryInterface.createTable('PagIBIG_ContributionTable', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      range_Min: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      range_Max: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      ee_Rate: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      er_Rate: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      contributionCeiling: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 4. Create WithholdingTax_Table
    await queryInterface.createTable('WithholdingTax_Table', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      range_Min: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      range_Max: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      baseTax: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      excessRate: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      excessOver: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 5. Create ReferenceTable_Audit
    await queryInterface.createTable('ReferenceTable_Audit', {
      auditId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tableName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      uploadedBy: {
        type: Sequelize.SMALLINT,
        allowNull: false,
      },
      uploadDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rowCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ReferenceTable_Audit');
    await queryInterface.dropTable('WithholdingTax_Table');
    await queryInterface.dropTable('PagIBIG_ContributionTable');
    await queryInterface.dropTable('Philhealth_ContributionTable');
    await queryInterface.dropTable('SSS_ContributionTable');
  },
};
