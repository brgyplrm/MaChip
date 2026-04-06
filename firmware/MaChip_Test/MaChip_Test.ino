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

  delay(1000); // Debounce
}

void sendScanToBackend(String uid) {
  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["uid"] = uid;
  String requestBody;
  serializeJson(doc, requestBody);

  Serial.println("Sending request to backend...");
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    Serial.println("Response: " + response);

    // Parse JSON response
    StaticJsonDocument<200> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error) {
      bool success = resDoc["success"];
      const char* name = resDoc["name"];
      const char* action = resDoc["action"];

      if (success) {
        Serial.print("Access Granted: ");
        Serial.print(name);
        Serial.print(" (");
        Serial.print(action);
        Serial.println(")");
        
        grantAccessFeedback();
      } else {
        Serial.println("Access Denied: " + String(resDoc["message"].as<const char*>()));
        denyAccessFeedback();
      }
    }
  } else {
    Serial.print("Error on sending POST: ");
    Serial.println(httpResponseCode);
    denyAccessFeedback(); // Treat connection error as denied
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
