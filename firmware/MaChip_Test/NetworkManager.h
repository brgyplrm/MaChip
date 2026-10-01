#pragma once
#include "Config.h"
#include "DisplayManager.h"
#include "HardwareDrivers.h"

// ── LOGGING ENGINE ───────────────────────────────────────────────
inline void sysLog(const String &msg) {
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
    .header-bar { display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <div class="header-bar">
    <h2>MAChip Hardware Live Serial Monitor</h2>
    <button class="btn" onclick="clearLogs()">Clear Terminal</button>
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

inline void setupWebConsole() {
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
