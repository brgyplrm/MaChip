#include "Config.h"
#include "DisplayManager.h"
#include "HardwareDrivers.h"
#include "NetworkManager.h"
#include "BiometricSensor.h"
#include "RfidDriver.h"

// ── GLOBAL HARDWARE CONTROLLER INSTANTIATIONS ─────────────────────
MFRC522 rfidIN(SS_PIN_IN, RST_PIN_IN);
MFRC522 rfidOUT(SS_PIN_OUT, RST_PIN_OUT);
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WebServer webServer(80);

// ── GLOBAL APPLICATION STATE INSTANTIATIONS ───────────────────────
String currentServerUrl = "";
String currentFpUrl = "";

LedMode greenMode = LED_SLOW_BLINK;
LedMode redMode = LED_OFF;
unsigned long lastGreenToggle = 0;
unsigned long lastRedToggle = 0;
bool greenState = false;
bool redState = false;

bool solenoidActive = false;
unsigned long solenoidStartTime = 0;

bool enrollmentMode = false;
int fpEnrollStage = 0;
int enrollmentSlotId = 1;
String enrollmentUserId = "";
String enrollmentType = "FP";
unsigned long fpEnrollStart = 0;

String pendingUID = "";
String pendingName = "";
int last2FACountdownSec = -1;
unsigned long pendingStart = 0;
int pendingExpectedFingerID = -1;
int pendingExpectedFingerID2 = -1;
uint32_t pendingCardCounter = 0;

BackendQueue queuedTransaction = {"", "", "", 0, false};
bool webServerStarted = false;
bool otaInitialized = false;
bool isFrontDisplayInReady = false;

String webLogBuffer[LOG_MAX_ENTRIES];
int logHead = 0;
int logCount = 0;

// ── INITIALIZATION ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("=========================================================="));
  Serial.println(F(" [MACHIP] CTPAT ATTENDANCE ARCHITECTURE"));
  Serial.println(" [+] Version:   " + String(FIRMWARE_VERSION));
  Serial.println(" [+] Compiled:  " + String(BUILD_TIMESTAMP));
  Serial.println(F(" [*] Security:  Sector 1 MACJ Key A | Rolling Code Anti-Replay"));
  Serial.println(F("=========================================================="));
  sysLog(F("[SYSTEM] MAChip Booting Architecture..."));
  sysLog(" [+] Version:  " + String(FIRMWARE_VERSION));
  sysLog(" [+] Compiled: " + String(BUILD_TIMESTAMP));
  
  // 1. Configure all Control, LED, Relay, and Chip-Select Pins
  pinMode(GREEN_LED, OUTPUT); 
  pinMode(RED_LED, OUTPUT);
  pinMode(SOLENOID_PIN, OUTPUT);
  pinMode(TFT_CS, OUTPUT);
  pinMode(SS_PIN_IN, OUTPUT);
  pinMode(SS_PIN_OUT, OUTPUT);
  pinMode(RST_PIN_IN, OUTPUT);
  pinMode(RST_PIN_OUT, OUTPUT);
  pinMode(TFT_RST, OUTPUT);

  // 2. Set Safe Default States (Lock energized/High, CS Unselected/High)
  digitalWrite(SOLENOID_PIN, HIGH);
  solenoidActive = false;
  clearSpiBusPins();

  // 3. Hardware Master SPI Bus Setup
  SPI.begin(TFT_SCK, -1, TFT_MOSI, -1);
  Wire.begin(21, 22);

  // 4. Reset & Initialize Front Display (ST7789 2.4" SPI 240x320)
  digitalWrite(TFT_RST, LOW);
  delay(50);
  digitalWrite(TFT_RST, HIGH);
  delay(100);

  clearSpiBusPins();
  digitalWrite(TFT_CS, LOW);
  tft.init(240, 320);
  tft.setRotation(3);
  tft.invertDisplay(TFT_INVERT_COLOR);
  digitalWrite(TFT_CS, HIGH);

  // 5. Init Back Display (0.96" OLED I2C)
  bool oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (oledOk) { 
    oled.setRotation(0); 
    oled.clearDisplay();
    oled.display();
  }

  // 6. Hardware Reset & Initialize Dual MFRC522 RFID Modules (4MHz Safe SPI Clock)
  digitalWrite(RST_PIN_IN, LOW);
  digitalWrite(RST_PIN_OUT, LOW);
  delay(50);
  digitalWrite(RST_PIN_IN, HIGH);
  digitalWrite(RST_PIN_OUT, HIGH);
  delay(50);

  clearSpiBusPins();
  SPI.setFrequency(4000000); // MFRC522 max reliable SPI clock is 4MHz
  
  rfidIN.PCD_Init();
  rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
  delay(20);
  byte vFront = rfidIN.PCD_ReadRegister(MFRC522::VersionReg);

  clearSpiBusPins();
  rfidOUT.PCD_Init();
  rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
  delay(20);
  byte vBack = rfidOUT.PCD_ReadRegister(MFRC522::VersionReg);
  clearSpiBusPins();

  // 7. Init R307 Optical Fingerprint Sensor (UART2)
  fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  bool fpOk = finger.verifyPassword();

  // 8. Visual & Audio Startup Feedback
  updateFrontDisplay("BOOTING", "Running Hardware Self-Test...", ST77XX_YELLOW);
  updateBackDisplay("BOOTING", "Checking sensors...");

  ledcAttach(BUZZER, BUZZER_FREQ, BUZZER_RES);
  provideFeedback(SYSTEM_READY);

  // 9. Wi-Fi & Web Console Initialization
  if (autoConnectWiFi()) {
    setupOTA();
    setupWebConsole();
  }
  setLED(LED_SLOW_BLINK, LED_OFF);

  // 10. Comprehensive Hardware Self-Test Report
  sysLog(F("=========================================================="));
  sysLog(F(" [*] MACHIP HARDWARE SELF-TEST DIAGNOSTICS"));
  sysLog("  +-- [OLED BACK]   " + String(oledOk ? "ONLINE (0x3C I2C)" : "FAILED/OFFLINE"));
  sysLog(F("  +-- [TFT FRONT]   INITIALIZED (ST7789 240x320 SPI CS:33)"));
  sysLog("  +-- [FP SENSOR]   " + String(fpOk ? "ONLINE (R307 UART2 RX:16 TX:17)" : "FAILED (Check RX:16 TX:17 5V GND)"));
  
  bool isFrontOk = (vFront == 0x91 || vFront == 0x92 || vFront == 0x82 || vFront == 0x88 || vFront == 0x90);
  if (isFrontOk) {
    sysLog("  +-- [RFID FRONT]  ONLINE (MFRC522 v0x" + String(vFront, HEX) + " CS:5 RST:32)");
  } else {
    sysLog("  +-- [RFID FRONT]  [ERROR] FAILED! (Reg: 0x" + String(vFront, HEX) + " - Check CS:5, SCK:18, MOSI:23, MISO:19, RST:32)");
  }

  bool isBackOk = (vBack == 0x91 || vBack == 0x92 || vBack == 0x82 || vBack == 0x88 || vBack == 0x90);
  if (isBackOk) {
    sysLog("  \\-- [RFID BACK]   ONLINE (MFRC522 v0x" + String(vBack, HEX) + " CS:26 RST:4)");
  } else {
    sysLog("  \\-- [RFID BACK]   [ERROR] FAILED! (Reg: 0x" + String(vBack, HEX) + " - Check CS:26, SCK:18, MOSI:23, MISO:19, RST:4)");
  }
  sysLog(F("=========================================================="));
  
  updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
  updateBackDisplay("READY", "Scan Card Out");
}

// ── MAIN RUNTIME LOOP ─────────────────────────────────────────────
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    ArduinoOTA.handle();
    webServer.handleClient();
  }

  updateLEDs();
  updateSolenoid();
  tickRfidPulseAnimation();

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiCheck = 0;
    if (millis() - lastWiFiCheck > 20000) {
      if (autoConnectWiFi()) {
        setupOTA();
        setupWebConsole();
      }
      lastWiFiCheck = millis();
    }
  }

  // Periodic Server Connection Heartbeat (Logged every 30 seconds to Web Console)
  static unsigned long lastServerHeartbeat = 0;
  if (WiFi.status() == WL_CONNECTED && millis() - lastServerHeartbeat > 30000) {
    lastServerHeartbeat = millis();
    HTTPClient checkHttp;
    checkHttp.begin(currentFpUrl + "/session");
    checkHttp.setTimeout(2500);
    signHttpRequest(checkHttp, "");
    unsigned long startMs = millis();
    int sCode = checkHttp.GET();
    unsigned long latency = millis() - startMs;
    checkHttp.end();

    if (sCode == 200) {
      sysLog("[NET-SERVER] Server Connection: ONLINE | Backend: " + currentServerUrl + " | Latency: " + String(latency) + "ms | Wi-Fi RSSI: " + String(WiFi.RSSI()) + " dBm");
    } else {
      sysLog("[NET-SERVER] [WARNING] Server Heartbeat: HTTP " + String(sCode) + " | URL: " + currentServerUrl);
    }
  }

  processQueuedTransaction();

  // ── BACKEND PROVISIONING POLL ────────────────────────────────────
  static unsigned long lastModalPoll = 0;
  if (!enrollmentMode && WiFi.status() == WL_CONNECTED && millis() - lastModalPoll > 1000) {
    lastModalPoll = millis();
    HTTPClient http;
    http.begin(currentFpUrl + "/session");
    signHttpRequest(http, "");
    int code = http.GET();
    
    if (code == 200) {
      JsonDocument doc;
      deserializeJson(doc, http.getString());
      
      if (doc["active"] | false) {
        String type = doc["type"] | "FP";

        if (type == "CLEAR_ALL") {
          sysLog("[FP-REMOVE] EXECUTING FULL R307 HARDWARE FACTORY RESET...");
          updateFrontDisplay("HARDWARE RESET", "Wiping sensor memory...", ST77XX_RED);
          
          bool wiped = (finger.emptyDatabase() == FINGERPRINT_OK);
          if (!wiped) {
            sysLog("[FP-REMOVE] emptyDatabase command failed. Executing slot-by-slot purge (1 to 162)...");
            for (int i = 1; i <= 162; i++) {
              finger.deleteModel(i);
            }
            wiped = true;
          }
          
          if (wiped) {
            sysLog("[FP-REMOVE] [SUCCESS] All physical R307 fingerprint slots (1-162) wiped clean!");
            updateFrontDisplay("SUCCESS", "Sensor memory wiped.", ST77XX_GREEN);
            provideFeedback(SUCCESS_OK);
          } else {
            sysLog("[FP-ERROR] Failed to clear sensor memory.");
            updateFrontDisplay("ERROR", "Failed to clear sensor.", ST77XX_RED);
            provideFeedback(ERROR_FAIL);
          }
          
          delay(2000);
          HTTPClient clearHttp;
          clearHttp.begin(currentFpUrl + "/session/clear");
          signHttpRequest(clearHttp, "");
          clearHttp.GET(); clearHttp.end();
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
        }
        else if (type == "VISITOR_OPEN") {
          sysLog(F("[VISITOR] REMOTE UNLOCK TRIGGERED"));
          updateFrontDisplay("VISITOR ACCESS", "Authorized Remote Open\nWelcome!", ST77XX_CYAN);
          updateBackDisplay("VISITOR", "Remote Authorized");
          
          provideFeedback(SUCCESS_OK);
          solenoidUnlock();
          
          // Wait for solenoid duration + small buffer
          delay(SOLENOID_DURATION + 500);
          
          // Notify backend that door is closed/completed
          HTTPClient confirmHttp;
          confirmHttp.begin(currentFpUrl + "/visitor-access/confirm");
          signHttpRequest(confirmHttp, "{}");
          confirmHttp.POST("{}"); 
          confirmHttp.end();

          // Clear session explicitly
          HTTPClient clearHttp;
          clearHttp.begin(currentFpUrl + "/session/clear");
          signHttpRequest(clearHttp, "");
          clearHttp.GET(); clearHttp.end();

          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
          updateBackDisplay("READY", "Scan Card Out");
        }
        else if (type == "DELETE_SLOT") {
          int targetSlot = doc["slotId"] | 0;
          if (targetSlot > 0) {
            sysLog("[FP] CANCELLED ENROLLMENT: PURGING SLOT " + String(targetSlot) + " FROM R307 SENSOR...");
            updateFrontDisplay("ROLLBACK", "Purging cancelled slot " + String(targetSlot), ST77XX_YELLOW);
            if (finger.deleteModel(targetSlot) == FINGERPRINT_OK) {
              sysLog("[FP] Slot " + String(targetSlot) + " successfully deleted from R307 memory.");
            } else {
              sysLog("[FP] Slot " + String(targetSlot) + " cleared or already empty.");
            }
          }
          delay(1000);
          HTTPClient clearHttp;
          clearHttp.begin(currentFpUrl + "/session/clear");
          signHttpRequest(clearHttp, "");
          clearHttp.GET(); clearHttp.end();
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
        }
        else {
          enrollmentMode = true;
          enrollmentUserId = doc["userId"].as<String>();
          enrollmentSlotId = doc["slotId"] | 1;
          enrollmentType = type;
          fpEnrollStage = 0; // Always force clean state machine restart
          fpEnrollStart = millis();
          
          provideFeedback(WAITING_SCAN);
          updateFrontDisplay("ENROLL ACTIVE", "ID: " + enrollmentUserId + " | Mode: " + enrollmentType, ST77XX_ORANGE);
          updateBackDisplay("LOCKED", "Admin Management");

          if (enrollmentType == "RFID") {
            clearSpiBusPins();
            SPI.setFrequency(4000000);
            rfidIN.PCD_Init();
            rfidIN.PCD_SetAntennaGain(rfidIN.RxGain_max);
            rfidOUT.PCD_Init();
            rfidOUT.PCD_SetAntennaGain(rfidOUT.RxGain_max);
            clearSpiBusPins();
          }
        }
      }
    }
    http.end();
  }

  // ── ENROLLMENT PIPELINE: RFID CAPTURE ────────────────────────────
  if (enrollmentMode && enrollmentType == "RFID") {
    // 1. Check for web app cancellation or mode switch during RFID enrollment
    static unsigned long lastRFIDCheck = 0;
    if (millis() - lastRFIDCheck > 1000) {
      lastRFIDCheck = millis();
      HTTPClient httpCheck;
      httpCheck.begin(currentFpUrl + "/session");
      httpCheck.setTimeout(1200);
      signHttpRequest(httpCheck, "");
      int cCode = httpCheck.GET();
      if (cCode == 200) {
        JsonDocument cDoc;
        deserializeJson(cDoc, httpCheck.getString());
        bool active = cDoc["active"] | false;
        String cType = cDoc["type"] | "";
        if (!active || cType != "RFID") {
          sysLog("[RFID-CANCEL] Session cancelled or switched by web application (Type: " + cType + ", Active: " + String(active) + ")");
          enrollmentMode = false;
          setLED(LED_SLOW_BLINK, LED_OFF);
          updateFrontDisplay("CANCELLED", "Enrollment Aborted", ST77XX_YELLOW);
          delay(1000);
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
          updateBackDisplay("READY", "Scan Card Out");
          httpCheck.end();
          return;
        }
      }
      httpCheck.end();
    }

    // 2. Timeout protection: 30 seconds
    if (millis() - fpEnrollStart > 30000) {
      sysLog(F("[RFID-TIMEOUT] RFID enrollment timed out after 30s."));
      enrollmentMode = false;
      provideFeedback(ERROR_FAIL);
      updateFrontDisplay("TIMEOUT", "RFID Scan Timed Out", ST77XX_RED);
      delay(1500);
      setLED(LED_SLOW_BLINK, LED_OFF);
      updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      updateBackDisplay("READY", "Scan Card Out");
      return;
    }

    // 3. Check BOTH Front (rfidIN) and Back (rfidOUT) readers
    clearSpiBusPins();
    bool cardOnFront = rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial();
    clearSpiBusPins();
    bool cardOnBack = !cardOnFront && (rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial());
    clearSpiBusPins();

    if (cardOnFront || cardOnBack) {
      MFRC522 &activeReader = cardOnFront ? rfidIN : rfidOUT;
      String cardUid = getUIDString(activeReader);
      uint32_t initCounter = readAndIncrementCardCounter(activeReader);
      activeReader.PICC_HaltA(); activeReader.PCD_StopCrypto1();
      clearSpiBusPins();
      
      sysLog("[ENROLL-RFID] Card detected on " + String(cardOnFront ? "FRONT" : "BACK") + " reader: " + cardUid);
      if (initCounter > 0) {
        sysLog("[ENROLL-RFID] Card provisioned with Sector 1 key. Initial Counter: " + String(initCounter));
      } else {
        sysLog(F("[ENROLL-RFID] Card UID registered (Sector 1 not provisioned)."));
      }
      uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, cardUid);
      provideFeedback(SUCCESS_OK);
      updateFrontDisplay("SUCCESS", "RFID Credential Active", ST77XX_GREEN);
      
      enrollmentMode = false;
      delay(1000);
      HTTPClient clearHttp;
      clearHttp.begin(currentFpUrl + "/session/clear");
      signHttpRequest(clearHttp, "");
      clearHttp.GET(); clearHttp.end();
      setLED(LED_SLOW_BLINK, LED_OFF);
      updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      updateBackDisplay("READY", "Scan Card Out");
    }
  }

  // ── ENROLLMENT PIPELINE: FINGERPRINT ─────────────────────────────
  else if (enrollmentMode && enrollmentType == "FP") {
    // Check for web app cancellation during enrollment
    static unsigned long lastFPCheck = 0;
    if (millis() - lastFPCheck > 1000) {
      lastFPCheck = millis();
      HTTPClient httpCheck;
      httpCheck.begin(currentFpUrl + "/session");
      httpCheck.setTimeout(1200);
      signHttpRequest(httpCheck, "");
      int cCode = httpCheck.GET();
      if (cCode == 200) {
        JsonDocument cDoc;
        deserializeJson(cDoc, httpCheck.getString());
        bool active = cDoc["active"] | false;
        String cType = cDoc["type"] | "";
        if (!active || cType == "DELETE_SLOT") {
          sysLog("[FP-CANCEL] Session cancelled by web application. Aborting enrollment for Slot " + String(enrollmentSlotId));
          if (cType == "DELETE_SLOT" || !active) {
            int targetSlot = cDoc["slotId"] | enrollmentSlotId;
            if (targetSlot > 0) {
              if (finger.deleteModel(targetSlot) == FINGERPRINT_OK) {
                sysLog("[FP-REMOVE] Slot " + String(targetSlot) + " purged from R307 flash memory.");
              } else {
                sysLog("[FP-REMOVE] Slot " + String(targetSlot) + " was already empty.");
              }
            }
          }
          enrollmentMode = false;
          fpEnrollStage = 0;
          updateFrontDisplay("CANCELLED", "Enrollment Aborted", ST77XX_YELLOW);
          delay(1200);
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
          httpCheck.end();
          return;
        }
      }
      httpCheck.end();
    }

    if (fpEnrollStage == 0) {
      int p = finger.getImage();
      if (p == FINGERPRINT_NOFINGER) {
        sysLog("[FP-ADD] Session initialized for User: " + enrollmentUserId + " | Target Slot: " + String(enrollmentSlotId));
        updateFrontDisplay("ENROLL BIOMETRIC", "Press pad firmly with finger...", ST77XX_BLUE);
        fpEnrollStart = millis();
        fpEnrollStage = 1;
      } else {
        static unsigned long lastLiftWarn = 0;
        if (millis() - lastLiftWarn > 1500) {
          lastLiftWarn = millis();
          sysLog("[FP-STAGE-0] Finger resting on pad. Waiting for finger to be lifted...");
          updateFrontDisplay("RELEASE SENSOR", "Lift finger off pad first...", ST77XX_YELLOW);
        }
      }
    }
    
    if (fpEnrollStage == 1) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        p = finger.image2Tz(1);
        if (p == FINGERPRINT_OK) {
          sysLog("[FP-STAGE-1] Scan 1 captured into Buffer 1.");

          // --- DEDUPLICATION CHECK (IGNORE SAME SLOT RE-ENROLLMENT) ---
          p = finger.fingerFastSearch();
          if (p == FINGERPRINT_OK && finger.fingerID != enrollmentSlotId) {
            sysLog("[FP-ERROR] DUPLICATE DETECTED: Finger matches existing Slot " + String(finger.fingerID));
            updateFrontDisplay("DUPLICATE", "Finger already enrolled!\nAbort and Check Admin", ST77XX_RED);
            provideFeedback(ERROR_FAIL);
            uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "DUPLICATE:" + String(finger.fingerID));
            enrollmentMode = false; fpEnrollStage = 0;
            delay(3000);
            setLED(LED_SLOW_BLINK, LED_OFF);
            updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
            return;
          }
          // --- END CHECK ---
          
          sysLog("[FP-STAGE-1] [SUCCESS] Scan 1 valid. Promitted: Release finger from sensor...");
          updateFrontDisplay("ENROLL BIOMETRIC", "First Scan OK! Release sensor...", ST77XX_YELLOW);
          beep(100);
          fpEnrollStart = millis();
          fpEnrollStage = 2;
        }
      }
      
      if (millis() - fpEnrollStart > 30000) {
        sysLog("[FP-ERROR] Stage 1 timeout (30s). Aborting enrollment.");
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false; fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
        updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      }
    }
    
    else if (fpEnrollStage == 2) {
      // Require finger to be lifted off sensor before proceeding to Scan 2
      int p = finger.getImage();
      if (p == FINGERPRINT_NOFINGER || (millis() - fpEnrollStart > 1000 && p != FINGERPRINT_OK)) {
        sysLog("[FP-STAGE-2] [SUCCESS] Finger released from sensor pad. Advancing to Scan 2.");
        updateFrontDisplay("ENROLL BIOMETRIC", "Verify: Press same finger again...", ST77XX_BLUE);
        beep(80);
        fpEnrollStart = millis();
        fpEnrollStage = 3;
      } else if (millis() - fpEnrollStart > 10000) {
        sysLog("[FP-ERROR] Stage 2 timeout waiting for finger release. Aborting.");
        uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
        provideFeedback(ERROR_FAIL);
        enrollmentMode = false; fpEnrollStage = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
        updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      }
    }
    
    else if (fpEnrollStage == 3) {
      int p = finger.getImage();
      if (p == FINGERPRINT_OK) {
        p = finger.image2Tz(2);
        if (p == FINGERPRINT_OK) {
          sysLog("[FP-STAGE-3] Scan 2 captured into Buffer 2.");
          if (finger.createModel() == FINGERPRINT_OK) {
            sysLog("[FP-STAGE-3] [SUCCESS] Scan 1 & Scan 2 templates MATCHED!");
            if (finger.storeModel(enrollmentSlotId) == FINGERPRINT_OK) {
              String templateHex = downloadTemplate();
              sysLog("[FP-SUCCESS] Slot " + String(enrollmentSlotId) + " written to R307 flash memory & uploaded.");
              uploadEnrollment(enrollmentSlotId, true, enrollmentUserId, templateHex);
              provideFeedback(SUCCESS_OK);
              updateFrontDisplay("SUCCESS", "Biometric Slot " + String(enrollmentSlotId) + " Saved", ST77XX_GREEN);
            } else {
              sysLog("[FP-ERROR] Failed to store model into Slot " + String(enrollmentSlotId));
              uploadEnrollment(enrollmentSlotId, false, enrollmentUserId, "");
              provideFeedback(ERROR_FAIL);
            }
          } else {
            sysLog("[FP-ERROR] Templates DO NOT MATCH! Scan 1 != Scan 2");
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
        sysLog("[FP-ERROR] Stage 3 timeout (30s). Aborting enrollment.");
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
    if (millis() - lastReaderInit > 10000) {
      clearSpiBusPins();
      rfidIN.PCD_Init();
      rfidOUT.PCD_Init();
      clearSpiBusPins();
      lastReaderInit = millis();
    }

    // ── FRONT INTERFACE: CLOCK-IN 2FA PIPELINE ─────────────────────
    clearSpiBusPins();
    bool checkInScan = rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial();
    
    if (checkInScan) {
      provideFeedback(RFID_TAP);
      String currentUID = getUIDString(rfidIN);
      uint32_t cardCounter = readAndIncrementCardCounter(rfidIN);
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      clearSpiBusPins();

      sysLog("[FRONT READ] Card scanned: " + currentUID + (cardCounter > 0 ? " [Ctr: " + String(cardCounter) + "]" : ""));

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(currentServerUrl);
        http.setTimeout(4000);
        http.addHeader("Content-Type", "application/json");
        
        JsonDocument doc;
        doc["uid"] = currentUID;
        doc["action"] = "clock_in";
        doc["terminalType"] = "FRONT";
        if (cardCounter > 0) {
          doc["cardCounter"] = cardCounter;
        }
        
        String payload;
        serializeJson(doc, payload);
        signHttpRequest(http, payload);
        int httpCode = http.POST(payload);
        
        if (httpCode == 200) {
          JsonDocument resDoc;
          deserializeJson(resDoc, http.getString());
          if (resDoc["success"] | false) {
            if (resDoc["mode"] == "WAITING_FOR_FINGERPRINT_2FA") {
              sysLog("[2FA] Challenge triggered for Card " + currentUID);
              pendingName = resDoc["employeeName"] | resDoc["name"] | resDoc["userName"] | "Employee";
              pendingUID = currentUID;
              pendingCardCounter = cardCounter;
              pendingExpectedFingerID = resDoc["expectedFingerId"] | -1;
              pendingExpectedFingerID2 = resDoc["expectedFingerId2"] | -1;
              pendingStart = millis();
              last2FACountdownSec = TIMEOUT_2FA / 1000;
              draw2FAChallengeUI(pendingName, last2FACountdownSec);
              provideFeedback(WAITING_SCAN);
            } else {
              String name = resDoc["employeeName"] | resDoc["name"] | "Employee";
              sysLog("[ACCESS APPROVED] Clocked in: " + name + " (" + currentUID + ")");
              updateFrontDisplay("VERIFIED", name + "\nAttendance Clocked In", ST77XX_GREEN);
              provideFeedback(SUCCESS_OK);
              solenoidUnlock();
            }
          } else {
            String errMsg = resDoc["message"] | "Access Rejected";
            String name = resDoc["employeeName"] | resDoc["name"] | "";
            String modeStr = resDoc["mode"] | "";

            sysLog("[ACCESS DENIED] Card " + currentUID + ": " + errMsg);

            if (modeStr == "CARD_LOCKED") {
              updateFrontDisplay("LOCKED OUT", "Excessive 2FA Fails\nCard Locked 5 Mins", ST77XX_RED);
              provideFeedback(ERROR_FAIL);
            } else if (modeStr == "REPLAY_ATTACK") {
              updateFrontDisplay("SECURITY FAULT", "Replay/Clone Card\nAccess Blocked!", ST77XX_RED);
              provideFeedback(ERROR_FAIL);
            } else if (modeStr == "FINGERPRINT_REQUIRED" || errMsg.indexOf("Fingerprint") >= 0) {
              updateFrontDisplay("DENIED", (name != "" ? name + "\n" : "") + "Fingerprint Required!", ST77XX_RED);
              provideFeedback(ERROR_FAIL); // Error Beep, solenoid remains LOCKED
            } else if (modeStr == "ALREADY_INSIDE" || errMsg.indexOf("inside") >= 0 || errMsg.indexOf("Inside") >= 0 || errMsg.indexOf("Already") >= 0) {
              updateFrontDisplay("ACCESS DENIED", (name != "" ? name + "\n" : "") + "Already Inside!", ST77XX_RED);
              provideFeedback(ERROR_FAIL); // Error Beep, solenoid remains LOCKED
            } else {
              updateFrontDisplay("DENIED", errMsg, ST77XX_RED);
              provideFeedback(ERROR_FAIL); // Error Beep, solenoid remains LOCKED
            }
          }
        } else {
          sysLog("[HTTP ERROR] Backend connection failed, Code: " + String(httpCode));
          updateFrontDisplay("BUS ERROR", "Database Connection Lost", ST77XX_RED);
          provideFeedback(ERROR_FAIL);
        }
        http.end();
      } else {
        sysLog("[NET ERROR] WiFi disconnected during scan.");
        updateFrontDisplay("OFFLINE", "Network Pipeline Down", ST77XX_RED);
        provideFeedback(ERROR_FAIL);
      }
    }
    digitalWrite(SS_PIN_IN, HIGH);

    // ── FRONT INTERFACE: BIOMETRIC MATCH EVALUATION ────────────────
    if (pendingUID != "") {
      unsigned long elapsed = millis() - pendingStart;
      if (elapsed < TIMEOUT_2FA) {
        int secondsLeft = (TIMEOUT_2FA - elapsed + 999) / 1000;
        if (secondsLeft != last2FACountdownSec) {
          last2FACountdownSec = secondsLeft;
          update2FACountdown(secondsLeft);
        }

        int p = finger.getImage();
        if (p == FINGERPRINT_OK) {
          if (finger.image2Tz(1) == FINGERPRINT_OK) {
            if (finger.fingerFastSearch() == FINGERPRINT_OK) {
              bool matchPrimary = (pendingExpectedFingerID != -1 && finger.fingerID == pendingExpectedFingerID);
              bool matchFallback = (pendingExpectedFingerID2 != -1 && finger.fingerID == pendingExpectedFingerID2);
              bool hasExpectation = (pendingExpectedFingerID != -1 || pendingExpectedFingerID2 != -1);

              if (hasExpectation && !matchPrimary && !matchFallback) {
                updateFrontDisplay("SECURITY FAULT", "Token ID Mismatch\nEvent Dispatched!", ST77XX_RED);
                provideFeedback(ERROR_FAIL);
                queueTransaction(pendingUID + "|" + String(finger.fingerID), "suspicious_biometric_fail", "FRONT");
                pendingUID = ""; pendingName = ""; last2FACountdownSec = -1;
                pendingExpectedFingerID = -1; pendingExpectedFingerID2 = -1; pendingCardCounter = 0;
                setLED(LED_SLOW_BLINK, LED_OFF);
              } else {
                updateFrontDisplay("VERIFIED", (pendingName != "" ? pendingName + "\n" : "") + "Door Released", ST77XX_GREEN);
                provideFeedback(SUCCESS_OK);
                solenoidUnlock();
                queueTransaction(pendingUID + "|" + String(finger.fingerID), "clock_in", "FRONT", pendingCardCounter);
                pendingUID = ""; pendingName = ""; last2FACountdownSec = -1;
                pendingExpectedFingerID = -1; pendingExpectedFingerID2 = -1; pendingCardCounter = 0;
                setLED(LED_SLOW_BLINK, LED_OFF);
              }
            } else {
              updateFrontDisplay("ACCESS FORBIDDEN", "Biometric Unknown", ST77XX_RED);
              provideFeedback(ERROR_FAIL);
              queueTransaction(pendingUID, "suspicious_biometric_fail", "FRONT");
              pendingUID = ""; pendingName = ""; last2FACountdownSec = -1;
              pendingExpectedFingerID = -1; pendingExpectedFingerID2 = -1; pendingCardCounter = 0;
              setLED(LED_SLOW_BLINK, LED_OFF);
            }
          }
        }
      } else {
        updateFrontDisplay("TIMEOUT", "2FA Verification Timeout", ST77XX_RED);
        provideFeedback(ERROR_FAIL);
        queueTransaction(pendingUID, "unenrolled_card_attempt", "FRONT");
        pendingUID = ""; pendingName = ""; last2FACountdownSec = -1;
        pendingExpectedFingerID = -1; pendingExpectedFingerID2 = -1; pendingCardCounter = 0;
        setLED(LED_SLOW_BLINK, LED_OFF);
      }
    }

    // ── BACK INTERFACE: CLOCK-OUT MODULE (RFID ONLY) ────────────────
    clearSpiBusPins();
    bool checkOutScan = rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial();
    
    if (checkOutScan) {
      provideFeedback(RFID_TAP);
      String outUID = getUIDString(rfidOUT);
      uint32_t cardCounter = readAndIncrementCardCounter(rfidOUT);
      rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
      clearSpiBusPins();

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(currentServerUrl);
        http.setTimeout(4000);
        http.addHeader("Content-Type", "application/json");
        
        JsonDocument doc;
        doc["uid"] = outUID;
        doc["action"] = "clock_out";
        doc["terminalType"] = "BACK";
        if (cardCounter > 0) {
          doc["cardCounter"] = cardCounter;
        }

        String payload;
        serializeJson(doc, payload);
        signHttpRequest(http, payload);
        int httpCode = http.POST(payload);
        
        if (httpCode == 200) {
          JsonDocument resDoc;
          deserializeJson(resDoc, http.getString());
          bool isSuccess = resDoc["success"] | false;
          http.end(); // End session immediately before power dip

          if (isSuccess) {
            updateBackDisplay("APPROVED", "Goodbye!");
            provideFeedback(SUCCESS_OK);
            delay(100); // Allow display update before solenoid draw
            solenoidUnlock();
          } else {
            String errMsg = resDoc["message"] | "Rejected";
            String modeStr = resDoc["mode"] | "";
            if (modeStr == "REPLAY_ATTACK") {
              updateBackDisplay("SECURITY", "Replay Blocked");
            } else if (errMsg.indexOf("outside") >= 0 || errMsg.indexOf("Outside") >= 0) {
              updateBackDisplay("DENIED", "Already Outside");
            } else {
              updateBackDisplay("DENIED", errMsg);
            }
            provideFeedback(ERROR_FAIL);
          }
        } else {
          updateBackDisplay("NET ERROR", "Code: " + String(httpCode));
          provideFeedback(ERROR_FAIL);
          http.end();
        }
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