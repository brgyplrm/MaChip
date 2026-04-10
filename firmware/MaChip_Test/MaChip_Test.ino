#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal.h>
#include "arduino_secrets.h"

const char* ssid       = SECRET_SSID;
const char* password   = SECRET_PASS;
const char* serverName = SECRET_SERVER_URL;

// ── Pin Definitions ──────────────────────────────────────────
#define SS_PIN_IN     5
#define SS_PIN_OUT    26
#define RST_PIN_IN    22
#define RST_PIN_OUT   25
#define GREEN_LED     2
#define RED_LED       4
#define BUZZER        13

// ── LCD: RS, E, D4, D5, D6, D7 ──────────────────────────────
LiquidCrystal lcd(27, 32, 33, 14, 21, 17);

MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);

// ── LCD Helpers ──────────────────────────────────────────────
void lcdIdle() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  Scan Your ID  ");
  lcd.setCursor(0, 1);
  lcd.print("                ");
}

void lcdScanning(String uid) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ID: " + uid.substring(0, 12)); // show partial UID
  lcd.setCursor(0, 1);
  lcd.print("Checking...     ");
}

// success = true  → "08:30 AM  MACJ-001"
// success = false → "Unauthorized ID"
void lcdResult(bool success, String timeStr, String machipId, String lastName) {
  lcd.clear();
  if (success) {
    // Row 0: time + machip ID   e.g. "08:30 AM MACJ-001"
    String row0 = timeStr + " " + machipId;
    lcd.setCursor(0, 0);
    lcd.print(row0.substring(0, 16));

    // Row 1: Last name          e.g. "Dela Cruz"
    lcd.setCursor(0, 1);
    lcd.print(lastName.substring(0, 16));
  } else {
    lcd.setCursor(0, 0);
    lcd.print(" Unauthorized   ");
    lcd.setCursor(0, 1);
    lcd.print("      ID        ");
  }
}

// ── Reader Check ─────────────────────────────────────────────
void checkReader(MFRC522 &rfid, String label) {
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.print(label + " firmware: 0x");
  Serial.println(version, HEX);
  if (version == 0x91 || version == 0x92 || version == 0x82 || version == 0x88) {
    Serial.println(label + " → OK!");
  } else if (version == 0xFF) {
    Serial.println(label + " → FAILED: SS pin floating");
  } else if (version == 0x00) {
    Serial.println(label + " → FAILED: MISO/SCK/MOSI loose");
  } else {
    Serial.println(label + " → FAILED: unknown version");
  }
}

// ── Setup ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  // LCD init
  lcd.begin(16, 2);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  MAChip v1.0   ");
  lcd.setCursor(0, 1);
  lcd.print(" Initializing...");

  SPI.begin();
  rfidIN.PCD_Init();
  delay(50);
  rfidOUT.PCD_Init();
  delay(50);

  checkReader(rfidIN,  "Reader IN  (GPIO 5)");
  checkReader(rfidOUT, "Reader OUT (GPIO 26)");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi ");
  lcd.setCursor(0, 1);
  lcd.print("Please wait...  ");

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  startupFeedback();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(" WiFi Connected ");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP().toString());
  delay(2000);

  lcdIdle(); // ← show "Scan Your ID" as default

  Serial.println("MAChip RFID Reader Online");
  Serial.println("Waiting for card...");
}

// ── Loop ─────────────────────────────────────────────────────
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    int attempts = 0;
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      attempts++;
    }
  }

  // ── Clock IN / Auto-detect (GPIO 5) ───────────────────────
  if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
    String uid = buildUID(rfidIN);
    Serial.println("Scan Detected: " + uid);
    lcdScanning(uid);             // show UID + "Checking..."
    sendScanToBackend(uid, "auto_detect");
    rfidIN.PICC_HaltA();
    rfidIN.PCD_StopCrypto1();
    delay(1500);
    lcdIdle();                    // back to default
  }

  // ── Clock OUT (GPIO 26) ────────────────────────────────────
  if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
    String uid = buildUID(rfidOUT);
    Serial.println("[CLOCK OUT] Scanned UID: " + uid);
    lcdScanning(uid);
    sendScanToBackend(uid, "clock_out");
    rfidOUT.PICC_HaltA();
    rfidOUT.PCD_StopCrypto1();
    delay(1500);
    lcdIdle();
  }
}

// ── Send to Backend ───────────────────────────────────────────
// Backend must return:
// { "success": true,  "name": "Dela Cruz", "machipId": "MACJ-001", "time": "08:30 AM", "action": "clock_in" }
// { "success": false, "message": "Unauthorized" }
void sendScanToBackend(String uid, String action) {
  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["uid"]    = uid;
  doc["action"] = action;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP " + String(httpResponseCode) + ": " + response);

    StaticJsonDocument<300> resDoc;
    deserializeJson(resDoc, response);

    bool success       = resDoc["success"];
    String lastName    = resDoc["name"]     | "Unknown";
    String machipId    = resDoc["machipId"] | "MACJ-???";
    String timeStr     = resDoc["time"]     | "--:-- --";

    lcdResult(success, timeStr, machipId, lastName);

    if (success) {
      Serial.println("Granted: " + lastName + " | " + machipId + " | " + timeStr);
      grantAccessFeedback();
    } else {
      String msg = resDoc["message"] | "Denied";
      Serial.println("Denied: " + msg);
      denyAccessFeedback();
    }
  } else {
    Serial.println("Server Error: " + String(httpResponseCode));
    lcdResult(false, "", "", "");
    denyAccessFeedback();
  }

  http.end();
}

// ── Feedback ──────────────────────────────────────────────────
void startupFeedback() {
  int notes[] = {1000, 1500, 2000, 2500};
  for (int i = 0; i < 4; i++) {
    tone(BUZZER, notes[i], 100);
    delay(120);
  }
}

void errorFeedback() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER, 1000, 100);
    delay(200);
  }
}

void grantAccessFeedback() {
  digitalWrite(GREEN_LED, HIGH);
  tone(BUZZER, 2000, 100); delay(150);
  noTone(BUZZER);
  tone(BUZZER, 2500, 100); delay(1000);
  noTone(BUZZER);
  digitalWrite(GREEN_LED, LOW);
}

void denyAccessFeedback() {
  digitalWrite(RED_LED, HIGH);
  tone(BUZZER, 800, 200); delay(250);
  noTone(BUZZER);
  tone(BUZZER, 400, 400); delay(1000);
  noTone(BUZZER);
  digitalWrite(RED_LED, LOW);
}

// ── UID Builder ───────────────────────────────────────────────
String buildUID(MFRC522 &rfid) {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}