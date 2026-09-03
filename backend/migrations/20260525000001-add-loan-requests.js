'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Loan_Request table
    await queryInterface.createTable('Loan_Request', {
      loanReqId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emp_reqId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'emp_Request',
          key: 'emp_reqId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_Id: {
        type: Sequelize.SMALLINT,
        allowNull: false,
      },
      agency: {
        type: Sequelize.STRING(50), // SSS, Pag-IBIG, Company
        allowNull: false,
      },
      loanType: {
        type: Sequelize.STRING(50), // Salary, Calamity, MPL, Personal, Cash Advance
        allowNull: false,
      },
      amountRequested: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      monthsToPay: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isEnrollment: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      proof_File: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    // 2. Insert new request types
    await queryInterface.sequelize.query(`
      INSERT INTO "request_Type" ("reqTypeId", "reqTypeName")
      VALUES 
        (13, 'Loan Certification'),
        (14, 'Loan Enrollment')
      ON CONFLICT ("reqTypeId") DO UPDATE SET "reqTypeName" = EXCLUDED."reqTypeName";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Loan_Request');
    await queryInterface.bulkDelete('request_Type', {
      reqTypeId: [13, 14]
    });
  }
};
