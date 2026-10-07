#pragma once
#include "Config.h"
#include "DisplayManager.h"
#include "HardwareDrivers.h"


// ── WEB CONSOLE HTML UI ───────────────────────────────────────────
const char CONSOLE_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAChip Hardware Console</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #58a6ff; margin: 0; padding: 20px; }
    h2 { color: #f0f6fc; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-top: 0; }
    #terminal { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; height: 75vh; overflow-y: scroll; white-space: pre-wrap; font-size: 13px; line-height: 1.4; color: #7ee787; }
    .btn { background: #238636; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; }
    .btn:hover { background: #2ea043; }
    .btn-danger { background: #da3633; margin-right: 8px; }
    .btn-danger:hover { background: #b62324; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <div class="header-bar">
    <h2>MAChip Hardware Live Serial Monitor</h2>
    <div>
      <button class="btn btn-danger" onclick="resetSensor()">Wipe R307 Sensor</button>
      <button class="btn" onclick="discoverServer()">Discover Server</button>
      <button class="btn" onclick="clearLogs()">Clear Terminal</button>
    </div>
  </div>
  <div id="terminal">Loading streaming logs...</div>

  <script>
    async function fetchLogs() {
      try {
        const res = await fetch('/console/logs');
        if (res.ok) {
          const logs = await res.json();
          const term = document.getElementById('terminal');
          term.textContent = logs.join('\n');
          term.scrollTop = term.scrollHeight;
        }
      } catch (err) {}
    }

    async function clearLogs() {
      await fetch('/console/clear', { method: 'POST' });
      fetchLogs();
    }

    async function discoverServer() {
      const res = await fetch('/console/discover', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(data.message + '\n' + data.serverUrl);
      }
      fetchLogs();
    }

    async function resetSensor() {
      if (!confirm("Are you sure you want to completely wipe all fingerprint templates stored in the physical R307 optical sensor memory?")) return;
      const res = await fetch('/console/reset-sensor', { method: 'POST' });
      if (res.ok) {
        alert("Sensor memory wipe command executed!");
      }
      fetchLogs();
    }

    setInterval(fetchLogs, 1500);
    fetchLogs();
  </script>
</body>
</html>
)rawliteral";

inline void handleConsoleUI() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  webServer.send(200, "text/html", CONSOLE_HTML);
}

inline void handleConsoleLogs() {
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

inline void handleConsoleClear() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  logHead = 0;
  logCount = 0;
  webServer.send(200, "application/json", "{\"success\":true}");
}

inline void handleConsoleResetSensor() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  sysLog(F("[CONSOLE-RESET] Web console triggered manual R307 sensor wipe..."));
  updateFrontDisplay("HARDWARE RESET", "Wiping sensor memory...", ST77XX_RED);
  
  bool wiped = (finger.emptyDatabase() == FINGERPRINT_OK);
  if (!wiped) {
    sysLog(F("[CONSOLE-RESET] emptyDatabase command failed. Executing slot-by-slot purge (1 to 162)..."));
    for (int i = 1; i <= 162; i++) {
      finger.deleteModel(i);
    }
    wiped = true;
  }
  
  if (wiped) {
    sysLog(F("[CONSOLE-RESET] [SUCCESS] All physical R307 fingerprint slots wiped clean!"));
    updateFrontDisplay("SUCCESS", "Sensor memory wiped.", ST77XX_GREEN);
    provideFeedback(SUCCESS_OK);
  } else {
    sysLog(F("[CONSOLE-RESET] [ERROR] Failed to clear sensor memory."));
    updateFrontDisplay("ERROR", "Failed to clear sensor.", ST77XX_RED);
    provideFeedback(ERROR_FAIL);
  }
  
  delay(1500);
  updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
  webServer.send(200, "application/json", "{\"success\":true,\"message\":\"Sensor memory wiped clean\"}");
}

inline void handleResetScreen() {
  sysLog(F("[REMOTE-RESET] Reset TFT screen to READY state requested by server"));
  enrollmentMode = false;
  fpEnrollStage = 0;
  pendingUID = "";
  pendingName = "";
  last2FACountdownSec = -1;
  pendingExpectedFingerID = -1;
  pendingExpectedFingerID2 = -1;
  pendingCardCounter = 0;
  updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
  updateBackDisplay("READY", "Scan Card Out");
  setLED(LED_SLOW_BLINK, LED_OFF);
  webServer.send(200, "application/json", "{\"success\":true,\"message\":\"TFT screen reset to default READY state\"}");
}

inline void handleCancelEnrollment() {
  bool wasEnrolling = enrollmentMode;
  enrollmentMode = false;
  fpEnrollStage = 0;
  pendingUID = "";
  pendingName = "";
  last2FACountdownSec = -1;
  pendingExpectedFingerID = -1;
  pendingExpectedFingerID2 = -1;
  pendingCardCounter = 0;
  if (wasEnrolling) {
    sysLog(F("[REMOTE-CANCEL] Direct cancellation signal received from server"));
    updateFrontDisplay("CANCELLED", "Enrollment Cancelled", ST77XX_YELLOW);
    delay(500);
    updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
    updateBackDisplay("READY", "Scan Card Out");
    setLED(LED_SLOW_BLINK, LED_OFF);
  }
  webServer.send(200, "application/json", "{\"success\":true,\"cancelled\":true}");
}

// ── UDP ZERO-CONFIG AUTO-DISCOVERY ─────────────────────────────────
inline bool discoverServer(unsigned long timeoutMs = 2500) {
  if (WiFi.status() != WL_CONNECTED) {
    sysLog(F("[UDP-DISCOVERY] Aborted: Wi-Fi is not connected"));
    return false;
  }

  WiFiUDP udp;
  if (!udp.begin(4002)) {
    sysLog(F("[UDP-DISCOVERY] Failed to bind local UDP port 4002"));
    return false;
  }

  sysLog(F("[UDP-DISCOVERY] Broadcasting MACHIP_DISCOVER on UDP port 4001..."));

  IPAddress localIp = WiFi.localIP();
  IPAddress subnet = WiFi.subnetMask();
  IPAddress broadcastIp(
    (localIp[0] & subnet[0]) | (~subnet[0] & 0xFF),
    (localIp[1] & subnet[1]) | (~subnet[1] & 0xFF),
    (localIp[2] & subnet[2]) | (~subnet[2] & 0xFF),
    (localIp[3] & subnet[3]) | (~subnet[3] & 0xFF)
  );

  const char* msg = "MACHIP_DISCOVER";

  // 1. Send to subnet-directed broadcast address
  udp.beginPacket(broadcastIp, 4001);
  udp.write((const uint8_t*)msg, strlen(msg));
  udp.endPacket();

  // 2. Send to global broadcast address (255.255.255.255)
  udp.beginPacket(IPAddress(255, 255, 255, 255), 4001);
  udp.write((const uint8_t*)msg, strlen(msg));
  udp.endPacket();

  unsigned long start = millis();
  bool discovered = false;

  while (millis() - start < timeoutMs) {
    int packetSize = udp.parsePacket();
    if (packetSize > 0) {
      char buffer[512];
      int len = udp.read(buffer, sizeof(buffer) - 1);
      if (len > 0) {
        buffer[len] = '\0';
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, buffer);
        if (!err && doc["serverUrl"].is<const char*>() && doc["fpUrl"].is<const char*>()) {
          String newServer = doc["serverUrl"].as<String>();
          String newFp = doc["fpUrl"].as<String>();
          if (newServer.length() > 0 && newFp.length() > 0) {
            currentServerUrl = newServer;
            currentFpUrl = newFp;
            sysLog("[UDP-DISCOVERY] [SUCCESS] Target Backend Server: " + currentServerUrl);
            discovered = true;
            break;
          }
        }
      }
    }
    delay(20);
  }

  udp.stop();

  if (!discovered) {
    sysLog("[UDP-DISCOVERY] [TIMEOUT] Retaining profile URL: " + currentServerUrl);
  }
  return discovered;
}

inline void handleConsoleDiscover() {
  if (!webServer.authenticate(WEB_CONSOLE_USER, WEB_CONSOLE_PASS)) {
    return webServer.requestAuthentication(BASIC_AUTH, "MAChip Admin Auth Required");
  }
  sysLog(F("[CONSOLE] Web console triggered UDP Zero-Config discovery..."));
  bool ok = discoverServer(2500);
  String msg = ok ? "Auto-discovery successful" : "Auto-discovery timed out, keeping current URL";
  webServer.send(200, "application/json", "{\"success\":" + String(ok ? "true" : "false") + ",\"serverUrl\":\"" + currentServerUrl + "\",\"message\":\"" + msg + "\"}");
}

inline void setupWebConsole() {
  if (webServerStarted) return;

  webServer.on("/", HTTP_GET, handleConsoleUI);
  webServer.on("/console", HTTP_GET, handleConsoleUI);
  webServer.on("/console/logs", HTTP_GET, handleConsoleLogs);
  webServer.on("/console/clear", HTTP_POST, handleConsoleClear);
  webServer.on("/console/reset-sensor", HTTP_POST, handleConsoleResetSensor);
  webServer.on("/console/discover", HTTP_POST, handleConsoleDiscover);
  webServer.on("/api/cancel", HTTP_ANY, handleCancelEnrollment);
  webServer.on("/cancel", HTTP_ANY, handleCancelEnrollment);
  webServer.on("/api/reset-screen", HTTP_ANY, handleResetScreen);
  webServer.on("/reset-screen", HTTP_ANY, handleResetScreen);

  webServer.begin();
  webServerStarted = true;

  sysLog(F("=========================================================="));
  sysLog(" [*] MACHIP SECURED WEB CONSOLE (" + String(FIRMWARE_VERSION) + ")");
  sysLog("  +-- Build:    " + String(BUILD_TIMESTAMP));
  sysLog("  +-- URL:      http://" + WiFi.localIP().toString() + "/console");
  sysLog(F("  +-- mDNS:     http://machip-esp32.local/console"));
  sysLog("  +-- Username: " + String(WEB_CONSOLE_USER));
  sysLog("  \\-- Password: " + String(WEB_CONSOLE_PASS));
  sysLog(F("=========================================================="));
}

// ── FAST WIFI CONNECTION ENGINE (SCAN & MATCH) ───────────────────
inline bool autoConnectWiFi() {
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
          
          // Sync SNTP real-time clock (UTC+8 Manila)
          configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
          sysLog(F("[NTP] Initialized SNTP synchronization (UTC+8 Manila)"));

          // UDP Zero-Config Auto-Discovery
          discoverServer(2500);
          sysLog("[NET] Target Backend Server: " + currentServerUrl);

          // Immediate Server Health Verification
          HTTPClient testHttp;
          testHttp.begin(currentFpUrl + "/session");
          testHttp.setTimeout(3000);
          signHttpRequest(testHttp, "");
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
      configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
      sysLog("[WIFI] [CONNECTED] Fallback linked to [" + networks[i].ssid + "]");
      discoverServer(2500);
      sysLog("[NET] Target Backend Server: " + currentServerUrl);
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

// ── ARDUINO OTA INITIALIZATION ─────────────────────────────────────
inline void setupOTA() {
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
    sysLog("[OTA] Firmware update started: " + type);
    updateFrontDisplay("OTA UPDATE", "Flashing new firmware...", ST77XX_YELLOW);
    updateBackDisplay("OTA UPDATE", "Do not power off!");
  });

  ArduinoOTA.onEnd([]() {
    sysLog(F("[OTA] Firmware update complete! Rebooting..."));
    updateFrontDisplay("OTA COMPLETE", "Rebooting system...", ST77XX_GREEN);
    updateBackDisplay("OTA COMPLETE", "Rebooting...");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    int pct = (progress / (total / 100));
    Serial.printf("[OTA] Progress: %u%%\r", pct);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    String errStr = "Unknown";
    if (error == OTA_AUTH_ERROR) errStr = "Auth Failed";
    else if (error == OTA_BEGIN_ERROR) errStr = "Begin Failed";
    else if (error == OTA_CONNECT_ERROR) errStr = "Connect Failed";
    else if (error == OTA_RECEIVE_ERROR) errStr = "Receive Failed";
    else if (error == OTA_END_ERROR) errStr = "End Failed";
    sysLog("[OTA] Error[" + String(error) + "]: " + errStr);
    updateFrontDisplay("OTA ERROR", "Update Failed!", ST77XX_RED);
    updateBackDisplay("OTA ERROR", "Update Failed");
  });

  ArduinoOTA.begin();
  otaInitialized = true;
  sysLog(F("[OTA] ArduinoOTA service initialized and listening on LAN"));
}
