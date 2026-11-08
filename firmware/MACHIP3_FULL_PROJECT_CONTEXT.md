# MAChip 3.0 — Master Hardware-to-Firmware Context & Complete Display States Manual (For AI CLIs & Developers)

> **Purpose of this Document:**  
> This file is the complete, un-abbreviated **Single Source of Truth** bridging the physical **MAChip 3.0 PCB (`MACHIP3.0.kicad_pcb`)**, bench hardware modifications, the modular **ESP32 Firmware (`v2.7.0-UDP-DISCOVERY`)** in `firmware/MaChip_Test/`, and the **Complete Dual-TFT Hardware Display States Manual**.  
> Pass this file to any AI CLI (Claude Code, Gemini CLI, Cursor, Codex, GitHub Copilot, etc.) on your Kali Linux machine or your groupmate's laptop so the AI has 100% of the hardware, schematic, netlist, security, and UI state context.

---

## 0. STRICT AI CLI & DEVELOPER GUARDRAILS (UI-ONLY LOCK)

> [!CAUTION]
> **READ BEFORE EDITING ANY CODE:**  
> 1. **LOCKED PCB PIN MAPPINGS (`Config.h`):**  
>    The hardware pin definitions in [`firmware/MaChip_Test/Config.h`](file:///home/achyllisss/Documents/Projects/MaChip/firmware/MaChip_Test/Config.h) are **100% hardwired to the physical copper traces of `MACHIP3.0.kicad_pcb`**. **NEVER alter any GPIO pin numbers in `Config.h`!**  
>    *(Note: An older UI draft erroneously listed `TFT_CS = GPIO 5` and `TFT_CS_INSIDE = GPIO 15`. On the actual `MACHIP 3.0` PCB, `GPIO 5` is `SS_PIN_OUT` Back RFID CS, `GPIO 15` is `TFT_RESET_PIN`, Front `TFT_CS` is **`GPIO 33`**, and Back `TFT_CS_INSIDE` is **`GPIO 21`**).*
> 2. **WHEN PERFORMING TFT UI / GRAPHICS UPDATES:**  
>    * ✅ **ALLOWED TO EDIT:** **`firmware/MaChip_Test/DisplayManager.h`** and **`firmware/MaChip_Test/Bitmaps.h`** ONLY (and display string arguments if required).  
>    * 🔒 **FORBIDDEN TO MODIFY:** Do **NOT** touch or refactor:
>      * `Config.h` (Pin definitions, HMAC-SHA256 signer, MIFARE keys, `clearSpiBusPins()`)
>      * `RfidDriver.h` (MIFARE Classic Sector 1 Key A authentication & Block 5 rolling counter anti-replay)
>      * `BiometricSensor.h` (R307 UART2 512-byte template extractor & `/enroll-confirm` uploader)
>      * `EnvSensor.h` & `EnvSensor.cpp` (Register-level AHT20 `0x38` + BMP280 `0x76`/`0x77` I2C driver & `temperatureRead()`)
>      * `HardwareDrivers.h` (Resonant 2730 Hz passive buzzer LEDC PWM, non-blocking LED blink engine, NPN solenoid driver)
>      * `NetworkManager.h` (Multi-SSID Wi-Fi scanner, SNTP, UDP Auto-Discovery on port 4001/4002, ArduinoOTA, Web Console)

---

## 1. System Overview & Repository Structure

**MAChip 3.0** is an industrial-grade, ESP32-based dual-sided (Outside Entrance / Inside Exit) door access control and attendance station with Multi-Factor Authentication (RFID + Optical Fingerprint), cryptographic anti-cloning (MIFARE Classic Sector 1 rolling counter), HMAC-SHA256 signed requests, enclosure climate telemetry, and real-time backend synchronization.

### 1.1 Repository & Directory Layout (`/home/achyllisss/Documents/Projects/MaChip/`)
* **`firmware/MACHIP3.0/`** (and `/home/achyllisss/Documents/ELECTRONICS/MACHIP3.0/`) — KiCad 10 PCB & Schematic design files:
  * `MACHIP3.0.kicad_sch` — Main KiCad 10 Schematic (`0 ERC Errors`)
  * `MACHIP3.0.kicad_pcb` — Main 2-Layer $100 \times 100\,\text{mm}$ FR-4 PCB Layout (`0 DRC Violations`)
  * `MACHIP3.0.step` / `MACHIP3.0.stl` — 3D Mechanical CAD & 3D Printing Exports
  * `MACHIP3.0_JLCPCB_READY.zip` & `MACHIP3.0_JLCPCB_BOM_CORRECTED.csv` — Fabrication Gerbers, Excellon Drills & BOM
  * `MACHIP3_HARDWARE_BRINGUP_AND_ASSEMBLY_GUIDE.md` — 6-Stage bench assembly & multimeter smoke-test protocol
  * `MACHIP3_PCB_LAYOUT_AUDIT_REPORT.md` — IPC-2221B / IPC-2152 / DFM / Signal Integrity audit report
* **`firmware/MaChip_Test/`** — Production Modular ESP32 Firmware (`v2.7.0-UDP-DISCOVERY`):
  * `MaChip_Test.ino` — Main `setup()`, hardware self-test diagnostics, 2FA clock-in/clock-out access pipeline, and enrollment state machines (RFID & R307 3-stage biometric enrollment with duplicate finger check)
  * `Config.h` — Master PCB pin definitions, MIFARE Sector 1 security keys (`MIFARE_KEY_MACJ`), HMAC-SHA256 request signer (`signHttpRequest()`), ring-buffer logger (`sysLog()`), and SPI bus guard (`clearSpiBusPins()`)
  * `DisplayManager.h` — Dual ST7789 $320 \times 240$ landscape SPI UI renderers (`tft` Front/Outside on `J4`, `tftBack` Back/Inside on `J5`), 2FA countdown timer, RFID pulse animation, and inductive kickback recovery (`resetBackDisplay()`)
  * `Bitmaps.h` — PROGMEM bitmap frames (`epd_bitmap_Frame_1`, `epd_bitmap_Frame_2`, `epd_rfid_pulse_frames`)
  * `HardwareDrivers.h` — Resonant LEDC PWM buzzer engine (`2730 Hz`), non-blocking LED blink state machine, and NPN solenoid relay driver (`solenoidUnlock()`, `solenoidLock()`, `updateSolenoid()`)
  * `RfidDriver.h` — MIFARE Classic Sector 1 Key A authentication, automatic factory card provisioning, Block 5 monotonic rolling counter anti-replay protection (`readAndIncrementCardCounter()`), and offline transaction queue (`queueTransaction()`)
  * `BiometricSensor.h` — R307 optical fingerprint raw 512-byte template extractor (`downloadTemplate()`) and `/enroll-confirm` uploader
  * `EnvSensor.h` & `EnvSensor.cpp` — Register-level I2C driver for the **AHT20 (`0x38`) + BMP280 (`0x76`/`0x77`)** combo casing sensor plus ESP32 internal silicon temperature (`temperatureRead()`)
  * `NetworkManager.h` — Multi-SSID fast Wi-Fi scanner, SNTP (`UTC+8 Manila`), UDP Zero-Config Auto-Discovery (`MACHIP_DISCOVER` on UDP port `4001`/`4002`), ArduinoOTA (`machip-esp32.local`), and Authenticated Web Console (`/console`, `/api/env`, `/console/logs`, `/console/test-buzzer`, `/console/unlock`, `/console/reset-sensor`)
* **`backend/` & `frontend/`** — Full-stack Node.js/Express + React web application for CTPAT attendance, biometric/RFID provisioning, payroll, and tamper-evident hash-chain auditing.
* **`/home/achyllisss/Documents/ELECTRONICS/DATASHEETS/`** — Component datasheets (`esp32-wroom-32_datasheet_en.pdf`, `tsr1_datasheet.pdf`, `DS9080-09.pdf`, `AO3401.pdf`, `AHT20.pdf`, `bst-bmp280-ds001.pdf`, `mfrc522.pdf`, `R307.pdf`, `adafruit-cp-st7789-readthedocs-io-en-stable.pdf`, `ESDSRV05-4.pdf`, `RXEF110.pdf`, `P2N2222A-D.pdf`).

---

### 1.2 Core Hardware Peripherals on PCB (`MACHIP3.0.kicad_pcb`)
* **MCU (`U2`):** 38-Pin ESP32 DevKitC / NodeMCU-32S (`ESP32-WROOM-32`), mounted in dual 19-pin female headers.
* **Power Supply Architecture:**
  * **Input (`J1`):** $9\,\text{V}$ DC Barrel Jack $\rightarrow$ `F1` ($1.1\,\text{A}$ PTC Resettable Fuse `RXEF110`) $\rightarrow$ `D2` (`SMBJ10CA` Bidirectional TVS Diode) $\rightarrow$ `Q1` (`AO3401A` High-Side P-MOSFET Reverse Polarity Protection with `D1` `BZT52C10` Zener & `R1`/`R2` $10\,\text{k}\Omega$ bias).
  * **5V Rail (`U1`):** TO-220-3 footprint (`LM7805` upgraded to drop-in switching buck regulator **`Traco Power TSR 1-2450`**). Powers ESP32 `VIN` (Pin 19), `U3` LDO input, Fingerprint sensor `J6`, Relay module `J8`, and TFT `VCC` pins (`J4.1`, `J5.1`).
  * **3.3V Rail (`U3`):** `RT9080-33GJ5` ($600\,\text{mA}$ Low-Dropout Regulator, SOT-23-5). Powers both MFRC522 RFID readers (`J2.7`, `J3.7`), TFT backlights (`J4.8`, `J5.8`), Buzzer `VCC` (`J7.1`), ESD arrays (`U4.5`, `U5.5`), and pull-up resistors (`R3`–`R7`, `R11`).
* **Displays (Dual SPI ST7789 2.4" $320 \times 240$ TFTs):**
  * **Outside / Front Display (`J4`):** 9-Pin JST-XH (`TFT_OUTSIDE`)
  * **Inside / Back Display (`J5`):** 9-Pin JST-XH (`TFT_INSIDE`)
* **RFID Readers (Dual SPI MFRC522 13.56 MHz):**
  * **Inside / Front Reader (`J2`):** 7-Pin JST-XH (`MFRC522_INSIDE`)
  * **Outside / Back Reader (`J3`):** 7-Pin JST-XH (`MFRC522_OUTSIDE`)
* **Biometric Scanner (`J6`):** 4-Pin JST-XH for **R307 / R307S Optical Fingerprint Module** (UART2).
* **Actuators & Indicators:**
  * **Relay Module (`J8`):** 3-Pin JST-XH driven via low-side NPN transistor `Q2` (`PN2222A`, `R16` $1\,\text{k}\Omega$ base, `R17` $10\,\text{k}\Omega$ pull-down) to unlock a 12V magnetic door lock.
  * **Buzzer Module (`J7`):** 3-Pin JST-XH driven via `GPIO 32` (`R14` $1\,\text{k}\Omega$ series, `R15` $10\,\text{k}\Omega$ pull-down).
  * **Green Status LED (`D3`):** 2-Pin JST-XH with on-board $220\,\Omega$ resistor (`R12`), split via external Y-cable (+ $68\,\Omega$ per branch) to Inside & Outside panel LEDs.
  * **Red Status LED (`D4`):** 2-Pin JST-XH with on-board $220\,\Omega$ resistor (`R13`), split via external Y-cable (+ $68\,\Omega$ per branch) to Inside & Outside panel LEDs.
* **Enclosure Climate Sensor (External Add-on):**
  * **AHT20 + BMP280 Combo I2C Module:** Measures ambient enclosure temperature ($^\circ\text{C}$), relative humidity ($\text{\% RH}$), and barometric pressure ($\text{hPa}$).

---

## 2. Forensic History: What Was Fixed From MAChip 2.0 to MAChip 3.0

1. **ESP32 RF Ground Continuity:** In MAChip 2.0 (EasyEDA), ESP32 Ground Pins 20 and 26 were accidentally isolated on unrouted nets (`U1_GND2`, `U1_GND3`), causing severe ground bounce and Wi-Fi TX brownout resets. In MAChip 3.0, Pins 14, 20, and 26 are solidly tied to the continuous `B.Cu` ground plane.
2. **Power Delivery Collapse Eliminated:** MAChip 2.0 left `VIN` floating and back-powered the ESP32 through the `3V3` pin from a weak MB102 breadboard regulator that collapsed below $2.8\,\text{V}$ on Wi-Fi bursts. MAChip 3.0 feeds regulated $+5\,\text{V}$ into `U2` Pin 19 (`5V/VIN`) and uses a dedicated $600\,\text{mA}$ `RT9080-33GJ5` LDO (`U3`) for peripheral $3.3\,\text{V}$ loads.
3. **Separated SPI Chip Selects & Resets:**
   * In MAChip 2.0, both displays shared the same `TFT_CS` (`GPIO 33`), causing SPI bus lockup and FreeRTOS Task Watchdog Timer (TWDT) panics.
   * In MAChip 3.0, both TFT displays have independent Chip Select (`TFT_CS` = `IO33`, `TFT_CS_INSIDE` = `IO21`) and Data/Command (`TFT_DC` = `IO25`, `TFT_DC_INSIDE` = `IO22`) pins.
   * RFID Reset (`RFID_Resets` = `IO27`) and TFT Reset (`TFT_RESETS` = `IO15`) are physically separated so re-initializing the MFRC522 readers every 10 seconds never blanks or resets the TFT screens.
4. **SPI Signal Integrity & ESD Protection:** Added $22\,\Omega$ series source-termination resistors (`R9` on MOSI, `R18` on MISO, `R19` on SCK) and dual `ESDSRV05-4` TVS diode arrays (`U4`, `U5`) on external SPI/UART lines.

---

## 3. Exact Hardware Pinout & Netlist (`MACHIP3.0.kicad_pcb`)

### 3.1 ESP32 38-Pin DevKit (`U2`) Complete Pin-by-Pin Mapping

| U2 Pin # | ESP32 Pin Name | PCB Net Name | `Config.h` Macro | Connected Hardware / Function | Direction / Notes |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `3V3` | `unconnected-(U2-3V3-Pad1)` | *(Power Out)* | Internal 3.3V LDO output of DevKit | Can power external I2C sensor ($<1.5\,\text{mA}$) |
| **2** | `EN` | `Net-(U2-EN)` | *(Reset)* | `R3` ($10\,\text{k}\Omega$ to +3V3), `C9` ($100\,\text{nF}$ to GND), `TP_EN1` | Hardware Enable / Reset |
| **3** | `SENSOR_VP / IO36` | `unconnected` | *(Free Input)* | **FREE (Input-Only / ADC1_CH0)** | Can be used for analog inputs |
| **4** | `SENSOR_VN / IO39` | `unconnected` | *(Free Input)* | **FREE (Input-Only / ADC1_CH3)** | Can be used for analog inputs |
| **5** | `IO34` | `unconnected` | *(Free Input)* | **FREE (Input-Only / ADC1_CH6)** | Can be used for analog inputs |
| **6** | `IO35` | `unconnected` | *(Free Input)* | **FREE (Input-Only / ADC1_CH7)** | Can be used for analog inputs |
| **7** | `IO32` | `Buzzer` | `BUZZER` (`32`) | `R14` ($1\,\text{k}\Omega$) & `R15` ($10\,\text{k}\Omega$ pull-down) $\rightarrow$ `J7` Pin 2 (`SIG`) | Passive Buzzer LEDC PWM (`2730 Hz`) |
| **8** | `IO33` | `TFT_CS_OUTSIDE` | `TFT_CS` (`33`) | `J4` Pin 3 (`CS`) | Front/Outside ST7789 Chip Select (Active LOW) |
| **9** | `IO25` | `TFT_DC_OUTSIDE` | `TFT_DC` (`25`) | `J4` Pin 5 (`DC`) | Front/Outside ST7789 Data/Command |
| **10** | `IO26` | `SDA_RFID_INSIDE` | `SS_PIN_IN` (`26`) | `J2` Pin 1 (`SDA/CS`), `R4` ($10\,\text{k}\Omega$ pull-up to +3V3) | Front/Clock-In MFRC522 Chip Select (Active LOW) |
| **11** | `IO27` | `RFID_Resets` | `RFID_RESET_PIN` (`27`) | `J2` Pin 6 (`RST`), `J3` Pin 6 (`RST`), `R5`/`R6` ($10\,\text{k}\Omega$ pull-ups) | Shared Hardware Reset for Both RFIDs |
| **12** | `IO14` | `Red_Led` | `RED_LED` (`14`) | `R13` ($220\,\Omega$) $\rightarrow$ `D4` Pin 2 (Anode) | Red Status LEDs (Active HIGH) |
| **13** | `IO12` | `unconnected` | *(Free GPIO)* | **FREE GPIO** *(Boot Strapping Pin: must be LOW at boot)* | Available I/O |
| **14** | `GND` | `GND` | *(Ground)* | Solid `B.Cu` Ground Plane | System Ground |
| **15** | `IO13` | `Green_Led` | `GREEN_LED` (`13`) | `R12` ($220\,\Omega$) $\rightarrow$ `D3` Pin 2 (Anode) | Green Status LEDs (Active HIGH) |
| **16** | `SD2 / IO9` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |
| **17** | `SD3 / IO10` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |
| **18** | `CMD / IO11` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |
| **19** | `5V / VIN` | `+5V` | *(5V Input)* | `U1` Pin 3 (+5V Rail), `TP_5V1` | Main 5V Power Input to ESP32 DevKit |
| **20** | `GND` | `GND` | *(Ground)* | Solid `B.Cu` Ground Plane | System Ground |
| **21** | `IO23` | `Net-(U2-IO23)` $\rightarrow$ `MOSI` | `TFT_MOSI` (`23`) | Via `R9` ($22\,\Omega$) $\rightarrow$ `J2.3`, `J3.3`, `J4.6`, `J5.6` | Hardware VSPI MOSI |
| **22** | `IO22` | `TFT_DC_INSIDE` | `TFT_DC_INSIDE` (`22`) | `J5` Pin 5 (`DC`) | Back/Inside ST7789 Data/Command |
| **23** | `TX0 / IO1` | `unconnected` | *(UART0 TX)* | USB-UART0 TX | Used by USB Serial Monitor |
| **24** | `RX0 / IO3` | `unconnected` | *(UART0 RX)* | USB-UART0 RX | Used by USB Serial Monitor |
| **25** | `IO21` | `TFT_CS_INSIDE` | `TFT_CS_INSIDE` (`21`) | `J5` Pin 3 (`CS`) | Back/Inside ST7789 Chip Select (Active LOW) |
| **26** | `GND` | `GND` | *(Ground)* | Solid `B.Cu` Ground Plane | System Ground |
| **27** | `IO19` | `Net-(U2-IO19)` $\rightarrow$ `MISO` | `RFID_MISO` (`19`) | Via `R18` ($22\,\Omega$) $\rightarrow$ `J2.4`, `J3.4`, `J4.9`, `J5.9` | Hardware VSPI MISO |
| **28** | `IO18` | `Net-(U2-IO18)` $\rightarrow$ `SCK` | `TFT_SCK` (`18`) | Via `R19` ($22\,\Omega$) $\rightarrow$ `J2.2`, `J3.2`, `J4.7`, `J5.7` | Hardware VSPI SCK |
| **29** | `IO5` | `SDA_RFID_OUTSIDE` | `SS_PIN_OUT` (`5`) | `J3` Pin 1 (`SDA/CS`), `R7` ($10\,\text{k}\Omega$ pull-up to +3V3) | Back/Clock-Out MFRC522 Chip Select (Active LOW) |
| **30** | `IO17` | `FP_TX` | `FP_TX` (`17`) | Via `R8` ($68\,\Omega$) $\rightarrow$ `J6` Pin 4 (`RX`), `R11` ($10\,\text{k}\Omega$ to +3V3) | ESP32 UART2 TX $\rightarrow$ Fingerprint RX |
| **31** | `IO16` | `FP_RX` | `FP_RX` (`16`) | Via `R10` ($100\,\Omega$) $\leftarrow$ `J6` Pin 3 (`TX`) | ESP32 UART2 RX $\leftarrow$ Fingerprint TX |
| **32** | `IO4` | `RELAY_IN2` | `SOLENOID_PIN` (`4`) | Via `R16` ($1\,\text{k}\Omega$) & `R17` ($10\,\text{k}\Omega$ pull-down) $\rightarrow$ `Q2` Base (`PN2222A`) $\rightarrow$ `J8.2` | Relay Trigger (**HIGH = UNLOCK**, **LOW = LOCK**) |
| **33** | `IO0` | `unconnected` | `I2C_SDA_PIN` (`0`) | Wired to **`AHT20 + BMP280` I2C `SDA`** | External Casing Sensor Data |
| **34** | `IO2` | `unconnected` | `I2C_SCL_PIN` (`2`) | Wired to **`AHT20 + BMP280` I2C `SCL`** | External Casing Sensor Clock |
| **35** | `IO15` | `TFT_RESETS` | `TFT_RESET_PIN` (`15`) | `J4` Pin 4 (`RESET`), `J5` Pin 4 (`RESET`) | Shared Hardware Reset for Both TFT Displays |
| **36** | `SD1 / IO8` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |
| **37** | `SD0 / IO7` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |
| **38** | `CLK / IO6` | `unconnected` | *(Reserved)* | **DO NOT USE** (Internal SPI Flash) | Reserved for internal flash |

---

### 3.2 Connector Pinouts (`J1` – `J8`, `D3`, `D4`)

* **`J1` (DC Barrel Jack):** Pin 1 = `+9V Input` (to `F1.2`), Pin 2/3 = `GND`.
* **`J2` (`MFRC522_INSIDE`, 7-Pin JST-XH — Used as Front/Clock-In Reader `SS_PIN_IN`):**  
  `1: SDA_RFID_INSIDE (IO26)` | `2: SCK (IO18)` | `3: MOSI (IO23)` | `4: MISO (IO19)` | `5: GND` | `6: RFID_Resets (IO27)` | `7: +3V3`
* **`J3` (`MFRC522_OUTSIDE`, 7-Pin JST-XH — Used as Back/Clock-Out Reader `SS_PIN_OUT`):**  
  `1: SDA_RFID_OUTSIDE (IO5)` | `2: SCK (IO18)` | `3: MOSI (IO23)` | `4: MISO (IO19)` | `5: GND` | `6: RFID_Resets (IO27)` | `7: +3V3`
* **`J4` (`TFT_OUTSIDE`, 9-Pin JST-XH — Front Display `tft`):**  
  `1: +5V` | `2: GND` | `3: TFT_CS_OUTSIDE (IO33)` | `4: TFT_RESETS (IO15)` | `5: TFT_DC_OUTSIDE (IO25)` | `6: MOSI (IO23)` | `7: SCK (IO18)` | `8: +3V3 (BLK)` | `9: MISO (IO19)`
* **`J5` (`TFT_INSIDE`, 9-Pin JST-XH — Back Display `tftBack`):**  
  `1: +5V` | `2: GND` | `3: TFT_CS_INSIDE (IO21)` | `4: TFT_RESETS (IO15)` | `5: TFT_DC_INSIDE (IO22)` | `6: MOSI (IO23)` | `7: SCK (IO18)` | `8: +3V3 (BLK)` | `9: MISO (IO19)`
* **`J6` (`FingerPrint_R307`, 4-Pin JST-XH):**  
  `1: GND` | `2: +5V` | `3: TX (to ESP32 IO16/FP_RX via R10 100Ω)` | `4: RX (from ESP32 IO17/FP_TX via R8 68Ω & R11 10kΩ pull-up)`
* **`J7` (`BUZZER-MODULE-JST3`, 3-Pin JST-XH):**  
  `1: +3V3` | `2: SIG (from IO32 via R14 1kΩ & R15 10kΩ pull-down)` | `3: GND`
* **`J8` (`RELAY-MODULE-JST3`, 3-Pin JST-XH):**  
  `1: +5V` | `2: IN (driven low by Q2 PN2222A collector when IO4 is HIGH)` | `3: GND`
* **`D3` (`Green_Led`, 2-Pin JST-XH):**  
  `1: GND (Cathode)` | `2: Anode (from IO13 via R12 220Ω)`
* **`D4` (`Red_Led`, 2-Pin JST-XH):**  
  `1: GND (Cathode)` | `2: Anode (from IO14 via R13 220Ω)`

---

## 4. Real-World Hardware Modifications & Field Notes

1. **`Q1` Reverse-Polarity MOSFET Bridge (`A09T` vs `A19T`):**
   * During initial assembly, an N-Channel MOSFET (`A09T` / `AO3400`) was accidentally soldered onto `Q1` instead of the specified P-Channel MOSFET (`A19T` / `AO3401A`). Because the gate is pulled to `GND` via `R1` ($10\,\text{k}\Omega$), $V_{GS} = -9\,\text{V}$ kept the N-MOSFET completely off and its body diode reverse-biased.
   * **Current Workaround:** `Q1` Pin 2 (Source) and Pin 3 (Drain) are bridged with solder so $+9\,\text{V}$ flows directly to `U1`.
   * **Permanent Fix:** Replace `Q1` with a genuine P-Channel SOT-23 MOSFET marked **`A19T`** (`AO3401A`) or `SI2301`.
2. **`U1` 5V Regulator Upgrade (`LM7805` $\rightarrow$ `Traco Power TSR 1-2450`):**
   * The linear `LM7805` drops $9\,\text{V} \rightarrow 5\,\text{V}$, dissipating $(9\,\text{V} - 5\,\text{V}) \times 0.5\,\text{A} \approx 2.0\,\text{W}$ of pure heat inside the enclosure.
   * **Upgrade:** Replaced `U1` with a **`Traco Power TSR 1-2450`** ($5\,\text{V}$, $1\,\text{A}$ synchronous buck switching regulator, $94\%$ efficiency, $11.7 \times 7.5 \times 10.1\,\text{mm}$). Drops directly into the `U1` TO-220-3 footprint (`Pin 1 = +Vin`, `Pin 2 = GND`, `Pin 3 = +Vout`) with $>3.3\,\text{mm}$ clearance to nearest capacitors (`C6`, `C7`, `C3`), dissipates $<0.15\,\text{W}$, and requires **no heatsink**.
3. **Dual Status LED Y-Split Cable (`D3` & `D4`):**
   * Each LED connector (`D3` Green, `D4` Red) splits via an external Y-cable to drive two physical LEDs in parallel (Front/Outside panel + Back/Inside panel).
   * To prevent parallel LED current hogging while retaining the on-board $220\,\Omega$ resistors (`R12`, `R13`), solder a **$68\,\Omega$ ballast resistor** onto the positive (Anode) wire of **each** branch after the Y-split:
     $$\text{Effective Resistance per LED} = (2 \times 220\,\Omega) + 68\,\Omega = 508\,\Omega \implies I_{\text{Red}} \approx 2.75\,\text{mA},\; I_{\text{Green}} \approx 2.1\,\text{mA}$$
4. **External Casing Climate Sensor (`AHT20 + BMP280` 2-in-1 I2C Module):**
   * Mounted to the inner wall of the plastic enclosure via foam tape using a 4-wire cable:
     * **VCC (Red):** Soldered to **`TP_3V3`** test pad (or `U2` **Pin 1 `3V3`**). Draws $<1.5\,\text{mA}$.
     * **GND (Black):** Soldered to **`TP_GND1`** test pad (or `U2` **Pin 14 / Pin 20 `GND`**).
     * **SDA (Yellow):** Soldered to `U2` **Pin 33 (`GPIO 0`)** (`#define I2C_SDA_PIN 0` in `Config.h`).
     * **SCL (Green):** Soldered to `U2` **Pin 34 (`GPIO 2`)** (`#define I2C_SCL_PIN 2` in `Config.h`).
   * **I2C Addresses:** `AHT20` = **`0x38`** (Temperature & Humidity), `BMP280` = **`0x76`** or **`0x77`** (Barometric Pressure & Temperature).

---

## 5. Legacy Breadboard (`MAChip 2.0`) $\rightarrow$ Production `MACHIP 3.0` PCB Pin Migration Reference

| Signal / Function | Legacy Breadboard (`MAChip 2.0`) | **Production `MACHIP 3.0` PCB (`Config.h`)** | Hardware Notes on `MACHIP 3.0` PCB |
| :--- | :---: | :---: | :--- |
| **Green Status LED (`GREEN_LED`)** | `GPIO 12` | **`GPIO 13`** (`U2` Pin 15) | Drives `D3` via `R12` ($220\,\Omega$). Active HIGH. |
| **Red Status LED (`RED_LED`)** | `GPIO 13` | **`GPIO 14`** (`U2` Pin 12) | Drives `D4` via `R13` ($220\,\Omega$). Active HIGH. |
| **Door Relay / Solenoid (`SOLENOID_PIN`)** | `GPIO 14` | **`GPIO 4`** (`U2` Pin 32) | Drives NPN `Q2` (`PN2222A`) base via `R16`. **`HIGH` = UNLOCK, `LOW` = LOCK**. |
| **Buzzer (`BUZZER`)** | `GPIO 27` | **`GPIO 32`** (`U2` Pin 7) | Drives `J7` Pin 2 via `R14` ($1\,\text{k}\Omega$). Passive PWM @ `2730 Hz`. |
| **Front/Clock-In RFID CS (`SS_PIN_IN`)** | `GPIO 5` | **`GPIO 26`** (`U2` Pin 10) | Connected to `J2` Pin 1 (`SDA_RFID_INSIDE`). |
| **Back/Clock-Out RFID CS (`SS_PIN_OUT`)** | `GPIO 26` | **`GPIO 5`** (`U2` Pin 29) | Connected to `J3` Pin 1 (`SDA_RFID_OUTSIDE`). |
| **RFID Reset (`RFID_RESET_PIN`)** | `GPIO 32` & `GPIO 4` | **`GPIO 27`** (`U2` Pin 11) | Shared hardware reset for both `J2` & `J3` (`RFID_Resets`). |
| **Front TFT CS (`TFT_CS` on `J4`)** | `GPIO 33` | **`GPIO 33`** (`U2` Pin 8) | Connected to `J4` Pin 3 (`TFT_CS_OUTSIDE`). |
| **Front TFT DC (`TFT_DC` on `J4`)** | `GPIO 2` | **`GPIO 25`** (`U2` Pin 9) | Connected to `J4` Pin 5 (`TFT_DC_OUTSIDE`). |
| **Back Display (`tftBack` on `J5`)** | 0.96" I2C OLED | **2.4" SPI ST7789 (`J5`)** | Upgraded from OLED to full-color ST7789 SPI TFT! |
| **Back TFT CS (`TFT_CS_INSIDE` on `J5`)** | *(None — was I2C)* | **`GPIO 21`** (`U2` Pin 25) | Connected to `J5` Pin 3 (`TFT_CS_INSIDE`). |
| **Back TFT DC (`TFT_DC_INSIDE` on `J5`)** | *(None — was I2C)* | **`GPIO 22`** (`U2` Pin 22) | Connected to `J5` Pin 5 (`TFT_DC_INSIDE`). |
| **TFT Reset (`TFT_RESET_PIN`)** | `GPIO 25` | **`GPIO 15`** (`U2` Pin 35) | Shared hardware reset for both `J4` & `J5` (`TFT_RESETS`). |
| **SPI Bus (`MOSI / MISO / SCK`)** | `23 / 19 / 18` | **`23 / 19 / 18`** | Hardware VSPI with $22\,\Omega$ series damping (`R9`, `R18`, `R19`). |
| **Fingerprint UART2 (`FP_RX / FP_TX`)** | `16 / 17` | **`16 / 17`** | `IO16` = ESP32 RX2, `IO17` = ESP32 TX2. |
| **Casing Sensor I2C (`I2C_SDA / I2C_SCL`)** | *(None)* | **`0 / 2`** (`U2` Pin 33 & 34) | `AHT20` (`0x38`) + `BMP280` (`0x76`/`0x77`). |

---

## 6. Critical Firmware Architecture, Security & UI Engineering Rules

1. **SPI Bus Arbitration (`clearSpiBusPins()`):**
   * All 4 SPI devices (`rfidIN` on `GPIO 26`, `rfidOUT` on `GPIO 5`, `tft` on `GPIO 33`, `tftBack` on `GPIO 21`) share `SCK` (`18`), `MISO` (`19`), and `MOSI` (`23`).
   * Always call `clearSpiBusPins()` (which sets all 4 CS pins `HIGH`) before and after every SPI transaction.
   * For `tftBack` (`J5`), always wrap drawing operations with `digitalWrite(TFT_CS_INSIDE, LOW);` and `digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();`.
2. **Dual-TFT Shared Reset Rule (`TFT_RESET_PIN = 15`):**
   * Both `J4` (`tft`) and `J5` (`tftBack`) share physical reset line `GPIO 15` (`TFT_RESETS`).
   * Both `Adafruit_ST7789` objects are constructed with `rst = -1`:
     ```cpp
     Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, -1);
     Adafruit_ST7789 tftBack = Adafruit_ST7789(TFT_CS_INSIDE, TFT_DC_INSIDE, -1);
     ```
   * **CRITICAL BUG TO AVOID:** Never toggle `GPIO 15` LOW inside runtime UI functions (such as `resetBackDisplay()`), or **both** displays will blank out! Pulse `GPIO 15` LOW only once during `setup()` before initializing both displays.
3. **Preserve Required `DisplayManager.h` Function Signatures:**
   * `MaChip_Test.ino` and `HardwareDrivers.h` call these exact functions—do **not** rename or remove them when updating UI layouts:
     * `inline void drawFrame1UI()`
     * `inline void update2FACountdown(int secondsLeft)`
     * `inline void draw2FAChallengeUI(String employeeName, int secondsLeft = 15)`
     * `inline void tickRfidPulseAnimation()`
     * `inline void updateFrontDisplay(String header, String message, uint16_t color)`
     * `inline void updateBackDisplay(String line1, String line2)`
     * `inline void resetFrontDisplay()`
     * `inline void resetBackDisplay()`
4. **MFRC522 Antenna Gain Calibration (`applyOptimalAntennaGain()`):**
   * Reads `VersionReg`: sets `RxGain_33dB` for clone/compatible silicon (`0x82`/`0x88`/`0x12`) to prevent carrier overdrive, and `RxGain_43dB` for genuine NXP silicon (`0x91`/`0x92`).
5. **MIFARE Classic Anti-Clone & Anti-Replay Security (`RfidDriver.h`):**
   * Authenticates Sector 1 (Blocks 4–7) using custom key `MIFARE_KEY_MACJ` (`B5:2A:49:3B:7B:20`).
   * Unprovisioned factory cards (`FF:FF:FF:FF:FF:FF`) are automatically provisioned on first tap with the `"MACJ"` header in Block 4, a 32-bit monotonic counter + bitwise-inverted checksum in Block 5, and `MIFARE_KEY_MACJ` in Block 7.
   * Every clock-in/clock-out increments Block 5 and sends `cardCounter` in the HMAC-SHA256 signed JSON payload to the backend to block cloned UIDs and replay attacks.
6. **Web Console & API Endpoints (Port 80 on `machip-esp32.local`):**
   * Basic Auth credentials: `admin` / `machip2026` (defined in `Config.h`).
   * `GET /console` — Live HTML terminal + Casing Telemetry bar (AHT20 Temp/Hum, BMP280 Pressure, ESP32 Core Temp)
   * `GET /api/env` — Returns JSON `{"aht20_ok":true,"temperature":28.4,"humidity":61.2,"bmp280_ok":true,"pressure":1011.5,"bmp_temp":28.5,"esp32_core_temp":54.2}`
   * `POST /console/test-buzzer?freq=2730&duration=200` — Tests passive buzzer PWM
   * `POST /console/unlock` — Triggers 3-second relay unlock
   * `POST /console/reset-sensor` — Wipes all 162 fingerprint slots on the R307 module
   * `POST /console/discover` — Broadcasts `MACHIP_DISCOVER` on UDP port `4001` to auto-discover the Node.js backend IP
   * `POST /api/cancel` & `POST /api/reset-screen` — Remote enrollment abort & screen reset hooks called by the Node.js backend

---

## 7. MAChip Dual-TFT Hardware Display States Manual (Complete Operational Reference)

### 7.1 System Display Architecture & Roles

The MAChip hardware edge terminal uses an ESP32 microcontroller driving a **Dual ST7789 Color TFT Display** architecture over high-speed hardware SPI (`VSPI` bus: `SCK = GPIO 18`, `MISO = GPIO 19`, `MOSI = GPIO 23`, shared `TFT_RESET_PIN = GPIO 15`):

1. **FRONT TFT Display (`tft` on `J4` — Entrance / Turnstile Outside):**
   - **Resolution & Type:** $320 \times 240$ landscape IPS Color TFT (`ST7789` controller, `setRotation(3)`).
   - **Audience:** Employees entering the facility and visitors requesting remote clearance.
   - **Primary Function:** Standby branding with animated RFID pulsing waves, dynamic 2FA biometric verification prompts, live countdown timers, enrollment wizard cues, and clear security clearance/denial feedback.
   - **Hardware Pins (`J4`):** `TFT_CS` = **`GPIO 33`** (`U2` Pin 8), `TFT_DC` = **`GPIO 25`** (`U2` Pin 9), `TFT_RST` = **`GPIO 15`** (`U2` Pin 35).

2. **BACK TFT Display (`tftBack` on `J5` — Exit / Turnstile Inside):**
   - **Resolution & Type:** $320 \times 240$ landscape IPS Color TFT (`ST7789` controller, `setRotation(3)`).
   - **Audience:** Employees departing the facility.
   - **Primary Function:** Exit card tap confirmation, anti-passback exit validation, admin session lockout notices, and curfew warnings.
   - **Hardware Pins (`J5`):** `TFT_CS_INSIDE` = **`GPIO 21`** (`U2` Pin 25), `TFT_DC_INSIDE` = **`GPIO 22`** (`U2` Pin 22), `TFT_RST_INSIDE` = **`GPIO 15`** (`U2` Pin 35).

3. **Optional Legacy I2C OLED (`ENABLE_I2C_OLED = false` on MAChip 3.0 PCB):**
   - Kept in `DisplayManager.h` under `#elif ENABLE_I2C_OLED` only for backward compatibility with older single-TFT prototypes; disabled on `MACHIP 3.0` because `GPIO 21` and `GPIO 22` drive `J5` (`tftBack`). Operational telemetry is served live via `http://machip-esp32.local/console` and `/api/env`.

---

### 7.2 Master State Reference Matrix

#### Section A: User Provisioning & Enrollment States (Adding Users)

Triggered when HR or an Administrator enrolls a new employee's RFID badge or biometric fingerprint via the web dashboard (`frontend/src/components/rfidScanModal/RfidScanModal.jsx`).

| State ID | Trigger / Condition | FRONT TFT Display (Entrance) | BACK TFT Display (Exit) | Backend Mode Code (`rfid.controller.js`) | Web UI Modal State | Audio & Relay Feedback |
|---|---|---|---|---|---|---|
| **ENR-01** | Admin initiates RFID or FP capture session | **`ENROLL ACTIVE`**<br>`ID: <empId> \| Mode: <Type>`<br>*(Orange Header, White Text)* | **`LOCKED`**<br>`Admin Management`<br>*(Orange Header, White Text)* | `active: true`<br>`type: "RFID"` or `"FP"` | Modal opens with pulsing radar wave animation. Status: *"Ready to Scan"*. | Terminal pauses normal attendance; Green LED fast/slow blink. |
| **ENR-02** | RFID Card detected on Front Reader during session | **`SUCCESS`**<br>`RFID Credential Active`<br>*(Green Header, White Text)* | **`READY`**<br>`Scan Card Out` | `mode: "RFID_REG_SUCCESS"`<br>`isCapture: true` | Modal displays checkmark: *"The RFID card has been successfully linked."* | Double confirmation beep (`SUCCESS_OK`). Monotonic counter initialized in Sector 1. |
| **ENR-03** | Standalone Card Capture for web registration | **`CARD CAPTURED`**<br>`Assigned in Admin UI`<br>*(Green Header, White Text)* | **`CAPTURED`**<br>`Admin Assigned` | `isCapture: true`<br>`message: "CAPTURE OK"` | Modal inputs auto-populate the scanned UID. | Double confirmation beep (`SUCCESS_OK`). Solenoid remains locked. |
| **ENR-04** | RFID Enrollment timeout (30 seconds without tap) | **`TIMEOUT`**<br>`RFID Scan Timed Out`<br>*(Red Header, White Text)* | **`READY`**<br>`Scan Card Out` | Session expired in cache (`expiresAt`) | Modal alert: *"RFID scan timed out. Click rescan to try again."* | Long error tone (`ERROR_FAIL`). Display returns to `READY` after 1.5s. |
| **ENR-05** | Biometric Stage 0: Sensor ready for finger | **`ENROLL BIOMETRIC`**<br>`Press pad firmly with finger...`<br>*(Blue Header, White Text)* | **`LOCKED`**<br>`Admin Management` | `mode: "WAITING_FOR_FINGERPRINT"` | Modal prompt: *"Please place the employee's finger on the sensor to begin enrollment."* | Optical sensor illumination turns on. |
| **ENR-06** | Biometric Stage 0: Finger resting before prompt | **`RELEASE SENSOR`**<br>`Lift finger off pad first...`<br>*(Yellow Header, White Text)* | **`LOCKED`**<br>`Admin Management` | Internal probe check | Modal warning: *"Please lift finger from the glass sensor before starting."* | Intermittent yellow status alert. |
| **ENR-07** | Biometric Stage 1: First scan captured | **`ENROLL BIOMETRIC`**<br>`First Scan OK! Release sensor...`<br>*(Yellow Header, White Text)* | **`LOCKED`**<br>`Admin Management` | Image converted to CharBuffer 1 | Modal progress indicator: 50% completed. Prompt: *"Release sensor"*. | Short confirmation chirp (100ms). |
| **ENR-08** | Biometric Deduplication Collision | **`DUPLICATE`**<br>`Finger already enrolled!`<br>`Abort and Check Admin`<br>*(Red Header, White Text)* | **`LOCKED`**<br>`Admin Management` | `duplicateSlot: <id>`<br>`errorMessage: "Duplicate fingerprint detected"` | Modal conflict banner: *"This finger is already registered to <User> (Slot #X)."* | Triple error buzz (`ERROR_FAIL`). Aborts session to prevent identity collision. |
| **ENR-09** | Biometric Stage 2: Prompt for verification scan | **`ENROLL BIOMETRIC`**<br>`Verify: Press same finger again...`<br>*(Blue Header, White Text)* | **`LOCKED`**<br>`Admin Management` | Awaiting CharBuffer 2 capture | Modal prompt: *"Press the same finger firmly once more to verify enrollment."* | Short chirp (80ms). Optical sensor re-arms. |
| **ENR-10** | Biometric Stage 3: Templates matched and saved | **`SUCCESS`**<br>`Biometric Slot <slotId> Saved`<br>*(Green Header, White Text)* | **`READY`**<br>`Scan Card Out` | `success: true`<br>`slotId: <finalSlotId>` | Modal shows green checkmark: *"Fingerprint enrolled into Slot #X"*. | Double high beep (`SUCCESS_OK`). Template stored to R307 flash memory. |
| **ENR-11** | Biometric Stage 3: First and second scan mismatch | **`MISMATCH`**<br>`Templates do not match`<br>*(Red Header, White Text)* | **`LOCKED`**<br>`Admin Management` | `success: false`<br>`error: "Templates do not match"` | Modal error: *"First and second scans did not match. Please try again."* | Long error buzz (`ERROR_FAIL`). Target slot purged from sensor. |
| **ENR-12** | Biometric timeout (Stage 1, 2, or 3 exceeds timeout) | **`READY`**<br>`Scan RFID Card to Login` | **`READY`**<br>`Scan Card Out` | Session timeout in cache | Modal error: *"Biometric enrollment timed out"*. | Long error buzz (`ERROR_FAIL`). Terminal resets. |
| **ENR-13** | Admin closes modal or cancels enrollment | **`CANCELLED`**<br>`Enrollment Aborted`<br>*(Yellow Header, White Text)* | **`READY`**<br>`Scan Card Out` | `session/clear` dispatched | Modal unmounts. | Terminal returns to `READY` after 1 second. |
| **ENR-14** | Slot Rollback triggered by deletion | **`ROLLBACK`**<br>`Purging cancelled slot <slotId>`<br>*(Yellow Header, White Text)* | **`READY`**<br>`Scan Card Out` | `type: "DELETE_SLOT"` | User deleted or re-enrolled; previous slot released. | R307 model purged via `deleteModel(slotId)`. |

---

#### Section B: Normal Attendance & Verification States

| State ID | Trigger / Condition | FRONT TFT Display (Entrance) | BACK TFT Display (Exit) | Backend Mode Code (`rfid.controller.js`) | Visual Layout & Colors | Hardware Action |
|---|---|---|---|---|---|---|
| **ATT-01** | Hardware Boot & Self-Test | **`BOOTING`**<br>`Running Hardware Self-Test...` | **`BOOTING`**<br>`Checking sensors...` | Telemetry Handshake | Yellow header, black screen, white body text | Verifies SPI bus, optical sensor, AHT20+BMP280, and Wi-Fi link. |
| **ATT-02** | Idle Standby Mode (Entrance) | **`READY`**<br>`Scan RFID Card to Login`<br>*(Full Graphic Canvas)* | **`READY`**<br>`Scan Card Out` | N/A | **Frame 1 Bitmap**: Full $320 \times 240$ custom company template with non-blocking $112 \times 80$ pulsing RFID waves at `(200, 78)`. | Solenoid locked. Green status LED pulsing slowly. |
| **ATT-03** | 2FA Challenge Triggered | **`2FA CHALLENGE`**<br>`<EMPLOYEE NAME>`<br>`TIME REMAINING: 15 SECONDS` | **`READY`**<br>`Scan Card Out` | `WAITING_FOR_FINGERPRINT_2FA` | **Frame 2 Bitmap**: Full $320 \times 240$ biometric challenge layout. Employee name in Cyan, live timer in White (switches to **Red** at $\le 5\text{s}$). | Short chirp (`WAITING_SCAN`). Optical sensor ring illuminates. |
| **ATT-04** | 2FA Fingerprint Matched (Clock-In) | **`VERIFIED`**<br>`<Employee Name>`<br>`Door Released`<br>*(Green Header)* | **`READY`**<br>`Scan Card Out` | `success: true`<br>`action: "clock_in"` | Green header (`ST77XX_GREEN`), employee name in bold white. | High double beep (`SUCCESS_OK`). Solenoid energized for 3 seconds. |
| **ATT-05** | Single-Factor Card Clock-In (Exempt) | **`VERIFIED`**<br>`<Employee Name>`<br>`Attendance Clocked In`<br>*(Green Header)* | **`READY`**<br>`Scan Card Out` | `success: true`<br>`action: "clock_in"` | Green header (`ST77XX_GREEN`), employee name in bold white. | High double beep (`SUCCESS_OK`). Solenoid energized for 3 seconds. |
| **ATT-06** | Clock-Out Approved (Exit Reader) | **`READY`**<br>`Scan RFID Card to Login` | **`APPROVED`**<br>`Goodbye!`<br>*(Green Header)* | `success: true`<br>`action: "clock_out"` | Green header on Back display, white greeting text. | High double beep (`SUCCESS_OK`). Exit solenoid energized for 3 seconds. |
| **ATT-07** | Visitor Authorized Remote Unlock | **`VISITOR ACCESS`**<br>`Authorized Remote Open`<br>`Welcome!`<br>*(Cyan Header)* | **`VISITOR`**<br>`Remote Authorized` | `type: "VISITOR_OPEN"` | Cyan header (`ST77XX_CYAN`) on Front, Green header on Back display. | Double confirmation beep. Turnstile unlocked for 3.5–5 seconds. |

---

#### Section C: Access Denial & Security Fault States ("No Entry" / Errors)

| State ID | Failure Cause | FRONT TFT Display (Entrance) | BACK TFT Display (Exit) | Backend Mode Code (`rfid.controller.js`) | Technical Explanation & Root Cause |
|---|---|---|---|---|---|
| **ERR-01** | **Unregistered Card ("No Entry")** | **`DENIED`**<br>`Card not enrolled`<br>*(Red Header, White Text)* | **`DENIED`**<br>`Card not enrolled` | `CARD_NOT_ENROLLED`<br>`success: false` | The scanned RFID UID does not exist in the `User_Hardware` database table. Solenoid remains strictly locked; single low error buzz (`ERROR_FAIL`). |
| **ERR-02** | **Inactive / Terminated Account** | **`DENIED`**<br>`Access Denied: Inactive / Separated Account`<br>*(Red Header)* | **`DENIED`**<br>`Access Denied: Inactive / Separated Account` | `ACCOUNT_INACTIVE`<br>`success: false` | Employee account is marked with `user_EmploymentStatusId = 5` (Resigned) or `6` (Terminated). Access denied. |
| **ERR-03** | **2FA Unknown Fingerprint** | **`ACCESS FORBIDDEN`**<br>`Biometric Unknown`<br>*(Red Header, White Text)* | **`READY`**<br>`Scan Card Out` | Local R307 `FINGERPRINT_NOTFOUND` | The finger scanned during a 2FA challenge does not match any template in the optical sensor database. Increments card failure counter. |
| **ERR-04** | **2FA Token ID Mismatch** | **`SECURITY FAULT`**<br>`Token ID Mismatch`<br>`Event Dispatched!`<br>*(Red Header)* | **`READY`**<br>`Scan Card Out` | Firmware mismatch:<br>`fingerID != expectedFingerId` | Card belongs to Employee A, but Employee B placed their enrolled finger. Potential credential sharing or stolen card attempt. Security log dispatched to audit ledger. |
| **ERR-05** | **2FA Verification Timeout** | **`TIMEOUT`**<br>`2FA Verification Timeout`<br>*(Red Header, White Text)* | **`READY`**<br>`Scan Card Out` | Timer elapsed:<br>`elapsed >= TIMEOUT_2FA` (15s) | Employee tapped card but failed to scan their finger within the 15-second challenge window. Solenoid remains locked. |
| **ERR-06** | **Security Brute-Force Lockout** | **`LOCKED OUT`**<br>`Security Lockout`<br>`Wait <Xs> to Tap`<br>*(Red Header)* | **`LOCKED`**<br>`Wait <Xs>` | `CARD_LOCKED`<br>`remainingSec: <seconds>` | Card triggered 3 consecutive failed biometric attempts. The card is locked in memory for 300 seconds (5 minutes). All subsequent taps are rejected until the cooldown expires. |
| **ERR-07** | **Cloned / Replay Card Attack** | **`SECURITY FAULT`**<br>`Replay/Clone Card`<br>`Access Blocked!`<br>*(Red Header)* | **`SECURITY`**<br>`Replay Blocked` | `REPLAY_ATTACK`<br>`success: false` | MIFARE Classic Sector 1 monotonic counter did not increment (`counter <= dbCounter`). Potential card clone or replay attack. Card is blocked and incident is flagged in audit log. |
| **ERR-08** | **Curfew Restriction (10PM - 6AM)** | **`CURFEW RESTRICTION`**<br>`Facility Closed`<br>`(10PM - 6AM)`<br>*(Red Header)* | **`RESTRICTED`**<br>`Curfew (10PM-6AM)` | `HOURS_RESTRICTED`<br>`success: false` | Employee attempted entry between 10:00 PM and 6:00 AM without an approved Overtime Permit or designated Night Shift assignment. |
| **ERR-09** | **Fingerprint Enrollment Required** | **`DENIED`**<br>`<Name>`<br>`Fingerprint Required!`<br>*(Red Header)* | **`DENIED`**<br>`Fingerprint Required!` | `FINGERPRINT_REQUIRED`<br>`success: false` | Employee is required to use 2FA, but no primary biometric slot has been enrolled in `User_Hardware`. User must visit HR to complete enrollment. |
| **ERR-10** | **Anti-Passback: Already Inside** | **`ACCESS DENIED`**<br>`<Name>`<br>`Already Inside!`<br>*(Red Header)* | **`READY`**<br>`Scan Card Out` | `ALREADY_INSIDE`<br>`success: false` | Employee tapped the entrance reader, but their last recorded attendance log was already an IN punch. Prevents tailgating and card passback. |
| **ERR-11** | **Anti-Passback: Already Outside** | **`READY`**<br>`Scan RFID Card to Login` | **`DENIED`**<br>`Already Outside`<br>*(Red/Green Header)* | `ALREADY_OUTSIDE`<br>`success: false` | Employee tapped the exit reader, but their last recorded log was already an OUT punch. Prevents double clock-outs and ghost punches. |
| **ERR-12** | **Rapid-Tap Spam Protection** | **`DENIED`**<br>`Too fast! Wait <Xs>`<br>*(Red Header, White Text)* | **`DENIED`**<br>`Too fast! Wait <Xs>` | `RAPID_TAP`<br>`success: false` | Same card tapped within the 5-second cooldown window. Throttled to prevent database race conditions and protect solenoid relay coils. |

---

#### Section D: Hardware, Bus & Network Diagnostics States

| State ID | Fault Condition | FRONT TFT Display (Entrance) | BACK TFT Display (Exit) | Root Cause & Edge Behavior |
|---|---|---|---|---|
| **SYS-01** | **Wi-Fi / LAN Disconnection** | **`OFFLINE`**<br>`Network Pipeline Down`<br>*(Red Header, White Text)* | **`OFFLINE`**<br>`Local Denied`<br>*(Green/Red Header)* | ESP32 lost Wi-Fi connection (`WiFi.status() != WL_CONNECTED`). Hardware switches to offline buffer mode; transactions queued in RAM/flash. |
| **SYS-02** | **Backend / Database HTTP Failure** | **`BUS ERROR`**<br>`Database Connection Lost`<br>*(Red Header, White Text)* | **`NET ERROR`**<br>`Code: <httpCode>` | Express server returned an HTTP error code (e.g., 500, 502) or timed out connecting to PostgreSQL. |
| **SYS-03** | **Factory Memory Reset (Active)** | **`HARDWARE RESET`**<br>`Wiping sensor memory...`<br>*(Red Header)* | **`LOCKED`**<br>`Admin Management` | Admin executed hardware memory wipe from Admin Settings via `/api/esp/fingerprint/clear-all` or Web Console `/console/reset-sensor`. |
| **SYS-04** | **Factory Memory Reset (Success)** | **`SUCCESS`**<br>`Sensor memory wiped.`<br>*(Green Header)* | **`READY`**<br>`Scan Card Out` | Sensor database emptied (`finger.emptyDatabase() == FINGERPRINT_OK`). All slots 1–162 wiped. |
| **SYS-05** | **Factory Memory Reset (Failed)** | **`ERROR`**<br>`Failed to clear sensor.`<br>*(Red Header)* | **`READY`**<br>`Scan Card Out` | R307 UART packet error or checksum verification failed. |
| **SYS-06** | **Remote Screen Reset Command** | **`READY`**<br>`Scan RFID Card to Login`<br>*(Frame 1 Redrawn)* | **`READY`**<br>`Scan Card Out` | Admin clicked "Reset TFT Screen" button on the Web Dashboard Home page (`/api/reset-screen`). Resets stuck displays. |

---

### 7.3 UI Display Layout & Color Standards

All display routines are defined in [`DisplayManager.h`](file:///home/achyllisss/Documents/Projects/MaChip/firmware/MaChip_Test/DisplayManager.h) with strict anti-ghosting bounding boxes:

```text
┌────────────────────────────────────────────────────────┐
│ MACHIP CLOCK-IN STATION       (ST77XX_ORANGE, Size 2)  │  Y = 15
├────────────────────────────────────────────────────────┤  Y = 38 (FastHLine)
│                                                        │
│ HEADER TEXT                   (Dynamic Color, Size 3)  │  Y = 55
│                                                        │
├────────────────────────────────────────────────────────┤  Y = 105
│                                                        │
│ SUBTITLE / MESSAGE BODY       (ST77XX_WHITE, Size 2)   │  Y = 115
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Color Palette Constants (16-bit RGB565)
- **`ST77XX_GREEN` (`0x07E0`)**: Success events, approved entries, active standby graphics.
- **`ST77XX_RED` (`0xF800`)**: Access denials, security faults, duplicate conflicts, countdown alerts under 5 seconds.
- **`ST77XX_YELLOW` (`0xFFE0`)**: Hardware booting, fingerprint intermediate step prompts, enrollment cancellation.
- **`ST77XX_BLUE` (`0x001F`)**: Active biometric fingerprint sensor touch prompts.
- **`ST77XX_CYAN` (`0x07FF`)**: Dynamic employee name rendering during 2FA, remote visitor unlocks.
- **`ST77XX_ORANGE` (`0xFD20`)**: System branding banners, admin enrollment mode active.

#### Display Timing Profiles
- **Denial / Error Screen Hold**: **3,000 ms** before auto-reverting to `READY`.
- **Capture Confirmation Hold**: **2,500 ms** before auto-reverting to `READY`.
- **Solenoid Relay Energize**: **3,000 ms** (Entrance & Exit), **3,500–5,000 ms** (Visitor Remote Open).
- **2FA Challenge Countdown**: **15 seconds** strict timeout with visual color change to red at $\le 5$ seconds.
- **RFID Pulse Wave Step**: **200 ms** per animation frame (6 steps total).
