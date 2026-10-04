# MACHIP 3.0 Hardware Terminal (PCB & Schematic)

This directory contains the official KiCad 8/10 hardware design files, production Gerbers, bill of materials (BOM), and assembly guides for the **MACHIP 3.0 Access Control Terminal**.

---

## Quick Navigation

- **KiCad Project File:** [`MACHIP3.0.kicad_pro`](MACHIP3.0.kicad_pro)
- **Schematic File:** [`MACHIP3.0.kicad_sch`](MACHIP3.0.kicad_sch)
- **PCB Layout File:** [`MACHIP3.0.kicad_pcb`](MACHIP3.0.kicad_pcb)
- **Production Gerbers (JLCPCB Ready):** [`MACHIP3.0_JLCPCB_READY.zip`](MACHIP3.0_JLCPCB_READY.zip)
- **Verified Component BOM (LCSC):** [`MACHIP3.0_JLCPCB_BOM_CORRECTED.csv`](MACHIP3.0_JLCPCB_BOM_CORRECTED.csv)
- **Hardware Assembly & Bring-Up Guide:** [`MACHIP3_HARDWARE_BRINGUP_AND_ASSEMBLY_GUIDE.md`](MACHIP3_HARDWARE_BRINGUP_AND_ASSEMBLY_GUIDE.md)
- **Pre-Fab Engineering Audit Report:** [`MACHIP3_PCB_LAYOUT_AUDIT_REPORT.md`](MACHIP3_PCB_LAYOUT_AUDIT_REPORT.md)

---

## How to Open on Your Laptop

### Option 1: In KiCad (Full Design & Editing)
1. Install **KiCad 8.0+** (or KiCad 10).
2. Clone this repository or download this folder.
3. Open KiCad $\to$ **File** $\to$ **Open Project** $\to$ Select `MACHIP3.0.kicad_pro`.
4. *Custom Footprints & Symbols:* The included `fp-lib-table`, `sym-lib-table`, and `machip_footprints.pretty/` will load all custom footprints automatically without library warnings.

### Option 2: In Web Browser (No Installation Needed!)
You can view the schematic and PCB interactively online:
1. Go to [kicanvas.org](https://kicanvas.org).
2. Drag and drop `MACHIP3.0.kicad_sch` or `MACHIP3.0.kicad_pcb` directly into your browser.

---

## Hardware Specifications

- **Controller:** ESP32-WROOM-32 (38-Pin DevKit Socket)
- **Operating Voltage:** 9.0V DC Regulated Input (5.5mm × 2.1mm Center-Positive Barrel Jack)
- **Onboard Regulators:**
  - `U1` (LM7805 TO-220 + Aluminum Heatsink): 5V System Bus
  - `U3` (RT9080-33GJ5 SOT-23-5): 3.3V Logic Rail (600mA Low-Dropout)
- **Peripherals Supported:**
  - `J2`: Inside MFRC522 RFID Reader (SPI, 7-Pin JST-XH)
  - `J3`: Outside MFRC522 RFID Reader (SPI, 7-Pin JST-XH)
  - `J4`: Outside ST7789 TFT Display (SPI, 9-Pin JST-XH)
  - `J5`: Inside ST7789 TFT Display (SPI, 9-Pin JST-XH)
  - `J6`: R307 Optical Fingerprint Sensor (UART, 4-Pin JST-XH)
  - `J7`: Active Buzzer Module (3-Pin JST-XH)
  - `J8`: 12V Door Strike / Maglock Relay Driver (3-Pin JST-XH)
- **Protection:**
  - Reverse Polarity: P-Channel MOSFET (`AO3401`) + Zener (`BZT52C10`)
  - Overcurrent: Resettable PTC Fuse (`RXEF110`, 1.1A Hold)
  - Overvoltage / Surge: Bidirectional TVS Diode (`SMBJ10CA`)
  - ESD Protection: Multichannel TVS Arrays (`ESDSRV05-4`) on peripheral lines
- **Dimensions:** $111.5\,\text{mm} \times 101.0\,\text{mm}$ (2-Layer FR-4, 1.6mm thickness, 1 oz copper)
- **Mounting:** 4× M3 Mounting Holes (`H1`–`H4`) with $>6.5\,\text{mm}$ annular clearance
