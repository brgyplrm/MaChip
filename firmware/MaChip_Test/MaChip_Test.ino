#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <WebServer.h>
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
  { String(WIFI_SSID_3), String(WIFI_PASS_3), String(SERVER_URL_3), String(FP_ENROLL_3) },
  { String(WIFI_SSID_4), String(WIFI_PASS_4), String(SERVER_URL_4), String(FP_ENROLL_4) },
  { String(WIFI_SSID_6), String(WIFI_PASS_6), String(SERVER_URL_6), String(FP_ENROLL_6) }
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
int fpEnrollStage = 0;
unsigned long fpEnrollStart = 0;

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

// ── SECURED WEB SERIAL CONSOLE ─────────────────────────────────────
#ifndef WEB_CONSOLE_USER
#define WEB_CONSOLE_USER "admin"
#endif
#ifndef WEB_CONSOLE_PASS
#define WEB_CONSOLE_PASS "machip2026"
#endif

WebServer webServer(80);
static bool webServerStarted = false;

const int LOG_MAX_ENTRIES = 60;
String webLogBuffer[LOG_MAX_ENTRIES];
int logHead = 0;
int logCount = 0;

void sysLog(const String &msg) {
  Serial.println(msg);
  
  unsigned long ms = millis();
  unsigned long sec = ms / 1000;
  unsigned long min = (sec / 60) % 60;
  unsigned long hr = (sec / 3600) % 24;
  sec = sec % 60;
  
  char timeStr[16];
  snprintf(timeStr, sizeof(timeStr), "[%02lu:%02lu:%02lu] ", hr, min, sec);
  
  webLogBuffer[logHead] = String(timeStr) + msg;
  logHead = (logHead + 1) % LOG_MAX_ENTRIES;
  if (logCount < LOG_MAX_ENTRIES) logCount++;
}

const char CONSOLE_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAChip Hardware Console</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; }
    body { background-color: #0f172a; color: #e2e8f0; display: flex; flex-direction: column; height: 100vh; padding: 16px; }
    .header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #334155; }
    .title { font-size: 1.1rem; font-weight: 700; color: #f97316; display: flex; align-items: center; gap: 8px; }
    .status-badge { background: #166534; color: #4ade80; font-size: 0.8rem; padding: 4px 10px; border-radius: 9999px; font-weight: 600; }
    .toolbar { display: flex; gap: 12px; align-items: center; }
    button { background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.85; }
    .label-check { font-size: 0.85rem; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .console-box { flex: 1; background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 14px; overflow-y: auto; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.9rem; line-height: 1.5; color: #22c55e; white-space: pre-wrap; word-break: break-all; }
    .log-line { border-bottom: 1px solid #0f172a; padding: 2px 0; }
    .log-err { color: #f87171; }
    .log-warn { color: #fbbf24; }
    .log-info { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">⚡ MAChip ESP32 Live Terminal</div>
    <div class="toolbar">
      <span class="status-badge" id="status">● ESP32 ONLINE</span>
      <span class="status-badge" id="server-status" style="background:#1e3a8a; color:#93c5fd;">● SERVER: CONNECTED</span>
      <label class="label-check"><input type="checkbox" id="autoscroll" checked> Auto-Scroll</label>
      <button onclick="clearLogs()">Clear Logs</button>
    </div>
  </div>
  <div class="console-box" id="console">Loading live logs...</div>
  <script>
    const consoleBox = document.getElementById('console');
    const autoScrollCheck = document.getElementById('autoscroll');
    
    async function fetchLogs() {
      try {
        const res = await fetch('/console/logs');
        if (res.status === 401) { location.reload(); return; }
        const logs = await res.json();
        if (logs.length === 0) {
          consoleBox.innerHTML = '<div class="log-line" style="color:#64748b;">No logs recorded yet.</div>';
          return;
        }
        let html = '';
        logs.forEach(msg => {
          let cls = '';
          if (msg.includes('FAILED') || msg.includes('Fail') || msg.includes('Error') || msg.includes('ERROR')) cls = 'log-err';
          else if (msg.includes('WARN') || msg.includes('WARNING') || msg.includes('OTA UPDATE')) cls = 'log-warn';
          else if (msg.includes('[WIFI]') || msg.includes('[SYSTEM]') || msg.includes('CONNECTED') || msg.includes('[OTA]') || msg.includes('[NET')) cls = 'log-info';
          html += `<div class="log-line ${cls}">${escapeHtml(msg)}</div>`;

          if (msg.includes('[NET-SERVER]') && msg.includes('ONLINE')) {
            const sBadge = document.getElementById('server-status');
            if (sBadge) {
              sBadge.innerText = '● SERVER: ONLINE';
              sBadge.style.background = '#166534'; sBadge.style.color = '#4ade80';
            }
          } else if (msg.includes('[NET-SERVER]') && msg.includes('WARNING')) {
            const sBadge = document.getElementById('server-status');
            if (sBadge) {
              sBadge.innerText = '● SERVER: WARN';
              sBadge.style.background = '#854d0e'; sBadge.style.color = '#fef08a';
            }
          }
        });
        consoleBox.innerHTML = html;
        if (autoScrollCheck.checked) consoleBox.scrollTop = consoleBox.scrollHeight;
      } catch (err) {
        const st = document.getElementById('status');
        if (st) {
          st.innerText = '● DISCONNECTED';
          st.style.background = '#991b1b';
          st.style.color = '#fca5a5';
        }
      }
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    async function clearLogs() {
      await fetch('/console/clear', { method: 'POST' });
      fetchLogs();
    }

    setInterval(fetchLogs, 1500);
    fetchLogs();
  </script>
</body>
</html>
)rawliteral";

void handleConsoleUI() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  webServer.send(200, "text/html", CONSOLE_HTML);
}

void handleConsoleLogs() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();

  int start = (logCount < LOG_MAX_ENTRIES) ? 0 : logHead;
  for (int i = 0; i < logCount; i++) {
    int index = (start + i) % LOG_MAX_ENTRIES;
    array.add(webLogBuffer[index]);
  }

  String response;
  serializeJson(doc, response);
  webServer.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  webServer.sendHeader("Pragma", "no-cache");
  webServer.sendHeader("Expires", "0");
  webServer.send(200, "application/json", response);
}

void handleConsoleClear() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  logHead = 0;
  logCount = 0;
  webServer.send(200, "application/json", "{\"success\":true}");
}

void setupWebConsole() {
  if (webServerStarted) return;

  webServer.on("/", HTTP_GET, handleConsoleUI);
  webServer.on("/console", HTTP_GET, handleConsoleUI);
  webServer.on("/console/logs", HTTP_GET, handleConsoleLogs);
  webServer.on("/console/clear", HTTP_POST, handleConsoleClear);

  webServer.begin();
  webServerStarted = true;

  sysLog(F("=========================================================="));
  sysLog(F(" 🌐 MACHIP SECURED WEB SERIAL CONSOLE INITIALIZED"));
  sysLog(" └─ URL:      http://" + WiFi.localIP().toString() + "/console");
  sysLog(F(" └─ mDNS:     http://machip-esp32.local/console"));
  sysLog(" └─ Username: " + String(WEB_CONSOLE_USER));
  sysLog(" └─ Password: " + String(WEB_CONSOLE_PASS));
  sysLog(F("=========================================================="));
}

// ── FAST WIFI CONNECTION ENGINE (SCAN & MATCH) ───────────────────
bool autoConnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  
  sysLog(F("[WIFI] Scanning for nearby configured networks..."));
  updateFrontDisplay("NET CONFIG", "Scanning Wi-Fi...", ST77XX_YELLOW);
  updateBackDisplay("WIFI LINK", "Scanning...");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Max power / zero sleep latency for fastest link
  
  // Fast asynchronous scan (takes ~500ms)
  int n = WiFi.scanNetworks(false, false, false, 150);
  sysLog("[WIFI] Scan complete. Found " + String(n) + " access points.");

  // 1. Primary Priority: Match scanned networks against our configured profiles
  for (int j = 0; j < n; j++) {
    String scannedSSID = WiFi.SSID(j);
    int scannedRSSI = WiFi.RSSI(j);

    for (int i = 0; i < NETWORK_COUNT; i++) {
      if (networks[i].ssid == "") continue;
      
      if (scannedSSID == networks[i].ssid) {
        sysLog("[WIFI] Visible AP detected: [" + networks[i].ssid + "] (" + String(scannedRSSI) + " dBm). Connecting...");
        updateFrontDisplay("WIFI CONNECT", "Joining " + networks[i].ssid, ST77XX_YELLOW);
        
        WiFi.begin(networks[i].ssid.c_str(), networks[i].pass.c_str());
        
        int tries = 0;
        while (WiFi.status() != WL_CONNECTED && tries < 20) { // 20 * 200ms = 4s max
          updateLEDs();
          delay(200);
          tries++;
        }

        if (WiFi.status() == WL_CONNECTED) {
          currentServerUrl = networks[i].serverUrl;
          currentFpUrl = networks[i].fpEnrollUrl;
          WiFi.scanDelete(); // Free scan memory
          
          sysLog("[WIFI] [CONNECTED] Linked to [" + networks[i].ssid + "] in " + String(tries * 200) + "ms!");
          sysLog("[WIFI] ESP32 Local IP: " + WiFi.localIP().toString());
          sysLog("[NET] Target Backend Server: " + currentServerUrl);
          
          // Immediate Server Health Verification
          HTTPClient testHttp;
          testHttp.begin(currentFpUrl + "/session");
          testHttp.setTimeout(3000);
          testHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
          int testCode = testHttp.GET();
          if (testCode == 200) {
            sysLog("[NET-SERVER] [SUCCESS] Node.js Backend Server is ONLINE & Connected!");
          } else {
            sysLog("[NET-SERVER] [WARNING] Wi-Fi linked, but Server returned HTTP " + String(testCode));
          }
          testHttp.end();

          updateFrontDisplay("ONLINE", "IP: " + WiFi.localIP().toString(), ST77XX_GREEN);
          updateBackDisplay("ONLINE", WiFi.localIP().toString());
          return true;
        }
      }
    }
  }

  // 2. Direct fallback (in case SSID is hidden or missed in first scan pass)
  sysLog(F("[WIFI] Running direct fallback connection..."));
  for (int i = 0; i < NETWORK_COUNT; i++) {
    if (networks[i].ssid == "") continue;
    
    WiFi.begin(networks[i].ssid.c_str(), networks[i].pass.c_str());
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 10) { // 2s timeout
      updateLEDs(); delay(200); tries++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      currentServerUrl = networks[i].serverUrl;
      currentFpUrl = networks[i].fpEnrollUrl;
      sysLog("[WIFI] [CONNECTED] Fallback linked to [" + networks[i].ssid + "]");
      updateFrontDisplay("ONLINE", "IP: " + WiFi.localIP().toString(), ST77XX_GREEN);
      updateBackDisplay("ONLINE", WiFi.localIP().toString());
      return true;
    }
  }

  sysLog(F("[WIFI] All network connection attempts failed. Entering offline mode."));
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

// ── ARDUINO OTA INITIALIZATION ─────────────────────────────────────
static bool otaInitialized = false;

void setupOTA() {
  if (otaInitialized) return;

  // Set Hostname for local mDNS resolution (machip-esp32.local)
  ArduinoOTA.setHostname("machip-esp32");

  // Optional: Password protection for network updates
  // ArduinoOTA.setPassword("machip2026");

  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_SPIFFS / U_LITTLEFS
      type = "filesystem";
    }
    Serial.println("[OTA] Firmware update started: " + type);
    updateFrontDisplay("OTA UPDATE", "Flashing new firmware...", ST77XX_YELLOW);
    updateBackDisplay("OTA UPDATE", "Do not power off!");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\n[OTA] Firmware update complete!");
    updateFrontDisplay("OTA COMPLETE", "Rebooting system...", ST77XX_GREEN);
    updateBackDisplay("OTA COMPLETE", "Rebooting...");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    int pct = (progress / (total / 100));
    Serial.printf("[OTA] Progress: %u%%\r", pct);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
    updateFrontDisplay("OTA ERROR", "Update Failed!", ST77XX_RED);
    updateBackDisplay("OTA ERROR", "Update Failed");
  });

  ArduinoOTA.begin();
  otaInitialized = true;
  Serial.println(F("[OTA] ArduinoOTA service initialized and listening on LAN"));
}

// ── INITIALIZATION ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n\n[SYSTEM] MAChip Booting Architecture..."));
  
  // 1. Configure all Control, LED, Relay, and Chip-Select Pins
  pinMode(GREEN_LED, OUTPUT); 
  pinMode(RED_LED, OUTPUT);
  pinMode(SOLENOID_PIN, OUTPUT);
  
  pinMode(TFT_CS, OUTPUT);
  pinMode(TFT_DC, OUTPUT);
  pinMode(TFT_RST, OUTPUT);
  
  pinMode(SS_PIN_IN, OUTPUT);
  pinMode(RST_PIN_IN, OUTPUT);
  pinMode(SS_PIN_OUT, OUTPUT);
  pinMode(RST_PIN_OUT, OUTPUT);

  // 2. Enforce clean locked/deselected states to prevent SPI bus contention
  digitalWrite(TFT_CS, HIGH);
  digitalWrite(TFT_RST, HIGH);
  digitalWrite(SS_PIN_IN, HIGH);
  digitalWrite(RST_PIN_IN, HIGH);
  digitalWrite(SS_PIN_OUT, HIGH);
  digitalWrite(RST_PIN_OUT, HIGH);
  digitalWrite(SOLENOID_PIN, HIGH);
  solenoidActive = false;

  // 3. Initialize Shared SPI Bus FIRST
  SPI.begin();
  delay(50);

  // 4. Hardware Reset & Initialize Front Display (2.4" TFT ST7789 SPI)
  digitalWrite(TFT_RST, LOW);
  delay(50);
  digitalWrite(TFT_RST, HIGH);
  delay(100);

  clearSpiBusPins();
  digitalWrite(TFT_CS, LOW);
  tft.init(240, 320);
  tft.setRotation(3);
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
  sysLog(F(" 🔍 MACHIP HARDWARE SELF-TEST DIAGNOSTICS"));
  sysLog(" ├─ [OLED BACK]   " + String(oledOk ? "ONLINE (0x3C I2C)" : "FAILED/OFFLINE"));
  sysLog(F(" ├─ [TFT FRONT]   INITIALIZED (ST7789 240x320 SPI CS:33)"));
  sysLog(" ├─ [FP SENSOR]   " + String(fpOk ? "ONLINE (R307 UART2 RX:16 TX:17)" : "FAILED (Check RX:16 TX:17 5V GND)"));
  
  if (vFront == 0x91 || vFront == 0x92) {
    sysLog(" ├─ [RFID FRONT]  ONLINE (MFRC522 v0x" + String(vFront, HEX) + " CS:5 RST:32)");
  } else {
    sysLog(" ├─ [RFID FRONT]  [ERROR] FAILED! (Reg: 0x" + String(vFront, HEX) + " - Check CS:5, SCK:18, MOSI:23, MISO:19, RST:32)");
  }

  if (vBack == 0x91 || vBack == 0x92) {
    sysLog(" └─ [RFID BACK]   ONLINE (MFRC522 v0x" + String(vBack, HEX) + " CS:26 RST:4)");
  } else {
    sysLog(" └─ [RFID BACK]   [ERROR] FAILED! (Reg: 0x" + String(vBack, HEX) + " - Check CS:26, SCK:18, MOSI:23, MISO:19, RST:4)");
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
    checkHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
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
    http.addHeader("x-esp32-key", String(ESP32_API_KEY));
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
          clearHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
          clearHttp.GET(); clearHttp.end();
          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
        }
        else if (type == "VISITOR_OPEN") {
          Serial.println(F("[VISITOR] REMOTE UNLOCK TRIGGERED"));
          updateFrontDisplay("VISITOR ACCESS", "Authorized Remote Open\nWelcome!", ST77XX_CYAN);
          updateBackDisplay("VISITOR", "Remote Authorized");
          
          provideFeedback(SUCCESS_OK);
          solenoidUnlock();
          
          // Wait for solenoid duration + small buffer
          delay(SOLENOID_DURATION + 500);
          
          // Notify backend that door is closed/completed
          HTTPClient confirmHttp;
          confirmHttp.begin(currentFpUrl + "/visitor-access/confirm");
          confirmHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
          confirmHttp.POST("{}"); 
          confirmHttp.end();

          // Clear session explicitly
          HTTPClient clearHttp;
          clearHttp.begin(currentFpUrl + "/session/clear");
          clearHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
          clearHttp.GET(); clearHttp.end();

          updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
          updateBackDisplay("READY", "Scan Card Out");
        }
        else if (type == "DELETE_SLOT") {
          int targetSlot = doc["slotId"] | 0;
          if (targetSlot > 0) {
            Serial.printf("[FP] CANCELLED ENROLLMENT: PURGING SLOT %d FROM R307 SENSOR...\n", targetSlot);
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
          clearHttp.addHeader("x-esp32-key", String(ESP32_API_KEY));
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
        }
      }
    }
    http.end();
  }

  // ── ENROLLMENT PIPELINE: RFID CAPTURE ────────────────────────────
  if (enrollmentMode && enrollmentType == "RFID") {
    clearSpiBusPins();
    if (rfidIN.PICC_IsNewCardPresent() && rfidIN.PICC_ReadCardSerial()) {
      String cardUid = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        cardUid += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      cardUid.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      clearSpiBusPins();
      
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
  }

  // ── ENROLLMENT PIPELINE: FINGERPRINT ─────────────────────────────
  else if (enrollmentMode && enrollmentType == "FP") {
    // Check for web app cancellation during enrollment
    static unsigned long lastFPCheck = 0;
    if (millis() - lastFPCheck > 2000) {
      lastFPCheck = millis();
      HTTPClient httpCheck;
      httpCheck.begin(currentFpUrl + "/session");
      httpCheck.addHeader("x-esp32-key", String(ESP32_API_KEY));
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
      String currentUID = "";
      for (byte i = 0; i < rfidIN.uid.size; i++) {
        currentUID += (rfidIN.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidIN.uid.uidByte[i], HEX);
      }
      currentUID.toUpperCase();
      rfidIN.PICC_HaltA(); rfidIN.PCD_StopCrypto1();
      clearSpiBusPins();

      sysLog("[FRONT READ] Card scanned: " + currentUID);

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
              sysLog("[2FA] Challenge triggered for Card " + currentUID);
              updateFrontDisplay("2FA CHALLENGE", "Scan biometric token now...", ST77XX_CYAN);
              provideFeedback(WAITING_SCAN);
              pendingUID = currentUID;
              pendingExpectedFingerID = resDoc["expectedFingerId"] | -1;
              pendingStart = millis();
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

            if (modeStr == "FINGERPRINT_REQUIRED" || errMsg.indexOf("Fingerprint") >= 0) {
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
    bool checkOutScan = rfidOUT.PICC_IsNewCardPresent() && rfidOUT.PICC_ReadCardSerial();
    
    if (checkOutScan) {
      provideFeedback(RFID_TAP);
      String outUID = "";
      for (byte i = 0; i < rfidOUT.uid.size; i++) {
        outUID += (rfidOUT.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfidOUT.uid.uidByte[i], HEX);
      }
      outUID.toUpperCase();
      rfidOUT.PICC_HaltA(); rfidOUT.PCD_StopCrypto1();
      clearSpiBusPins();

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
          bool isSuccess = resDoc["success"] | false;
          http.end(); // End session immediately before power dip

          if (isSuccess) {
            updateBackDisplay("APPROVED", "Goodbye!");
            provideFeedback(SUCCESS_OK);
            delay(100); // Allow display update before solenoid draw
            solenoidUnlock();
          } else {
            String errMsg = resDoc["message"] | "Rejected";
            if (errMsg.indexOf("outside") >= 0 || errMsg.indexOf("Outside") >= 0) {
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