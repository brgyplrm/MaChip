import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { 
  Cpu, 
  Wifi, 
  Thermometer, 
  Radio, 
  Fingerprint, 
  Monitor, 
  ExternalLink, 
  RefreshCw, 
  Volume2, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Terminal,
  Activity,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HardwareDiagnostics() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetchWithAuth("/api/esp/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("[HARDWARE-DIAGNOSTICS] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleTestBuzzer = async () => {
    setActionLoading("buzzer");
    try {
      const res = await fetchWithAuth("/api/esp/test-buzzer", { method: "POST" });
      const data = await res.json();
      setActionMessage({ type: res.ok ? "success" : "error", text: data.message || "Buzzer tested" });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleUnlockRelay = async () => {
    setActionLoading("relay");
    try {
      const res = await fetchWithAuth("/api/esp/unlock-relay", { method: "POST" });
      const data = await res.json();
      setActionMessage({ type: res.ok ? "success" : "error", text: data.message || "Relay unlocked" });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleResetScreen = async () => {
    setActionLoading("screen");
    try {
      const res = await fetchWithAuth("/api/esp/reset-screen", { method: "POST" });
      const data = await res.json();
      setActionMessage({ type: res.ok ? "success" : "error", text: data.message || "TFT Screen reset" });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleSimulateTelemetry = async () => {
    setActionLoading("simulate");
    try {
      const res = await fetchWithAuth("/api/esp/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempC: 44.5,
          casingTempC: 34.0,
          rssi: -58,
          freeHeap: 184320,
          uptimeSec: 3600,
          rfidOk: true,
          fingerOk: true,
          dualTftOk: true,
          buzzerOk: true,
          solenoidOk: true,
          firmwareVersion: "3.0.0-PROD"
        })
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Simulated ESP32 telemetry packet dispatched! Status refreshed." });
        await fetchStatus();
      } else {
        const data = await res.json();
        setActionMessage({ type: "error", text: data.message || "Simulation failed" });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const isConnected = Boolean(status?.connected);
  const ip = status?.ip;
  const consoleUrl = status?.directUrl;
  const mdnsUrl = status?.mdnsUrl || "http://machip-esp32.local/console";
  const telemetry = status?.telemetry;
  const hasTelemetry = Boolean(telemetry && (telemetry.coreTempC !== undefined || telemetry.rssi !== undefined));
  const isStale = Boolean(telemetry?.isStale);

  const coreTemp = hasTelemetry ? telemetry.coreTempC : null;
  const casingTemp = hasTelemetry ? telemetry.casingTempC : null;
  const rssi = hasTelemetry ? telemetry.rssi : null;
  const freeHeapKb = hasTelemetry && telemetry.freeHeap ? Math.round(telemetry.freeHeap / 1024) : null;

  const getTempColor = (temp) => {
    if (temp === null || temp === undefined) return "text-slate-400 bg-slate-100 border-slate-200";
    if (temp < 55) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (temp < 68) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  return (
    <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-primary-light text-brand-primary rounded-xl">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                MAChip Node 01 Terminal
                <span className="text-xs font-mono font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  PCB v3.0 Certified
                </span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                ESP32 Dual-Core • Wi-Fi Station • MFRC522 Dual RFID • R307 Biometrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`px-3 py-1 text-xs font-semibold flex items-center gap-1.5 ${
                isConnected 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300" 
                  : isStale
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-rose-50 text-rose-700 border-rose-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : isStale ? "bg-amber-500" : "bg-rose-500"}`} />
              {isConnected ? "ONLINE (Active Link)" : isStale ? "OFFLINE (Stale Telemetry)" : "STANDBY / OFFLINE"}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="h-8 px-2.5 text-xs text-slate-600"
              title="Refresh Hardware State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {actionMessage && (
          <div className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
            actionMessage.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
          </div>
        )}

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Core Temperature */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Thermometer className="w-4 h-4 text-brand-primary" /> ESP32 Die Temp
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTempColor(coreTemp)}`}>
                {coreTemp !== null ? (coreTemp < 55 ? "NORMAL" : coreTemp < 68 ? "WARM" : "HOT") : "OFFLINE"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              {coreTemp !== null ? (
                <>
                  <span className="text-2xl font-bold font-mono text-slate-800">{coreTemp}°C</span>
                  <span className="text-xs text-slate-400">({Math.round(coreTemp * 1.8 + 32)}°F)</span>
                </>
              ) : (
                <span className="text-2xl font-bold font-mono text-slate-400">—</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-2">
              {coreTemp !== null ? "Silicon Junction Sensor" : "Awaiting Device Telemetry"}
            </span>
          </div>

          {/* Casing Ambient Temperature */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-4 h-4 text-brand-primary" /> Casing Temp
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                casingTemp !== null 
                  ? "text-emerald-600 bg-emerald-50 border-emerald-200" 
                  : "text-slate-400 bg-slate-100 border-slate-200"
              }`}>
                {casingTemp !== null ? "VENTILATED" : "OFFLINE"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              {casingTemp !== null ? (
                <>
                  <span className="text-2xl font-bold font-mono text-slate-800">{casingTemp}°C</span>
                  <span className="text-xs text-slate-400">Ambient Air</span>
                </>
              ) : (
                <span className="text-2xl font-bold font-mono text-slate-400">—</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-2">
              {casingTemp !== null ? "Thermal Enclosure Model / DS18B20" : "Awaiting Device Telemetry"}
            </span>
          </div>

          {/* Wi-Fi Signal RSSI */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Wifi className="w-4 h-4 text-brand-primary" /> Wi-Fi RSSI
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                rssi !== null
                  ? (rssi > -65 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200")
                  : "text-slate-400 bg-slate-100 border-slate-200"
              }`}>
                {rssi !== null ? (rssi > -65 ? "EXCELLENT" : rssi > -78 ? "FAIR" : "WEAK") : "NO LINK"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              {rssi !== null ? (
                <>
                  <span className="text-2xl font-bold font-mono text-slate-800">{rssi}</span>
                  <span className="text-xs text-slate-500 font-mono">dBm</span>
                </>
              ) : (
                <span className="text-2xl font-bold font-mono text-slate-400">—</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-2 font-mono">
              IP: {ip || "Awaiting UDP Discovery"}
            </span>
          </div>

          {/* System RAM / Free Heap */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-brand-primary" /> Free Memory
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                freeHeapKb !== null ? "text-blue-600 bg-blue-50 border-blue-200" : "text-slate-400 bg-slate-100 border-slate-200"
              }`}>
                {freeHeapKb !== null ? "STABLE" : "STANDBY"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              {freeHeapKb !== null ? (
                <>
                  <span className="text-2xl font-bold font-mono text-slate-800">{freeHeapKb}</span>
                  <span className="text-xs text-slate-500 font-mono">KB RAM</span>
                </>
              ) : (
                <span className="text-2xl font-bold font-mono text-slate-400">—</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-2 font-mono">
              {freeHeapKb !== null ? "ESP.getFreeHeap()" : "Awaiting Handshake"}
            </span>
          </div>
        </div>

        {/* Peripheral Components Health Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Hardware Components & Circuit Integrity</span>
            <span className="text-[11px] font-normal text-slate-500 lowercase">PCB: MACHIP-V3-2026</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Front Door RFID Reader (Outside)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-[11px]">J3 Pin 1 (CS: GPIO 26, RST: GPIO 27)</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  isConnected && telemetry?.rfidFront && !telemetry.rfidFront.includes("OFFLINE")
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {isConnected && telemetry?.rfidFront ? telemetry.rfidFront : "DISCONNECTED (No Heartbeat)"}
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Back Door RFID Reader (Inside)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-[11px]">J2 Pin 1 (CS: GPIO 5, RST: GPIO 27)</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  isConnected && telemetry?.rfidBack && !telemetry.rfidBack.includes("OFFLINE")
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {isConnected && telemetry?.rfidBack ? telemetry.rfidBack : "DISCONNECTED (No Heartbeat)"}
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Optical Fingerprint Sensor (R307)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-[11px]">J6 UART2 (RX: GPIO 16, TX: GPIO 17)</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  isConnected && telemetry?.fpSensor && !telemetry.fpSensor.includes("OFFLINE")
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {isConnected && telemetry?.fpSensor ? telemetry.fpSensor : "DISCONNECTED (No Heartbeat)"}
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Dual ST7789 Color TFT Displays</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-[11px]">Front J4 (CS:33 DC:25) / Back J5 (CS:21 DC:22)</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  isConnected 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {isConnected ? "DUAL SPI ACTIVE" : "STANDBY"}
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Audio Feedback & Lock Relay Control</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-[11px]">Buzzer: GPIO 32 (2730Hz) • Solenoid: GPIO 4 (NPN Q2)</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${
                  isConnected 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {isConnected ? "READY" : "STANDBY"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Live Web Console & Hardware Diagnostics Controls */}
        <div className="p-5 rounded-xl border border-purple-100 bg-purple-50/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-primary" />
                ESP32 Secured Web Serial Console Access
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                UDP Auto-Discovered direct access for real-time serial logs, Wi-Fi configuration, and hardware wipe controls.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateTelemetry}
                disabled={actionLoading === "simulate"}
                className="text-xs h-9 px-3 border-purple-200 bg-white text-brand-primary hover:bg-purple-50"
                title="Send a sample telemetry packet to simulate active hardware connectivity"
              >
                <Activity className="w-3.5 h-3.5 mr-1" />
                <span>{actionLoading === "simulate" ? "Simulating..." : "Simulate ESP32 Beacon"}</span>
              </Button>

              {consoleUrl ? (
                <Button
                  asChild
                  className="bg-brand-primary hover:bg-[#3B206D] text-white text-xs font-semibold h-9 px-4 gap-1.5 shadow-sm"
                >
                  <a href={consoleUrl} target="_blank" rel="noopener noreferrer">
                    <span>Launch Live Terminal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="text-xs font-semibold h-9 px-4 gap-1.5 border-slate-300 text-slate-600"
                >
                  <a href={mdnsUrl} target="_blank" rel="noopener noreferrer" title="Direct IP pending discovery. Launching via mDNS hostname.">
                    <span>Launch via mDNS</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Direct Terminal URL</span>
                <span className="font-mono text-slate-700 font-semibold">{consoleUrl || "Awaiting UDP Beacon..."}</span>
              </div>
              {consoleUrl && (
                <button 
                  onClick={() => copyToClipboard(consoleUrl, "direct")}
                  className="text-slate-400 hover:text-brand-primary p-1 rounded"
                  title="Copy Direct URL"
                >
                  {copiedField === "direct" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">mDNS Host URL</span>
                <span className="font-mono text-slate-700 font-semibold">{mdnsUrl}</span>
              </div>
              <button 
                onClick={() => copyToClipboard(mdnsUrl, "mdns")}
                className="text-slate-400 hover:text-brand-primary p-1 rounded"
                title="Copy mDNS URL"
              >
                {copiedField === "mdns" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Console User</span>
                <span className="font-mono text-slate-700 font-semibold">{status?.adminUser || "admin"}</span>
              </div>
              <button 
                onClick={() => copyToClipboard(status?.adminUser || "admin", "user")}
                className="text-slate-400 hover:text-brand-primary p-1 rounded"
                title="Copy Username"
              >
                {copiedField === "user" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Console Password</span>
                <span className="font-mono text-slate-700 font-semibold">{status?.adminPass || "machip2026"}</span>
              </div>
              <button 
                onClick={() => copyToClipboard(status?.adminPass || "machip2026", "pass")}
                className="text-slate-400 hover:text-brand-primary p-1 rounded"
                title="Copy Password"
              >
                {copiedField === "pass" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Quick Hardware Trigger Buttons */}
          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestBuzzer}
              disabled={actionLoading === "buzzer" || !isConnected}
              className="text-xs h-8 gap-1.5 border-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              <Volume2 className="w-3.5 h-3.5 text-brand-primary" />
              <span>{actionLoading === "buzzer" ? "Testing..." : "Test 2730Hz Buzzer"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlockRelay}
              disabled={actionLoading === "relay" || !isConnected}
              className="text-xs h-8 gap-1.5 border-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span>{actionLoading === "relay" ? "Triggering..." : "Trigger Door Relay (3s)"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetScreen}
              disabled={actionLoading === "screen" || !isConnected}
              className="text-xs h-8 gap-1.5 border-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-600" />
              <span>{actionLoading === "screen" ? "Resetting..." : "Reset ST7789 Screens"}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

