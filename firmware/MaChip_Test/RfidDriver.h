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

inline void queueTransaction(String uid, String action, String terminalType) {
  queuedTransaction.uid = uid;
  queuedTransaction.action = action;
  queuedTransaction.terminalType = terminalType;
  queuedTransaction.pending = true;
}

inline void processQueuedTransaction() {
  if (!queuedTransaction.pending || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(currentServerUrl);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-esp32-key", String(ESP32_API_KEY));

  JsonDocument doc;
  doc["uid"] = queuedTransaction.uid;
  doc["action"] = queuedTransaction.action;
  doc["terminalType"] = queuedTransaction.terminalType;

  String payload;
  serializeJson(doc, payload);
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    queuedTransaction.pending = false;
    Serial.println(F("[OK] Sync Finished"));
  }
  http.end();
}
