'use strict';

const { computeAuditEntryHash, GENESIS_AUDIT_HASH } = require('../src/utils/encryption');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ── 1. Upgrade User_Deduction_Profile with Statutory SPI Encrypted Fields & Blind Indexes (SEC-SPI-001)
    const udpTable = await queryInterface.describeTable('User_Deduction_Profile');

    const spiColumns = [
      { name: 'sss_no', type: Sequelize.TEXT },
      { name: 'sss_no_bidx', type: Sequelize.STRING(64), index: 'idx_user_deduction_sss_bidx' },
      { name: 'tin_no', type: Sequelize.TEXT },
      { name: 'tin_no_bidx', type: Sequelize.STRING(64), index: 'idx_user_deduction_tin_bidx' },
      { name: 'philhealth_no', type: Sequelize.TEXT },
      { name: 'philhealth_no_bidx', type: Sequelize.STRING(64), index: 'idx_user_deduction_philhealth_bidx' },
      { name: 'hdmf_no', type: Sequelize.TEXT },
      { name: 'hdmf_no_bidx', type: Sequelize.STRING(64), index: 'idx_user_deduction_hdmf_bidx' },
    ];

    for (const col of spiColumns) {
      if (!udpTable[col.name]) {
        await queryInterface.addColumn('User_Deduction_Profile', col.name, {
          type: col.type,
          allowNull: true,
          defaultValue: null
        });

        if (col.index) {
          try {
            await queryInterface.addIndex('User_Deduction_Profile', [col.name], {
              name: col.index
            });
          } catch (idxErr) {
            console.warn(`[Migration Warning]: Index ${col.index} already exists or skipped:`, idxErr.message);
          }
        }
      }
    }

    // ── 2. Upgrade Audit_Log with Cryptographic Tamper-Evident Hash Chaining (SEC-AUD-001)
    const auditTable = await queryInterface.describeTable('Audit_Log');

    if (!auditTable.previous_hash) {
      await queryInterface.addColumn('Audit_Log', 'previous_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null
      });

      try {
        await queryInterface.addIndex('Audit_Log', ['previous_hash'], {
          name: 'idx_audit_log_previous_hash'
        });
      } catch (idxErr) {
        console.warn('[Migration Warning]: Index idx_audit_log_previous_hash skipped:', idxErr.message);
      }
    }

    if (!auditTable.entry_hash) {
      await queryInterface.addColumn('Audit_Log', 'entry_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null
      });

      try {
        await queryInterface.addIndex('Audit_Log', ['entry_hash'], {
          name: 'idx_audit_log_entry_hash'
        });
      } catch (idxErr) {
        console.warn('[Migration Warning]: Index idx_audit_log_entry_hash skipped:', idxErr.message);
      }
    }

    // ── 3. Backfill Existing Audit_Log Rows into a Continuous Cryptographic Chain
    try {
      const [existingLogs] = await queryInterface.sequelize.query(
        `SELECT "auditId", "user_Id", "module", "action", "target_Table", "target_Id", "old_Value", "new_Value", "ip_Address", "createdAt"
         FROM "Audit_Log"
         ORDER BY "auditId" ASC`
      );

      if (existingLogs && existingLogs.length > 0) {
        let prevHash = GENESIS_AUDIT_HASH;

        for (const log of existingLogs) {
          const entryHash = computeAuditEntryHash(prevHash, log);

          await queryInterface.sequelize.query(
            `UPDATE "Audit_Log" 
             SET "previous_hash" = :prevHash, "entry_hash" = :entryHash 
             WHERE "auditId" = :auditId`,
            {
              replacements: {
                prevHash,
                entryHash,
                auditId: log.auditId
              }
            }
          );

          prevHash = entryHash;
        }

        console.log(`[Migration Backfill]: Cryptographic hash-chain established for ${existingLogs.length} existing audit records.`);
      }
    } catch (backfillErr) {
      console.error('[Migration Backfill Warning]: Failed backfilling audit hash-chain:', backfillErr.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Rollback Audit_Log hash fields
    try {
      await queryInterface.removeIndex('Audit_Log', 'idx_audit_log_previous_hash');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('Audit_Log', 'idx_audit_log_entry_hash');
    } catch (e) {}

    const auditTable = await queryInterface.describeTable('Audit_Log');
    if (auditTable.previous_hash) {
      await queryInterface.removeColumn('Audit_Log', 'previous_hash');
    }
    if (auditTable.entry_hash) {
      await queryInterface.removeColumn('Audit_Log', 'entry_hash');
    }

    // 2. Rollback User_Deduction_Profile statutory fields
    const spiIndexes = [
      'idx_user_deduction_sss_bidx',
      'idx_user_deduction_tin_bidx',
      'idx_user_deduction_philhealth_bidx',
      'idx_user_deduction_hdmf_bidx'
    ];
    for (const idx of spiIndexes) {
      try {
        await queryInterface.removeIndex('User_Deduction_Profile', idx);
      } catch (e) {}
    }

    const spiCols = [
      'sss_no', 'sss_no_bidx',
      'tin_no', 'tin_no_bidx',
      'philhealth_no', 'philhealth_no_bidx',
      'hdmf_no', 'hdmf_no_bidx'
    ];
    const udpTable = await queryInterface.describeTable('User_Deduction_Profile');
    for (const col of spiCols) {
      if (udpTable[col]) {
        await queryInterface.removeColumn('User_Deduction_Profile', col);
      }
    }
  }
};
