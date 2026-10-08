# Module Checklist 04: Hardware, IoT & ESP32 Integration

> **Focus:** Embedded Safety, RFID/Biometric Boundaries, Offline Resilience, and Device Authentication

---

## 1. Hardware Credential Boundary & Storage Safety
- [ ] **Biometric Template Isolation:** Fingerprint templates reside strictly inside the R307 optical sensor memory. The PostgreSQL database stores only the integer slot mapping (`slotId`), never raw minutiae or template blobs.
- [ ] **Dual-Factor Access Control Verification:**
  - Scanning valid RFID card alone: Denied access (solenoid remains locked).
  - Placing enrolled fingerprint alone: Denied access (solenoid remains locked).
  - Valid RFID card followed by matching fingerprint within timeout window (10s): **Access Granted** (solenoid unlocks, punch logged).
  - Unknown card or unmatched print: Immediate rejection and alert logged.
- [ ] **eFuse Safety Protocol:** ESP32 hardware eFuses (Secure Boot, flash encryption) are never burned during iterative testing.

---

## 2. Device Request Authentication & Anti-Replay
- [ ] **Cryptographic Device Signatures:** Hardware attendance payloads sent to the backend include a monotonic timestamp, nonce, and HMAC-SHA256 signature generated with the shared device secret.
- [ ] **Anti-Replay Window:** Backend rejects punch packets with timestamps older than the allowed tolerance window (e.g., 30 seconds) or matching a previously consumed nonce.
- [ ] **UDP Discovery & Handshake:** ESP32 LAN auto-discovery broadcasts on UDP port 4001 safely locate the backend server IP without hardcoded network gateways.

---

## 3. Network Interruption & Offline Mode
- [ ] **Offline Punch Buffering:** When LAN or server connection drops, the ESP32 buffers punch events in local non-volatile storage (SPIFFS / EEPROM / LittleFS) up to the buffer limit.
- [ ] **Door Policy on Disconnect:** Door mechanism adheres to the documented physical security policy (e.g., fail-secure for external warehouse perimeter; fail-safe for emergency egress).
- [ ] **Reconnection & Deduplication:** When connection is restored, buffered punches replay to the server in chronological order; backend deduplicates against existing timestamps.

---

## 4. Electrical, Solenoid & Thermal Protection
- [ ] **Solenoid Release Timer:** Door lock relay automatically de-energizes after a fixed pulse duration (3–5 seconds), even if firmware hangs.
- [ ] **Watchdog Timer (WDT) Enabled:** Hardware task watchdog reboots the ESP32 if the main attendance loop becomes unresponsive or blocks on SPI/UART sensors.
- [ ] **Regulator & Thermal Stability:** 5V/3.3V power rails operate within thermal limits under full sensor load without brownout resets.
