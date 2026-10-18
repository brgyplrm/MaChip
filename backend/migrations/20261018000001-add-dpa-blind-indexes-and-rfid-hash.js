'use strict';

const { hashRfidBadge, generateBlindIndex, decrypt } = require('../src/utils/encryption');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Upgrade User_Hardware with machip_uid_hash
    const uhTable = await queryInterface.describeTable('User_Hardware');
    if (!uhTable.machip_uid_hash) {
      await queryInterface.addColumn('User_Hardware', 'machip_uid_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null
      });

      try {
        await queryInterface.addIndex('User_Hardware', ['machip_uid_hash'], {
          unique: true,
          name: 'idx_user_hardware_machip_uid_hash'
        });
      } catch (idxErr) {
        console.warn('[Migration Warning]: Index idx_user_hardware_machip_uid_hash already exists or skipped:', idxErr.message);
      }
    }

    // 2. Upgrade User_Banking with account_number_bidx
    const ubTable = await queryInterface.describeTable('User_Banking');
    if (!ubTable.account_number_bidx) {
      await queryInterface.addColumn('User_Banking', 'account_number_bidx', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null
      });

      try {
        await queryInterface.addIndex('User_Banking', ['account_number_bidx'], {
          name: 'idx_user_banking_account_number_bidx'
        });
      } catch (idxErr) {
        console.warn('[Migration Warning]: Index idx_user_banking_account_number_bidx already exists or skipped:', idxErr.message);
      }
    }

    // 3. Upgrade User with non-SPI birth_month
    const userTable = await queryInterface.describeTable('User');
    if (!userTable.birth_month) {
      await queryInterface.addColumn('User', 'birth_month', {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null
      });

      try {
        await queryInterface.addIndex('User', ['birth_month'], {
          name: 'idx_user_birth_month'
        });
      } catch (idxErr) {
        console.warn('[Migration Warning]: Index idx_user_birth_month already exists or skipped:', idxErr.message);
      }
    }

    // 4. Backfill Data: Compute HMAC hashes for existing records
    try {
      // 4A. Backfill User_Hardware.machip_uid_hash
      const [hardwareRows] = await queryInterface.sequelize.query(
        `SELECT "hardwareId", "user_MachipId" FROM "User_Hardware" 
         WHERE "user_MachipId" IS NOT NULL AND "user_MachipId" != '' AND "machip_uid_hash" IS NULL`
      );

      for (const row of hardwareRows) {
        const hash = hashRfidBadge(row.user_MachipId);
        if (hash) {
          await queryInterface.sequelize.query(
            `UPDATE "User_Hardware" SET "machip_uid_hash" = :hash WHERE "hardwareId" = :id`,
            { replacements: { hash, id: row.hardwareId } }
          );
        }
      }

      // 4B. Backfill User_Banking.account_number_bidx
      const [bankingRows] = await queryInterface.sequelize.query(
        `SELECT "bankingId", "account_Number" FROM "User_Banking" 
         WHERE "account_Number" IS NOT NULL AND "account_Number" != '' AND "account_number_bidx" IS NULL`
      );

      for (const row of bankingRows) {
        const rawAccount = decrypt(row.account_Number);
        if (rawAccount) {
          const bidx = generateBlindIndex(rawAccount);
          if (bidx) {
            await queryInterface.sequelize.query(
              `UPDATE "User_Banking" SET "account_number_bidx" = :bidx WHERE "bankingId" = :id`,
              { replacements: { bidx, id: row.bankingId } }
            );
          }
        }
      }

      // 4C. Backfill User.birth_month from user_DOB
      await queryInterface.sequelize.query(
        `UPDATE "User" 
         SET "birth_month" = EXTRACT(MONTH FROM "user_DOB") 
         WHERE "user_DOB" IS NOT NULL AND "birth_month" IS NULL`
      );

      console.log('[Migration Backfill]: DPA blind indexes and RFID hashes successfully populated.');
    } catch (backfillErr) {
      console.error('[Migration Backfill Warning]: Failed during data backfill:', backfillErr.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Remove User.birth_month
    try {
      await queryInterface.removeIndex('User', 'idx_user_birth_month');
    } catch (e) {}
    const userTable = await queryInterface.describeTable('User');
    if (userTable.birth_month) {
      await queryInterface.removeColumn('User', 'birth_month');
    }

    // 2. Remove User_Banking.account_number_bidx
    try {
      await queryInterface.removeIndex('User_Banking', 'idx_user_banking_account_number_bidx');
    } catch (e) {}
    const ubTable = await queryInterface.describeTable('User_Banking');
    if (ubTable.account_number_bidx) {
      await queryInterface.removeColumn('User_Banking', 'account_number_bidx');
    }

    // 3. Remove User_Hardware.machip_uid_hash
    try {
      await queryInterface.removeIndex('User_Hardware', 'idx_user_hardware_machip_uid_hash');
    } catch (e) {}
    const uhTable = await queryInterface.describeTable('User_Hardware');
    if (uhTable.machip_uid_hash) {
      await queryInterface.removeColumn('User_Hardware', 'machip_uid_hash');
    }
  }
};
