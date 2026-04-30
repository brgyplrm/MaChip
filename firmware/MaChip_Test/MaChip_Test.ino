#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include "arduino_secrets.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

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
  byte templateData[512];
  for (int i = 0; i < 512; i++) {
    templateData[i] = (byte) strtol(hexTemplate.substring(i * 2, i * 2 + 2).c_str(), NULL, 16);
  }

  uint8_t bufId = 0x02;
  // Command 0x09 = DownChar (Host to Sensor)
  if (sendCommand(0x09, &bufId, 1) != 0x00) return false;

  delay(30);
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
  disp.clearDisplay(); disp.setCursor(0,10); disp.setTextSize(2); disp.println(line1);
  disp.setTextSize(1); disp.println(line2); disp.display();
}

void showIdleMessages() {
  displayIN.clearDisplay(); displayIN.setTextSize(1); displayIN.setTextColor(SSD1306_WHITE);
  displayIN.setCursor(0,0); displayIN.println("MAChip FRONT"); displayIN.println("---------------------");
  displayIN.setCursor(0,30); displayIN.println("TAP CARD TO ENTER"); displayIN.display();

  displayOUT.clearDisplay(); displayOUT.setTextSize(1); displayOUT.setTextColor(SSD1306_WHITE);
  displayOUT.setCursor(0,0); displayOUT.println("MAChip BACK"); displayOUT.println("---------------------");
  displayOUT.setCursor(0,30); displayOUT.println("TAP CARD TO EXIT"); displayOUT.display();
}

// ── Feedback Helpers ─────────────────────────────────────────
void startupFeedback() { int notes[] = {1000, 1500, 2000, 2500}; for (int i = 0; i < 4; i++) { tone(BUZZER, notes[i], 100); delay(120); } }
void grantFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); tone(BUZZER, 2000, 100); delay(150); noTone(BUZZER); tone(BUZZER, 2500, 150); delay(1200); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }
void denyFeedback() { setLED(LED_OFF, LED_STEADY_RED); tone(BUZZER, 800, 200); delay(250); noTone(BUZZER); tone(BUZZER, 400, 400); delay(1200); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }
void captureFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); for (int i = 0; i < 3; i++) { tone(BUZZER, 2500, 80); delay(150); } delay(800); setLED(LED_SLOW_BLINK, LED_OFF); }
void enrollSuccessFeedback() { setLED(LED_STEADY_GREEN, LED_OFF); tone(BUZZER, 1000, 100); delay(120); tone(BUZZER, 2000, 300); setLED(LED_SLOW_BLINK, LED_OFF); }
void enrollFailFeedback() { setLED(LED_OFF, LED_STEADY_RED); tone(BUZZER, 500, 500); delay(600); noTone(BUZZER); setLED(LED_SLOW_BLINK, LED_OFF); }

// ── Backend Sync ─────────────────────────────────────────────
String fetchTemplateFromBackend(String uid) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  String url = String(fpEnrollUrl) + "/download/" + uid;
  http.begin(url);
  int code = http.GET();
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
  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");
  JsonDocument doc; doc["uid"] = uid; doc["action"] = action;
  String requestBody; serializeJson(doc, requestBody);
  int code = http.POST(requestBody);
  if (code == 200 || code == 201) {
    String response = http.getString();
    JsonDocument resDoc; deserializeJson(resDoc, response);
    if (resDoc["isCapture"] | false) { updateOLED(targetDisp, "CAPTURED", uid.substring(0,8)); captureFeedback(); }
    else if (resDoc["success"] | false) {
      String name = resDoc["name"] | "User"; String time = resDoc["time"] | "--:--";
      updateOLED(targetDisp, name, (action == "clock_out" ? "OUT " : "IN ") + time); grantFeedback();
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
  if (autoConnectWiFi()) startupFeedback();
  setLED(LED_SLOW_BLINK, LED_OFF);
}

// ── LOOP ─────────────────────────────────────────────────────
void loop() {
  updateLEDs();

  static unsigned long lastWifiCheck = 0;
  if (millis() - lastWifiCheck > 30000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) autoConnectWiFi();
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

    updateOLED(displayIN, "FETCHING", "BIO-TEMPLATE...");
    String templateHex = fetchTemplateFromBackend(uid);
    
    if (templateHex == "CAPTURE_OK") {
      updateOLED(displayIN, "CAPTURED", uid.substring(0,8));
      captureFeedback();
    } else if (templateHex != "") {
      if (uploadTemplate(templateHex)) {
        pendingInUID = uid;
        pendingInStart = millis();
        updateOLED(displayIN, "CARD OK", "SCAN FINGER...");
        tone(BUZZER, 2000, 100); 
        setLED(LED_FAST_BLINK, LED_OFF); 
      } else { updateOLED(displayIN, "ERROR", "LOAD FAILED"); denyFeedback(); }
    } else { 
      // Fallback: It might be a regular RFID-only user or a late capture request
      sendScanToBackend(uid, "auto_detect"); 
    }
    
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
    updateOLED(displayOUT, "SCANNED", "VERIFYING...");
    sendScanToBackend(uid, "clock_out");
    rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
    delay(2500); showIdleMessages();
  }

  // ── Enrollment session (Zero-Slot) ───────────────────────
  static unsigned long lastFPCheck = 0;
  if (millis() - lastFPCheck > 2000) {
    lastFPCheck = millis();
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http; http.begin(String(fpEnrollUrl) + "/session");
      if (http.GET() == 200) {
        JsonDocument doc; deserializeJson(doc, http.getString());
        if (doc["active"] | false) {
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
      }
      http.end();
    }
  }
}
