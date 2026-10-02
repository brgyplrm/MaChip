#pragma once
#include "Config.h"

// ── RFID UTILITIES & QUEUED SYNC ENGINE ──────────────────────────
inline String getUIDString(MFRC522 &rfid) {
  String cardUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    cardUid += (rfid.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfid.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();
  return cardUid;
}

// ── RFID SECTOR 1 PASSWORD AUTHENTICATION & ROLLING CODE ──────────
inline bool authenticateCardSector(MFRC522 &rfid, byte blockAddr, const byte *keyBytes) {
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) key.keyByte[i] = keyBytes[i];
  MFRC522::StatusCode status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, blockAddr, &key, &(rfid.uid));
  return (status == MFRC522::STATUS_OK);
}

inline uint32_t readAndIncrementCardCounter(MFRC522 &rfid) {
  MFRC522::PICC_Type piccType = rfid.PICC_GetType(rfid.uid.sak);
  // Only execute MIFARE Classic sector authentication on supported Classic cards
  if (piccType != MFRC522::PICC_TYPE_MIFARE_MINI && 
      piccType != MFRC522::PICC_TYPE_MIFARE_1K && 
      piccType != MFRC522::PICC_TYPE_MIFARE_4K) {
    return 0;
  }

  // 1. Try authenticating with proprietary system Key A
  bool isAuth = authenticateCardSector(rfid, MIFARE_SECTOR_COUNTER_BLOCK, MIFARE_KEY_MACJ);
  
  if (!isAuth) {
    // 2. Try authenticating with factory default key (0xFF * 6) for first-time provisioning
    isAuth = authenticateCardSector(rfid, MIFARE_SECTOR_COUNTER_BLOCK, MIFARE_KEY_FACTORY);
    if (isAuth) {
      Serial.println(F("[RFID-SEC] Unprovisioned MIFARE Classic detected. Initializing Sector 1..."));
      
      // Block 4: Organization Header / Verification Token ("MACJ")
      byte headerBlock[16] = { 0x4D, 0x41, 0x43, 0x4A, 0x01, 0x00, 0x00, 0x00, 0xAA, 0x55, 0xAA, 0x55, 0x00, 0x00, 0x00, 0x00 };
      rfid.MIFARE_Write(MIFARE_SECTOR_AUTH_BLOCK, headerBlock, 16);

      // Block 5: Monotonic Counter = 1 with inverted verification bytes
      byte counterBlock[16] = { 0 };
      uint32_t initialCounter = 1;
      counterBlock[0] = initialCounter & 0xFF;
      counterBlock[1] = (initialCounter >> 8) & 0xFF;
      counterBlock[2] = (initialCounter >> 16) & 0xFF;
      counterBlock[3] = (initialCounter >> 24) & 0xFF;
      counterBlock[4] = ~counterBlock[0];
      counterBlock[5] = ~counterBlock[1];
      counterBlock[6] = ~counterBlock[2];
      counterBlock[7] = ~counterBlock[3];
      counterBlock[8] = 'R'; counterBlock[9] = 'O'; counterBlock[10] = 'L'; counterBlock[11] = 'L';
      counterBlock[12] = '_'; counterBlock[13] = 'C'; counterBlock[14] = 'O'; counterBlock[15] = 'D';
      rfid.MIFARE_Write(MIFARE_SECTOR_COUNTER_BLOCK, counterBlock, 16);

      // Block 7: Sector Trailer (Write MACJ Key A so future reads are protected)
      byte trailerBlock[16] = { 0 };
      for (byte i = 0; i < 6; i++) trailerBlock[i] = MIFARE_KEY_MACJ[i];
      for (byte i = 0; i < 4; i++) trailerBlock[6 + i] = MIFARE_ACCESS_BITS[i];
      for (byte i = 0; i < 6; i++) trailerBlock[10 + i] = MIFARE_KEY_FACTORY[i]; // Keep Key B accessible
      rfid.MIFARE_Write(MIFARE_SECTOR_TRAILER_BLOCK, trailerBlock, 16);

      Serial.println(F("[RFID-SEC] Sector 1 securely provisioned with MACJ Key A & Counter = 1"));
      return initialCounter;
    } else {
      Serial.println(F("[RFID-SEC] Sector 1 authentication failed (unrecognized key)."));
      return 0;
    }
  }

  // 3. Authenticated with MACJ Key A: Read current monotonic counter from Block 5
  byte readBuffer[18];
  byte bufferSize = sizeof(readBuffer);
  MFRC522::StatusCode status = rfid.MIFARE_Read(MIFARE_SECTOR_COUNTER_BLOCK, readBuffer, &bufferSize);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.printf("[RFID-SEC] Read Block %d Failed: %s\n", MIFARE_SECTOR_COUNTER_BLOCK, rfid.GetStatusCodeName(status));
    return 0;
  }

  uint32_t currentCounter = (uint32_t)readBuffer[0] |
                            ((uint32_t)readBuffer[1] << 8) |
                            ((uint32_t)readBuffer[2] << 16) |
                            ((uint32_t)readBuffer[3] << 24);

  uint32_t invCounter = (uint32_t)readBuffer[4] |
                        ((uint32_t)readBuffer[5] << 8) |
                        ((uint32_t)readBuffer[6] << 16) |
                        ((uint32_t)readBuffer[7] << 24);

  // Validate integrity checksum
  if ((currentCounter ^ invCounter) != 0xFFFFFFFF) {
    Serial.println(F("[RFID-SEC] Counter checksum mismatch, resetting counter baseline..."));
    currentCounter = 0;
  }

  uint32_t nextCounter = currentCounter + 1;
  byte writeBuffer[16] = { 0 };
  writeBuffer[0] = nextCounter & 0xFF;
  writeBuffer[1] = (nextCounter >> 8) & 0xFF;
  writeBuffer[2] = (nextCounter >> 16) & 0xFF;
  writeBuffer[3] = (nextCounter >> 24) & 0xFF;
  writeBuffer[4] = ~writeBuffer[0];
  writeBuffer[5] = ~writeBuffer[1];
  writeBuffer[6] = ~writeBuffer[2];
  writeBuffer[7] = ~writeBuffer[3];
  writeBuffer[8] = 'R'; writeBuffer[9] = 'O'; writeBuffer[10] = 'L'; writeBuffer[11] = 'L';
  writeBuffer[12] = '_'; writeBuffer[13] = 'C'; writeBuffer[14] = 'O'; writeBuffer[15] = 'D';

  status = rfid.MIFARE_Write(MIFARE_SECTOR_COUNTER_BLOCK, writeBuffer, 16);
  if (status != MFRC522::STATUS_OK) {
    Serial.printf("[RFID-SEC] Counter update write failed: %s\n", rfid.GetStatusCodeName(status));
  } else {
    Serial.printf("[RFID-SEC] Counter successfully advanced to %u\n", nextCounter);
  }

  return nextCounter;
}

inline void queueTransaction(String uid, String action, String terminalType, uint32_t cardCounter = 0) {
  queuedTransaction.uid = uid;
  queuedTransaction.action = action;
  queuedTransaction.terminalType = terminalType;
  queuedTransaction.cardCounter = cardCounter;
  queuedTransaction.pending = true;
}

inline void processQueuedTransaction() {
  if (!queuedTransaction.pending || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(currentServerUrl);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["uid"] = queuedTransaction.uid;
  doc["action"] = queuedTransaction.action;
  doc["terminalType"] = queuedTransaction.terminalType;
  if (queuedTransaction.cardCounter > 0) {
    doc["cardCounter"] = queuedTransaction.cardCounter;
  }

  String payload;
  serializeJson(doc, payload);
  signHttpRequest(http, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    queuedTransaction.pending = false;
    Serial.println(F("[OK] Sync Finished"));
  }
  http.end();
}
