  #include <SPI.h>
  #include <MFRC522.h>
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <ArduinoJson.h>
  #include "arduino_secrets.h"

  const char* ssid       = SECRET_SSID;
  const char* password   = SECRET_PASS;
  const char* serverName = SECRET_SERVER_URL;

  // Pin Definitions — only change SS_PIN_OUT and RST_PIN_OUT
  #define SS_PIN_IN     5 
  #define SS_PIN_OUT    26 
  #define RST_PIN_IN    22
  #define RST_PIN_OUT   25 
  #define GREEN_LED     2
  #define RED_LED       4
  #define BUZZER        13

  MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
  MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);


  void checkReader(MFRC522 &rfid, String label) {
    byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
    Serial.print(label + " firmware: 0x");
    Serial.println(version, HEX);

    if (version == 0x91 || version == 0x92 || version == 0x82 || version == 0x88) {
      Serial.println(label + " → OK!");
    } else if (version == 0xFF) {
      Serial.println(label + " → FAILED: SS pin not connected or floating");
    } else if (version == 0x00) {
      Serial.println(label + " → FAILED: MISO/SCK/MOSI loose");
    } else {
      Serial.println(label + " → FAILED: unknown version");
    }
  }



  // --- NEW: Track status locally ---

  void setup() {
    Serial.begin(115200);
    pinMode(GREEN_LED, OUTPUT);
    pinMode(RED_LED, OUTPUT);
    pinMode(BUZZER, OUTPUT);

    SPI.begin();
    rfidIN.PCD_Init();
    rfidOUT.PCD_Init();

    checkReader(rfidIN,  "Reader IN  (GPIO 5)");
    checkReader(rfidOUT, "Reader OUT (GPIO 26)");

      // Add this to verify both readers initialized
    Serial.print("Reader IN firmware: ");
    Serial.println(rfidIN.PCD_ReadRegister(rfidIN.VersionReg), HEX);
    Serial.print("Reader OUT firmware: ");
    Serial.println(rfidOUT.PCD_ReadRegister(rfidOUT.VersionReg), HEX);
    
    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

    startupFeedback();
    errorFeedback();

    Serial.println("MAChip RFID Reader Online");
    Serial.println("Waiting for card...");

  }

  void loop() {
    // ── Check Clock IN reader (G5) ─────────────────────────────
    // ── Check Clock IN reader (G5) ─────────────────────────────
    if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
      String uid = buildUID(rfidIN);
      Serial.println("[CLOCK IN] Scanned UID: " + uid);
      
      // The server will check if this specific UID is already clocked in
      sendScanToBackend(uid, "clock_in");
      
      rfidIN.PICC_HaltA();
      rfidIN.PCD_StopCrypto1();
    }

      // ── Check Clock OUT reader (G26) ────────────────────────────
    if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
      String uid = buildUID(rfidOUT);
      Serial.println("[CLOCK OUT] Scanned UID: " + uid);
      
      // The server will check if this specific UID is actually inside
      sendScanToBackend(uid, "clock_out");
      
      rfidOUT.PICC_HaltA();
      rfidOUT.PCD_StopCrypto1();
    }
  }

  // ── Send UID + action to backend ─────────────────────────
    void sendScanToBackend(String uid, String action) {
    HTTPClient http;
    http.begin(serverName); // Use the URL from secrets
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["uid"] = uid;
    doc["action"] = action;
    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      String response = http.getString();
      StaticJsonDocument<200> resDoc;
      deserializeJson(resDoc, response);
      
      // Server must return { "success": true } only if:
      // 1. User exists
      // 2. User is NOT already clocked in (if action is clock_in)
      // 3. User IS clocked in (if action is clock_out)
      if (resDoc["success"]) {
        Serial.println("Access Granted: " + String(resDoc["name"].as<const char*>()));
        grantAccessFeedback();
      } else {
        Serial.println("Access Denied: " + String(resDoc["message"].as<const char*>()));
        denyAccessFeedback();
      }
    } else {
      Serial.println("Server Error");
      denyAccessFeedback();
    }
    http.end();
  }

  void errorFeedback() {
    for (int i = 0; i < 3; i++) {
      tone(BUZZER, 1000, 100);
      delay(200);
    }
  }

  void startupFeedback() {
    int notes[] = {1000, 1500, 2000, 2500};
    for (int i = 0; i < 4; i++) {
      tone(BUZZER, notes[i], 100);
      delay(120);
    }
  }

  void grantAccessFeedback() {
    digitalWrite(GREEN_LED, HIGH);
    tone(BUZZER, 2000, 100); delay(150);
    tone(BUZZER, 2500, 100); delay(1000); // rising = positive feel
    digitalWrite(GREEN_LED, LOW);
  }

  void denyAccessFeedback() {
    digitalWrite(RED_LED, HIGH);
    tone(BUZZER, 800, 200); delay(250);
    tone(BUZZER, 400, 400); delay(1000); // falling = negative feel
    digitalWrite(RED_LED, LOW);
  }

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