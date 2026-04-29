        #include <SPI.h>
        #include <MFRC522.h>
        #include <WiFi.h>
        #include <HTTPClient.h>
        #include <ArduinoJson.h>
        #include <Adafruit_Fingerprint.h>
        #include "arduino_secrets.h"

        const char* ssid       = SECRET_SSID;
        const char* password   = SECRET_PASS;
        const char* serverName = SECRET_SERVER_URL; // /api/rfid/scan
        const char* fpEnrollUrl = SECRET_FP_ENROLL_URL; // /api/esp/fingerprint

        // ── Pin Definitions ──────────────────────────────────────────
        #define SS_PIN_IN    5
        #define SS_PIN_OUT   26
        #define RST_PIN_IN   22
        #define RST_PIN_OUT  25
        #define GREEN_LED    2
        #define RED_LED      4
        #define BUZZER       13
        // R307S on UART2
        #define FP_RX        16
        #define FP_TX        17

        // ── Objects ──────────────────────────────────────────────────
        MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
        MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
        HardwareSerial fpSerial(2);
        Adafruit_Fingerprint finger(&fpSerial);

        // ─────────────────────────────────────────────────────────────
        // LED STATE MACHINE (non-blocking millis)
        // ─────────────────────────────────────────────────────────────
        enum LedMode {
          LED_OFF,
          LED_SLOW_BLINK,  // idle   — 1 blink/sec
          LED_FAST_BLINK,  // processing — 10 blinks/sec
          LED_STEADY_GREEN,// success
          LED_STEADY_RED   // error / denied
        };

        LedMode greenMode    = LED_SLOW_BLINK;
        LedMode redMode      = LED_OFF;
        unsigned long lastGreenToggle = 0;
        unsigned long lastRedToggle   = 0;
        bool greenState = false;
        bool redState   = false;

        void setLED(LedMode gMode, LedMode rMode) {
          greenMode = gMode;
          redMode   = rMode;
          // Reset states so transition is immediate
          if (gMode == LED_OFF)          { digitalWrite(GREEN_LED, LOW);  greenState = false; }
          if (gMode == LED_STEADY_GREEN) { digitalWrite(GREEN_LED, HIGH); greenState = true;  }
          if (rMode == LED_OFF)          { digitalWrite(RED_LED, LOW);    redState = false;   }
          if (rMode == LED_STEADY_RED)   { digitalWrite(RED_LED, HIGH);   redState = true;    }
        }

        void updateLEDs() {
          unsigned long now = millis();

          // ── Green LED ─────────────────────────────────────────────
          unsigned long gInterval = 0;
          if      (greenMode == LED_SLOW_BLINK) gInterval = 1000;
          else if (greenMode == LED_FAST_BLINK) gInterval = 80;

          if (gInterval > 0 && now - lastGreenToggle >= gInterval) {
            lastGreenToggle = now;
            greenState = !greenState;
            digitalWrite(GREEN_LED, greenState ? HIGH : LOW);
          }

          // ── Red LED ───────────────────────────────────────────────
          unsigned long rInterval = 0;
          if      (redMode == LED_SLOW_BLINK) rInterval = 1000;
          else if (redMode == LED_FAST_BLINK) rInterval = 80;

          if (rInterval > 0 && now - lastRedToggle >= rInterval) {
            lastRedToggle = now;
            redState = !redState;
            digitalWrite(RED_LED, redState ? HIGH : LOW);
          }
        }

        // ─────────────────────────────────────────────────────────────
        // FEEDBACK
        // ─────────────────────────────────────────────────────────────
        void startupFeedback() {
          int notes[] = {1000, 1500, 2000, 2500};
          for (int i = 0; i < 4; i++) {
            tone(BUZZER, notes[i], 100);
            delay(120);
          }
        }

        void grantFeedback() {
          setLED(LED_STEADY_GREEN, LED_OFF);
          tone(BUZZER, 2000, 100); delay(150);
          noTone(BUZZER);
          tone(BUZZER, 2500, 150); delay(1200);
          noTone(BUZZER);
          setLED(LED_SLOW_BLINK, LED_OFF); // back to idle
        }

        void denyFeedback() {
          setLED(LED_OFF, LED_STEADY_RED);
          tone(BUZZER, 800, 200); delay(250);
          noTone(BUZZER);
          tone(BUZZER, 400, 400); delay(1200);
          noTone(BUZZER);
          setLED(LED_SLOW_BLINK, LED_OFF); // back to idle
        }

        void captureFeedback() {
          // 3 short beeps — distinct from clock-in
          setLED(LED_STEADY_GREEN, LED_OFF);
          for (int i = 0; i < 3; i++) {
            tone(BUZZER, 2500, 80);
            delay(150);
          }
          delay(800);
          setLED(LED_SLOW_BLINK, LED_OFF);
        }

        void enrollSuccessFeedback() {
          // Long rising tone — fingerprint enrolled
          setLED(LED_STEADY_GREEN, LED_OFF);
          tone(BUZZER, 1000, 100); delay(120);
          tone(BUZZER, 1500, 100); delay(120);
          tone(BUZZER, 2000, 100); delay(120);
          tone(BUZZER, 2500, 300); delay(500);
          noTone(BUZZER);
          setLED(LED_SLOW_BLINK, LED_OFF);
        }

        void enrollFailFeedback() {
          setLED(LED_OFF, LED_STEADY_RED);
          tone(BUZZER, 500, 500); delay(600);
          noTone(BUZZER);
          setLED(LED_SLOW_BLINK, LED_OFF);
        }

        // ─────────────────────────────────────────────────────────────
        // READER CHECK
        // ─────────────────────────────────────────────────────────────
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
            Serial.println(label + " → FAILED: unknown 0x" + String(version, HEX));
          }
        }

        // ─────────────────────────────────────────────────────────────
        // FINGERPRINT ENROLLMENT
        // Polls backend to check if admin triggered enrollment mode
        // for a specific user, then captures from R307 and stores slot
        // ─────────────────────────────────────────────────────────────

        // Returns slot ID assigned by backend, or -1 if no session active
        int checkFingerprintEnrollSession(String &outUserId) {
          if (WiFi.status() != WL_CONNECTED) return -1;

          HTTPClient http;
          // GET /api/esp/fingerprint/session
          String url = String(fpEnrollUrl) + "/session";
          http.begin(url);
          http.setTimeout(3000);
          int code = http.GET();

          if (code != 200) { http.end(); return -1; }

          String body = http.getString();
          http.end();

          StaticJsonDocument<200> doc;
          if (deserializeJson(doc, body)) return -1;

          bool active = doc["active"] | false;
          if (!active) return -1;

          outUserId       = doc["userId"].as<String>();
          int slotId      = doc["slotId"] | -1;
          return slotId; // backend tells us which slot to store into
        }

        // Captures finger from R307 and stores into given slot
        // Returns true on success
        bool enrollFingerIntoSlot(int slotId) {
          Serial.println("[FP] Enrolling into slot " + String(slotId));
          Serial.println("[FP] Waiting for finger (scan 1)...");

          unsigned long start = millis();
          int p = -1;

          // ── Scan 1 ───────────────────────────────────────────────
          while (millis() - start < 12000) { // 12 second window
            p = finger.getImage();
            if (p == FINGERPRINT_OK) break;
            if (p == FINGERPRINT_NOFINGER) { delay(50); continue; }
            Serial.println("[FP] Image error scan 1: " + String(p));
            return false;
          }
          if (p != FINGERPRINT_OK) { Serial.println("[FP] Timeout scan 1"); return false; }

          p = finger.image2Tz(1);
          if (p != FINGERPRINT_OK) { Serial.println("[FP] image2Tz(1) failed"); return false; }
          Serial.println("[FP] Scan 1 OK — remove finger...");

          // Wait for finger to lift
          delay(1000);
          while (finger.getImage() != FINGERPRINT_NOFINGER) delay(50);

          Serial.println("[FP] Waiting for same finger again (scan 2)...");
          start = millis();
          p = -1;

          // ── Scan 2 ───────────────────────────────────────────────
          while (millis() - start < 12000) {
            p = finger.getImage();
            if (p == FINGERPRINT_OK) break;
            if (p == FINGERPRINT_NOFINGER) { delay(50); continue; }
            Serial.println("[FP] Image error scan 2: " + String(p));
            return false;
          }
          if (p != FINGERPRINT_OK) { Serial.println("[FP] Timeout scan 2"); return false; }

          p = finger.image2Tz(2);
          if (p != FINGERPRINT_OK) { Serial.println("[FP] image2Tz(2) failed"); return false; }

          // ── Create model ──────────────────────────────────────────
          p = finger.createModel();
          if (p != FINGERPRINT_OK) {
            Serial.println("[FP] Fingerprints did not match: " + String(p));
            return false;
          }

          // ── Store model into slot ─────────────────────────────────
          p = finger.storeModel(slotId);
          if (p != FINGERPRINT_OK) {
            Serial.println("[FP] Store failed: " + String(p));
            return false;
          }

          Serial.println("[FP] Stored into slot " + String(slotId) + " ✅");
          return true;
        }

        // Tell backend enrollment succeeded
        void confirmEnrollToBackend(String userId, int slotId, bool success) {
          if (WiFi.status() != WL_CONNECTED) return;

          HTTPClient http;
          String url = String(fpEnrollUrl) + "/confirm";
          http.begin(url);
          http.addHeader("Content-Type", "application/json");
          http.setTimeout(5000);

          StaticJsonDocument<128> doc;
          doc["userId"]  = userId;
          doc["slotId"]  = slotId;
          doc["success"] = success;
          String body;
          serializeJson(doc, body);

          http.POST(body);
          http.end();
        }

        // ── Fingerprint Identification ──────────────────────────────
        int getFingerprintID() {
          if (finger.getImage() != FINGERPRINT_OK) return -1;
          if (finger.image2Tz() != FINGERPRINT_OK) return -1;
          if (finger.fingerFastSearch() != FINGERPRINT_OK) return -1;
          return finger.fingerID;
        }

        // ─────────────────────────────────────────────────────────────
        // RFID BACKEND CALL
        // ─────────────────────────────────────────────────────────────
        void sendScanToBackend(String uid, String action) {
          if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WARN] WiFi not connected — skipping");
            denyFeedback();
            return;
          }

          setLED(LED_FAST_BLINK, LED_OFF); // processing

          HTTPClient http;
          http.begin(serverName);
          http.addHeader("Content-Type", "application/json");
          http.setTimeout(5000);

          StaticJsonDocument<200> doc;
          doc["uid"]    = uid;
          doc["action"] = action;
          String requestBody;
          serializeJson(doc, requestBody);

          Serial.println("[HTTP] POST → " + String(serverName));
          Serial.println("[HTTP] Body: " + requestBody);

          int code = http.POST(requestBody);

          if (code == 200 || code == 201) {
            String response = http.getString();
            Serial.println("[HTTP] " + String(code) + ": " + response);

            StaticJsonDocument<300> resDoc;
            DeserializationError err = deserializeJson(resDoc, response);

            if (err) {
              Serial.println("[JSON] Parse error");
              grantFeedback(); // assume ok if server responded 200
              http.end(); return;
            }

            bool success   = resDoc["success"]   | false;
            bool isCapture = resDoc["isCapture"] | false;

            // ── RFID Capture mode (Generate RFID button) ──────────
            if (isCapture) {
              Serial.println("[CAPTURE] UID captured: " + uid);
              captureFeedback();
              http.end(); return;
            }

            // ── Normal clock-in / clock-out ───────────────────────
            if (success) {
              String name     = resDoc["name"]     | "Unknown";
              String machipId = resDoc["machipId"] | uid.substring(0, 8);
              String timeStr  = resDoc["time"]     | "--:--";
              Serial.println("[OK] " + name + " | " + machipId + " | " + timeStr);
              grantFeedback();
            } else {
              String msg = resDoc["message"] | resDoc["error"] | "Denied";
              Serial.println("[DENIED] " + msg);
              denyFeedback();
            }

          } else if (code <= 0) {
            Serial.println("[HTTP] No response: " + String(code));
            denyFeedback();
          } else {
            Serial.println("[HTTP] Error: " + String(code));
            String response = http.getString();
            StaticJsonDocument<200> errDoc;
            deserializeJson(errDoc, response);
            String msg = errDoc["message"] | errDoc["error"] | "Denied";
            Serial.println("[DENIED] " + msg);
            denyFeedback();
          }

          http.end();
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

        // ─────────────────────────────────────────────────────────────
        // SETUP
        // ─────────────────────────────────────────────────────────────
        void setup() {
          Serial.begin(115200);
          pinMode(GREEN_LED, OUTPUT);
          pinMode(RED_LED,   OUTPUT);
          pinMode(BUZZER,    OUTPUT);

          // Start with fast blink during init
          setLED(LED_FAST_BLINK, LED_OFF);

          // ── R307S init ────────────────────────────────────────────
          fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
          finger.begin(57600);
          if (finger.verifyPassword()) {
            Serial.println("[R307] Connected OK — " + String(finger.templateCount) + " templates stored");
          } else {
            Serial.println("[R307] NOT FOUND — check wiring (GPIO16/17)");
          }

          // ── RFID init ─────────────────────────────────────────────
          SPI.begin();
          rfidIN.PCD_Init();  delay(50);
          rfidOUT.PCD_Init(); delay(50);
          checkReader(rfidIN,  "Reader IN  (GPIO 5)");
          checkReader(rfidOUT, "Reader OUT (GPIO 26)");

          // ── WiFi ──────────────────────────────────────────────────
          Serial.print("Connecting WiFi");
          WiFi.begin(ssid, password);
          int tries = 0;
          while (WiFi.status() != WL_CONNECTED && tries < 30) {
            updateLEDs(); // keep LED animating during wait
            delay(500);
            Serial.print(".");
            tries++;
          }

          if (WiFi.status() == WL_CONNECTED) {
            Serial.println("\nWiFi Connected: " + WiFi.localIP().toString());
            startupFeedback();
          } else {
            Serial.println("\n[WARN] No WiFi");
          }

          setLED(LED_SLOW_BLINK, LED_OFF); // idle
          Serial.println("MAChip Ready — waiting for card or finger...");
        }

        // ─────────────────────────────────────────────────────────────
        // LOOP
        // ─────────────────────────────────────────────────────────────
        void loop() {

          // ── Always update LEDs (non-blocking) ─────────────────────
          updateLEDs();

          // ── WiFi reconnect check every 30s ────────────────────────
          static unsigned long lastWifiCheck = 0;
          if (millis() - lastWifiCheck > 30000) {
            lastWifiCheck = millis();
            if (WiFi.status() != WL_CONNECTED) {
              Serial.print("[WiFi] Reconnecting");
              WiFi.begin(ssid, password);
              int a = 0;
              while (WiFi.status() != WL_CONNECTED && a < 20) {
                updateLEDs(); delay(500); Serial.print("."); a++;
              }
              Serial.println(WiFi.status() == WL_CONNECTED ? "\n[WiFi] OK" : "\n[WiFi] Still offline");
            }
          }

          // ── Fingerprint ID check (every 500ms) ────────────────────
          static unsigned long lastFingerCheck = 0;
          if (millis() - lastFingerCheck > 500) {
            lastFingerCheck = millis();
            int fid = getFingerprintID();
            if (fid > 0) {
              Serial.println("[FP] Identified Slot: " + String(fid));
              sendScanToBackend(String(fid), "fingerprint_scan");
            }
          }

          // ── Fingerprint enrollment session check (every 2s) ───────
          // Admin clicked "FINGERPRINT" button on dashboard
          // Backend opens a session → ESP32 detects it here
          static unsigned long lastFPCheck = 0;
          if (millis() - lastFPCheck > 2000) {
            lastFPCheck = millis();

            String userId = "";
            int slotId = checkFingerprintEnrollSession(userId);

            if (slotId > 0) {
              Serial.println("[FP] Enrollment session active for user " + userId + " → slot " + String(slotId));

              // Switch to fast blink — waiting for finger placement
              setLED(LED_FAST_BLINK, LED_OFF);
              Serial.println("[FP] Place finger on R307 sensor...");

              bool ok = enrollFingerIntoSlot(slotId);

              if (ok) {
                Serial.println("[FP] Enrollment SUCCESS");
                confirmEnrollToBackend(userId, slotId, true);
                enrollSuccessFeedback(); // rising tone + steady green
              } else {
                Serial.println("[FP] Enrollment FAILED");
                confirmEnrollToBackend(userId, slotId, false);
                enrollFailFeedback(); // long low tone + steady red
              }

              setLED(LED_SLOW_BLINK, LED_OFF); // back to idle
            }
          }

          // ── Clock IN / Auto-detect (GPIO 5) ───────────────────────
          if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
            String uid = buildUID(rfidIN);
            Serial.println("[IN] Scanned: " + uid);
            setLED(LED_FAST_BLINK, LED_OFF); // processing
            sendScanToBackend(uid, "auto_detect");
            rfidIN.PICC_HaltA();
            rfidIN.PCD_StopCrypto1();
            delay(1500);
            setLED(LED_SLOW_BLINK, LED_OFF); // back to idle
          }

          // ── Clock OUT (GPIO 26) ────────────────────────────────────
          if (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial()) {
            String uid = buildUID(rfidOUT);
            Serial.println("[OUT] Scanned: " + uid);
            setLED(LED_FAST_BLINK, LED_OFF); // processing
            sendScanToBackend(uid, "clock_out");
            rfidOUT.PICC_HaltA();
            rfidOUT.PCD_StopCrypto1();
            delay(1500);
            setLED(LED_SLOW_BLINK, LED_OFF); // back to idle
          }
        }
