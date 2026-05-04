const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters in .env");
}
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a string.
 * @param {string} text 
 * @returns {string} iv:encrypted_text
 */
function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error("[Encryption Error]:", error);
    return text; // Fallback to raw text if error
  }
}

/**
 * Decrypts a string.
 * @param {string} text 
 * @returns {string} original_text
 */
function decrypt(text) {
  if (!text) return null;
  // If not in the format "iv:encrypted", it might be unencrypted
  if (!text.includes(':')) return text;

  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("[Decryption Error]:", error);
    return text; // Return as is if decryption fails
  }
}

module.exports = { encrypt, decrypt };
