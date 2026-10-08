/**
 * espValidator.js
 * Middleware to ensure requests to critical hardware endpoints
 * come from an authorized ESP32 device using a pre-shared API Key.
 */

const crypto = require('crypto');

// In-memory replay cache to prevent duplicate signature submissions within the skew window
const seenSignatures = new Map();

function cleanSeenSignatures(now) {
    for (const [sig, ts] of seenSignatures.entries()) {
        if (now - ts > 120) {
            seenSignatures.delete(sig);
        }
    }
}

/**
 * espValidator.js
 * Enhanced middleware to ensure requests come from an authorized ESP32.
 * Implements:
 * 1. API Key Validation
 * 2. Anti-Replay Protection (Timestamp Check & Replay Cache)
 * 3. Cryptographic Integrity (HMAC-SHA256 Signature)
 * 4. Payload Confidentiality (AES-128 Decryption)
 */
const espValidator = (req, res, next) => {
    const apiKey = req.headers['x-esp32-key'] || req.headers['x-api-key'] || req.headers['authorization'];
    const systemKey = process.env.ESP32_API_KEY;

    // 1. Basic API Key Check
    if (!apiKey || apiKey !== systemKey) {
        console.warn(`[AUTH ERROR] Unauthorized ESP32 attempt from ${req.ip}`);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid API key." });
    }

    const signature = req.headers['x-esp32-signature'];
    const timestamp = req.headers['x-esp32-timestamp'];

    // Require signature and timestamp for all state-changing requests (POST, PUT, DELETE, PATCH)
    if (!signature || !timestamp) {
        // Allow GET requests without signature for polling/session checks
        if (req.method === 'GET') {
            return next();
        }
        return res.status(403).json({ success: false, message: "Secure communication required (Missing Sig/TS)." });
    }

    // 2. Anti-Replay Protection (Timestamp must be within 2 minutes)
    const now = Math.floor(Date.now() / 1000);
    const requestTs = parseInt(timestamp);
    const ALLOWED_SKEW = 120; 

    // Special Case: If the device has not synced time yet (timestamp < 10 million), 
    // we allow it IF the signature matches, but we log a warning.
    const isBootTime = !isNaN(requestTs) && requestTs < 10000000;

    if (!isBootTime && (isNaN(requestTs) || Math.abs(now - requestTs) > ALLOWED_SKEW)) {
        console.error(`[SEC] Replay/Skew detected. Now: ${now}, Req: ${requestTs}`);
        return res.status(403).json({ success: false, message: "Request expired or clock skew too high." });
    }

    if (isBootTime) {
        console.warn(`[SEC] Device using boot-time timestamp: ${requestTs}. NTP sync may have failed.`);
    }

    // 3. HMAC-SHA256 Signature Verification
    const hmacSecret = process.env.SECRET_HMAC_KEY || process.env.ESP32_HMAC_KEY;
    if (!hmacSecret) {
        console.error(`[SEC] No HMAC Secret Key defined in server environment!`);
        return res.status(500).json({ success: false, message: "Server security misconfiguration." });
    }
    
    // For GET requests or empty bodies, we sign the timestamp + empty string
    // For POST/PUT with body, prefer rawBody (exact wire bytes) to avoid serialization differences
    let bodyString = "";
    if (req.method !== 'GET') {
        if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
            bodyString = req.rawBody;
        } else if (req.body && Object.keys(req.body).length > 0) {
            bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }
    }

    const expectedSignature = crypto.createHmac('sha256', hmacSecret)
        .update(timestamp + bodyString)
        .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        console.error(`[SEC] Signature Mismatch! Expected: ${expectedSignature.slice(0, 8)}..., Received: ${signature.slice(0, 8)}...`);
        return res.status(403).json({ success: false, message: "Invalid cryptographic signature." });
    }

    // Check for replay of identical signature within the 120s skew window
    cleanSeenSignatures(now);
    if (seenSignatures.has(signature)) {
        console.error(`[SEC] Replay attack detected for signature: ${signature.slice(0, 8)}...`);
        return res.status(403).json({ success: false, message: "Replay attack detected: Duplicate request signature." });
    }
    seenSignatures.set(signature, now);

    // 4. AES-128 Payload Decryption
    if (req.body && req.body.encryptedData) {
        try {
            const aesKey = process.env.ESP32_AES_KEY || "macj_aes_key_16b"; // Must be 16 bytes for AES-128
            
            // The encryptedData now contains the IV (first 16 bytes) followed by ciphertext
            const combinedData = Buffer.from(req.body.encryptedData, 'hex');
            
            if (combinedData.length < 17) {
                throw new Error("Payload too short to contain IV and Ciphertext");
            }

            const iv = combinedData.slice(0, 16);
            const ciphertext = combinedData.slice(16);
            
            const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(aesKey), iv);
            let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            // Overwrite body with decrypted JSON object
            req.body = JSON.parse(decrypted);
        } catch (err) {
            console.error(`[SEC] Decryption failed: ${err.message}`);
            return res.status(400).json({ success: false, message: "Failed to decrypt secure payload." });
        }
    }

    next();
};

module.exports = espValidator;

