#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
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
 * LEVEL 2: MULTI-FACTOR CORRELATION (2FA - Token + Biometric)
 * LEVEL 3: CRYPTOGRAPHIC INTEGRITY (Strategy 2 - Signed Payloads)
 * LEVEL 4: RATE-LIMITING & ANTI-HAMMERING (Strategy 9 - Firmware Lockout)
 * ───────────────────────────────────────────────────────────────────────────────
 */

// ── TFT Pin Definitions (Using your open pins) ────────────────
#define TFT_CS         15 
#define TFT_RST        14 
#define TFT_DC         27 
#define RELAY_PIN      12 // Dedicated Relay Pin

// ── SPI Hardware Pins (Shared) ──────────────────────────────
#define SCK_PIN        18
#define MISO_PIN       19
#define MOSI_PIN       23
#define SS_PIN_IN      5
#define SS_PIN_OUT     26
#define RST_PIN_IN     32  
#define RST_PIN_OUT    25

// ── Peripherals ──────────────────────────────────────────────
#define GREEN_LED      2
#define RED_LED        4
#define BUZZER       13
#define FP_RX        16
#define FP_TX        17

// ── Security State ──────────────────────────────────────────
String suspiciousUID = "";
int rapidCount = 0;
unsigned long lockUntil = 0;
unsigned long lastScanTime = 0;
const unsigned long SCAN_THRESHOLD = 2000; 

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

// ── Objects ──────────────────────────────────────────────────
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ── Pending Scan State (2FA) ─────────────────────────────────
String pendingInUID = "";
unsigned long pendingInStart = 0;
const unsigned long PENDING_TIMEOUT = 15000;

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

// ── TFT Helpers ─────────────────────────────────────────────
void tftLog(String msg, uint16_t color = ST7735_WHITE) {
    Serial.println("[TFT_LOG] " + msg);
    tft.setTextColor(color);
    tft.println("> " + msg);
}

void drawStatusLine() {
  tft.drawFastHLine(0, 140, 128, ST7735_WHITE);
  tft.setCursor(0, 145);
  tft.setTextSize(1);
  if (WiFi.status() == WL_CONNECTED) {
    tft.setTextColor(ST7735_GREEN);
    tft.print("WiFi: OK | Srv: READY");
  } else {
    tft.setTextColor(ST7735_RED);
    tft.print("WiFi: OFFLINE");
  }
}

void updateTFT(String title, String subtitle, uint16_t color = ST7735_WHITE) {
  tft.fillScreen(ST7735_BLACK);
  tft.setCursor(0, 20);
  tft.setTextColor(color);
  tft.setTextSize(2);
  tft.println(title);
  tft.setTextSize(1);
  tft.setCursor(0, 50);
  tft.println(subtitle);
  drawStatusLine();
}

void showIdleTFT() {
  tft.fillScreen(ST7735_BLACK);
  tft.setCursor(0, 10);
  tft.setTextColor(ST7735_CYAN);
  tft.setTextSize(2);
  tft.println("MAChip V4");
  tft.drawFastHLine(0, 30, 128, ST7735_CYAN);
  tft.setCursor(0, 50);
  tft.setTextSize(1);
  tft.setTextColor(ST7735_WHITE);
  tft.println("READY FOR SCAN");
  tft.println("");
  tft.println("TAP CARD OR FINGER");
  drawStatusLine();
}

// ── Hardware Control ─────────────────────────────────────────
void monitorPins() {
    int relayVal = digitalRead(RELAY_PIN);
    static int lastRelayVal = -1;
    if(relayVal != lastRelayVal) {
        Serial.print(F("[DEBUG] Relay State Change: "));
        Serial.println(relayVal == HIGH ? F("HIGH (OFF)") : F("LOW (ON)"));
        lastRelayVal = relayVal;
    }
}

void unlockDoor() {
    tftLog("ACCESS GRANTED", ST7735_GREEN);
    digitalWrite(RELAY_PIN, LOW); // Trigger Relay
    delay(3000);                  // Wait 3 seconds
    digitalWrite(RELAY_PIN, HIGH); // Lock again
    tftLog("DOOR LOCKED", ST7735_YELLOW);
}

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

bool uploadTemplate(String hexTemplate) {
  if (hexTemplate.length() != 1024) return false;
  while(fpSerial.available()) fpSerial.read();
  byte templateData[512];
  for (int i = 0; i < 512; i++) {
    templateData[i] = (byte) strtol(hexTemplate.substring(i * 2, i * 2 + 2).c_str(), NULL, 16);
  }
  uint8_t bufId = 0x02;
  uint8_t ack = sendCommand(0x09, &bufId, 1);
  if (ack != 0x00) return false;
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

String downloadTemplate() {
  while(fpSerial.available()) fpSerial.read();
  uint8_t bufId = 0x01;
  if (sendCommand(0x08, &bufId, 1) != 0x00) return "";
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

// ── Security & Authentication ────────────────────────────────
bool authenticateCard(MFRC522 &rfid) {
  MFRC522::MIFARE_Key key;
  MFRC522::StatusCode status;
  byte block = 4;
  key.keyByte[0] = 0x4D; key.keyByte[1] = 0x41; key.keyByte[2] = 0x43; key.keyByte[3] = 0x4A;
  key.keyByte[4] = 0x2D; key.keyByte[5] = rfid.uid.uidByte[0];
  status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &key, &(rfid.uid));
  if (status == MFRC522::STATUS_OK) return true;
  rfid.PCD_StopCrypto1();
  return false;
}

bool provisionCard(MFRC522 &rfid) {
  MFRC522::StatusCode status;
  MFRC522::MIFARE_Key key;
  byte trailerBlock = 7;
  rfid.PCD_StopCrypto1(); rfid.PICC_HaltA(); delay(50);
  byte bufferATQA[2]; byte bufferSize = sizeof(bufferATQA);
  status = rfid.PICC_WakeupA(bufferATQA, &bufferSize);
  if (status == MFRC522::STATUS_OK) status = rfid.PICC_Select(&(rfid.uid));
  if (status != MFRC522::STATUS_OK) return false;
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;
  status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(rfid.uid));
  if (status != MFRC522::STATUS_OK) {
    rfid.PCD_StopCrypto1(); rfid.PICC_HaltA(); delay(50);
    rfid.PICC_WakeupA(bufferATQA, &bufferSize); rfid.PICC_Select(&(rfid.uid));
    for (byte i = 0; i < 6; i++) key.keyByte[i] = 0x00;
    status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerBlock, &key, &(rfid.uid));
  }
  if (status != MFRC522::STATUS_OK) return false;
  byte trailerBuffer[16];
  trailerBuffer[0] = 0x4D; trailerBuffer[1] = 0x41; trailerBuffer[2] = 0x43; trailerBuffer[3] = 0x4A;
  trailerBuffer[4] = 0x2D; trailerBuffer[5] = rfid.uid.uidByte[0];
  trailerBuffer[6] = 0xFF; trailerBuffer[7] = 0x07; trailerBuffer[8] = 0x80; trailerBuffer[9] = 0x69;
  for (byte i = 10; i < 16; i++) trailerBuffer[i] = 0xFF;
  status = rfid.MIFARE_Write(trailerBlock, trailerBuffer, 16);
  return (status == MFRC522::STATUS_OK);
}

// ── Cryptography ─────────────────────────────────────────────
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
  unsigned char input[paddedLen]; unsigned char output[paddedLen];
  memset(input, 0, paddedLen); memcpy(input, payload.c_str(), payloadLen);
  byte padVal = paddedLen - payloadLen;
  for(int i = payloadLen; i < paddedLen; i++) input[i] = padVal;
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, (const unsigned char*)key.c_str(), 128);
  unsigned char iv[16]; for (int i = 0; i < 16; i++) iv[i] = (unsigned char)esp_random();
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

// ── Backend Sync ─────────────────────────────────────────────
void syncTimeFromServer() {
  if (WiFi.status() != WL_CONNECTED || serverName == nullptr) return;
  String url = String(serverName); int apiIdx = url.indexOf("/api/"); if (apiIdx == -1) return;
  url = url.substring(0, apiIdx) + "/api/system/time";
  HTTPClient http; http.begin(url);
  int code = http.GET();
  if (code == 200) {
    JsonDocument doc; deserializeJson(doc, http.getString());
    unsigned long serverUnixTime = doc["unixTime"] | 0;
    if (serverUnixTime > 10000000) {
      struct timeval tv; tv.tv_sec = serverUnixTime; tv.tv_usec = 0;
      settimeofday(&tv, NULL);
    }
  }
  http.end();
}

void applySecureHeaders(HTTPClient &http, String body) {
  unsigned long now = time(nullptr);
  if (now < 10000000) syncTimeFromServer();
  String timestamp = String(now);
  String signature = getHmacSha256(timestamp + body, SECRET_HMAC_KEY);
  http.addHeader("x-esp32-key", ESP32_API_KEY);
  http.addHeader("x-esp32-signature", signature);
  http.addHeader("x-esp32-timestamp", timestamp);
}

String fetchTemplateFromBackend(String uid) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  String url = String(fpEnrollUrl) + "/download/" + uid;
  http.begin(url);
  applySecureHeaders(http, "");
  int code = http.GET();
  if (code == 200) {
    String body = http.getString();
    JsonDocument doc; deserializeJson(doc, body);
    http.end(); return doc["template"] | "";
  }
  http.end(); return (code == 404) ? "NOT_FOUND" : "";
}

void sendScanToBackendTFT(String uid, String action) {
  if (WiFi.status() != WL_CONNECTED) { 
    Serial.println(F("[ERROR] Scan failed: WiFi NOT CONNECTED")); 
    updateTFT("OFFLINE", "CHECK WIFI", ST7735_RED); 
    denyFeedback(); 
    return; 
  }

  Serial.print(F("[DEBUG] Connecting to Server: "));
  Serial.println(serverName);

  setLED(LED_FAST_BLINK, LED_OFF);
  JsonDocument innerDoc; innerDoc["uid"] = uid; innerDoc["action"] = action;
  String innerBody; serializeJson(innerDoc, innerBody);
  String encrypted = encryptAES(innerBody, ESP32_AES_KEY); 
  JsonDocument outerDoc; outerDoc["encryptedData"] = encrypted;
  String outerBody; serializeJson(outerDoc, outerBody);

  HTTPClient http; 
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");
  applySecureHeaders(http, outerBody);
  
  int code = http.POST(outerBody);

  if (code > 0) {
    Serial.print(F("[SERVER] Response Code: "));
    Serial.println(code);
  } else {
    Serial.print(F("[SERVER] Connection Failed. Error: "));
    Serial.println(http.errorToString(code).c_str());
  }

  if (code == 200 || code == 201) {
    String response = http.getString();
    Serial.println(F("[SERVER] Success Payload Received"));
    JsonDocument resDoc; deserializeJson(resDoc, response);
    if (resDoc["isCapture"] | false) { updateTFT("CAPTURED", uid.substring(0,8), ST7735_GREEN); captureFeedback(); }
    else if (resDoc["success"] | false) {
      String name = resDoc["name"] | "User"; String timeStr = resDoc["time"] | "--:--";
      updateTFT(name, (action == "clock_out" ? "OUT " : "IN ") + timeStr, ST7735_GREEN); 
      grantFeedback(); unlockDoor();
    } else { updateTFT("DENIED", resDoc["message"] | "Error", ST7735_RED); denyFeedback(); }
  } else { 
    updateTFT("ERROR", "CODE: " + String(code), ST7735_RED); 
    denyFeedback(); 
  }
  http.end();
}

bool uploadEnrollment(int slotId, bool success, String userId, String templateHex) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http; http.begin(String(fpEnrollUrl) + "/confirm");
  http.addHeader("Content-Type", "application/json");
  JsonDocument doc; doc["slotId"] = slotId; doc["success"] = success; doc["userId"] = userId;
  if (success) doc["template"] = templateHex;
  String body; serializeJson(doc, body);
  applySecureHeaders(http, body);
  int code = http.POST(body);
  http.end(); return code == 200;
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
  pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, HIGH); 
  pinMode(GREEN_LED, OUTPUT); pinMode(RED_LED, OUTPUT); pinMode(BUZZER, OUTPUT);
  setLED(LED_FAST_BLINK, LED_OFF);

  tft.initR(INITR_BLACKTAB);
  tft.setRotation(1);
  tft.fillScreen(ST7735_BLACK);
  tft.setCursor(0, 0);
  tft.setTextSize(1);
  
  tftLog("MAChip V4 Booting...", ST7735_CYAN);
  tftLog("Initializing Biometrics...");
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  finger.begin(57600);
  if (finger.verifyPassword()) tftLog("Biometric: READY", ST7735_GREEN);
  else tftLog("Biometric: NOT FOUND", ST7735_RED);

  tftLog("Initializing RFID...");
  pinMode(SS_PIN_IN, OUTPUT); pinMode(SS_PIN_OUT, OUTPUT);
  digitalWrite(SS_PIN_IN, HIGH); digitalWrite(SS_PIN_OUT, HIGH);
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN);
  rfidIN.PCD_Init(); delay(100); rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  rfidOUT.PCD_Init(); delay(100); rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
  tftLog("RFID Bus: READY", ST7735_GREEN);

  tftLog("Connecting WiFi...");
  WiFi.mode(WIFI_STA);
  if (autoConnectWiFi()) {
    tftLog("Network: CONNECTED", ST7735_GREEN);
    tftLog("IP: " + WiFi.localIP().toString(), ST7735_YELLOW);
    configTime(28800, 0, "pool.ntp.org");
    startupFeedback();
  } else tftLog("Network: OFFLINE", ST7735_RED);
  
  delay(2000);
  setLED(LED_SLOW_BLINK, LED_OFF);
  showIdleTFT();
}

// ── LOOP ─────────────────────────────────────────────────────
void loop() {
  updateLEDs();
  monitorPins();

  static unsigned long lastStatusRefresh = 0;
  if (millis() - lastStatusRefresh > 5000) {
    lastStatusRefresh = millis();
    if (pendingInUID == "") drawStatusLine();
  }

  if (lockUntil > 0 && (long)(millis() - lockUntil) < 0) {
    updateTFT("LOCKED", "SEC VIOLATION", ST7735_RED);
    if(rfidIN.PICC_IsNewCardPresent()) rfidIN.PICC_HaltA();
    if(rfidOUT.PICC_IsNewCardPresent()) rfidOUT.PICC_HaltA();
    delay(100); return;
  }

  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiCheck > 30000) {
    lastWifiCheck = millis(); autoConnectWiFi();
  }

  // --- CONNECTION STABILITY LOG ---
  static unsigned long lastConnLog = 0;
  if (millis() - lastConnLog > 10000) { // Log every 10 seconds
    lastConnLog = millis();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print(F("[SYSTEM] WiFi OK. IP: "));
      Serial.println(WiFi.localIP());
    } else {
      Serial.println(F("[SYSTEM] WiFi DISCONNECTED - Attempting Reconnect..."));
    }
  }

  // Reader Health Check
  static unsigned long lastReaderCheck = 0;
  if (millis() - lastReaderCheck > 10000) {
    lastReaderCheck = millis();
    if (rfidIN.PCD_ReadRegister(rfidIN.VersionReg) == 0x00) {
      rfidIN.PCD_Init();
      rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
    }
    if (rfidOUT.PCD_ReadRegister(rfidOUT.VersionReg) == 0x00) {
      rfidOUT.PCD_Init();
      rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
    }
  }

  // RFID IN
  if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidIN.uid.size; i++) {
      if (rfidIN.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfidIN.uid.uidByte[i], HEX);
      if (i < rfidIN.uid.size - 1) uid += ":";
    }
    uid.toUpperCase();
    bool authenticated = authenticateCard(rfidIN);
    unsigned long timeSinceLast = millis() - lastScanTime;
    if (uid == suspiciousUID && timeSinceLast < SCAN_THRESHOLD) {
      rapidCount++;
      if (rapidCount >= 3) {
        lockUntil = millis() + 30000;
        denyFeedback(); rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
        lastScanTime = millis(); return;
      }
    } else { suspiciousUID = uid; rapidCount = 1; }
    lastScanTime = millis();
    updateTFT((authenticated ? "FETCHING" : "VERIFYING"), "BIO-TEMPLATE...", ST7735_YELLOW);
    if (authenticated) { rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1(); }
    String templateHex = fetchTemplateFromBackend(uid);
    if (templateHex == "CAPTURE_OK") {
      updateTFT("CAPTURED", uid.substring(0,8), ST7735_GREEN);
      if (!authenticated) provisionCard(rfidIN);
      captureFeedback();
    } else if (templateHex != "" && templateHex != "NOT_FOUND" && templateHex != "ERROR") {
      if (uploadTemplate(templateHex)) {
        pendingInUID = uid; pendingInStart = millis();
        updateTFT("CARD OK", "SCAN FINGER...", ST7735_CYAN);
        tone(BUZZER, 2000, 100); setLED(LED_FAST_BLINK, LED_OFF); 
      } else { updateTFT("ERROR", "LOAD FAILED", ST7735_RED); denyFeedback(); }
    } else { 
      if (templateHex == "NOT_FOUND") { updateTFT("UNKNOWN", "NOT REGISTERED", ST7735_RED); denyFeedback(); }
      else if (authenticated) sendScanToBackendTFT(uid, "auto_detect"); 
      else denyFeedback();
    }
    rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
    delay(2000); showIdleTFT();
  }

  // 2FA Fingerprint
  if (pendingInUID != "") {
    if (millis() - pendingInStart > PENDING_TIMEOUT) {
      pendingInUID = ""; updateTFT("TIMEOUT", "TRY AGAIN", ST7735_RED); denyFeedback();
      delay(2000); showIdleTFT();
    } else {
      if (finger.getImage() == FINGERPRINT_OK) {
        if (finger.image2Tz(1) == FINGERPRINT_OK) {
          if (matchFinger() == 0x00) { 
            updateTFT("VERIFYING", "PLEASE WAIT", ST7735_CYAN);
            sendScanToBackendTFT(pendingInUID, "clock_in");
            pendingInUID = ""; delay(2000); showIdleTFT();
          } else { updateTFT("NO MATCH", "TRY AGAIN", ST7735_RED); denyFeedback(); }
        }
      }
    }
  }

  // RFID OUT
  if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidOUT.uid.size; i++) {
      if (rfidOUT.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfidOUT.uid.uidByte[i], HEX);
      if (i < rfidOUT.uid.size - 1) uid += ":";
    }
    uid.toUpperCase();
    bool authenticated = authenticateCard(rfidOUT);
    unsigned long timeSinceLast = millis() - lastScanTime;
    if (uid == suspiciousUID && timeSinceLast < SCAN_THRESHOLD) {
      rapidCount++;
      if (rapidCount >= 3) {
        lockUntil = millis() + 30000;
        denyFeedback(); rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
        lastScanTime = millis(); return;
      }
    } else { suspiciousUID = uid; rapidCount = 1; }
    lastScanTime = millis();
    if (authenticated) {
      updateTFT("SCANNED", "VERIFYING...", ST7735_YELLOW);
      sendScanToBackendTFT(uid, "clock_out");
    } else denyFeedback();
    rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
    delay(2000); showIdleTFT();
  }

  // Enrollment
  static unsigned long lastFPCheck = 0;
  if (millis() - lastFPCheck > 2000) {
    lastFPCheck = millis();
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http; http.begin(String(fpEnrollUrl) + "/session");
      applySecureHeaders(http, ""); 
      int code = http.GET();
      if (code == 200) {
        JsonDocument doc; deserializeJson(doc, http.getString());
        if (doc["active"] | false) {
          String userId = doc["userId"].as<String>(); int slotId = doc["slotId"] | 0;
          updateTFT("ENROLLING", "SCAN FINGER 1", ST7735_MAGENTA);
          setLED(LED_FAST_BLINK, LED_OFF);
          bool ok = false; String templateHex = ""; unsigned long startScan = millis();
          while (millis() - startScan < 15000) {
            if (finger.getImage() == FINGERPRINT_OK && finger.image2Tz(1) == FINGERPRINT_OK) {
              updateTFT("SCAN 1 OK", "REMOVE FINGER", ST7735_GREEN); ok = true; break;
            }
            delay(100);
          }
          if (ok) {
            delay(1000); while(finger.getImage() != FINGERPRINT_NOFINGER) delay(50);
            updateTFT("ENROLLING", "SCAN FINGER 2", ST7735_MAGENTA);
            ok = false; startScan = millis();
            while (millis() - startScan < 15000) {
              if (finger.getImage() == FINGERPRINT_OK && finger.image2Tz(2) == FINGERPRINT_OK) {
                ok = true; break;
              }
              delay(100);
            }
          }
          if (ok) {
            if (finger.createModel() == FINGERPRINT_OK) {
              templateHex = downloadTemplate(); if (templateHex == "") ok = false;
            } else ok = false;
          }
          uploadEnrollment(slotId, ok, userId, templateHex);
          if (ok) { updateTFT("SUCCESS", "ENROLLED!", ST7735_GREEN); enrollSuccessFeedback(); }
          else { updateTFT("FAILED", "TRY AGAIN", ST7735_RED); enrollFailFeedback(); }
          setLED(LED_SLOW_BLINK, LED_OFF); delay(2000); showIdleTFT();
        }
      }
      http.end();
    }
  }
}
