#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include "mbedtls/md.h"
#include "mbedtls/aes.h"
#include "arduino_secrets.h"

// ── Configuration & Structs ──
struct NetworkConfig {
  String ssid;
  String pass;
  String scanUrl;
  String fpBaseUrl;
};

const NetworkConfig networks[] = {
  { String(WIFI_SSID_3), String(WIFI_PASS_3), String(SERVER_URL_3), String(FP_ENROLL_3) }
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

String currentScanUrl = "";
String currentFpBaseUrl = "";

// ── Pin Definitions ──
#define SS_PIN_IN    5
#define SS_PIN_OUT   26
#define RST_PIN_IN   32  
#define RST_PIN_OUT  25
#define GREEN_LED    2
#define RED_LED      4
#define BUZZER       27  
#define FP_RX        16  
#define FP_TX        17    

// ── PWM Configuration (v3.0 Style) ───────────────────────────────
#define BUZZER_FREQ     2500 // 2.5kHz
#define BUZZER_RES      8    // 8-bit resolution

// ── Feedback Types ───────────────────────────────────────────────
enum FeedbackType {
  SUCCESS_OK,    
  ERROR_FAIL,    
  WAITING_SCAN,  
  RFID_TAP,      
  SYSTEM_READY,
  READING        
};

// ── Global Objects ──
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

unsigned long lastSessionCheck = 0;
const unsigned long CHECK_INTERVAL = 1000; // Faster response (1s)

// ── Support Functions ──
void beep(int duration) {
  ledcWriteTone(BUZZER, BUZZER_FREQ);
  delay(duration);
  ledcWriteTone(BUZZER, 0); 
}

void provideFeedback(FeedbackType type) {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);

  switch (type) {
    case SUCCESS_OK:
      digitalWrite(GREEN_LED, HIGH);
      beep(80); delay(80);
      beep(80);
      delay(1000);
      digitalWrite(GREEN_LED, LOW);
      break;

    case ERROR_FAIL:
      digitalWrite(RED_LED, HIGH);
      beep(800); 
      delay(500);
      digitalWrite(RED_LED, LOW);
      break;

    case RFID_TAP:
      beep(100); 
      break;

    case WAITING_SCAN:
      digitalWrite(GREEN_LED, HIGH); 
      break;

    case READING:
      // Rapid blinking: On, Off, then Rapid
      digitalWrite(GREEN_LED, HIGH); delay(150);
      digitalWrite(GREEN_LED, LOW); delay(150);
      for (int i = 0; i < 8; i++) {
        digitalWrite(GREEN_LED, !digitalRead(GREEN_LED));
        delay(40);
      }
      digitalWrite(GREEN_LED, LOW);
      break;

    case SYSTEM_READY:
      for (int i = 0; i < 3; i++) {
        beep(50); delay(50);
      }
      break;
  }
}

bool autoConnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println("\n[WIFI] Connecting...");

  for (int i = 0; i < NETWORK_COUNT; i++) {
    if (networks[i].ssid == "") continue;

    WiFi.disconnect();
    WiFi.mode(WIFI_STA);
    delay(1000);
    
    Serial.print("[WIFI] SSID: "); Serial.println(networks[i].ssid);
    WiFi.begin(networks[i].ssid.c_str(), networks[i].pass.c_str());

    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 15) {
      delay(1000);
      Serial.print(".");
      tries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      currentScanUrl = networks[i].scanUrl;
      currentFpBaseUrl = networks[i].fpBaseUrl;
      Serial.println("\n[OK] Connected!");
      Serial.print("[INFO] Local IP: "); Serial.println(WiFi.localIP());
      provideFeedback(SUCCESS_OK); 
      return true;
    }
  }
  Serial.println("\n[FAIL] WiFi Timeout.");
  provideFeedback(ERROR_FAIL);
  return false;
}

void sendEnrollmentConfirm(String userId, int slotId, bool success, String templateData) {
  HTTPClient http;
  String url = currentFpBaseUrl + "/confirm";
  http.begin(url);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-esp32-key", String(ESP32_API_KEY));

  JsonDocument doc;
  doc["userId"] = userId;
  doc["success"] = success;
  doc["template"] = templateData;
  doc["slotId"] = slotId;

  String payload;
  serializeJson(doc, payload);
  
  Serial.println("[HTTP] Sending enrollment confirmation (Success: " + String(success) + ")");
  http.POST(payload);
  http.end();
}

void enrollFingerprint(String userId, int slotId) {
  Serial.println("\n-------------------------------------------");
  Serial.println("[MODE] >>> BIOMETRIC ENROLLMENT START <<<");
  Serial.println("[INFO] Target: " + userId);
  Serial.print("[INFO] Slot: "); Serial.println(slotId);
  Serial.println("-------------------------------------------");
  
  // Flash sensor light purple to show it's "open"
  finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_PURPLE, 0);

  int p = -1;
  unsigned long lastBlink = 0;
  bool ledState = false;
  unsigned long enrollStartTime = millis();
  
  // CAPTURE 1
  Serial.println("[REG] Place finger...");
  while (p != FINGERPRINT_OK) {
    if (millis() - enrollStartTime > 30000) { // 30s timeout on device
      Serial.println("[ERR] Enrollment Timeout.");
      sendEnrollmentConfirm(userId, slotId, false, "TIMEOUT");
      provideFeedback(ERROR_FAIL);
      return;
    }

    // Blink Green LED while waiting
    if (millis() - lastBlink > 400) {
      ledState = !ledState;
      digitalWrite(GREEN_LED, ledState);
      lastBlink = millis();
    }

    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
       Serial.println("[REG] Image 1 OK.");
    }
    yield(); 
  }
  digitalWrite(GREEN_LED, LOW);

  if (finger.image2Tz(1) != FINGERPRINT_OK) {
     Serial.println("[ERR] Conversion 1 Fail.");
     finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
     sendEnrollmentConfirm(userId, slotId, false, "CONV_FAIL_1");
     provideFeedback(ERROR_FAIL);
     return;
  }

  Serial.println("[REG] Remove finger...");
  finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, FINGERPRINT_LED_BLUE);
  beep(100); 
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) { p = finger.getImage(); }

  // CAPTURE 2
  Serial.println("[REG] Place same finger again...");
  finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_BLUE, 0);
  p = -1;
  enrollStartTime = millis(); // Reset timeout for 2nd stage
  while (p != FINGERPRINT_OK) {
    if (millis() - enrollStartTime > 30000) {
      Serial.println("[ERR] Enrollment Timeout Stage 2.");
      sendEnrollmentConfirm(userId, slotId, false, "TIMEOUT_2");
      provideFeedback(ERROR_FAIL);
      return;
    }

    if (millis() - lastBlink > 200) { // Faster blink for 2nd step
      ledState = !ledState;
      digitalWrite(GREEN_LED, ledState);
      lastBlink = millis();
    }
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
       Serial.println("[REG] Image 2 OK.");
    }
    yield();
  }
  digitalWrite(GREEN_LED, LOW);

  if (finger.image2Tz(2) != FINGERPRINT_OK) {
     Serial.println("[ERR] Conversion 2 Fail.");
     finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
     sendEnrollmentConfirm(userId, slotId, false, "CONV_FAIL_2");
     provideFeedback(ERROR_FAIL);
     return;
  }

  if (finger.createModel() != FINGERPRINT_OK) {
    Serial.println("[DENIED] Mismatch.");
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
    sendEnrollmentConfirm(userId, slotId, false, "MISMATCH");
    provideFeedback(ERROR_FAIL);
    return;
  }

  // STORE MODEL
  Serial.print("[REG] Storing in Slot #"); Serial.println(slotId);
  if (finger.storeModel(slotId) != FINGERPRINT_OK) {
    Serial.println("[ERR] Failed to store model.");
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
    sendEnrollmentConfirm(userId, slotId, false, "STORE_FAIL");
    provideFeedback(ERROR_FAIL);
    return;
  }

  // Upload Result (Success)
  sendEnrollmentConfirm(userId, slotId, true, "CAPTURED_ON_DEVICE");
  
  Serial.println("[SUCCESS] Biometrics linked!");
  finger.LEDcontrol(FINGERPRINT_LED_ON, 0, FINGERPRINT_LED_BLUE);
  provideFeedback(SUCCESS_OK);
  finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, FINGERPRINT_LED_BLUE);
  Serial.println("[SYSTEM] Ready.");
}

void checkEnrollmentSession() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = currentFpBaseUrl + "/session";
  
  http.begin(url);
  http.setTimeout(3000); 
  http.addHeader("x-esp32-key", String(ESP32_API_KEY));
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && (doc["active"] | false)) {
      int slotId = doc["slotId"] | 0;
      enrollFingerprint(doc["userId"] | "temp", slotId);
    }
  } 
  http.end();
}

void identifyFingerprint(String rfidUid, String terminalType) {
  Serial.println("\n[2FA] Proceeding to Biometric Verification...");
  Serial.println("[2FA] Place finger on sensor...");
  
  // Fast blue blink to indicate 2FA wait
  finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_BLUE, 0);

  int p = -1;
  unsigned long startTime = millis();
  
  while (p != FINGERPRINT_OK) {
    if (millis() - startTime > 15000) { // 15s timeout for 2FA
      Serial.println("[2FA] Timeout.");
      finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
      provideFeedback(ERROR_FAIL);
      return;
    }

    p = finger.getImage();
    yield();
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("[2FA] Image conversion error.");
    provideFeedback(ERROR_FAIL);
    return;
  }

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.print("[2FA] Match Found! Slot #"); Serial.println(finger.fingerID);
    // Send combined 2FA payload
    String payload = rfidUid + "|" + String(finger.fingerID);
    sendScanRequest(payload, "2fa_verify", terminalType);
  } else {
    Serial.println("[2FA] No match found or Access Denied.");
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
    provideFeedback(ERROR_FAIL);
    
    // Log suspicious attempt locally
    Serial.println("[SUSPICIOUS] Biometric mismatch during 2FA.");
  }
}

void sendScanRequest(String uid, String action, String terminalType) {
  if (WiFi.status() != WL_CONNECTED) {
     Serial.println("[ERR] WiFi Link Down.");
     provideFeedback(ERROR_FAIL);
     return;
  }

  // Rapid blinking feedback when reading/processing
  provideFeedback(READING);

  HTTPClient http;
  Serial.println("\n[HTTP] POST to " + currentScanUrl);
  http.begin(currentScanUrl);
  http.setTimeout(10000); 
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-esp32-key", String(ESP32_API_KEY));
  
  JsonDocument doc;
  doc["uid"] = uid;
  doc["action"] = action;
  doc["terminalType"] = terminalType;

  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument resDoc;
    deserializeJson(resDoc, response);

    String mode = resDoc["mode"] | "ATTENDANCE";

    if (mode == "RFID_REG_SUCCESS") {
      Serial.println("[OK] RFID Registration Successful.");
      provideFeedback(SUCCESS_OK);
    } 
    else if (mode == "WAITING_FOR_FINGERPRINT") {
      int slotId = resDoc["slotId"] | 0;
      enrollFingerprint(resDoc["userId"], slotId);
    } 
    else if (mode == "WAITING_FOR_FINGERPRINT_2FA") {
      String rfidUid = resDoc["uid"] | uid;
      identifyFingerprint(rfidUid, terminalType);
    }
    else {
      Serial.println("[OK] Attendance logged: " + String(resDoc["name"] | "User"));
      provideFeedback(SUCCESS_OK);
    }
  } else {
    Serial.print("[ERR] Scan failed. Code: "); Serial.println(httpCode);
    provideFeedback(ERROR_FAIL);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\nMAChip Hardware v2.3 Starting...");
  
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  // v3.0 PWM syntax
  ledcAttach(BUZZER, BUZZER_FREQ, BUZZER_RES);

  provideFeedback(SYSTEM_READY);

  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  if (finger.verifyPassword()) {
    Serial.println("[FP] Biometric Sensor: ONLINE");
  } else {
    Serial.println("[FP] Biometric Sensor: ERROR (Check Wiring)");
  }

  SPI.begin();
  rfidIN.PCD_Init();
  rfidOUT.PCD_Init();
  rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max); 
  rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);

  autoConnectWiFi();
  Serial.println("[SYSTEM] Ready.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastRetry = 0;
    if (millis() - lastRetry > 15000) {
      autoConnectWiFi();
      lastRetry = millis();
    }
  }

  // Session Polling
  if (millis() - lastSessionCheck > CHECK_INTERVAL) {
    checkEnrollmentSession();
    lastSessionCheck = millis();
  }

  // Front Reader
  if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidIN.uid.size; i++) {
      uid += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    Serial.println("\n[FRONT] RFID: " + uid);
    sendScanRequest(uid, "auto_detect", "FRONT");
    rfidIN.PICC_HaltA(); 
    rfidIN.PCD_StopCrypto1();
  }

  // Back Reader
  if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfidOUT.uid.size; i++) {
      uid += (rfidOUT.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidOUT.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    Serial.println("\n[BACK] RFID: " + uid);
    sendScanRequest(uid, "clock_out", "BACK");
    rfidOUT.PCD_StopCrypto1();
  }
  
  yield();
}
