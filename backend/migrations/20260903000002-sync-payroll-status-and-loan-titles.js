'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    };

    // 1. Ensure Payroll_status table exists and seed canonical status mappings
    if (!await tableExists('Payroll_status')) {
      await queryInterface.createTable('Payroll_status', {
        PaystatusId: { type: Sequelize.SMALLINT, primaryKey: true },
        PaystatusName: { type: Sequelize.STRING, allowNull: false }
      });
    }

    const statuses = [
      { PaystatusId: 1, PaystatusName: 'Draft' },
      { PaystatusId: 2, PaystatusName: 'Pending Approval' },
      { PaystatusId: 3, PaystatusName: 'Approved' },
      { PaystatusId: 4, PaystatusName: 'Paid' },
      { PaystatusId: 5, PaystatusName: 'Released' },
      { PaystatusId: 6, PaystatusName: 'Rejected' }
    ];

    for (const s of statuses) {
      await queryInterface.sequelize.query(`
        INSERT INTO "Payroll_status" ("PaystatusId", "PaystatusName")
        VALUES (${s.PaystatusId}, '${s.PaystatusName}')
        ON CONFLICT ("PaystatusId") DO UPDATE
        SET "PaystatusName" = EXCLUDED."PaystatusName";
      `);
    }

    // 2. Migrate any legacy Payroll records with status 2 to status 5 ('Released')
    if (await tableExists('Payroll')) {
      await queryInterface.sequelize.query(`
        UPDATE "Payroll"
        SET "status" = 5, "updatedAt" = NOW()
        WHERE "status" = 2;
      `);
    }

    // 3. Ensure Loan_Deductions has 'notes' column for professional loan titles
    if (await tableExists('Loan_Deductions')) {
      const tableInfo = await queryInterface.describeTable('Loan_Deductions');
      if (!tableInfo.notes) {
        await queryInterface.addColumn('Loan_Deductions', 'notes', {
          type: Sequelize.TEXT,
          allowNull: true
        });
      }
    }

    // 4. Ensure Payroll_Cash_Advances has payrollId column
    if (await tableExists('Payroll_Cash_Advances')) {
      const tableInfo = await queryInterface.describeTable('Payroll_Cash_Advances');
      if (!tableInfo.payrollId) {
        await queryInterface.addColumn('Payroll_Cash_Advances', 'payrollId', {
          type: Sequelize.INTEGER,
          allowNull: true
        });
      }
    }

    // 5. Ensure Payroll_Eastwest has payrollId column
    if (await tableExists('Payroll_Eastwest')) {
      const tableInfo = await queryInterface.describeTable('Payroll_Eastwest');
      if (!tableInfo.payrollId) {
        await queryInterface.addColumn('Payroll_Eastwest', 'payrollId', {
          type: Sequelize.INTEGER,
          allowNull: true
        });
      }
    }

    // 6. Ensure Payroll_GovernmentLoans has payrollId, principalPaid, interestPaid
    if (await tableExists('Payroll_GovernmentLoans')) {
      const tableInfo = await queryInterface.describeTable('Payroll_GovernmentLoans');
      if (!tableInfo.payrollId) {
        await queryInterface.addColumn('Payroll_GovernmentLoans', 'payrollId', {
          type: Sequelize.INTEGER,
          allowNull: true
        });
      }
      if (!tableInfo.principalPaid) {
        await queryInterface.addColumn('Payroll_GovernmentLoans', 'principalPaid', {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: 0
        });
      }
      if (!tableInfo.interestPaid) {
        await queryInterface.addColumn('Payroll_GovernmentLoans', 'interestPaid', {
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: 0
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive down migration
  }
};
