#pragma once
#include "Config.h"

// ── BIOMETRIC EXTRACTOR ENGINE ────────────────────────────────────
inline String downloadTemplate() {
  while (fpSerial.available()) fpSerial.read();
  uint8_t bufId = 0x01;
  uint16_t packetLen = 1 + 3;
  uint8_t packet[13];
  packet[0] = 0xEF; packet[1] = 0x01;
  packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF;
  packet[6] = 0x01;
  packet[7] = (packetLen >> 8) & 0xFF; packet[8] = packetLen & 0xFF;
  packet[9] = 0x08; packet[10] = bufId;
  uint16_t sum = 0x01 + (packetLen >> 8) + (packetLen & 0xFF) + 0x08 + bufId;
  packet[11] = (sum >> 8) & 0xFF; packet[12] = sum & 0xFF;
  
  fpSerial.write(packet, 13);
  unsigned long start = millis();
  while (fpSerial.available() < 12 && millis() - start < 1000) delay(1);
  if (fpSerial.available() < 12) return "";
  
  uint8_t ack[12];
  for (int i = 0; i < 12; i++) ack[i] = fpSerial.read();
  if (ack[9] != 0x00) return "";

  byte templateData[512];
  int totalBytes = 0;
  unsigned long startTime = millis();
  
  for (int p = 0; p < 4; p++) {
    bool found = false;
    while (millis() - startTime < 5000) {
      if (fpSerial.available() >= 2) {
        if (fpSerial.read() == 0xEF && fpSerial.peek() == 0x01) {
          fpSerial.read(); found = true; break;
        }
      }
      delay(1);
    }
    if (!found) return "";
    for (int i = 0; i < 7; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      fpSerial.read();
    }
    for (int i = 0; i < 128; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      templateData[p * 128 + i] = fpSerial.read();
      totalBytes++;
    }
    for (int i = 0; i < 2; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      fpSerial.read();
    }
  }

  if (totalBytes < 512) return "";
  String hex = "";
  for (int i = 0; i < 512; i++) {
    if (templateData[i] < 0x10) hex += "0";
    hex += String(templateData[i], HEX);
  }
  hex.toUpperCase();
  return hex;
}

inline void uploadEnrollment(int slotId, bool success, String userId, String templateHex) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(currentFpUrl + "/enroll-confirm");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-esp32-key", String(ESP32_API_KEY));
  
  JsonDocument doc;
  doc["userId"] = userId;
  doc["slotId"] = slotId;
  doc["success"] = success;
  doc["template"] = templateHex;
  
  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}
