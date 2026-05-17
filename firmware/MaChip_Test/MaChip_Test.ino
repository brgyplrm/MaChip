#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include "arduino_secrets.h"

// ── HARDWARE LAYER PIN DEFINITIONS ──────────────────────────────
#define SOLENOID_PIN       14    // Active-Low Relay control signal
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
#define BUZZER_FREQ        2500  // Clean 2.5kHz resonant square wave
#define BUZZER_RES         8     // Bit-depth configuration
#define SOLENOID_DURATION  3000  // 3-Second passenger clearance window

// ── MEMORY STORAGE STRUCTURE TYPES ───────────────────────────────
enum LedMode { LED_OFF, LED_SLOW_BLINK, LED_FAST_BLINK, LED_STEADY_GREEN, LED_STEADY_RED };

// Structural Positioning Fix: Enumeration declared prior to use in prototypes
enum FeedbackType {
  SUCCESS_OK,    // Access Granted: Double beep, steady Green light
  ERROR_FAIL,    // Access Denied: Long tone, steady Red light
  WAITING_SCAN,  // System Armed: Rapid Green blinking, biometric collection window open
  RFID_TAP,      // Intercept Signal: Single swift confirmation chirp
  SYSTEM_READY   // Microcontroller Up: Triple greeting beeps
};

struct NetworkConfig {
  String ssid;
  String pass;
  String serverUrl;
  String fpEnrollUrl;
};

// Array assignments parsed directly from localized secret headers
const NetworkConfig networks[] = {
  { String(WIFI_SSID_1), String(WIFI_PASS_1), String(SERVER_URL_1), String(FP_ENROLL_1) },
  { String(WIFI_SSID_2), String(WIFI_PASS_2), String(SERVER_URL_2), String(FP_ENROLL_2) }
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

// Global environmental strings
String currentServerUrl = "";
String currentFpUrl = "";

// ── HARDWARE CONTROLLER SUBSYSTEMS ───────────────────────────────
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// Operational Volatiles
LedMode greenMode = LED_SLOW_BLINK;
LedMode redMode = LED_OFF;
unsigned long lastGreenToggle = 0;
unsigned long lastRedToggle = 0;
bool greenState = false;
bool redState = false;

String pendingUID = "";
unsigned long pendingStart = 0;
const unsigned long TIMEOUT_2FA = 15000;

// ── AUDIO & SIGNAL GENERATOR FUNCTIONS ───────────────────────────
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

// ── CONNECTION SECURITY LAYER ────────────────────────────────────
bool autoConnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println(F("\n[WIFI] Initializing Clean Connection Sequence..."));
  for (int i = 0; i < NETWORK_COUNT; i++) {
    if (networks[i].ssid == "") continue;

    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    delay(300);
    WiFi.mode(WIFI_STA);
    delay(300);

    Serial.print(F("[WIFI] Target SSID Found: ")); Serial.println(networks[i].ssid);
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
      Serial.println(F("\n[WIFI] Link Connected successfully."));
      Serial.print(F("[WIFI] IP Address: ")); Serial.println(WiFi.localIP());
      return true;
    }
  }
  Serial.println(F("\n[WIFI] Critical: Networks out of reach. Standing by in local state."));
  return false;
}

// ── REGISTRATION OVERRIDE ENGINES ─────────────────────────────────
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

// ── MAIN INITIALIZATION METHOD ───────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("[SYSTEM] Booting MAChip Node Terminal Hardware..."));
  
  pinMode(GREEN_LED, OUTPUT); 
  pinMode(RED_LED, OUTPUT);
  pinMode(SOLENOID_PIN, OUTPUT);
  
  // FIX: Relay configuration set HIGH immediately to maintain COM-NO disconnection on boot
  digitalWrite(SOLENOID_PIN, HIGH);
  Serial.println(F("[SOLENOID] Setup state initialized: HIGH (Circuit Broken / Door Securely Locked)"));
  
  // Audio binding channel mapping
  ledcAttach(BUZZER, BUZZER_FREQ, BUZZER_RES);
  provideFeedback(SYSTEM_READY);

  // Biometric UART Channel Mapping
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  if (finger.verifyPassword()) {
    Serial.println(F("[FP] R307S Biometric Communication: STABLE"));
  } else {
    Serial.println(F("[FP] Critical Error: Internal biometric mapping path unreachable."));
  }

  // SPI Bus Allocation
  SPI.begin();
  rfidIN.PCD_Init();
  rfidOUT.PCD_Init();
  rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
  
  WiFi.mode(WIFI_STA);
  autoConnectWiFi();
  
  setLED(LED_SLOW_BLINK, LED_OFF);
  Serial.println(F("[SYSTEM] Pipeline ready for transaction tracking arrays.\n"));
}

// ── CORE RUNTIME LOGIC ───────────────────────────────────────────
void loop() {
  updateLEDs();

  // Dynamic Loss Prevention Loop
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiCheck = 0;
    if (millis() - lastWiFiCheck > 20000) {
      autoConnectWiFi();
      lastWiFiCheck = millis();
    }
  }

  // A. INTERCEPT ACTIVE REGISTRATION SESSIONS FROM ADMIN UI MODALS
  static unsigned long lastModalPoll = 0;
  if (WiFi.status() == WL_CONNECTED && millis() - lastModalPoll > 2000) {
    lastModalPoll = millis();
    HTTPClient http;
    http.begin(currentFpUrl + "/session");
    http.addHeader("x-esp32-key", String(ESP32_API_KEY)); // Added from old logic
    int code = http.GET();
    
    if (code == 200) {
      JsonDocument doc;
      deserializeJson(doc, http.getString());
      
      if (doc["active"] | false) {
        String userId = doc["userId"].as<String>();
        int slotId = doc["slotId"] | 1;
        String modeType = doc["type"] | "FP"; 
        
        Serial.println("\n[MODAL] Active Registration Overrides Armed for User: " + userId);
        provideFeedback(WAITING_SCAN);

        if (modeType == "RFID") {
          Serial.println(F("[MODAL] Armed: Capture card trace from Front Door..."));
          unsigned long startScan = millis();
          bool ok = false;
          String cardUid = "";
          
          while (millis() - startScan < 20000) {
            updateLEDs();
            if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
              for (byte i = 0; i < rfidIN.uid.size; i++) {
                cardUid += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
              }
              cardUid.toUpperCase();
              rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
              ok = true; break;
            }
            delay(50);
          }
          
          if (ok) {
            Serial.println("[MODAL] RFID Registered Trace Capture: " + cardUid);
            HTTPClient postHttp;
            postHttp.begin(currentFpUrl + "/enroll-confirm");
            postHttp.addHeader("Content-Type", "application/json");
            postHttp.addHeader("x-esp32-key", String(ESP32_API_KEY)); // Added from old logic
            JsonDocument confirmDoc;
            confirmDoc["userId"] = userId;
            confirmDoc["rfidUid"] = cardUid;
            confirmDoc["success"] = true;
            confirmDoc["type"] = "RFID";
            String body; serializeJson(confirmDoc, body);
            postHttp.POST(body); postHttp.end();
            provideFeedback(SUCCESS_OK);
          } else {
            Serial.println(F("[MODAL] RFID Modal Capture Timeout. Override aborted."));
            provideFeedback(ERROR_FAIL);
          }
          setLED(LED_SLOW_BLINK, LED_OFF);
        } 
        else if (modeType == "FP") {
          Serial.println(F("[MODAL] Armed: Capture dual biometric verification passes..."));
          bool ok = false;
          String templateHex = "";
          
          unsigned long startScan = millis();
          while (millis() - startScan < 15000) {
            updateLEDs();
            if (finger.getImage() == FINGERPRINT_OK && finger.image2Tz(1) == FINGERPRINT_OK) {
              Serial.println(F("[FP] Pass 1 footprint captured. Lift finger..."));
              beep(100); delay(1000); break;
            }
            delay(100);
          }
          
          if (millis() - startScan < 15000) {
            startScan = millis();
            while (millis() - startScan < 15000) {
              updateLEDs();
              if (finger.getImage() == FINGERPRINT_OK && finger.image2Tz(2) == FINGERPRINT_OK) {
                Serial.println(F("[FP] Pass 2 footprint captured. Synchronizing model..."));
                ok = true; break;
              }
              delay(100);
            }
          }

          if (ok) {
            if (finger.createModel() == FINGERPRINT_OK) {
              templateHex = downloadTemplate();
              if (templateHex == "") ok = false;
            } else {
              Serial.println(F("[FP] Model creation signature tracking matrix failed (mismatch)."));
              ok = false;
            }
          }

          uploadEnrollment(slotId, ok, userId, templateHex);
          if (ok) {
            Serial.println(F("[FP] Custom matrix profile linked successfully."));
            provideFeedback(SUCCESS_OK);
          } else {
            Serial.println(F("[FP] Structural enrollment profile dropped."));
            provideFeedback(ERROR_FAIL);
          }
          setLED(LED_SLOW_BLINK, LED_OFF);
        }
      }
    }
    http.end();
  }

  // B. UNIFIED FRONT DOOR CLOCK-IN PIPELINE
  if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
    provideFeedback(RFID_TAP);
    pendingUID = "";
    for (byte i = 0; i < rfidIN.uid.size; i++) {
      pendingUID += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
    }
    pendingUID.toUpperCase();
    
    Serial.println("\n[IN] Token identified: " + pendingUID);
    provideFeedback(WAITING_SCAN);
    pendingStart = millis();
    
    rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
  }

  // 2FA Evaluation Routine
  if (pendingUID != "" && millis() - pendingStart < TIMEOUT_2FA) {
    if (finger.getImage() == FINGERPRINT_OK && finger.image2Tz(1) == FINGERPRINT_OK) {
      if (finger.fingerFastSearch() == FINGERPRINT_OK) {
        Serial.println("[IN] Multi-factor authentication successful. Identity structural match validated.");
        provideFeedback(SUCCESS_OK);
        
        // FIX: Active-Low relay execution loop. Setting LOW completes the COM-NO path to lock
        digitalWrite(SOLENOID_PIN, LOW);
        Serial.println(F("[SOLENOID] Relay Energized: LOW (Circuit Closed / 12V Open-Lock Engaged)"));
        
        delay(SOLENOID_DURATION);
        
        // Return to normal structural safe baseline state
        digitalWrite(SOLENOID_PIN, HIGH);
        Serial.println(F("[SOLENOID] Relay Released: HIGH (Circuit Broken / Door Securely Locked)"));
        
        if (WiFi.status() == WL_CONNECTED) {
          HTTPClient http;
          http.begin(currentServerUrl);
          http.addHeader("Content-Type", "application/json");
          http.addHeader("x-esp32-key", String(ESP32_API_KEY)); // Added from old logic
          JsonDocument txn;
          txn["uid"] = pendingUID;
          txn["action"] = "clock_in";
          txn["terminalType"] = "FRONT"; // Added from old logic
          String txnBody; serializeJson(txn, txnBody);
          int httpCode = http.POST(txnBody); 
          Serial.print(F("[HTTP IN] Result: ")); Serial.println(httpCode);
          http.end();
        }
        
        pendingUID = "";
        setLED(LED_SLOW_BLINK, LED_OFF);
      } else {
        Serial.println(F("[IN] Access Aborted: Biometric matrix signature verification structural reject."));
        provideFeedback(ERROR_FAIL);
        pendingUID = "";
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }
  } else if (pendingUID != "") {
    Serial.println(F("[IN] Verification threshold limit expired. Resetting hardware registers to idle baseline."));
    provideFeedback(ERROR_FAIL);
    pendingUID = "";
    setLED(LED_SLOW_BLINK, LED_OFF);
  }

  // C. UNIFIED BACK DOOR CLOCK-OUT PIPELINE (Token Only, Token Bypass 2FA Mode)
  if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
    String outUID = "";
    for (byte i = 0; i < rfidOUT.uid.size; i++) {
      outUID += (rfidOUT.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidOUT.uid.uidByte[i], HEX);
    }
    outUID.toUpperCase();
    Serial.println("\n[OUT] Token identified: " + outUID);
    provideFeedback(SUCCESS_OK);
    
    // Pulse lock open path circuit loop
    digitalWrite(SOLENOID_PIN, LOW);
    Serial.println(F("[SOLENOID] Relay Energized: LOW (Circuit Closed / 12V Open-Lock Engaged)"));
    
    delay(SOLENOID_DURATION);
    
    digitalWrite(SOLENOID_PIN, HIGH);
    Serial.println(F("[SOLENOID] Relay Released: HIGH (Circuit Broken / Door Securely Locked)"));

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(currentServerUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-esp32-key", String(ESP32_API_KEY)); // Added from old logic
      JsonDocument txn;
      txn["uid"] = outUID;
      txn["action"] = "clock_out";
      txn["terminalType"] = "BACK"; // Added from old logic
      String txnBody; serializeJson(txn, txnBody);
      int httpCode = http.POST(txnBody);
      Serial.print(F("[HTTP OUT] Result: ")); Serial.println(httpCode);
      http.end();
    }
    setLED(LED_SLOW_BLINK, LED_OFF);
  }
}