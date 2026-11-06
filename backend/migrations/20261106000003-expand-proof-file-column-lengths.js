'use strict';

/**
 * Migration: 20261106000003-expand-proof-file-column-lengths.js
 * Expands proof_File and damageProof_File column types to TEXT to support multi-file attachments.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const safeChangeColumn = async (tableName, columnName, newType) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName).catch(() => null);
        if (tableDescription && tableDescription[columnName]) {
          await queryInterface.changeColumn(tableName, columnName, {
            type: newType,
            allowNull: true,
          });
          console.log(`[COLUMN SUCCESS] Changed ${tableName}.${columnName} to TEXT`);
        }
      } catch (err) {
        console.warn(`[COLUMN NOTICE] Skipping ${tableName}.${columnName}:`, err.message);
      }
    };

    await safeChangeColumn('Sick_Leave', 'proof_File', Sequelize.TEXT);
    await safeChangeColumn('Onfield_Work', 'proof_File', Sequelize.TEXT);
    await safeChangeColumn('LogCorrection_Request', 'proof_File', Sequelize.TEXT);
    await safeChangeColumn('Statutory_Leave', 'proof_File', Sequelize.TEXT);
    await safeChangeColumn('Loan_Request', 'proof_File', Sequelize.TEXT);
    await safeChangeColumn('Loan_Request', 'damageProof_File', Sequelize.TEXT);
  },

  down: async (queryInterface, Sequelize) => {
    const safeChangeColumn = async (tableName, columnName, newType) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName).catch(() => null);
        if (tableDescription && tableDescription[columnName]) {
          await queryInterface.changeColumn(tableName, columnName, {
            type: newType,
            allowNull: true,
          });
          console.log(`[COLUMN SUCCESS] Reverted ${tableName}.${columnName} to STRING`);
        }
      } catch (err) {
        console.warn(`[COLUMN NOTICE] Skipping revert for ${tableName}.${columnName}:`, err.message);
      }
    };

    await safeChangeColumn('Sick_Leave', 'proof_File', Sequelize.STRING);
    await safeChangeColumn('Onfield_Work', 'proof_File', Sequelize.STRING);
    await safeChangeColumn('LogCorrection_Request', 'proof_File', Sequelize.STRING);
    await safeChangeColumn('Statutory_Leave', 'proof_File', Sequelize.STRING);
    await safeChangeColumn('Loan_Request', 'proof_File', Sequelize.STRING);
    await safeChangeColumn('Loan_Request', 'damageProof_File', Sequelize.STRING);
  }
};
