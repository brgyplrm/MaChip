#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include "arduino_secrets.h"

// ── HARDWARE LAYER PIN DEFINITIONS ──────────────────────────────
#define SOLENOID_PIN       14    // Relay control - LOW = UNLOCK, HIGH = LOCK
#define BUZZER             27    // PWM Audio Feedback Pin
#define FP_RX              16    // ESP32 UART2 RX <- R307S TX
#define FP_TX              17    // ESP32 UART2 TX -> R307S RX
#define GREEN_LED          12    // Physical UI Green Indicator
#define RED_LED            13    // Physical UI Red Indicator

// SPI Bus Mappings for Dual MFRC522 Modules
#define SS_PIN_IN          5     // Front Door Select Pin
#define SS_PIN_OUT         26    // Back Door Select Pin
#define RST_PIN_IN         32    // Front Door Reset Pin
#define RST_PIN_OUT        25    // Back Door Reset Pin

// ── TIMERS & FREQUENCY PROFILES ──────────────────────────────────
#define BUZZER_FREQ        2500
#define BUZZER_RES         8
#define SOLENOID_DURATION  3000
#define TIMEOUT_2FA        15000

// ── RELAY LOGIC ──────────────────────────────────────────────────
// GPIO 14 = LOW  → UNLOCK
// GPIO 14 = HIGH → LOCK

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

const NetworkConfig networks[] = {
  { String(WIFI_SSID_1), String(WIFI_PASS_1), String(SERVER_URL_1), String(FP_ENROLL_1) },
  { String(WIFI_SSID_2), String(WIFI_PASS_2), String(SERVER_URL_2), String(FP_ENROLL_2) }
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

String currentServerUrl = "";
String currentFpUrl = "";

// ── HARDWARE CONTROLLERS ───────────────────────────────────────
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// LED State
LedMode greenMode = LED_SLOW_BLINK;
LedMode redMode = LED_OFF;
unsigned long lastGreenToggle = 0;
unsigned long lastRedToggle = 0;
bool greenState = false;
bool redState = false;

// Solenoid State
bool solenoidActive = false;
unsigned long solenoidStartTime = 0;

// ── ENROLLMENT MODE (BLOCKS ACCESS) ──────────────────────────────
bool enrollmentMode = false;
String enrollmentUserId = "";
int enrollmentSlotId = 0;
String enrollmentType = "";

// ── ACCESS MODE: 2FA Pipeline ────────────────────────────────────
String pendingUID = "";
unsigned long pendingStart = 0;

// Backend Queue
struct BackendQueue {
  String uid;
  String action;
  String terminalType;
  bool pending;
};

BackendQueue queuedTransaction = {"", "", "", false};

// ── AUDIO FUNCTIONS ──────────────────────────────────────────────
void beep(int duration) {
  ledcWriteTone(BUZZER, BUZZER_FREQ);
  delay(duration);
  ledcWriteTone(BUZZER, 0); 
}

void provideFeedback(FeedbackType type) {
  switch (type) {
    case SUCCESS_OK:
      greenMode = LED_STEADY_GREEN;
      redMode = LED_OFF;
      digitalWrite(GREEN_LED, HIGH);
      digitalWrite(RED_LED, LOW);
      beep(80); delay(80);
      beep(80);
      break;

    case ERROR_FAIL:
      greenMode = LED_OFF;
      redMode = LED_STEADY_RED;
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(RED_LED, HIGH);
      beep(800); 
      break;

    case RFID_TAP:
      beep(100); 
      break;

    case WAITING_SCAN:
      greenMode = LED_FAST_BLINK;
      redMode = LED_OFF;
      break;

    case SYSTEM_READY:
      for (int i = 0; i < 3; i++) {
        beep(50); delay(50);
      }
      break;
  }
}

void setLED(LedMode gMode, LedMode rMode) {
  greenMode = gMode;
  redMode = rMode;
  if (gMode == LED_OFF) { digitalWrite(GREEN_LED, LOW); greenState = false; }
  if (gMode == LED_STEADY_GREEN) { digitalWrite(GREEN_LED, HIGH); greenState = true; }
  if (rMode == LED_OFF) { digitalWrite(RED_LED, LOW); redState = false; }
  if (rMode == LED_STEADY_RED) { digitalWrite(RED_LED, HIGH); redState = true; }
}

void updateLEDs() {
  unsigned long now = millis();
  
  if (greenMode == LED_SLOW_BLINK && now - lastGreenToggle >= 1000) {
    greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  } else if (greenMode == LED_FAST_BLINK && now - lastGreenToggle >= 100) {
    greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  }
  
  if (redMode == LED_SLOW_BLINK && now - lastRedToggle >= 1000) {
    redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  } else if (redMode == LED_FAST_BLINK && now - lastRedToggle >= 100) {
    redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  }
}

// ── SOLENOID CONTROL ──────────────────────────────────────────────
void solenoidUnlock() {
  if (!solenoidActive) {
    digitalWrite(SOLENOID_PIN, LOW);
    solenoidActive = true;
    solenoidStartTime = millis();
    Serial.println(F("[SOLENOID] UNLOCKED"));
  }
}

void solenoidLock() {
  if (solenoidActive) {
    digitalWrite(SOLENOID_PIN, HIGH);
    solenoidActive = false;
    Serial.println(F("[SOLENOID] LOCKED"));
  }
}

void updateSolenoid() {
  if (solenoidActive && (millis() - solenoidStartTime >= SOLENOID_DURATION)) {
    solenoidLock();
  }
}

// ── WIFI ──────────────────────────────────────────────────────────
bool autoConnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println(F("\n[WIFI] Connecting..."));
  for (int i = 0; i < NETWORK_COUNT; i++) {
    if (networks[i].ssid == "") continue;

    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    delay(300);
    WiFi.mode(WIFI_STA);
    delay(300);

    Serial.print(F("[WIFI] SSID: ")); Serial.println(networks[i].ssid);
    WiFi.begin(networks[i].ssid.c_str(), networks[i].pass.c_str());

    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 30) {
      updateLEDs();
      delay(500);
      Serial.print(F("."));
      tries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      currentServerUrl = networks[i].serverUrl;
      currentFpUrl = networks[i].fpEnrollUrl;
      Serial.println(F("\n[WIFI] Connected!"));
      Serial.print(F("[WIFI] IP: ")); Serial.println(WiFi.localIP());
      return true;
    }
  }
  Serial.println(F("\n[WIFI] Failed"));
  return false;
}

// ── ASYNC BACKEND ──────────────────────────────────────────────────
void queueTransaction(String uid, String action, String terminalType) {
  queuedTransaction.uid = uid;
  queuedTransaction.action = action;
  queuedTransaction.terminalType = terminalType;
  queuedTransaction.pending = true;
}

void processQueuedTransaction() {
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

  Serial.print("[HTTP] "); Serial.println(queuedTransaction.action);

  int httpCode = http.POST(payload);
  Serial.print("[HTTP] Code: "); Serial.println(httpCode);

  if (httpCode == 200) {
    queuedTransaction.pending = false;
    Serial.println("[OK] Posted");
  }

  http.end();
}

// ── FINGERPRINT TEMPLATE ──────────────────────────────────────────
String downloadTemplate() {
  while(fpSerial.available()) fpSerial.read();
  uint8_t bufId = 0x01;
  
  uint16_t packetLen = 1 + 3;
  uint8_t packet[13];
  packet[0] = 0xEF; packet[1] = 0x01;
  packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF;
  packet[6] = 0x01;
  packet[7] = (packetLen >> 8) & 0xFF; packet[8] = packetLen & 0xFF;
  packet[9] = 0x08;
  packet[10] = bufId;
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

void uploadEnrollment(int slotId, bool success, String userId, String templateHex) {
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

// ── SETUP ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n\n[SYSTEM] MAChip v2.3 Starting"));
  
  pinMode(GREEN_LED, OUTPUT); 
  pinMode(RED_LED, OUTPUT);
  pinMode(SOLENOID_PIN, OUTPUT);
  
  digitalWrite(SOLENOID_PIN, HIGH);
  solenoidActive = false;
  Serial.println(F("[SOLENOID] LOCKED"));
  
  ledcAttach(BUZZER, BUZZER_FREQ, BUZZER_RES);
  provideFeedback(SYSTEM_READY);

  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  if (finger.verifyPassword()) {
    Serial.println(F("[FP] Online"));
  } else {
    Serial.println(F("[FP] Error"));
  }

  SPI.begin();
  rfidIN.PCD_Init();
  rfidOUT.PCD_Init();
  rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
  Serial.println(F("[RFID] Ready"));
  
  WiFi.mode(WIFI_STA);
  autoConnectWiFi();
  
  setLED(LED_SLOW_BLINK, LED_OFF);
  Serial.println(F("[SYSTEM] Ready\n"));
}

// ── LOOP ──────────────────────────────────────────────────────────
void loop() {
  updateLEDs();
  updateSolenoid();

  // WiFi
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiCheck = 0;
    if (millis() - lastWiFiCheck > 20000) {
      autoConnectWiFi();
      lastWiFiCheck = millis();
    }
  }

  // Post queued transactions
  processQueuedTransaction();

  // ════════════════════════════════════════════════════════════════
  // ENROLLMENT MODE - Only process enrollment, block access
  // ════════════════════════════════════════════════════════════════
  static unsigned long lastModalPoll = 0;
  if (!enrollmentMode && WiFi.status() == WL_CONNECTED && millis() - lastModalPoll > 1000) {
    lastModalPoll = millis();
    HTTPClient http;
    http.begin(currentFpUrl + "/session");
    http.addHeader("x-esp32-key", String(ESP32_API_KEY));
    int code = http.GET();
    
    if (code == 200) {
      JsonDocument doc;
      deserializeJson(doc, http.getString());
      
      if (doc["active"] | false) {
        // ENTER ENROLLMENT MODE
        enrollmentMode = true;
        enrollmentUserId = doc["userId"].as<String>();
        enrollmentSlotId = doc["slotId"] | 1;
        enrollmentType = doc["type"] | "FP";
        
        Serial.println("\n[ENROLL] >>> SESSION ACTIVE <<<");
        Serial.print("[ENROLL] User: "); Serial.println(enrollmentUserId);
        Serial.print("[ENROLL] Type: "); Serial.println(enrollmentType);
        Serial.print("[ENROLL] Slot: "); Serial.println(enrollmentSlotId);
        
        provideFeedback(WAITING_SCAN);
        
        if (enrollmentType == "FP") {
          Serial.println("[ENROLL] Initializing Fingerprint Sensor...");
          if (finger.verifyPassword()) {
            Serial.println("[ENROLL] Sensor OK. Starting capture.");
          } else {
            Serial.println("[ENROLL] SENSOR ERROR - Check wiring!");
            uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
            enrollmentMode = false;
          }
        }
      }
    }
    http.end();
  }

  // ── ENROLLMENT: RFID CAPTURE ──────────────────────────────────────
  if (enrollmentMode && enrollmentType == "RFID") {
    if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
      String cardUid = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        cardUid += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      cardUid.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      
      Serial.println("[ENROLL] RFID Captured: " + cardUid);
      uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, cardUid);
      provideFeedback(SUCCESS_OK);
      
      enrollmentMode = false;
      delay(500);
      HTTPClient clearHttp;
      clearHttp.begin(currentFpUrl + "/session/clear");
      clearHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
      clearHttp.GET();
      clearHttp.end();
      setLED(LED_SLOW_BLINK, LED_OFF);
    }
  }

  // ── ENROLLMENT: FINGERPRINT CAPTURE ───────────────────────────────
  else if (enrollmentMode && enrollmentType == "FP") {
    static unsigned long fpEnrollStart = 0;
    static int fpEnrollStage = 0;
    
    if (fpEnrollStage == 0) {
      Serial.println("[ENROLL] Stage 1: Waiting for finger...");
      fpEnrollStart = millis();
      fpEnrollStage = 1;
    }
    
    if (fpEnrollStage == 1) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        Serial.println("[ENROLL] Image taken. Converting...");
        p = finger.image2Tz(1);
        if (p == FINGERPRINT_OK) {
          Serial.println("[ENROLL] Pass 1 OK - Remove finger");
          beep(100);
          fpEnrollStart = millis();
          fpEnrollStage = 2;
        } else {
          Serial.print("[ENROLL] Conversion error: "); Serial.println(p);
        }
      } else if (p != FINGERPRINT_NOFINGER) {
        // Serial.print("[ENROLL] Error: "); Serial.println(p);
      }
      
      if (millis() - fpEnrollStart > 30000) { // Increased to 30s
        Serial.println("[ENROLL] Pass 1 timeout");
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false;
        fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }
    
    else if (fpEnrollStage == 2) {
      if (millis() - fpEnrollStart > 2000) {
        Serial.println("[ENROLL] Stage 2: Place same finger again...");
        fpEnrollStart = millis();
        fpEnrollStage = 3;
      }
    }
    
    else if (fpEnrollStage == 3) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        Serial.println("[ENROLL] Image 2 taken. Converting...");
        p = finger.image2Tz(2);
        if (p == FINGERPRINT_OK) {
          Serial.println("[ENROLL] Pass 2 OK. Creating model...");
          if (finger.createModel() == FINGERPRINT_OK) {
            Serial.print("[ENROLL] Storing model in slot "); Serial.println(enrollmentSlotId);
            if (finger.storeModel(enrollmentSlotId) == FINGERPRINT_OK) {
              String templateHex = downloadTemplate();
              Serial.println("[ENROLL] Success! Uploading template...");
              uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, templateHex);
              provideFeedback(SUCCESS_OK);
            } else {
              Serial.println("[ENROLL] Failed to store model in flash");
              uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
              provideFeedback(ERROR_FAIL);
            }
          } else {
            Serial.println("[ENROLL] Model mismatch/error");
            uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
            provideFeedback(ERROR_FAIL);
          }
          enrollmentMode = false;
          fpEnrollStage = 0;
          setLED(LED_SLOW_BLINK, LED_OFF);
        }
      }
      
      if (millis() - fpEnrollStart > 30000) {
        Serial.println("[ENROLL] Pass 2 timeout");
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false;
        fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ACCESS MODE - Only process when NOT in enrollment
  // ════════════════════════════════════════════════════════════════

  if (!enrollmentMode) {
    // ── FRONT DOOR: RFID + 2FA ──────────────────────────────────────
    if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
      provideFeedback(RFID_TAP);
      String currentUID = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        currentUID += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      currentUID.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      
      Serial.println("\n[ACCESS] Front RFID: " + currentUID);

      // Check enrollment before proceeding to 2FA
      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(currentServerUrl);
        http.setTimeout(5000);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-esp32-key", String(ESP32_API_KEY));
        
        JsonDocument doc;
        doc["uid"] = currentUID;
        doc["action"] = "clock_in";
        doc["terminalType"] = "FRONT";
        
        String payload;
        serializeJson(doc, payload);
        int httpCode = http.POST(payload);
        
        if (httpCode == 200) {
          JsonDocument resDoc;
          deserializeJson(resDoc, http.getString());
          if (resDoc["success"] | false) {
            if (resDoc["mode"] == "WAITING_FOR_FINGERPRINT_2FA") {
              Serial.println("[2FA] Card verified. Waiting for fingerprint...");
              provideFeedback(WAITING_SCAN);
              pendingUID = currentUID;
              pendingStart = millis();
            } else {
              Serial.println("[OK] Access Granted (No 2FA required)");
              provideFeedback(SUCCESS_OK);
              solenoidUnlock();
            }
          } else {
            String errMsg = resDoc["error"] | resDoc["message"] | "Denied";
            Serial.print("[DENIED] "); Serial.println(errMsg);
            provideFeedback(ERROR_FAIL);
          }
        } else {
          Serial.print("[HTTP] Error: "); Serial.println(httpCode);
          provideFeedback(ERROR_FAIL);
        }
        http.end();
      } else {
        Serial.println("[WIFI] Offline - Cannot verify card");
        provideFeedback(ERROR_FAIL);
      }
    }

    // ── 2FA EVALUATION ──────────────────────────────────────────────
    if (pendingUID != "") {
      if (millis() - pendingStart < TIMEOUT_2FA) {
        int p = finger.getImage();
        if (p == FINGERPRINT_OK) {
          if (finger.image2Tz(1) == FINGERPRINT_OK) {
            if (finger.fingerFastSearch() == FINGERPRINT_OK) {
              Serial.println("[2FA] ✓ Match (ID: " + String(finger.fingerID) + ")");
              Serial.println("[ACCESS] Granting access");
              provideFeedback(SUCCESS_OK);
              
              solenoidUnlock();
              // Send UID|FingerID to confirm 2FA
              queueTransaction(pendingUID + "|" + String(finger.fingerID), "clock_in", "FRONT");
              
              pendingUID = "";
              setLED(LED_SLOW_BLINK, LED_OFF);
            } else {
              Serial.println("[2FA] ✗ No match");
              provideFeedback(ERROR_FAIL);
              
              queueTransaction(pendingUID, "suspicious_biometric_fail", "FRONT");
              
              pendingUID = "";
              setLED(LED_SLOW_BLINK, LED_OFF);
            }
          } else {
            Serial.println("[2FA] Image conversion failed - keep finger still");
          }
        }
      } else {
        Serial.println("[2FA] Timeout");
        provideFeedback(ERROR_FAIL);
        
        queueTransaction(pendingUID, "unenrolled_card_attempt", "FRONT");
        
        pendingUID = "";
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }

    // ── BACK DOOR: RFID ONLY (Clock Out) ────────────────────────────
    if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
      String outUID = "";
      for (byte i = 0; i < rfidOUT.uid.size; i++) {
        outUID += (rfidOUT.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidOUT.uid.uidByte[i], HEX);
      }
      outUID.toUpperCase();
      Serial.println("\n[ACCESS] Back RFID: " + outUID);
      Serial.println("[ACCESS] Clock-out granted");
      provideFeedback(SUCCESS_OK);
      
      solenoidUnlock();
      queueTransaction(outUID, "clock_out", "BACK");
      
      rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
      setLED(LED_SLOW_BLINK, LED_OFF);
    }
  }

  delay(50);
  yield();
}
