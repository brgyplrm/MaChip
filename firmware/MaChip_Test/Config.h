#pragma once
#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_SSD1306.h>
#include <time.h>
#include "mbedtls/md.h"
#include "arduino_secrets.h"

// ── FIRMWARE METADATA & BUILD VERSION ───────────────────────────
#define FIRMWARE_VERSION   "v2.7.0-UDP-DISCOVERY"
#define BUILD_TIMESTAMP    __DATE__ " " __TIME__

// ── CRYPTOGRAPHIC & RFID HARDWARE SECURITY ───────────────────────
const byte MIFARE_KEY_MACJ[6] = { 0xB5, 0x2A, 0x49, 0x3B, 0x7B, 0x20 };
const byte MIFARE_KEY_FACTORY[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
const byte MIFARE_ACCESS_BITS[4] = { 0xFF, 0x07, 0x80, 0x69 }; // Transport default configuration
#define MIFARE_SECTOR_AUTH_BLOCK    4
#define MIFARE_SECTOR_COUNTER_BLOCK 5
#define MIFARE_SECTOR_TRAILER_BLOCK 7

// ── HARDWARE LAYER PIN DEFINITIONS ──────────────────────────────
#define GREEN_LED          12    // Physical UI Green Indicator
#define RED_LED            13    // Physical UI Red Indicator
#define SOLENOID_PIN       14    // Relay Control - LOW = UNLOCK, HIGH = LOCK
#define BUZZER             27    // PWM Audio Feedback Pin
#define FP_RX              16    // ESP32 UART2 RX <- R307S TX
#define FP_TX              17    // ESP32 UART2 TX -> R307S RX

// SPI Bus Mappings for Dual MFRC522 Modules
#define RFID_MISO          19    // Shared MISO (Master In Slave Out) for MFRC522 readers
// Set SWAP_RFID_READERS to true if physical front/back reader cables are swapped
#define SWAP_RFID_READERS  false

#if SWAP_RFID_READERS
  #define SS_PIN_IN          26    // Swapped: Front Door Select Pin
  #define SS_PIN_OUT         5     // Swapped: Back Door Select Pin
  #define RST_PIN_IN         4     // Swapped: Front Door Reset Pin
  #define RST_PIN_OUT        32    // Swapped: Back Door Reset Pin
#else
  #define SS_PIN_IN          5     // Front Door Select Pin
  #define SS_PIN_OUT         26    // Back Door Select Pin
  #define RST_PIN_IN         32    // Front Door Reset Pin
  #define RST_PIN_OUT        4     // Back Door Reset Pin
#endif

// ── DISPLAY PIN DEFINITIONS ──────────────────────────────────────
#define TFT_CS             33
#define TFT_RST            25
#define TFT_DC             2
#define TFT_MOSI           23
#define TFT_SCK            18

// Front Terminal: 2.4" ST7789 SPI TFT (320x240 Landscape Layout)
#define TFT_INVERT_COLOR   false        // Adafruit_ST7789 hardcodes INVON by default; false sends INVOFF to restore true Black BG & White text
#define RFID_PULSE_COLOR   ST77XX_WHITE // Pulse animation color (ST77XX_WHITE, ST77XX_CYAN, etc.)

// Back Terminal: 0.96" OLED (128x64 Landscape Layout) I2C
#define OLED_RESET         -1
#define SCREEN_WIDTH       128
#define SCREEN_HEIGHT      64

// ── TIMERS & FREQUENCY PROFILES ──────────────────────────────────
#define BUZZER_FREQ        2500
#define BUZZER_RES         8
#define SOLENOID_DURATION  3000
#define TIMEOUT_2FA        15000

// ── ENUMS & DATA STRUCTURES ──────────────────────────────────────
enum LedMode { LED_OFF, LED_SLOW_BLINK, LED_FAST_BLINK, LED_STEADY_GREEN, LED_STEADY_RED };

enum FeedbackType {
  SUCCESS_OK,
  ERROR_FAIL,
  WAITING_SCAN,
  RFID_TAP,
  SYSTEM_READY
};

struct NetworkConfig {
  String ssid;
  String pass;
  String serverUrl;
  String fpEnrollUrl;
};

struct BackendQueue {
  String uid;
  String action;
  String terminalType;
  uint32_t cardCounter;
  bool pending;
};

// ── NETWORK CONFIGURATIONS ───────────────────────────────────────
const NetworkConfig networks[] = {
  { String(WIFI_SSID_1), String(WIFI_PASS_1), String(SERVER_URL_1), String(FP_ENROLL_1) },
  { String(WIFI_SSID_2), String(WIFI_PASS_2), String(SERVER_URL_2), String(FP_ENROLL_2) },
  { String(WIFI_SSID_3), String(WIFI_PASS_3), String(SERVER_URL_3), String(FP_ENROLL_3) },
  { String(WIFI_SSID_4), String(WIFI_PASS_4), String(SERVER_URL_4), String(FP_ENROLL_4) },
  { String(WIFI_SSID_6), String(WIFI_PASS_6), String(SERVER_URL_6), String(FP_ENROLL_6) }
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

extern String currentServerUrl;
extern String currentFpUrl;

// ── HARDWARE CONTROLLER INSTANCES ────────────────────────────────
extern MFRC522 rfidIN;
extern MFRC522 rfidOUT;
extern HardwareSerial fpSerial;
extern Adafruit_Fingerprint finger;
extern Adafruit_ST7789 tft;
extern Adafruit_SSD1306 oled;
extern WebServer webServer;

// ── HARDWARE & LOGIC STATES ──────────────────────────────────────
extern LedMode greenMode;
extern LedMode redMode;
extern unsigned long lastGreenToggle;
extern unsigned long lastRedToggle;
extern bool greenState;
extern bool redState;

extern bool solenoidActive;
extern unsigned long solenoidStartTime;

extern bool enrollmentMode;
extern int fpEnrollStage;
extern int enrollmentSlotId;
extern String enrollmentUserId;
extern String enrollmentType;
extern unsigned long fpEnrollStart;

extern String pendingUID;
extern String pendingName;
extern int last2FACountdownSec;
extern unsigned long pendingStart;
extern int pendingExpectedFingerID;
extern int pendingExpectedFingerID2;
extern uint32_t pendingCardCounter;

extern BackendQueue queuedTransaction;
extern bool webServerStarted;
extern bool otaInitialized;
extern bool isFrontDisplayInReady;

// ── CRYPTOGRAPHIC REQUEST SIGNER (HMAC-SHA256) ───────────────────
inline uint32_t getCurrentTimestamp() {
  time_t now;
  time(&now);
  if (now > 1700000000) {
    return (uint32_t)now;
  }
  return (uint32_t)(millis() / 1000);
}

inline String computeHmacSha256(const String &data, const char *secretKey) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)secretKey, strlen(secretKey));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)data.c_str(), data.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  char hexBuffer[65];
  for (int i = 0; i < 32; i++) {
    sprintf(hexBuffer + (i * 2), "%02x", hmacResult[i]);
  }
  hexBuffer[64] = 0;
  return String(hexBuffer);
}

inline void signHttpRequest(HTTPClient &http, const String &body = "") {
  uint32_t ts = getCurrentTimestamp();
  String stringToSign = String(ts) + body;
  String sig = computeHmacSha256(stringToSign, SECRET_HMAC_KEY);

  http.addHeader("x-esp32-key", String(ESP32_API_KEY));
  http.addHeader("x-esp32-timestamp", String(ts));
  http.addHeader("x-esp32-signature", sig);
}

// ── WEB CONSOLE LOG BUFFER ───────────────────────────────────────
#ifndef WEB_CONSOLE_USER
#define WEB_CONSOLE_USER "admin"
#endif
#ifndef WEB_CONSOLE_PASS
#define WEB_CONSOLE_PASS "machip2026"
#endif

const int LOG_MAX_ENTRIES = 60;
extern String webLogBuffer[LOG_MAX_ENTRIES];
extern int logHead;
extern int logCount;

inline void sysLog(const String &msg) {
  char timeStr[16];
  time_t now;
  time(&now);
  if (now > 1700000000) {
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    snprintf(timeStr, sizeof(timeStr), "[%02d:%02d:%02d] ", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  } else {
    unsigned long ms = millis();
    unsigned long sec = ms / 1000;
    unsigned long min = (sec / 60) % 60;
    unsigned long hr = (sec / 3600) % 24;
    sec = sec % 60;
    snprintf(timeStr, sizeof(timeStr), "[%02lu:%02lu:%02lu] ", hr, min, sec);
  }
  
  String formatted = String(timeStr) + msg;
  Serial.println(formatted);
  
  webLogBuffer[logHead] = formatted;
  logHead = (logHead + 1) % LOG_MAX_ENTRIES;
  if (logCount < LOG_MAX_ENTRIES) logCount++;
}

// ── SPI BUS CONTROLLER SAFETY ENFORCEMENT ────────────────────────
inline void clearSpiBusPins() {
  digitalWrite(SS_PIN_IN, HIGH);
  digitalWrite(SS_PIN_OUT, HIGH);
  digitalWrite(TFT_CS, HIGH);
}
