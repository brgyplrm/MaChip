const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters in .env");
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY);
const GCM_IV_LENGTH = 12; // 12 bytes standard for AES-GCM (NIST SP 800-38D)
const CBC_IV_LENGTH = 16; // Legacy 16 bytes for AES-CBC

/**
 * Encrypts sensitive personal information using AES-256-GCM (Authenticated Encryption).
 * @param {string|number} text - Plaintext to encrypt
 * @returns {string|null} iv:authTag:ciphertext (hex encoded)
 */
function encrypt(text) {
  if (text === null || text === undefined || text === '') return null;
  const str = String(text);

  try {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);

    let encrypted = cipher.update(str, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag(); // 16-byte Buffer

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error("[Encryption Error]: Failed to encrypt payload:", error.message);
    throw new Error("Encryption failed: Security boundary violated.");
  }
}

/**
 * Decrypts ciphertext with dual-mode support:
 * - 3 parts (iv:authTag:ciphertext) -> AES-256-GCM authenticated decryption
 * - 2 parts (iv:ciphertext) -> Legacy AES-256-CBC decryption (backward compatibility)
 * - No colon -> Returns raw string (unencrypted fallback)
 *
 * Enforces fail-closed security: corrupted or tampered ciphertexts return null and log an alert.
 *
 * @param {string} text - Ciphertext string
 * @returns {string|null} Decrypted plaintext, or null if tampered/invalid
 */
function decrypt(text) {
  if (text === null || text === undefined || text === '') return null;
  if (typeof text !== 'string') return text;

  // Unencrypted plain string fallback
  if (!text.includes(':')) return text;

  const parts = text.split(':');

  // Case 1: Standard AES-256-GCM (iv:authTag:ciphertext)
  if (parts.length === 3) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      if (authTag.length !== 16) {
        console.error("[Decryption Error]: Invalid GCM authentication tag length");
        return null;
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error("[Decryption Security Alert]: Tampering or authentication tag mismatch detected:", error.message);
      return null; // Fail-closed: Never return raw tampered ciphertext
    }
  }

  // Case 2: Legacy AES-256-CBC (iv:ciphertext) for backward compatibility with existing DB rows
  if (parts.length === 2) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedBuffer = Buffer.from(parts[1], 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', KEY_BUFFER, iv);
      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error("[Legacy Decryption Error]: Failed to decrypt legacy CBC payload:", error.message);
      return null; // Fail-closed
    }
  }

  // Unrecognized colon format: Fail-closed
  console.warn("[Decryption Warning]: Unrecognized ciphertext segment structure");
  return null;
}

/**
 * Computes an irreversible deterministic HMAC-SHA256 blind index for exact search lookups.
 * Allows O(1) indexed database queries on encrypted columns without exposing plaintext SPI.
 *
 * @param {string|number} value - Raw value to index (e.g., bank account or gov ID)
 * @param {string} [customSecret] - Optional key override (defaults to BLIND_INDEX_KEY or ENCRYPTION_KEY)
 * @returns {string|null} 64-character hex hash
 */
function generateBlindIndex(value, customSecret) {
  if (value === null || value === undefined || value === '') return null;
  const secret = customSecret || process.env.BLIND_INDEX_KEY || ENCRYPTION_KEY;
  const normalized = String(value).trim().toUpperCase();
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

/**
 * Computes a keyed HMAC-SHA256 hash for RFID badge matching without storing plaintext card UIDs.
 * Satisfies GEMINI.md Rule 8: "Cards are assumed clonable" by preventing badge cloning from DB dumps.
 *
 * @param {string} uid - Raw RFID card UID (e.g. "E2806894")
 * @param {string} [customSecret] - Optional secret key override
 * @returns {string|null} 64-character hex hash
 */
function hashRfidBadge(uid, customSecret) {
  if (uid === null || uid === undefined || uid === '') return null;
  const secret = customSecret || process.env.RFID_HMAC_SECRET || ENCRYPTION_KEY;
  const normalized = String(uid).trim().toUpperCase();
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

/**
 * Masks a sensitive account or identification number for safe UI presentation (e.g., ••••••••1234).
 * @param {string|number} value 
 * @param {number} [unmaskedDigits=4] 
 * @returns {string}
 */
function maskSensitiveValue(value, unmaskedDigits = 4) {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value).trim();
  if (s.length <= unmaskedDigits) return '••••••••';
  return '••••••••' + s.slice(-unmaskedDigits);
}

const GENESIS_AUDIT_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Recursively canonicalizes JSON objects by sorting keys to ensure deterministic
 * serialization regardless of database JSONB key-reordering.
 */
function canonicalizeJson(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        return canonicalizeJson(parsed);
      }
    } catch {}
    return val;
  }
  if (typeof val !== 'object') return String(val);
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(val[k])).join(',') + '}';
}

/**
 * Computes an HMAC-SHA256 hash for an audit log entry to establish cryptographic tamper-evidence.
 * Chaining each record to its predecessor guarantees that any modification or row deletion is detected.
 *
 * @param {string} previousHash - 64-char hex hash of preceding audit entry (or GENESIS_AUDIT_HASH)
 * @param {object} logData - Audit row attributes
 * @param {string} [customSecret] - Optional key override
 * @returns {string} 64-character hex hash
 */
function computeAuditEntryHash(previousHash, logData, customSecret) {
  const secret = customSecret || process.env.AUDIT_HMAC_SECRET || ENCRYPTION_KEY;
  const prev = previousHash || GENESIS_AUDIT_HASH;
  
  const oldValStr = canonicalizeJson(logData.old_Value);
  const newValStr = canonicalizeJson(logData.new_Value);
  const createdStr = logData.createdAt ? new Date(logData.createdAt).toISOString() : '';

  const payload = [
    prev,
    logData.user_Id || '',
    logData.module || '',
    logData.action || '',
    logData.target_Table || '',
    logData.target_Id || '',
    oldValStr,
    newValStr,
    logData.ip_Address || '',
    createdStr
  ].join('|');

  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies the sequential cryptographic integrity of an array of audit logs.
 * Returns valid status, total verified count, and index of first discrepancy if tampered.
 *
 * @param {Array} logs - Array of Audit_Log rows ordered by auditId ASC
 * @param {string} [customSecret]
 * @returns {object} { isValid: boolean, totalChecked: number, brokenAtAuditId: number|null, reason: string|null }
 */
function verifyAuditLogChain(logs, customSecret) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { isValid: true, totalChecked: 0, brokenAtAuditId: null, reason: null };
  }

  let expectedPrevHash = GENESIS_AUDIT_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    // Check 1: Previous hash link integrity
    if (i === 0) {
      if (entry.previous_hash && entry.previous_hash !== GENESIS_AUDIT_HASH) {
        return {
          isValid: false,
          totalChecked: i,
          brokenAtAuditId: entry.auditId,
          reason: `Genesis audit entry #${entry.auditId} has invalid previous_hash.`
        };
      }
    } else {
      if (entry.previous_hash !== expectedPrevHash) {
        return {
          isValid: false,
          totalChecked: i,
          brokenAtAuditId: entry.auditId,
          reason: `Chain broken at Log #${entry.auditId}: previous_hash does not match predecessor hash.`
        };
      }
    }

    // Check 2: Recompute entry hash and check for data alteration
    const recomputedHash = computeAuditEntryHash(entry.previous_hash, entry, customSecret);
    if (entry.entry_hash && entry.entry_hash !== recomputedHash) {
      return {
        isValid: false,
        totalChecked: i,
        brokenAtAuditId: entry.auditId,
        reason: `Data tampering detected at Log #${entry.auditId}: Payload content does not match entry_hash.`
      };
    }

    expectedPrevHash = entry.entry_hash || recomputedHash;
  }

  return {
    isValid: true,
    totalChecked: logs.length,
    brokenAtAuditId: null,
    reason: null
  };
}

module.exports = {
  encrypt,
  decrypt,
  generateBlindIndex,
  hashRfidBadge,
  maskSensitiveValue,
  GENESIS_AUDIT_HASH,
  computeAuditEntryHash,
  verifyAuditLogChain,
};
