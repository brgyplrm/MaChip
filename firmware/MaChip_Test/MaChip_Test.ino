#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "arduino_secrets.h"

// --- CONFIGURATION ---
const char* ssid = SECRET_SSID;
const char* password = SECRET_PASS;
const char* serverName = SECRET_SERVER_URL;

// Pin Definitions
#define SS_PIN    5
#define RST_PIN   22
#define GREEN_LED 2
#define RED_LED   4
#define BUZZER    13

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  noTone(BUZZER);

  SPI.begin(); 
  rfid.PCD_Init();

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  Serial.println("MAChip RFID Reader Online");
  Serial.println("Scan a card...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    delay(2000);
    return;
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();

  Serial.print("Scanned UID: ");
  Serial.println(uid);

  sendScanToBackend(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000);
}

void sendScanToBackend(String uid) {
  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["uid"] = uid;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    StaticJsonDocument<200> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error) {
      bool success = resDoc["success"];
      bool isCapture = resDoc["isCapture"] | false;

      if (isCapture) {
        Serial.println("UID Captured for registration mode.");
        captureFeedback();
      } else if (success) {
        Serial.print("Access Granted: ");
        Serial.println(resDoc["name"].as<const char*>());
        grantAccessFeedback();
      } else {
        Serial.println("Access Denied.");
        denyAccessFeedback();
      }
    }
  } else {
    Serial.print("Error on sending POST: ");
    Serial.println(httpResponseCode);
    denyAccessFeedback();
  }

  http.end();
}

void grantAccessFeedback() {
  digitalWrite(GREEN_LED, HIGH);
  tone(BUZZER, 2000, 200);
  delay(1000);
  digitalWrite(GREEN_LED, LOW);
}

void denyAccessFeedback() {
  digitalWrite(RED_LED, HIGH);
  tone(BUZZER, 500, 1000);
  delay(1000);
  digitalWrite(RED_LED, LOW);
}

void captureFeedback() {
  // Rapid blink both LEDs to indicate "Captured"
  for(int i=0; i<3; i++) {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, HIGH);
    tone(BUZZER, 1500, 100);
    delay(100);
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, LOW);
    delay(100);
  }
}
