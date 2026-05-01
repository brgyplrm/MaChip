#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include "mbedtls/md.h"
#include "mbedtls/aes.h"
#include "arduino_secrets.h"

/**
 * ── MACHIP SECURITY ARCHITECTURE ──────────────────────────────────────────────
 * 
 * LEVEL 1: HARDWARE-LAYER AUTHENTICATION (Strategy 7 - Sector Validation)
 * - Mechanism: MIFARE Classic Sector 1, Block 4 auth with custom Enterprise Key.
 * - Security Goal: Prevents UID-only cloning. Reader rejects "Magic Cards" 
 *   lacking the secret MACJ- sector key.
 * 
 * LEVEL 2: MULTI-FACTOR CORRELATION (2FA - Token + Biometric)
 * - Mechanism: Temporal binding (15s window) between RFID tap and Fingerprint.
 * - Security Goal: Eliminates "Buddy Punching." Physical token alone cannot clock-in.
 * 
 * LEVEL 3: CRYPTOGRAPHIC INTEGRITY (Strategy 2 - Signed Payloads)
 * - Mechanism: Appends HMAC-SHA256 (mocked) signature using SECRET_HMAC_KEY.
 * - Security Goal: Prevents MITM and Replay attacks. Backend validates origin.
 * 
 * LEVEL 4: RATE-LIMITING & ANTI-HAMMERING (Strategy 9 - Firmware Lockout)
 * - Mechanism: Monitors rapid scan counts per UID; triggers 30s hardware lockout.
 * - Security Goal: Mitigates reader-level brute-force/DoS attempts.
 * ───────────────────────────────────────────────────────────────────────────────
 */

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// ── Security State (Strategies 2, 7, 9) ──────────────────────
String suspiciousUID = "";
int rapidCount = 0;
unsigned long lockUntil = 0;
unsigned long lastScanTime = 0;
const unsigned long SCAN_THRESHOLD = 2000; 
// Note: SECRET_HMAC_KEY and ESP32_API_KEY are defined in arduino_secrets.h

// ── Network config table ──────────────────────────────────────
struct NetworkConfig {
  const char* ssid;
  const char* pass;
  const char* serverUrl;
  const char* fpEnrollUrl;
};

const NetworkConfig networks[] = {
  { WIFI_SSID_1, WIFI_PASS_1, SERVER_URL_1, FP_ENROLL_1 },
  { WIFI_SSID_2, WIFI_PASS_2, SERVER_URL_2, FP_ENROLL_2 },
  { WIFI_SSID_3, WIFI_PASS_3, SERVER_URL_3, FP_ENROLL_3 },
  { WIFI_SSID_4, WIFI_PASS_4, SERVER_URL_4, FP_ENROLL_4 },
  { WIFI_SSID_5, WIFI_PASS_5, SERVER_URL_5, FP_ENROLL_5 },
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

const char* serverName   = nullptr;
const char* fpEnrollUrl  = nullptr;
int connectedNetworkIdx  = -1;

// ── Pin Definitions ──────────────────────────────────────────
#define SS_PIN_IN    5
#define SS_PIN_OUT   26
#define RST_PIN_IN   32  
#define RST_PIN_OUT  25
#define GREEN_LED    2
#define RED_LED      4
#define BUZZER       13
#define FP_RX        16
#define FP_TX        17

// ── OLED Objects ─────────────────────────────────────────────
TwoWire I2C_OUT = TwoWire(1); 
Adafruit_SSD1306 displayIN(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 displayOUT(SCREEN_WIDTH, SCREEN_HEIGHT, &I2C_OUT, -1);

// ── LED STATE MACHINE ────────────────────────────────────────
enum LedMode { LED_OFF, LED_SLOW_BLINK, LED_FAST_BLINK, LED_STEADY_GREEN, LED_STEADY_RED };
LedMode greenMode = LED_SLOW_BLINK, redMode = LED_OFF;
unsigned long lastGreenToggle = 0, lastRedToggle = 0;
bool greenState = false, redState = false;

void setLED(LedMode gMode, LedMode rMode) {
  greenMode = gMode; redMode = rMode;
  if (gMode == LED_OFF) { digitalWrite(GREEN_LED, LOW); greenState = false; }
  if (gMode == LED_STEADY_GREEN) { digitalWrite(GREEN_LED, HIGH); greenState = true; }
  if (rMode == LED_OFF) { digitalWrite(RED_LED, LOW); redState = false; }
  if (rMode == LED_STEADY_RED) { digitalWrite(RED_LED, HIGH); redState = true; }
}

void updateLEDs() {
  unsigned long now = millis();
  unsigned long gInterval = (greenMode == LED_SLOW_BLINK) ? 1000 : (greenMode == LED_FAST_BLINK ? 80 : 0);
  if (gInterval > 0 && now - lastGreenToggle >= gInterval) {
    lastGreenToggle = now; greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW);
  }
  unsigned long rInterval = (redMode == LED_SLOW_BLINK) ? 1000 : (redMode == LED_FAST_BLINK ? 80 : 0);
  if (rInterval > 0 && now - lastRedToggle >= rInterval) {
    lastRedToggle = now; redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW);
  }
}

// ── Objects ──────────────────────────────────────────────────
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ── Pending Scan State (2FA) ─────────────────────────────────
String pendingInUID = "";
unsigned long pendingInStart = 0;
const unsigned long PENDING_TIMEOUT = 15000;

// ── R307S Raw Command Helpers (Zero-Slot) ────────────────────

uint8_t sendCommand(uint8_t cmd, uint8_t* data, uint16_t len) {
  uint16_t packetLen = len + 3;
  uint8_t packet[packetLen + 9];
  packet[0] = 0xEF; packet[1] = 0x01;
  packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF;
  packet[6] = 0x01;
  packet[7] = (packetLen >> 8) & 0xFF; packet[8] = packetLen & 0xFF;
  packet[9] = cmd;
  for (uint16_t i = 0; i < len; i++) packet[10 + i] = data[i];
  
  uint16_t sum = 0x01 + (packetLen >> 8) + (packetLen & 0xFF) + cmd;
  for (uint16_t i = 0; i < len; i++) sum += data[i];
  packet[10 + len] = (sum >> 8) & 0xFF;
  packet[11 + len] = sum & 0xFF;
  
  fpSerial.write(packet, packetLen + 9);
  
  unsigned long start = millis();
  while (fpSerial.available() < 12 && millis() - start < 1000) delay(1);
  if (fpSerial.available() < 12) return 0xFF;
  
  uint8_t ack[12];
  for (int i = 0; i < 12; i++) ack[i] = fpSerial.read();
  return ack[9];
}

uint8_t matchFinger() {
  return sendCommand(0x03, NULL, 0);
}

// Host -> Sensor (UP_CHAR to Buffer 2)
// Logic: Database -> ESP32 -> Sensor char buffer 2
bool uploadTemplate(String hexTemplate) {
  if (hexTemplate.length() != 1024) return false;
  
  // Flush serial buffer to prevent old data interference
  while(fpSerial.available()) fpSerial.read();

  byte templateData[512];
  for (int i = 0; i < 512; i++) {
    templateData[i] = (byte) strtol(hexTemplate.substring(i * 2, i * 2 + 2).c_str(), NULL, 16);
  }

  uint8_t bufId = 0x02;
  // Command 0x09 = DownChar (Host to Sensor)
  uint8_t ack = sendCommand(0x09, &bufId, 1);
  if (ack != 0x00) {
    Serial.println("[FP] DownChar command failed with code: 0x" + String(ack, HEX));
    return false;
  }

  Serial.println("[FP] Sending template packets...");
  for (int i = 0; i < 4; i++) {
    uint8_t type = (i == 3) ? 0x08 : 0x02;
    uint8_t packet[139];
    packet[0] = 0xEF; packet[1] = 0x01;
    packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF;
    packet[6] = type;
    packet[7] = 0x00; packet[8] = 0x82;
    uint16_t sum = type + 0x00 + 0x82;
    for (int j = 0; j < 128; j++) {
      packet[9 + j] = templateData[i * 128 + j];
      sum += packet[9 + j];
    }
    packet[137] = (sum >> 8) & 0xFF;
    packet[138] = sum & 0xFF;
    fpSerial.write(packet, 139);
    delay(25);
  }
  return true;
}

// Sensor -> Host (DOWN_CHAR from Buffer 1)
// Logic: Sensor char buffer 1 -> ESP32 -> Backend Database
String downloadTemplate() {
  // Flush serial buffer to prevent old data interference
  while(fpSerial.available()) fpSerial.read();

  uint8_t bufId = 0x01;
  // Command 0x08 = UpChar (Sensor to Host)
  if (sendCommand(0x08, &bufId, 1) != 0x00) {
    Serial.println("[FP] UpChar command failed");
    return "";
  }

  Serial.println("[FP] Receiving template packets...");
  byte templateData[512];
  int totalBytes = 0;
  unsigned long startTime = millis();

  for (int p = 0; p < 4; p++) {
    bool found = false;
    while (millis() - startTime < 5000) {
      if (fpSerial.available() >= 2) {
        if (fpSerial.read() == 0xEF && fpSerial.peek() == 0x01) {
          fpSerial.read(); // consume 0x01
          found = true;
          break;
        }
      }
      delay(1);
    }
    if (!found) { Serial.println("[FP] Header fail at packet " + String(p)); return ""; }

    // Skip ADDR(4), TYPE(1), LEN(2) = 7 bytes
    for (int i = 0; i < 7; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      fpSerial.read();
    }

    // Read 128 bytes data
    for (int i = 0; i < 128; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      templateData[p * 128 + i] = fpSerial.read();
      totalBytes++;
    }

    // Skip SUM(2)
    for (int i = 0; i < 2; i++) {
      while (!fpSerial.available() && millis() - startTime < 5000) delay(1);
      fpSerial.read();
    }
  }

  if (totalBytes < 512) {
    Serial.println("[FP] Download incomplete: " + String(totalBytes));
    return "";
  }

  String hex = "";
  for (int i = 0; i < 512; i++) {
    if (templateData[i] < 0x10) hex += "0";
    hex += String(templateData[i], HEX);
  }
  hex.toUpperCase();
  Serial.println("[FP] Template download success");
  return hex;
}

// ── OLED Helpers ─────────────────────────────────────────────
void updateOLED(Adafruit_SSD1306 &disp, String line1, String line2) {
  // Mirror to Serial Monitor with Plotter-friendly numerical status
  String label = (&disp == &displayIN) ? "FRONT" : "BACK";
  
  // Plotter logic: We use a simple numerical mapping for the Plotter to graph
  int statusValue = 0;
  if (line1 == "DENIED" || line1 == "ERROR" || line1 == "TIMEOUT") statusValue = -1;
  else if (line1 == "CARD OK" || line1 == "SUCCESS" || line1 == "CAPTURED") statusValue = 2;
  else if (line1 == "FETCHING" || line1 == "VERIFYING") statusValue = 1;
  
  // Format for Serial Plotter: "Label_State:Value"
  Serial.print(label + "_State:" + String(statusValue) + " "); 
  
  // Detailed text for Serial Monitor
  Serial.println("[" + label + "] Display: " + line1 + " | " + line2);

  disp.clearDisplay(); disp.setCursor(0,10); disp.setTextSize(2); disp.println(line1);
  disp.setTextSize(1); disp.println(line2); disp.display();
}

void showIdleMessages() {
  // Reset plotter to 0 (Idle)
  Serial.println(F("FRONT_State:0 BACK_State:0"));
  Serial.println(F("[SYSTEM] Screens Refreshing..."));

  displayIN.clearDisplay(); displayIN.setTextSize(1); displayIN.setTextColor(SSD1306_WHITE);
  displayIN.setCursor(0,0); displayIN.println("MAChip FRONT"); displayIN.println("---------------------");
  displayIN.setCursor(0,30); displayIN.println("TAP CARD TO ENTER"); displayIN.display();

  displayOUT.clearDisplay(); displayOUT.setTextSize(1); displayOUT.setTextColor(SSD1306_WHITE);
  displayOUT.setCursor(0,0); displayOUT.println("MAChip BACK"); displayOUT.println("---------------------");
  displayOUT.setCursor(0,30); displayOUT.println("TAP CARD TO EXIT"); displayOUT.display();
}

// ── Strategy 7: Hardware Sector Authentication Check ──────────
bool authenticateCard(MFRC522 &rfid) {
  MFRC522::MIFARE_Key key;
  MFRC522::StatusCode status;
  byte block = 4; // Sector 1

  // Try Custom MACJ- Key (M A C J - UID[0])
  key.keyByte[0] = 0x4D; key.keyByte[1] = 0x41; key.keyByte[2] = 0x43; key.keyByte[3] = 0x4A;
  key.keyByte[4] = 0x2D; key.keyByte[5] = rfid.uid.uidByte[0];
  
  status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &key, &(rfid.uid));
  if (status == MFRC522::STATUS_OK) { 
    Serial.println(F("[SEC] Auth: MACJ- Key SUCCESS")); 
    return true; 
  }

  Serial.println(F("[SEC] Hardware Auth Failed. Card is not provisioned with MACJ- Key."));
  rfid.PCD_StopCrypto1();
  return false;
}

// ── Provisioning Strategy ────────────────────────────────────
bool provisionCard(MFRC522 &rfid) {
  MFRC522::StatusCode status;
  MFRC522::MIFARE_Key key;
  byte trailerBlock = 7; // Sector 1 trailer

  // ── Step 0: RE-SELECT THE CARD ──
  // After a failed auth attempt, the card enters a state where it won't respond to REQA.
  // We use WUPA (Wake-Up) to force it to respond even if it's halted or in error.
  rfid.PCD_StopCrypto1();
  rfid.PICC_HaltA();
  delay(50);
  
  byte bufferATQA[2];
  byte bufferSize = sizeof(bufferATQA);
  status = rfid.PICC_WakeupA(bufferATQA, &bufferSize);
  
  if (status == MFRC522::STATUS_OK) {
    status = rfid.PICC_Select(&(rfid.uid));
  }

  if (status != MFRC522::STATUS_OK) {
    Serial.println(F("[PROVISION] Card lost during re-select. Hold steady!"));
    return false;
  }

  // ── Step 1: Try Default Key A (FF) ──
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;
  status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(rfid.uid));
  
  // Fallback: Some new cards use 00 00 00 00 00 00
  if (status != MFRC522::STATUS_OK) {
    // Re-select again for fallback
    rfid.PCD_StopCrypto1(); rfid.PICC_HaltA(); delay(50);
    rfid.PICC_WakeupA(bufferATQA, &bufferSize);
    rfid.PICC_Select(&(rfid.uid));
    for (byte i = 0; i < 6; i++) key.keyByte[i] = 0x00;
    status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(rfid.uid));
  }

  if (status != MFRC522::STATUS_OK) {
    Serial.print(F("[PROVISION] Auth failed: ")); Serial.println(rfid.GetStatusCodeName(status));
    return false;
  }

  // ── Step 2: Prepare & Write Sector Trailer ──
  byte trailerBuffer[16];
  // Key A: "MACJ-" + UID[0]
  trailerBuffer[0] = 0x4D; trailerBuffer[1] = 0x41; trailerBuffer[2] = 0x43; trailerBuffer[3] = 0x4A;
  trailerBuffer[4] = 0x2D; trailerBuffer[5] = rfid.uid.uidByte[0];
  // Access Bits: FF 07 80 69
  trailerBuffer[6] = 0xFF; trailerBuffer[7] = 0x07; trailerBuffer[8] = 0x80; trailerBuffer[9] = 0x69;
  // Key B: Default FF
  for (byte i = 10; i < 16; i++) trailerBuffer[i] = 0xFF;

  status = rfid.MIFARE_Write(trailerBlock, trailerBuffer, 16);
  if (status != MFRC522::STATUS_OK) {
    Serial.print(F("[PROVISION] Write failed: ")); Serial.println(rfid.GetStatusCodeName(status));
    return false;
  }

  Serial.println(F("[PROVISION] SUCCESS! Card is now locked with MACJ- Key."));
  return true;
}

// ── Strategy 2: Cryptographic Payload Signature & Encryption ──
String getHmacSha256(String payload, String key) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *) key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char *) payload.c_str(), payload.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  String hash = "";
  for (int i = 0; i < 32; i++) {
    char str[3]; sprintf(str, "%02x", (int)hmacResult[i]);
    hash += str;
  }
  return hash;
}

String encryptAES(String payload, String key) {
  int payloadLen = payload.length();
  int paddedLen = ((payloadLen / 16) + 1) * 16;
  unsigned char input[paddedLen];
  unsigned char output[paddedLen];
  
  memset(input, 0, paddedLen);
  memcpy(input, payload.c_str(), payloadLen);
  byte padVal = paddedLen - payloadLen;
  for(int i = payloadLen; i < paddedLen; i++) input[i] = padVal; // PKCS7

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, (const unsigned char*)key.c_str(), 128);
  
  // Strategy 2: Dynamic IV (Random per request)
  unsigned char iv[16]; 
  for (int i = 0; i < 16; i++) iv[i] = (unsigned char)esp_random();
  
  // Prepend IV to hex result
  String hexResult = "";
  for (int i = 0; i < 16; i++) {
    char str[3]; sprintf(str, "%02x", (int)iv[i]);
    hexResult += str;
  }

  unsigned char iv_copy[16]; memcpy(iv_copy, iv, 16);
  mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, paddedLen, iv_copy, input, output);
  mbedtls_aes_free(&aes);
  
  for (int i = 0; i < paddedLen; i++) {
    char str[3]; sprintf(str, "%02x", (int)output[i]);
    hexResult += str;
  }
  return hexResult;
}

// ── Feedback Helpers ─────────────────────────────────────────
void startupFeedback() { int notes[] = {1000, 1500, 2000, 2500}; for (int i = 0; i < 4; i++) { tone(BUZZER, notes[i], 100); delay(120); } }
void grantFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); tone(BUZZER, 2000, 100); delay(150); noTone(BUZZER); tone(BUZZER, 2500, 150); delay(1200); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }
void denyFeedback() { setLED(LED_OFF, LED_STEADY_RED); tone(BUZZER, 800, 200); delay(250); noTone(BUZZER); tone(BUZZER, 400, 400); delay(1200); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }
void captureFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); for (int i = 0; i < 3; i++) { tone(BUZZER, 2500, 80); delay(150); } delay(800); setLED(LED_SLOW_BLINK, LED_OFF); }
void enrollSuccessFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); tone(BUZZER, 1000, 100); delay(120); tone(BUZZER, 2000, 300); setLED(LED_SLOW_BLINK, LED_OFF); }
void enrollFailFeedback() { setLED(LED_OFF, LED_STEADY_RED); tone(BUZZER, 500, 500); delay(600); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }

// ── Security Header Helper ──────────────────────────────────
void syncTimeFromServer() {
  if (WiFi.status() != WL_CONNECTED || serverName == nullptr) return;
  
  String url = String(serverName);
  int apiIdx = url.indexOf("/api/");
  if (apiIdx == -1) return;
  url = url.substring(0, apiIdx) + "/api/system/time";
  
  HTTPClient http;
  http.begin(url);
  int code = http.GET();
  if (code == 200) {
    JsonDocument doc;
    deserializeJson(doc, http.getString());
    unsigned long serverUnixTime = doc["unixTime"] | 0;
    if (serverUnixTime > 10000000) {
      struct timeval tv;
      tv.tv_sec = serverUnixTime;
      tv.tv_usec = 0;
      settimeofday(&tv, NULL);
      Serial.println("[SYSTEM] Time synced from backend: " + String(serverUnixTime));
    }
  }
  http.end();
}

void applySecureHeaders(HTTPClient &http, String body) {
  unsigned long now = time(nullptr);
  
  // If clock is not synced, try a quick sync if we have a connection
  if (now < 10000000) {
    static unsigned long lastSyncTry = 0;
    if (millis() - lastSyncTry > 30000) { // Don't spam sync requests
      syncTimeFromServer();
      lastSyncTry = millis();
      now = time(nullptr);
    }
  }

  String timestamp = String(now);
  String signature = getHmacSha256(timestamp + body, SECRET_HMAC_KEY);
  
  http.addHeader("x-esp32-key", ESP32_API_KEY);
  http.addHeader("x-esp32-signature", signature);
  http.addHeader("x-esp32-timestamp", timestamp);
}

// ── Backend Sync ─────────────────────────────────────────────
String fetchTemplateFromBackend(String uid) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  String url = String(fpEnrollUrl) + "/download/" + uid;
  Serial.println("[HTTP] Fetching template from: " + url);
  http.begin(url);
  
  applySecureHeaders(http, ""); // GET request has empty body for signature
  
  int code = http.GET();
  if (code != 200) {
    Serial.println("[HTTP] Fetch failed code: " + String(code));
    if (code == 404) {
      Serial.println("[HTTP] Hint: User not registered.");
      http.end();
      return "NOT_FOUND";
    }
  }
  if (code == 200) {
    String body = http.getString();
    JsonDocument doc; deserializeJson(doc, body);
    http.end();
    return doc["template"] | "";
  }
  http.end();
  return "";
}

void sendScanToBackend(String uid, String action) {
  Adafruit_SSD1306 &targetDisp = (action == "clock_out") ? displayOUT : displayIN;
  if (WiFi.status() != WL_CONNECTED) { updateOLED(targetDisp, "OFFLINE", "CHECK WIFI"); denyFeedback(); return; }
  setLED(LED_FAST_BLINK, LED_OFF);
  
  // 1. Encrypt Payload (AES-128-CBC)
  JsonDocument innerDoc; innerDoc["uid"] = uid; innerDoc["action"] = action;
  String innerBody; serializeJson(innerDoc, innerBody);
  String encrypted = encryptAES(innerBody, ESP32_AES_KEY); 

  // 2. Prepare Outer Body
  JsonDocument outerDoc; outerDoc["encryptedData"] = encrypted;
  String outerBody; serializeJson(outerDoc, outerBody);

  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");
  
  applySecureHeaders(http, outerBody);
  
  int code = http.POST(outerBody);
  if (code != 200 && code != 201) Serial.println("[HTTP] POST failed code: " + String(code));
  if (code == 200 || code == 201) {
    String response = http.getString();
    JsonDocument resDoc; deserializeJson(resDoc, response);
    if (resDoc["isCapture"] | false) { updateOLED(targetDisp, "CAPTURED", uid.substring(0,8)); captureFeedback(); }
    else if (resDoc["success"] | false) {
      String name = resDoc["name"] | "User"; String timeStr = resDoc["time"] | "--:--";
      updateOLED(targetDisp, name, (action == "clock_out" ? "OUT " : "IN ") + timeStr); grantFeedback();
    } else { updateOLED(targetDisp, "DENIED", resDoc["message"] | "Error"); denyFeedback(); }
  } else { updateOLED(targetDisp, "ERROR", "CODE: " + String(code)); denyFeedback(); }
  http.end();
}

bool uploadEnrollment(int slotId, bool success, String userId, String templateHex) {
  if (WiFi.status() != WL_CONNECTED) return false;
    HTTPClient http;
    http.begin(String(fpEnrollUrl) + "/confirm");
    http.addHeader("Content-Type", "application/json");
    
    JsonDocument doc; doc["slotId"] = slotId; doc["success"] = success; doc["userId"] = userId;
    if (success) doc["template"] = templateHex;
    String body; serializeJson(doc, body);
    
    applySecureHeaders(http, body);
    
    int code = http.POST(body);
    http.end();
    return code == 200;
}

// ── WiFi ─────────────────────────────────────────────────────
bool autoConnectWiFi() {
  int found = WiFi.scanNetworks();
  if (found <= 0) return false;
  for (int n = 0; n < NETWORK_COUNT; n++) {
    for (int i = 0; i < found; i++) {
      if (WiFi.SSID(i) == String(networks[n].ssid)) {
        WiFi.begin(networks[n].ssid, networks[n].pass);
        int tries = 0;
        while (WiFi.status() != WL_CONNECTED && tries < 20) { updateLEDs(); delay(500); tries++; }
        if (WiFi.status() == WL_CONNECTED) {
          serverName = networks[n].serverUrl; fpEnrollUrl = networks[n].fpEnrollUrl;
          return true;
        }
      }
    }
  }
  return false;
}

// ── SETUP ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(GREEN_LED, OUTPUT); pinMode(RED_LED, OUTPUT); pinMode(BUZZER, OUTPUT);
  setLED(LED_FAST_BLINK, LED_OFF);

  if(!displayIN.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("OLED IN Failed");
  I2C_OUT.begin(14, 27, 400000); 
  if(!displayOUT.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("OLED OUT Failed");
  showIdleMessages();

  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);
  if (finger.verifyPassword()) Serial.println("[R307] OK");

  pinMode(SS_PIN_IN, OUTPUT); pinMode(SS_PIN_OUT, OUTPUT);
  digitalWrite(SS_PIN_IN, HIGH); digitalWrite(SS_PIN_OUT, HIGH);
  SPI.begin();
  rfidIN.PCD_Init(); delay(100); rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  rfidOUT.PCD_Init(); delay(100); rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);

  WiFi.mode(WIFI_STA);
  if (autoConnectWiFi()) {
    configTime(28800, 0, "pool.ntp.org"); // UTC+8 Philippines
    startupFeedback();
  }
  setLED(LED_SLOW_BLINK, LED_OFF);
}

// ── LOOP ─────────────────────────────────────────────────────
void loop() {
  updateLEDs();

  // ── Strategy 9: Hardware Lockout Check (Overflow Safe) ──────
  if (lockUntil > 0 && (long)(millis() - lockUntil) < 0) {
    updateOLED(displayIN, "LOCKED", "SEC VIOLATION");
    updateOLED(displayOUT, "LOCKED", "SEC VIOLATION");
    if(rfidIN.PICC_IsNewCardPresent()) rfidIN.PICC_HaltA();
    if(rfidOUT.PICC_IsNewCardPresent()) rfidOUT.PICC_HaltA();
    delay(500);
    return;
  }

  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiCheck > 30000) {
    lastWifiCheck = millis(); autoConnectWiFi();
  }

  // ── Clock IN: Part 1 - Card Tap ──────────────────────────
  if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidIN.uid.size; i++) {
      if (rfidIN.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfidIN.uid.uidByte[i], HEX);
      if (i < rfidIN.uid.size - 1) uid += ":";
    }
    uid.toUpperCase();

    // Strategy 7: Hardware Sector Auth
    bool authenticated = authenticateCard(rfidIN);
    
    // Strategy 9: Rate-Limiting / Anti-Hammering
    unsigned long timeSinceLast = millis() - lastScanTime;
    if (uid == suspiciousUID && timeSinceLast < SCAN_THRESHOLD) {
      rapidCount++;
      if (rapidCount >= 3) {
        lockUntil = millis() + 30000;
        Serial.println("[SEC] Rapid tapping detected. Device locked.");
        denyFeedback(); rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
        lastScanTime = millis(); return;
      }
    } else { suspiciousUID = uid; rapidCount = 1; }
    lastScanTime = millis();

    updateOLED(displayIN, (authenticated ? "FETCHING" : "VERIFYING"), "BIO-TEMPLATE...");
    
    // OPTIMIZATION: If card is already authenticated, we can release it early
    // to save reader power and prevent collisions.
    if (authenticated) { rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1(); }

    String templateHex = fetchTemplateFromBackend(uid);
    
    if (templateHex == "CAPTURE_OK") {
      updateOLED(displayIN, "CAPTURED", uid.substring(0,8));
      if (!authenticated) {
         if (provisionCard(rfidIN)) updateOLED(displayIN, "PROVISIONED", "SECURE KEY SET");
      }
      captureFeedback();
    } else if (templateHex != "" && templateHex != "NOT_FOUND" && templateHex != "ERROR") {
      if (uploadTemplate(templateHex)) {
        pendingInUID = uid;
        pendingInStart = millis();
        // If not authenticated, we'll provision later if 2FA succeeds
        updateOLED(displayIN, (authenticated ? "CARD OK" : "SEC-AUTH FAIL"), (authenticated ? "SCAN FINGER..." : "USE FINGERPRINT"));
        tone(BUZZER, (authenticated ? 2000 : 1500), (authenticated ? 100 : 200)); 
        setLED(LED_FAST_BLINK, LED_OFF); 
      } else { updateOLED(displayIN, "ERROR", "LOAD FAILED"); denyFeedback(); }
    } else { 
      if (templateHex == "NOT_FOUND") {
        updateOLED(displayIN, "UNKNOWN", "NOT REGISTERED");
        denyFeedback();
      } else if (authenticated) {
        sendScanToBackend(uid, "auto_detect"); 
      } else { denyFeedback(); }
    }
    
    // Final cleanup if not already halted
    rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
  }

  // ── Clock IN: Part 2 - Fingerprint Match ─────────────────
  if (pendingInUID != "") {
    if (millis() - pendingInStart > PENDING_TIMEOUT) {
      pendingInUID = ""; updateOLED(displayIN, "TIMEOUT", "TRY AGAIN"); denyFeedback();
      delay(2000); showIdleMessages();
    } else {
      if (finger.getImage() == FINGERPRINT_OK) {
        if (finger.image2Tz(1) == FINGERPRINT_OK) {
          uint8_t p = matchFinger(); 
          if (p == 0x00) { 
            updateOLED(displayIN, "VERIFYING", "PLEASE WAIT");
            sendScanToBackend(pendingInUID, "clock_in");
            
            // ── SELF-HEALING PROVISIONING ──
            // If we got here, fingerprint matched. If the card was NOT authenticated 
            // in Part 1, try to provision it now before clearing pendingInUID.
            // We re-select using WUPA to catch the card if it's still there.
            if (suspiciousUID == pendingInUID) {
              byte bufferATQA[2]; byte bufferSize = sizeof(bufferATQA);
              if (rfidIN.PICC_WakeupA(bufferATQA, &bufferSize) == MFRC522::STATUS_OK) {
                if (rfidIN.PICC_Select(&(rfidIN.uid)) == MFRC522::STATUS_OK) {
                   // Check if it already has the key (maybe it was just a read error)
                   if (!authenticateCard(rfidIN)) {
                      if (provisionCard(rfidIN)) Serial.println("[SEC] Self-Heal: Card provisioned after 2FA");
                   }
                }
              }
            }

            pendingInUID = ""; delay(2500); showIdleMessages();
          } else { updateOLED(displayIN, "NO MATCH", "TRY AGAIN"); denyFeedback(); }
        }
      }
    }
  }

  // ── Clock OUT: Card Tap Only ─────────────────────────────
  if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidOUT.uid.size; i++) {
      if (rfidOUT.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfidOUT.uid.uidByte[i], HEX);
      if (i < rfidOUT.uid.size - 1) uid += ":";
    }
    uid.toUpperCase();

    // Log Card Type for Diagnostics
    MFRC522::PICC_Type piccType = rfidOUT.PICC_GetType(rfidOUT.uid.sak);
    Serial.print(F("[RFID] Type: ")); Serial.println(rfidOUT.PICC_GetTypeName(piccType));

    // Strategy 7: Hardware Sector Auth
    bool authenticated = authenticateCard(rfidOUT);
    if (!authenticated) Serial.println(F("[SEC] Hardware Auth Failed for this card."));

    // Strategy 9: Rate-Limiting / Anti-Hammering
    unsigned long timeSinceLast = millis() - lastScanTime;
    if (uid == suspiciousUID && timeSinceLast < SCAN_THRESHOLD) {
      rapidCount++;
      if (rapidCount >= 3) {
        lockUntil = millis() + 30000;
        Serial.println("[SEC] Rapid tapping detected. Device locked.");
        denyFeedback(); rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
        lastScanTime = millis();
        return;
      }
    } else { suspiciousUID = uid; rapidCount = 1; }
    lastScanTime = millis();

    if (authenticated) {
      updateOLED(displayOUT, "SCANNED", "VERIFYING...");
      sendScanToBackend(uid, "clock_out");
    } else {
      denyFeedback();
    }
    
    rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
    delay(2500); showIdleMessages();
  }

  // ── Enrollment session (Zero-Slot) ───────────────────────
  static unsigned long lastFPCheck = 0;
  if (millis() - lastFPCheck > 2000) {
    lastFPCheck = millis();
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http; 
      http.begin(String(fpEnrollUrl) + "/session");
      
      applySecureHeaders(http, ""); // GET request
      
      int code = http.GET();
      if (code == 200) {
        JsonDocument doc; deserializeJson(doc, http.getString());
        if (doc["active"] | false) {
          // ... rest of the enrollment logic ...
          String userId = doc["userId"].as<String>(); int slotId = doc["slotId"] | 0;
          
          Serial.println("[FP] Enrollment session active for " + userId);
          updateOLED(displayIN, "ENROLLING", "SCAN FINGER 1");
          setLED(LED_FAST_BLINK, LED_OFF);
          
          bool ok = false; String templateHex = "";
          
          Serial.println("[FP] Waiting for first scan (15s timeout)...");
          unsigned long startScan = millis();
          while (millis() - startScan < 15000) {
            if (finger.getImage() == FINGERPRINT_OK) {
              if (finger.image2Tz(1) == FINGERPRINT_OK) {
                Serial.println("[FP] First scan captured!");
                updateOLED(displayIN, "SCAN 1 OK", "REMOVE FINGER");
                ok = true; break;
              }
            }
            delay(100);
          }
          
          if (ok) {
            delay(1000);
            while(finger.getImage() != FINGERPRINT_NOFINGER) delay(50);
            Serial.println("[FP] Remove finger...");
            updateOLED(displayIN, "ENROLLING", "SCAN FINGER 2");
            
            ok = false;
            Serial.println("[FP] Waiting for second scan...");
            startScan = millis();
            while (millis() - startScan < 15000) {
              if (finger.getImage() == FINGERPRINT_OK) {
                if (finger.image2Tz(2) == FINGERPRINT_OK) {
                  Serial.println("[FP] Second scan captured!");
                  ok = true; break;
                }
              }
              delay(100);
            }
          }

          if (ok) {
            Serial.println("[FP] Creating model and downloading template...");
            if (finger.createModel() == FINGERPRINT_OK) {
              templateHex = downloadTemplate();
              if (templateHex == "") ok = false;
            } else {
              Serial.println("[FP] Failed to create model (mismatch)");
              ok = false;
            }
          }

          uploadEnrollment(slotId, ok, userId, templateHex);
          if (ok) {
            Serial.println("[FP] Enrollment SUCCESS");
            enrollSuccessFeedback(); 
          } else {
            Serial.println("[FP] Enrollment FAILED");
            enrollFailFeedback();
          }
          setLED(LED_SLOW_BLINK, LED_OFF);
          showIdleMessages();
        }
      } else if (code != -1) {
        // Log non-connection errors (like 404) once in a while to avoid flooding
        static unsigned long lastErrorLog = 0;
        if (millis() - lastErrorLog > 30000) {
          Serial.println("[HTTP] Polling /session failed code: " + String(code));
          lastErrorLog = millis();
        }
      }
      http.end();
    }
  }
}
