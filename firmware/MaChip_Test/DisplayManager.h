#pragma once
#include "Config.h"
#include "Bitmaps.h"

// ============================================================================
// ARCHITECTURAL GUARDRAIL (MODE A - UI & DISPLAY STANDARDS)
// 1. Existing full-screen UI templates use RLE compression into rleBitmapBuffer[9600].
// 2. For any NEW UI states or dialogs (Section 7 Dual-TFT Manual):
//    - DO NOT create new full-screen 320x240 bitmaps for borders/banners/headers.
//    - Draw banners, status boxes, borders, and dividers using native Adafruit_GFX
//      primitives (fillRect, drawRect, drawRoundRect, drawFastHLine).
//    - Any new bitmap assets must strictly be cropped icons (e.g., 64x64, 112x80)
//      stored with PROGMEM in Bitmaps.h.
// ============================================================================

// ── LOSSLESS ZERO-RUN RLE BITMAP STREAMING ENGINE ─────────────────
// Static scratch buffer for decompressing 320x240 monochrome bitmaps (9,600 bytes)
static uint8_t rleBitmapBuffer[9600];

// Decompresses Zero-Run RLE stream [0x00, count] or literal non-zero from PROGMEM in ~25us on ESP32
inline void decodeRLEBitmap(const uint8_t *src, size_t srcLen, uint8_t *dest, size_t destLen) {
  size_t si = 0;
  size_t di = 0;
  while (si < srcLen && di < destLen) {
    uint8_t val = pgm_read_byte(&src[si++]);
    if (val == 0) {
      if (si < srcLen) {
        uint8_t count = pgm_read_byte(&src[si++]);
        while (count-- > 0 && di < destLen) {
          dest[di++] = 0;
        }
      }
    } else {
      dest[di++] = val;
    }
  }
}

inline void drawRLEBitmap(Adafruit_ST7789 &display, int16_t x, int16_t y,
                          const uint8_t *rleData, size_t rleLen,
                          int16_t w, int16_t h, uint16_t color, uint16_t bg) {
  decodeRLEBitmap(rleData, rleLen, rleBitmapBuffer, (size_t)(w * h / 8));
  display.drawBitmap(x, y, rleBitmapBuffer, w, h, color, bg);
}

// ── CUSTOM BITMAP & UI FRAME DRAWERS ─────────────────────────────
inline void drawFrame1UI() {
  clearSpiBusPins();
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Frame_1, sizeof(epd_bitmap_Frame_1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  clearSpiBusPins();
  isFrontDisplayInReady = true;
}

inline void drawBackReadyUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_Your_paragraph_text__1_, sizeof(epd_bitmap_Your_paragraph_text__1_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

inline void drawBackAlreadyOutsideUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_Your_paragraph_text__2_, sizeof(epd_bitmap_Your_paragraph_text__2_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

inline void drawBackAlreadyInsideUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_Your_paragraph_text__5_, sizeof(epd_bitmap_Your_paragraph_text__5_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

inline void drawBackAdminLockedUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ENR1___B__1_, sizeof(epd_bitmap_ENR1___B__1_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

inline void drawFrontAlreadyOutsideUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Your_paragraph_text__2_, sizeof(epd_bitmap_Your_paragraph_text__2_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontAlreadyInsideUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Your_paragraph_text__5_, sizeof(epd_bitmap_Your_paragraph_text__5_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ── RFID ENROLLMENT DRAWERS (BITMAP 4 & 30-SECOND COUNTDOWN) ──────
inline void updateRfidEnrollCountdown(int secondsLeft) {
  if (secondsLeft < 0) secondsLeft = 0;
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);

  // Wipe only the countdown text area (X: 16..130, Y: 112..124) to eliminate flicker
  tft.fillRect(16, 112, 114, 14, ST77XX_BLACK);

  String timerStr = String(secondsLeft) + (secondsLeft == 1 ? " SECOND" : " SECONDS");

  // Red alert warning at 5 seconds or less
  uint16_t timerColor = (secondsLeft <= 5) ? ST77XX_RED : ST77XX_WHITE;
  tft.setTextColor(timerColor, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(16, 114);
  tft.print(timerStr);

  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
}

inline void drawFrontRfidEnrollUI(int initialSeconds = 30) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Your_paragraph_text__4_, sizeof(epd_bitmap_Your_paragraph_text__4_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();

  updateRfidEnrollCountdown(initialSeconds);
  isFrontDisplayInReady = false;
}

// ── FINGERPRINT ENROLLMENT STAGE 1 DRAWERS (ENR5 FP - F & 30-SECOND COUNTDOWN) ──
inline void updateFpEnrollCountdown(int secondsLeft) {
  if (secondsLeft < 0) secondsLeft = 0;
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);

  // Wipe only the countdown text area (X: 16..130, Y: 150..162) to eliminate flicker
  tft.fillRect(16, 150, 114, 14, ST77XX_BLACK);

  String timerStr = String(secondsLeft) + (secondsLeft == 1 ? " SECOND" : " SECONDS");

  // Red alert warning at 5 seconds or less
  uint16_t timerColor = (secondsLeft <= 5) ? ST77XX_RED : ST77XX_WHITE;
  tft.setTextColor(timerColor, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(16, 152);
  tft.print(timerStr);

  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
}

inline void drawFrontFpEnrollStage1UI(int initialSeconds = 30) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR5_FP___F, sizeof(epd_bitmap_ENR5_FP___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();

  updateFpEnrollCountdown(initialSeconds);
  isFrontDisplayInReady = false;
}

inline void drawFrontFpEnrollConfirmUI(int initialSeconds = 30) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR9___F, sizeof(epd_bitmap_ENR9___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();

  updateFpEnrollCountdown(initialSeconds);
  isFrontDisplayInReady = false;
}

// ── FINGERPRINT TIMEOUT, CANCELLATION & 2FA ACCESS GRANTED DRAWERS ─
inline void drawFrontFpTimeoutUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR12___F, sizeof(epd_bitmap_ENR12___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpCancelUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR13___F, sizeof(epd_bitmap_ENR13___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontAccessGrantedUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ATT4, sizeof(epd_bitmap_ATT4), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ── RFID CANCEL, CURFEW RESTRICTION & FINGERPRINT SUCCESS DRAWERS ──
inline void drawFrontRfidCancelUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR13___F__1_, sizeof(epd_bitmap_ENR13___F__1_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontCurfewErrorUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR8, sizeof(epd_bitmap_ERR8), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpSuccessUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR10___F__1_, sizeof(epd_bitmap_ENR10___F__1_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ── FRAME 2: 2FA BIOMETRIC CHALLENGE DRAWERS ─────────────────────
inline void update2FACountdown(int secondsLeft) {
  if (secondsLeft < 0) secondsLeft = 0;
  clearSpiBusPins();

  // Wipe only the countdown text bounding box to prevent ghosting
  tft.fillRect(20, 201, 280, 16, ST77XX_BLACK);

  String timerStr = "TIME REMAINING: " + String(secondsLeft) + (secondsLeft == 1 ? " SECOND" : " SECONDS");
  int timerX = (320 - (timerStr.length() * 6)) / 2;
  if (timerX < 20) timerX = 20;

  // Visual warning: red under 5 seconds, white otherwise
  uint16_t timerColor = (secondsLeft <= 5) ? ST77XX_RED : ST77XX_WHITE;
  tft.setTextColor(timerColor, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(timerX, 205);
  tft.print(timerStr);

  clearSpiBusPins();
}

inline void draw2FAChallengeUI(String employeeName, int secondsLeft = 15) {
  clearSpiBusPins();
  isFrontDisplayInReady = false;

  // 1. Render Frame 2 base template (Fingerprint icon, banner, instructions, border)
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Frame_2, sizeof(epd_bitmap_Frame_2), 320, 240, ST77XX_WHITE, ST77XX_BLACK);

  // 2. Render Dynamic Employee Name (centered at Y=132..136)
  tft.fillRect(15, 126, 290, 24, ST77XX_BLACK);
  
  if (employeeName.length() == 0) employeeName = "EMPLOYEE";
  employeeName.toUpperCase();

  int textSize = (employeeName.length() > 20) ? 1 : 2;
  int charWidth = (textSize == 2) ? 12 : 6;
  int nameX = (320 - (employeeName.length() * charWidth)) / 2;
  if (nameX < 18) nameX = 18;

  tft.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tft.setTextSize(textSize);
  tft.setCursor(nameX, (textSize == 2) ? 132 : 136);
  tft.print(employeeName);

  // 3. Render Initial Countdown Timer
  tft.fillRect(20, 201, 280, 16, ST77XX_BLACK);
  String timerStr = "TIME REMAINING: " + String(secondsLeft) + (secondsLeft == 1 ? " SECOND" : " SECONDS");
  int timerX = (320 - (timerStr.length() * 6)) / 2;
  if (timerX < 20) timerX = 20;

  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(timerX, 205);
  tft.print(timerStr);

  clearSpiBusPins();
}

// ── NON-BLOCKING RFID PULSE ANIMATION (Disabled for hardware SPI stability) ──
inline void tickRfidPulseAnimation() {
  // Disabled to prevent continuous 24MHz SPI bus saturation and 3.3V rail ripple
  return;
}

// ── LANDSCAPE OPTIMIZED NON-BLOCKING UI LAYOUT DRAWERS ───────────
inline void updateFrontDisplay(String header, String message, uint16_t color) {
  clearSpiBusPins();
  
  if (header == "READY") {
    clearSpiBusPins();
    isFrontDisplayInReady = true;
    // Render the custom 320x240 image2cpp Frame 1 UI layout
    drawRLEBitmap(tft, 0, 0, epd_bitmap_Frame_1, sizeof(epd_bitmap_Frame_1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
    clearSpiBusPins();
    return;
  }

  if (header == "2FA CHALLENGE") {
    draw2FAChallengeUI(message, 15);
    return;
  }

  if (header == "ALREADY_OUTSIDE" || (header == "ACCESS DENIED" && message.indexOf("Outside") >= 0)) {
    drawFrontAlreadyOutsideUI();
    return;
  }

  if (header == "ALREADY_INSIDE" || (header == "ACCESS DENIED" && message.indexOf("Inside") >= 0)) {
    drawFrontAlreadyInsideUI();
    return;
  }

  if (header == "ENROLL BIOMETRIC" && message.indexOf("Press pad") >= 0) {
    drawFrontFpEnrollStage1UI(30);
    return;
  }

  if (header == "ENROLL BIOMETRIC" && (message.indexOf("Verify") >= 0 || message.indexOf("same finger") >= 0)) {
    drawFrontFpEnrollConfirmUI(30);
    return;
  }

  if (header == "FP_TIMEOUT") {
    drawFrontFpTimeoutUI();
    return;
  }

  if (header == "FP_CANCEL") {
    drawFrontFpCancelUI();
    return;
  }

  if (header == "RFID_CANCEL" || (header == "CANCELLED" && message.indexOf("Aborted") >= 0)) {
    drawFrontRfidCancelUI();
    return;
  }

  if (header == "CURFEW RESTRICTION" || header == "HOURS_RESTRICTED" || message.indexOf("Facility Closed") >= 0) {
    drawFrontCurfewErrorUI();
    return;
  }

  if (header == "FP_SUCCESS" || (header == "SUCCESS" && message.indexOf("Biometric") >= 0)) {
    drawFrontFpSuccessUI();
    return;
  }

  if (header == "ACCESS_GRANTED") {
    drawFrontAccessGrantedUI();
    return;
  }
  
  isFrontDisplayInReady = false;
  tft.fillScreen(ST77XX_BLACK);
  // Wipe header and message bounding boxes in solid black to guarantee no ghosting/overlap
  tft.fillRect(0, 42, 320, 60, ST77XX_BLACK);
  tft.fillRect(0, 105, 320, 135, ST77XX_BLACK);

  tft.setCursor(15, 15);
  tft.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tft.setTextSize(2);
  tft.println(F("MACHIP CLOCK-IN STATION"));
  
  tft.drawFastHLine(15, 38, 290, ST77XX_WHITE);
  
  int hSize = (header.length() > 15) ? 2 : 3;
  tft.setCursor(15, 55);
  tft.setTextColor(color, ST77XX_BLACK);
  tft.setTextSize(hSize); 
  tft.println(header);

  // Section 7.3 Lower Divider
  tft.drawFastHLine(15, 105, 290, ST77XX_WHITE);
  
  tft.setCursor(15, 115);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(2);
  tft.println(message);
  
  clearSpiBusPins();
}

inline void resetBackDisplay() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delay(10);
  digitalWrite(TFT_CS_INSIDE, LOW);
  tftBack.init(240, 320);
  tftBack.setRotation(3);
  tftBack.invertDisplay(TFT_INVERT_COLOR);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
  delay(10);
#endif
}

inline void resetFrontDisplay() {
  clearSpiBusPins();
  delay(10);
  digitalWrite(TFT_CS, LOW);
  tft.init(240, 320);
  tft.setRotation(3);
  tft.invertDisplay(TFT_INVERT_COLOR);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  delay(10);
}

inline void updateBackDisplay(String line1, String line2) {
#if ENABLE_DUAL_ST7789
  if (line1 == "READY") {
    drawBackReadyUI();
    return;
  }
  if (line1 == "ALREADY_OUTSIDE" || (line1 == "DENIED" && (line2.indexOf("outside") >= 0 || line2.indexOf("Outside") >= 0))) {
    drawBackAlreadyOutsideUI();
    return;
  }
  if (line1 == "ALREADY_INSIDE" || (line1 == "DENIED" && (line2.indexOf("inside") >= 0 || line2.indexOf("Inside") >= 0))) {
    drawBackAlreadyInsideUI();
    return;
  }
  if (line1 == "LOCKED" && (line2.indexOf("Admin") >= 0 || line2 == "Admin Management")) {
    drawBackAdminLockedUI();
    return;
  }
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  tftBack.fillScreen(ST77XX_BLACK);
  tftBack.fillRect(0, 42, 320, 60, ST77XX_BLACK);
  tftBack.fillRect(0, 105, 320, 135, ST77XX_BLACK);

  tftBack.setCursor(15, 15);
  tftBack.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tftBack.setTextSize(2);
  tftBack.println(F("MACHIP CLOCK-OUT"));
  tftBack.drawFastHLine(15, 38, 290, ST77XX_WHITE);
  
  // Section 7.2 State-aware color resolution
  uint16_t headerColor = ST77XX_GREEN;
  if (line1 == "DENIED" || line1 == "SECURITY" || line1 == "RESTRICTED" || line1 == "NET ERROR" || line1 == "OFFLINE" || line1 == "ERROR" || line1 == "MISMATCH") {
    headerColor = ST77XX_RED;
  } else if (line1 == "LOCKED") {
    headerColor = ST77XX_ORANGE;
  } else if (line1 == "BOOTING") {
    headerColor = ST77XX_YELLOW;
  } else if (line1 == "VISITOR") {
    headerColor = ST77XX_CYAN;
  }

  int hSize = (line1.length() > 15) ? 2 : 3;
  tftBack.setCursor(15, 55);
  tftBack.setTextColor(headerColor, ST77XX_BLACK);
  tftBack.setTextSize(hSize); 
  tftBack.println(line1);

  // Section 7.3 Lower Divider
  tftBack.drawFastHLine(15, 105, 290, ST77XX_WHITE);
  
  tftBack.setCursor(15, 115);
  tftBack.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tftBack.setTextSize(2);
  tftBack.println(line2);
  
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#elif ENABLE_I2C_OLED
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.println(F("MACHIP CLOCK-OUT"));
  oled.drawFastHLine(0, 11, 128, SSD1306_WHITE);
  
  oled.setCursor(0, 20);
  oled.setTextSize(2); 
  oled.println(line1);
  
  oled.setCursor(0, 50);
  oled.setTextSize(1);
  oled.println(line2);
  
  oled.display();
#endif
}
