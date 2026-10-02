const { sequelize, User, User_Hardware } = require("../config/sequelize.js");
const { QueryTypes } = require("sequelize");
const { getSystemTime, formatDateLocal } = require("../utils/systemTime.js");
const { logTransaction } = require("../utils/logger");

exports.getAllRfidCards = async (req, res) => {
  try {
    const results = await sequelize.query(
      `SELECT 
        u."user_Id", 
        CONCAT(u."user_FirstName", ' ', u."user_LastName") as "userName",
        h."user_MachipId" as "machip_id",
        CASE 
          WHEN h."user_MachipId" IS NOT NULL AND h."user_MachipId" != '' THEN 'Active' 
          ELSE 'Unassigned' 
        END as "hardwareStatus",
        h."updatedAt" as "dateAligned",
        (SELECT MAX(l."log_Date"::text || ' ' || l."time_Logged"::text) 
         FROM "user_logging" l 
         WHERE l."user_id" = u."user_Id") as "lastScannedRaw"
      FROM "User" u
      LEFT JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
      WHERE u."deletedAt" IS NULL
      ORDER BY u."user_LastName" ASC`,
      { type: QueryTypes.SELECT }
    );

    // Format dates for better UI display if needed
    const formatted = results.map(row => {
      let lastScannedStr = "Never";
      if (row.lastScannedRaw) {
        // e.g., "2026-05-16 08:00:00+08" -> Javascript Date handles this better than raw postgres CAST
        const d = new Date(row.lastScannedRaw);
        if (!isNaN(d.getTime())) {
          lastScannedStr = d.toLocaleString();
        } else {
          // Fallback if parsing fails
           lastScannedStr = row.lastScannedRaw.split('+')[0];
        }
      }

      return {
        ...row,
        dateAligned: row.machip_id && row.dateAligned ? row.dateAligned : null,
        lastScanned: lastScannedStr
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error fetching RFID cards:", error);
    res.status(500).json({ error: "Failed to fetch RFID registry." });
  }
};

exports.assignRfidCard = async (req, res) => {
  const { user_Id, machip_id } = req.body;

  if (!user_Id || !machip_id) {
    return res.status(400).json({ error: "User ID and Card UID are required." });
  }

  try {
    const now = await getSystemTime();
    const nowStr = now.toISOString();

    // Check if card is already assigned to someone else
    const [existing] = await sequelize.query(
      `SELECT u."user_FirstName", u."user_LastName" 
       FROM "User" u
       JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE LOWER(h."user_MachipId") = LOWER(:machip_id) AND u."deletedAt" IS NULL`,
      { replacements: { machip_id }, type: QueryTypes.SELECT }
    );

    if (existing) {
      return res.status(400).json({ 
        error: `This card is already assigned to ${existing.user_FirstName} ${existing.user_LastName}.` 
      });
    }

    // Upsert into User_Hardware
    await sequelize.query(
      `INSERT INTO "User_Hardware" ("user_Id", "user_MachipId", "card_counter", "createdAt", "updatedAt")
       VALUES (:user_Id, :machip_id, 0, :now, :now)
       ON CONFLICT ("user_Id") DO UPDATE SET
        "user_MachipId" = EXCLUDED."user_MachipId",
        "card_counter" = 0,
        "updatedAt" = EXCLUDED."updatedAt"`,
      { replacements: { user_Id, machip_id, now: nowStr }, type: QueryTypes.INSERT }
    );

    await logTransaction(user_Id, req.user?.user_Id, "HARDWARE_ASSIGN", `RFID Card ${machip_id} assigned to user.`, { machip_id }, req);

    res.status(200).json({ message: "RFID card assigned successfully." });
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error assigning RFID card:", error);
    res.status(500).json({ error: "Failed to assign hardware credentials." });
  }
};

const { encrypt } = require("../utils/encryption.js");

exports.revokeRfidCard = async (req, res) => {
  const { userId } = req.params;

  try {
    const nowStr = new Date().toISOString();

    await sequelize.query(
      `UPDATE "User_Hardware" 
       SET "user_MachipId" = NULL, "card_counter" = 0, "updatedAt" = :now
       WHERE "user_Id" = :userId`,
      { replacements: { userId, now: nowStr }, type: QueryTypes.UPDATE }
    );

    await logTransaction(userId, req.user?.user_Id, "HARDWARE_REVOKE", `RFID Card access revoked for user.`, {}, req);

    res.status(200).json({ message: "RFID card access unlinked successfully." });
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error revoking RFID card:", error);
    res.status(500).json({ error: "Failed to unlink hardware credentials." });
  }
};

exports.getAllFingerprints = async (req, res) => {
  try {
    const results = await sequelize.query(
      `SELECT 
        u."user_Id", 
        CONCAT(u."user_FirstName", ' ', u."user_LastName") as "userName",
        h."user_FingerprintId" as "fingerprintIndex",
        1 as "slotNumber",
        'Primary' as "fingerprintType",
        'Secure Node 01' as "sensorNode"
      FROM "User" u
      JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
      WHERE u."deletedAt" IS NULL 
        AND h."user_FingerprintId" IS NOT NULL
        AND h."user_FingerprintTemplate" IS NOT NULL 
        AND TRIM(h."user_FingerprintTemplate") != ''
      UNION ALL
      SELECT 
        u."user_Id", 
        CONCAT(u."user_FirstName", ' ', u."user_LastName") as "userName",
        h."user_FingerprintId2" as "fingerprintIndex",
        2 as "slotNumber",
        'Secondary (Fallback)' as "fingerprintType",
        'Secure Node 01' as "sensorNode"
      FROM "User" u
      JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
      WHERE u."deletedAt" IS NULL 
        AND h."user_FingerprintId2" IS NOT NULL
        AND h."user_FingerprintTemplate2" IS NOT NULL 
        AND TRIM(h."user_FingerprintTemplate2") != ''
      ORDER BY "userName" ASC, "slotNumber" ASC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(results);
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error fetching fingerprints:", error);
    res.status(500).json({ error: "Failed to fetch biometric registry." });
  }
};

exports.assignFingerprint = async (req, res) => {
  const { user_Id, fingerprintIndex, fingerprintTemplate, slotNumber } = req.body;

  if (!user_Id || !fingerprintIndex) {
    return res.status(400).json({ error: "User ID and Fingerprint Slot are required." });
  }

  try {
    const nowStr = new Date().toISOString();

    const [existing] = await sequelize.query(
      `SELECT u."user_FirstName", u."user_LastName" 
       FROM "User" u
       JOIN "User_Hardware" h ON u."user_Id" = h."user_Id"
       WHERE (h."user_FingerprintId" = :fingerprintIndex OR h."user_FingerprintId2" = :fingerprintIndex)
         AND u."deletedAt" IS NULL AND u."user_Id" != :user_Id`,
      { replacements: { fingerprintIndex, user_Id }, type: QueryTypes.SELECT }
    );

    if (existing) {
      return res.status(400).json({ 
        error: `This fingerprint slot is already assigned to ${existing.user_FirstName} ${existing.user_LastName}.` 
      });
    }

    // Fetch current hardware profile for this user
    const [currentHw] = await sequelize.query(
      `SELECT "user_FingerprintId", "user_FingerprintId2" FROM "User_Hardware" WHERE "user_Id" = :user_Id`,
      { replacements: { user_Id }, type: QueryTypes.SELECT }
    );

    // Determine target slot (1 or 2)
    let targetSlotNumber = slotNumber ? parseInt(slotNumber) : null;
    if (!targetSlotNumber) {
      if (currentHw && currentHw.user_FingerprintId && currentHw.user_FingerprintId !== parseInt(fingerprintIndex)) {
        targetSlotNumber = 2;
      } else {
        targetSlotNumber = 1;
      }
    }

    // Prevent assigning the same slot to both Primary and Fallback for the same user
    if (targetSlotNumber === 2 && currentHw?.user_FingerprintId && currentHw.user_FingerprintId === parseInt(fingerprintIndex)) {
      return res.status(400).json({ 
        error: "Fallback fingerprint cannot use the same slot or finger as the Primary fingerprint." 
      });
    }
    if (targetSlotNumber === 1 && currentHw?.user_FingerprintId2 && currentHw.user_FingerprintId2 === parseInt(fingerprintIndex)) {
      return res.status(400).json({ 
        error: "Primary fingerprint cannot use the same slot or finger as the Fallback fingerprint." 
      });
    }

    let encryptedTemplate = null;
    if (fingerprintTemplate) {
      encryptedTemplate = encrypt(fingerprintTemplate);
    }

    if (targetSlotNumber === 2) {
      await sequelize.query(
        `INSERT INTO "User_Hardware" ("user_Id", "user_FingerprintId2", "user_FingerprintTemplate2", "createdAt", "updatedAt")
         VALUES (:user_Id, :fingerprintIndex, :encryptedTemplate, :now, :now)
         ON CONFLICT ("user_Id") DO UPDATE SET
          "user_FingerprintId2" = EXCLUDED."user_FingerprintId2",
          "user_FingerprintTemplate2" = EXCLUDED."user_FingerprintTemplate2",
          "updatedAt" = EXCLUDED."updatedAt"`,
        { replacements: { user_Id, fingerprintIndex, encryptedTemplate, now: nowStr }, type: QueryTypes.INSERT }
      );
    } else {
      await sequelize.query(
        `INSERT INTO "User_Hardware" ("user_Id", "user_FingerprintId", "user_FingerprintTemplate", "createdAt", "updatedAt")
         VALUES (:user_Id, :fingerprintIndex, :encryptedTemplate, :now, :now)
         ON CONFLICT ("user_Id") DO UPDATE SET
          "user_FingerprintId" = EXCLUDED."user_FingerprintId",
          "user_FingerprintTemplate" = EXCLUDED."user_FingerprintTemplate",
          "updatedAt" = EXCLUDED."updatedAt"`,
        { replacements: { user_Id, fingerprintIndex, encryptedTemplate, now: nowStr }, type: QueryTypes.INSERT }
      );
    }

    await logTransaction(user_Id, req.user?.user_Id, "HARDWARE_ASSIGN", `Biometric Profile (${targetSlotNumber === 2 ? 'Secondary Fallback' : 'Primary'}) assigned to slot ${fingerprintIndex}.`, { fingerprintIndex, slotNumber: targetSlotNumber }, req);

    res.status(200).json({ message: `Biometric profile (${targetSlotNumber === 2 ? 'Secondary Fallback' : 'Primary'}) assigned successfully.` });
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error assigning biometric:", error);
    res.status(500).json({ error: "Failed to assign hardware credentials." });
  }
};

exports.clearFingerprint = async (req, res) => {
  const { userId } = req.params;
  const slotNumber = req.query.slotNumber || req.body?.slotNumber;

  try {
    const nowStr = new Date().toISOString();

    if (parseInt(slotNumber) === 2) {
      await sequelize.query(
        `UPDATE "User_Hardware" 
         SET "user_FingerprintId2" = NULL, "user_FingerprintTemplate2" = NULL, "updatedAt" = :now
         WHERE "user_Id" = :userId`,
        { replacements: { userId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    } else if (parseInt(slotNumber) === 1) {
      await sequelize.query(
        `UPDATE "User_Hardware" 
         SET "user_FingerprintId" = NULL, "user_FingerprintTemplate" = NULL, "updatedAt" = :now
         WHERE "user_Id" = :userId`,
        { replacements: { userId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    } else {
      await sequelize.query(
        `UPDATE "User_Hardware" 
         SET "user_FingerprintId" = NULL, "user_FingerprintTemplate" = NULL,
             "user_FingerprintId2" = NULL, "user_FingerprintTemplate2" = NULL,
             "updatedAt" = :now
         WHERE "user_Id" = :userId`,
        { replacements: { userId, now: nowStr }, type: QueryTypes.UPDATE }
      );
    }

    await logTransaction(userId, req.user?.user_Id, "HARDWARE_REVOKE", `Biometric Profile access revoked for user.`, { slotNumber }, req);

    res.status(200).json({ message: "Biometric profile unlinked successfully." });
  } catch (error) {
    console.error("[HARDWARE-CONTROLLER] Error revoking biometric:", error);
    res.status(500).json({ error: "Failed to unlink hardware credentials." });
  }
};
