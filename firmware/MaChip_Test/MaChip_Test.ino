#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h> // For 2.4" TFT Front Display
#include <Adafruit_SSD1306.h> // For 0.96" OLED Back Display
#include "arduino_secrets.h"

// ── HARDWARE LAYER PIN DEFINITIONS ──────────────────────────────
#define GREEN_LED          12    // Physical UI Green Indicator
#define RED_LED            13    // Physical UI Red Indicator
#define SOLENOID_PIN       14    // Relay Control - LOW = UNLOCK, HIGH = LOCK
#define BUZZER             27    // PWM Audio Feedback Pin
#define FP_RX              16    // ESP32 UART2 RX <- R307S TX
#define FP_TX              17    // ESP32 UART2 TX -> R307S RX

// SPI Bus Mappings for Dual MFRC522 Modules
#define SS_PIN_IN          5     // Front Door Select Pin
#define SS_PIN_OUT         26    // Back Door Select Pin
#define RST_PIN_IN         32    // Front Door Reset Pin
#define RST_PIN_OUT        4     // Back Door Reset Pin

// ── DISPLAY PIN DEFINITIONS ──────────────────────────────────────
#define TFT_CS             33
#define TFT_RST            25
#define TFT_DC             2
#define TFT_MOSI           23
#define TFT_SCK            18

// Back Terminal: 0.96" OLED (128x64 Landscape Layout) I2C
#define OLED_RESET         -1
#define SCREEN_WIDTH       128
#define SCREEN_HEIGHT      64

// ── TIMERS & FREQUENCY PROFILES ──────────────────────────────────
#define BUZZER_FREQ        2500
#define BUZZER_RES         8
#define SOLENOID_DURATION  3000
#define TIMEOUT_2FA        15000

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
  { String(WIFI_SSID_2), String(WIFI_PASS_2), String(SERVER_URL_2), String(FP_ENROLL_2) },
  { String(WIFI_SSID_3), String(WIFI_PASS_3), String(SERVER_URL_3), String(FP_ENROLL_3) }
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

String currentServerUrl = "";
String currentFpUrl = "";

// ── HARDWARE CONTROLLERS ───────────────────────────────────────
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Hardware States
LedMode greenMode = LED_SLOW_BLINK;
LedMode redMode = LED_OFF;
unsigned long lastGreenToggle = 0;
unsigned long lastRedToggle = 0;
bool greenState = false;
bool redState = false;

bool solenoidActive = false;
unsigned long solenoidStartTime = 0;

bool enrollmentMode = false;
String enrollmentUserId = "";
int enrollmentSlotId = 0;
String enrollmentType = "";

String pendingUID = "";
unsigned long pendingStart = 0;
int pendingExpectedFingerID = -1;

struct BackendQueue {
  String uid;
  String action;
  String terminalType;
  bool pending;
};
BackendQueue queuedTransaction = {"", "", "", false};

// ── SPI BUS CONTROLLER SAFETY ENFORCEMENT ────────────────────────
void clearSpiBusPins() {
  // Drive CS lines HIGH to prevent alternate devices from listening during I/O state transitions
  digitalWrite(SS_PIN_IN, HIGH);
  digitalWrite(SS_PIN_OUT, HIGH);
  digitalWrite(TFT_CS, HIGH);
}

// ── LANDSCAPE OPTIMIZED NON-BLOCKING UI LAYOUT DRAWERS ───────────
void updateFrontDisplay(String header, String message, uint16_t color) {
  clearSpiBusPins();
  digitalWrite(TFT_CS, LOW); // Claim bus cleanly for TFT output
  
  tft.fillScreen(ST77XX_BLACK);
  tft.setCursor(15, 15);
  tft.setTextColor(ST77XX_ORANGE);
  tft.setTextSize(2);
  tft.println("MACHIP CLOCK-IN STATION");
  
  tft.drawFastHLine(15, 38, 290, ST77XX_WHITE);
  
  tft.setCursor(15, 55);
  tft.setTextColor(color);
  tft.setTextSize(3); 
  tft.println(header);
  
  tft.setCursor(15, 115);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.println(message);
  
  digitalWrite(TFT_CS, HIGH); // Release bus back to general pool
}

void updateBackDisplay(String line1, String line2) {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.println("MACHIP CLOCK-OUT");
  oled.drawFastHLine(0, 11, 128, SSD1306_WHITE);
  
  oled.setCursor(0, 20);
  oled.setTextSize(2); 
  oled.println(line1);
  
  oled.setCursor(0, 50);
  oled.setTextSize(1);
  oled.println(line2);
  
  oled.display();
}

// ── FEEDBACK ENGINE ──────────────────────────────────────────────
void beep(int duration) {
  ledcWriteTone(BUZZER, BUZZER_FREQ);
  delay(duration);
  ledcWriteTone(BUZZER, 0); 
}

void setLED(LedMode gMode, LedMode rMode) {
  clearSpiBusPins(); // Isolate SPI line from direct state changes
  greenMode = gMode;
  redMode = rMode;
  if (gMode == LED_OFF) { digitalWrite(GREEN_LED, LOW); greenState = false; }
  if (gMode == LED_STEADY_GREEN) { digitalWrite(GREEN_LED, HIGH); greenState = true; }
  if (rMode == LED_OFF) { digitalWrite(RED_LED, LOW); redState = false; }
  if (rMode == LED_STEADY_RED) { digitalWrite(RED_LED, HIGH); redState = true; }
}

void provideFeedback(FeedbackType type) {
  switch (type) {
    case SUCCESS_OK:
      setLED(LED_STEADY_GREEN, LED_OFF);
      beep(80); delay(80);
      beep(80);
      break;

    case ERROR_FAIL:
      setLED(LED_OFF, LED_STEADY_RED);
      beep(800); 
      break;

    case RFID_TAP:
      beep(100); 
      break;

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY:
      for (int i = 0; i < 3; i++) {
        beep(50); delay(50);
      }
      break;
  }
}

void updateLEDs() {
  unsigned long now = millis();
  // Safe toggles wrapped to ensure transient states don't trip display drivers
  if (greenMode == LED_SLOW_BLINK && now - lastGreenToggle >= 1000) {
    clearSpiBusPins(); greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  } else if (greenMode == LED_FAST_BLINK && now - lastGreenToggle >= 100) {
    clearSpiBusPins(); greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  }
  if (redMode == LED_SLOW_BLINK && now - lastRedToggle >= 1000) {
    clearSpiBusPins(); redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  } else if (redMode == LED_FAST_BLINK && now - lastRedToggle >= 100) {
    clearSpiBusPins(); redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  }
}

// ── SOLENOID CONTROL ──────────────────────────────────────────────
void solenoidUnlock() {
  if (!solenoidActive) {
    clearSpiBusPins();
    digitalWrite(SOLENOID_PIN, LOW); // Pull Low to activate Relay shield
    solenoidActive = true;
    solenoidStartTime = millis();
    Serial.println(F("[SOLENOID] UNLOCKED"));
  }
}

void solenoidLock() {
  if (solenoidActive) {
    clearSpiBusPins();
    digitalWrite(SOLENOID_PIN, HIGH); // Pull High to return lock to rest
    solenoidActive = false;
    Serial.println(F("[SOLENOID] LOCKED"));
  }
}

void updateSolenoid() {
  if (solenoidActive && (millis() - solenoidStartTime >= SOLENOID_DURATION)) {
    solenoidLock();
    updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
    updateBackDisplay("READY", "Scan Card Out");
  }
}

// ── WIFI ──────────────────────────────────────────────────────────
bool autoConnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println(F("\n[WIFI] Connecting..."));
  updateFrontDisplay("NET CONFIG", "Linking to LAN AP...", ST77XX_YELLOW);
  updateBackDisplay("WIFI LINK", "Connecting...");

  for (int i = 0; i < NETWORK_COUNT; i++) {
    if (networks[i].ssid == "") continue;
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF); delay(300);
    WiFi.mode(WIFI_STA); delay(300);

    WiFi.begin(networks[i].ssid.c_str(), networks[i].pass.c_str());
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 30) {
      updateLEDs(); delay(500); Serial.print(F(".")); tries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      currentServerUrl = networks[i].serverUrl;
      currentFpUrl = networks[i].fpEnrollUrl;
      Serial.println(F("\n[WIFI] Connected!"));
      updateFrontDisplay("ONLINE", "System Pipeline Ready", ST77XX_GREEN);
      updateBackDisplay("ONLINE", "Ready to Scan");
      return true;
    }
  }
  updateFrontDisplay("OFFLINE", "LAN Local Database Mode", ST77XX_RED);
  updateBackDisplay("OFFLINE", "Local Base Mode");
  return false;
}

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
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    queuedTransaction.pending = false;
    Serial.println("[OK] Sync Finished");
  }
  http.end();
}

// ── BIOMETRIC EXTRACTOR ENGINE ────────────────────────────────────
String downloadTemplate() {
  while(fpSerial.available()) fpSerial.read();
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

// ── INITIALIZATION ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n\n[SYSTEM] MAChip Booting Architecture..."));
  
  pinMode(GREEN_LED, OUTPUT); 
  pinMode(RED_LED, OUTPUT);
  pinMode(SOLENOID_PIN, OUTPUT);
  
  pinMode(SS_PIN_IN, OUTPUT);
  pinMode(SS_PIN_OUT, OUTPUT);
  pinMode(RST_PIN_OUT, OUTPUT);
  
  // Enforce locked states on startup
  digitalWrite(SS_PIN_IN, HIGH);
  digitalWrite(SS_PIN_OUT, HIGH);
  digitalWrite(RST_PIN_OUT, HIGH);
  digitalWrite(SOLENOID_PIN, HIGH);
  solenoidActive = false;

  // Init Back Display (0.96" OLED I2C)
  if(!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("[OLED] Allocation failed"));
  } else {
    oled.setRotation(0); 
    oled.clearDisplay();
    oled.display();
  }

  // Init Front Display (2.4" TFT SPI)
  tft.init(240, 320);
  tft.setRotation(3); 
  
  updateFrontDisplay("BOOTING", "Initializing Peripheral Buses...", ST77XX_YELLOW);
  updateBackDisplay("BOOTING", "Loading system...");

  ledcAttach(BUZZER, BUZZER_FREQ, BUZZER_RES);
  provideFeedback(SYSTEM_READY);

  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  if (finger.verifyPassword()) Serial.println(F("[FP] Online"));

  SPI.begin();
  
  rfidIN.PCD_Init();
  rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  delay(50);
  
  rfidOUT.PCD_Init();
  rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
  
  autoConnectWiFi();
  setLED(LED_SLOW_BLINK, LED_OFF);
  
  updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
  updateBackDisplay("READY", "Scan Card Out");
}

// ── MAIN RUNTIME LOOP ─────────────────────────────────────────────
void loop() {
  updateLEDs();
  updateSolenoid();

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiCheck = 0;
    if (millis() - lastWiFiCheck > 20000) {
      autoConnectWiFi();
      lastWiFiCheck = millis();
    }
  }

  processQueuedTransaction();

  // ── BACKEND PROVISIONING POLL ────────────────────────────────────
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
        enrollmentMode = true;
        enrollmentUserId = doc["userId"].as<String>();
        enrollmentSlotId = doc["slotId"] | 1;
        enrollmentType = doc["type"] | "FP";
        
        provideFeedback(WAITING_SCAN);
        updateFrontDisplay("ENROLL ACTIVE", "ID: " + enrollmentUserId + " | Mode: " + enrollmentType, ST77XX_ORANGE);
        updateBackDisplay("LOCKED", "Admin Management");
      }
    }
    http.end();
  }

  // ── ENROLLMENT PIPELINE: RFID CAPTURE ────────────────────────────
  if (enrollmentMode && enrollmentType == "RFID") {
    clearSpiBusPins();
    digitalWrite(SS_PIN_IN, LOW);
    if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
      String cardUid = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        cardUid += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      cardUid.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      digitalWrite(SS_PIN_IN, HIGH);
      
      uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, cardUid);
      provideFeedback(SUCCESS_OK);
      updateFrontDisplay("SUCCESS", "RFID Credential Active", ST77XX_GREEN);
      
      enrollmentMode = false;
      delay(1000);
      HTTPClient clearHttp;
      clearHttp.begin(currentFpUrl + "/session/clear");
      clearHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
      clearHttp.GET(); clearHttp.end();
      setLED(LED_SLOW_BLINK, LED_OFF);
      updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
    }
    digitalWrite(SS_PIN_IN, HIGH);
  }

  // ── ENROLLMENT PIPELINE: FINGERPRINT ─────────────────────────────
  else if (enrollmentMode && enrollmentType == "FP") {
    static unsigned long fpEnrollStart = 0;
    static int fpEnrollStage = 0;
    
    if (fpEnrollStage == 0) {
      updateFrontDisplay("ENROLL BIOMETRIC", "Press pad firmly with finger...", ST77XX_BLUE);
      fpEnrollStart = millis();
      fpEnrollStage = 1;
    }
    
    if (fpEnrollStage == 1) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        p = finger.image2Tz(1);
        if (p == FINGERPRINT_OK) {
          updateFrontDisplay("ENROLL BIOMETRIC", "First Scan OK! Release sensor...", ST77XX_YELLOW);
          beep(100);
          fpEnrollStart = millis();
          fpEnrollStage = 2;
        }
      }
      
      if (millis() - fpEnrollStart > 30000) {
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false; fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
        updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      }
    }
    
    else if (fpEnrollStage == 2) {
      if (millis() - fpEnrollStart > 2000) {
        updateFrontDisplay("ENROLL BIOMETRIC", "Verify: Press same finger again...", ST77XX_BLUE);
        fpEnrollStart = millis();
        fpEnrollStage = 3;
      }
    }
    
    else if (fpEnrollStage == 3) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        p = finger.image2Tz(2);
        if (p == FINGERPRINT_OK) {
          if (finger.createModel() == FINGERPRINT_OK) {
            if (finger.storeModel(enrollmentSlotId) == FINGERPRINT_OK) {
              String templateHex = downloadTemplate();
              uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, templateHex);
              provideFeedback(SUCCESS_OK);
              updateFrontDisplay("SUCCESS", "Biometric Slot " + String(enrollmentSlotId) + " Saved", ST77XX_GREEN);
            } else {
              uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
              provideFeedback(ERROR_FAIL);
            }
          } else {
            updateFrontDisplay("MISMATCH", "Templates do not match", ST77XX_RED);
            uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
            provideFeedback(ERROR_FAIL);
          }
          enrollmentMode = false; fpEnrollStage = 0;
          delay(1500);
          setLED(LED_SLOW_BLINK, LED_OFF);
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
        }
      }
      
      if (millis() - fpEnrollStart > 30000) {
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false; fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
        updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      }
    }
  }

  // ── ACCESS ENGINE (RUNS WHEN PROVISIONING SESSIONS ARE QUIET) ────
  if (!enrollmentMode) {
    static unsigned long lastReaderInit = 0;
    if (millis() - lastReaderInit > 5000) {
      clearSpiBusPins();
      digitalWrite(SS_PIN_IN, LOW); rfidIN.PCD_Init(); digitalWrite(SS_PIN_IN, HIGH);
      digitalWrite(SS_PIN_OUT, LOW); rfidOUT.PCD_Init(); digitalWrite(SS_PIN_OUT, HIGH);
      lastReaderInit = millis();
    }

    // ── FRONT INTERFACE: CLOCK-IN 2FA PIPELINE ─────────────────────
    clearSpiBusPins();
    digitalWrite(SS_PIN_IN, LOW);
    bool checkInScan = rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial();
    
    if (checkInScan) {
      provideFeedback(RFID_TAP);
      String currentUID = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        currentUID += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      currentUID.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      digitalWrite(SS_PIN_IN, HIGH); // Isolate card reader completely

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(currentServerUrl);
        http.setTimeout(4000);
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
              updateFrontDisplay("2FA CHALLENGE", "Scan biometric token now...", ST77XX_CYAN);
              provideFeedback(WAITING_SCAN);
              pendingUID = currentUID;
              pendingExpectedFingerID = resDoc["expectedFingerId"] | -1;
              pendingStart = millis();
            } else {
              String name = resDoc["employeeName"] | "Employee";
              updateFrontDisplay("VERIFIED", name + "\nAttendance Clocked In", ST77XX_GREEN);
              provideFeedback(SUCCESS_OK);
              solenoidUnlock();
            }
          } else {
            String errMsg = resDoc["message"] | "Access Rejected";
            updateFrontDisplay("DENIED", errMsg, ST77XX_RED);
            provideFeedback(ERROR_FAIL);
          }
        } else {
          updateFrontDisplay("BUS ERROR", "Database Connection Lost", ST77XX_RED);
          provideFeedback(ERROR_FAIL);
        }
        http.end();
      } else {
        updateFrontDisplay("OFFLINE", "Network Pipeline Down", ST77XX_RED);
        provideFeedback(ERROR_FAIL);
      }
    }
    digitalWrite(SS_PIN_IN, HIGH);

    // ── FRONT INTERFACE: BIOMETRIC MATCH EVALUATION ────────────────
    if (pendingUID != "") {
      if (millis() - pendingStart < TIMEOUT_2FA) {
        int p = finger.getImage();
        if (p == FINGERPRINT_OK) {
          if (finger.image2Tz(1) == FINGERPRINT_OK) {
            if (finger.fingerFastSearch() == FINGERPRINT_OK) {
              if (pendingExpectedFingerID != -1 && finger.fingerID != pendingExpectedFingerID) {
                updateFrontDisplay("SECURITY FAULT", "Token ID Mismatch\nEvent Dispatched!", ST77XX_RED);
                provideFeedback(ERROR_FAIL);
                queueTransaction(pendingUID + "|" + String(finger.fingerID), "suspicious_biometric_fail", "FRONT");
                pendingUID = ""; pendingExpectedFingerID = -1;
                setLED(LED_SLOW_BLINK, LED_OFF);
              } else {
                updateFrontDisplay("VERIFIED", "2FA Validated\nDoor Released", ST77XX_GREEN);
                provideFeedback(SUCCESS_OK);
                solenoidUnlock();
                queueTransaction(pendingUID + "|" + String(finger.fingerID), "clock_in", "FRONT");
                pendingUID = ""; pendingExpectedFingerID = -1;
                setLED(LED_SLOW_BLINK, LED_OFF);
              }
            } else {
              updateFrontDisplay("ACCESS FORBIDDEN", "Biometric Unknown", ST77XX_RED);
              provideFeedback(ERROR_FAIL);
              queueTransaction(pendingUID, "suspicious_biometric_fail", "FRONT");
              pendingUID = ""; pendingExpectedFingerID = -1;
              setLED(LED_SLOW_BLINK, LED_OFF);
            }
          }
        }
      } else {
        updateFrontDisplay("TIMEOUT", "2FA Verification Timeout", ST77XX_RED);
        provideFeedback(ERROR_FAIL);
        queueTransaction(pendingUID, "unenrolled_card_attempt", "FRONT");
        pendingUID = ""; pendingExpectedFingerID = -1;
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }

    // ── BACK INTERFACE: CLOCK-OUT MODULE (RFID ONLY) ────────────────
    clearSpiBusPins();
    digitalWrite(SS_PIN_OUT, LOW);
    bool checkOutScan = rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial();
    
    if (checkOutScan) {
      provideFeedback(RFID_TAP);
      String outUID = "";
      for (byte i = 0; i < rfidOUT.uid.size; i++) {
        outUID += (rfidOUT.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidOUT.uid.uidByte[i], HEX);
      }
      outUID.toUpperCase();
      rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
      digitalWrite(SS_PIN_OUT, HIGH);

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(currentServerUrl);
        http.setTimeout(4000);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-esp32-key", String(ESP32_API_KEY));
        
        String payload = "{\"uid\":\"" + outUID + "\",\"action\":\"clock_out\",\"terminalType\":\"BACK\"}";
        int httpCode = http.POST(payload);
        
        if (httpCode == 200) {
          JsonDocument resDoc;
          deserializeJson(resDoc, http.getString());
          if (resDoc["success"] | false) {
            updateBackDisplay("APPROVED", "Goodbye!");
            provideFeedback(SUCCESS_OK);
            solenoidUnlock();
          } else {
            String errMsg = resDoc["message"] | "Rejected";
            updateBackDisplay("DENIED", errMsg);
            provideFeedback(ERROR_FAIL);
          }
        } else {
          updateBackDisplay("NET ERROR", "Code: " + String(httpCode));
          provideFeedback(ERROR_FAIL);
        }
        http.end();
      } else {
        updateBackDisplay("OFFLINE", "Local Denied");
        provideFeedback(ERROR_FAIL);
      }
      setLED(LED_SLOW_BLINK, LED_OFF);
    }
    digitalWrite(SS_PIN_OUT, HIGH);
  }

  delay(20);
  yield();
}