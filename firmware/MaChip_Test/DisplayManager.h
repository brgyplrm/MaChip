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

// ── LIVE REAL-TIME CLOCK OVERLAYS (STANDBY READY SCREENS) ─────────
inline void updateFrontLiveClock(const struct tm &timeinfo) {
  if (!isFrontDisplayInReady) return;
  int hr = timeinfo.tm_hour;
  bool pm = (hr >= 12);
  if (hr == 0) hr = 12;
  else if (hr > 12) hr -= 12;
  char timeBuf[16];
  snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d %s", hr, timeinfo.tm_min, timeinfo.tm_sec, pm ? "PM" : "AM");

  static const char* const DAYS[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  static const char* const MONTHS[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  char dateBuf[24];
  int wday = (timeinfo.tm_wday >= 0 && timeinfo.tm_wday < 7) ? timeinfo.tm_wday : 0;
  int mon = (timeinfo.tm_mon >= 0 && timeinfo.tm_mon < 12) ? timeinfo.tm_mon : 0;
  snprintf(dateBuf, sizeof(dateBuf), "%s, %s %02d, %04d", DAYS[wday], MONTHS[mon], timeinfo.tm_mday, 1900 + timeinfo.tm_year);

  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);

  // Time in high-contrast cyan with black background (flicker-free character rasterization)
  tft.setTextSize(2);
  tft.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tft.setCursor(20, 186);
  tft.print(timeBuf);

  // Date in orange with black background
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tft.setCursor(20, 206);
  tft.print(dateBuf);

  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
}

inline void updateBackLiveClock(const struct tm &timeinfo) {
#if ENABLE_DUAL_ST7789
  if (!isBackDisplayInReady) return;
  int hr = timeinfo.tm_hour;
  bool pm = (hr >= 12);
  if (hr == 0) hr = 12;
  else if (hr > 12) hr -= 12;
  char timeBuf[16];
  snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d %s", hr, timeinfo.tm_min, timeinfo.tm_sec, pm ? "PM" : "AM");

  static const char* const DAYS[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  static const char* const MONTHS[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  char dateBuf[24];
  int wday = (timeinfo.tm_wday >= 0 && timeinfo.tm_wday < 7) ? timeinfo.tm_wday : 0;
  int mon = (timeinfo.tm_mon >= 0 && timeinfo.tm_mon < 12) ? timeinfo.tm_mon : 0;
  snprintf(dateBuf, sizeof(dateBuf), "%s, %s %02d, %04d", DAYS[wday], MONTHS[mon], timeinfo.tm_mday, 1900 + timeinfo.tm_year);

  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);

  tftBack.setTextSize(2);
  tftBack.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tftBack.setCursor(20, 186);
  tftBack.print(timeBuf);

  tftBack.setTextSize(1);
  tftBack.setTextColor(ST77XX_ORANGE, ST77XX_BLACK);
  tftBack.setCursor(20, 206);
  tftBack.print(dateBuf);

  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

// ── CUSTOM BITMAP & UI FRAME DRAWERS ─────────────────────────────
inline void drawFrame1UI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_Frame_1, sizeof(epd_bitmap_Frame_1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = true;

  struct tm ti;
  if (getLocalTime(&ti, 0)) {
    updateFrontLiveClock(ti);
  }
}

inline void drawBackReadyUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_Your_paragraph_text__1_, sizeof(epd_bitmap_Your_paragraph_text__1_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  // Wipe "CLOCK IN" box and render "CLOCK OUT" overlay
  tftBack.fillRect(40, 161, 70, 13, ST77XX_BLACK);
  tftBack.setTextSize(1);
  tftBack.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tftBack.setCursor(46, 164);
  tftBack.print("CLOCK OUT");
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
  isBackDisplayInReady = true;

  struct tm ti;
  if (getLocalTime(&ti, 0)) {
    updateBackLiveClock(ti);
  }
#endif
}

inline void drawBackAlreadyOutsideUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_Your_paragraph_text__2_, sizeof(epd_bitmap_Your_paragraph_text__2_), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  tftBack.fillRect(80, 178, 160, 16, ST77XX_BLACK);
  tftBack.setTextSize(1);
  tftBack.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tftBack.setCursor(115, 182);
  tftBack.print("ALREADY OUTSIDE");
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
#endif
}

inline void drawBackAlreadyInsideUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
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
  isBackDisplayInReady = false;
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
  tft.fillRect(80, 178, 160, 16, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(115, 182);
  tft.print("ALREADY OUTSIDE");
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

inline void drawFrontRfidSuccessUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR2___F, sizeof(epd_bitmap_ENR2___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontCardCapturedUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR3___F, sizeof(epd_bitmap_ENR3___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontRfidTimeoutUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR4___F, sizeof(epd_bitmap_ENR4___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpReleaseSensorUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR6___F, sizeof(epd_bitmap_ENR6___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpFirstScanOkUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR7___F, sizeof(epd_bitmap_ENR7___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpDuplicateUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR8___F, sizeof(epd_bitmap_ENR8___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpMismatchUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR11___F, sizeof(epd_bitmap_ENR11___F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawFrontFpRollbackUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ENR14__F, sizeof(epd_bitmap_ENR14__F), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ── ATT-01 BOOT & SELF-TEST DRAWERS ──────────────────────────────
inline void drawFrontBootSelfTestUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ATT1_front, sizeof(epd_bitmap_ATT1_front), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawBackBootCheckingSensorsUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ATT1_back, sizeof(epd_bitmap_ATT1_back), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
  isBackDisplayInReady = false;
#endif
}

// ── ATT-06 CLOCK-OUT APPROVED DRAWER ─────────────────────────────
inline void drawBackClockOutApprovedUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ATT6, sizeof(epd_bitmap_ATT6), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
  isBackDisplayInReady = false;
#endif
}

// ── ATT-07 VISITOR AUTHORIZED ACCESS DRAWERS ──────────────────────
inline void drawFrontVisitorAccessUI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ATT7, sizeof(epd_bitmap_ATT7), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawBackVisitorAccessUI() {
#if ENABLE_DUAL_ST7789
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ATT7, sizeof(epd_bitmap_ATT7), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH);
  clearSpiBusPins();
  isBackDisplayInReady = false;
#endif
}

// ── ERROR & SECURITY ALERT DRAWERS (ERR-01..12) ──────────────────

// ERR-01: Unregistered Card / No Entry
inline void drawFrontUnregisteredCardUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR1, sizeof(epd_bitmap_ERR1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackUnregisteredCardUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR1, sizeof(epd_bitmap_ERR1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-02: Inactive / Separated Account
inline void drawFrontInactiveAccountUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR2, sizeof(epd_bitmap_ERR2), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackInactiveAccountUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR2, sizeof(epd_bitmap_ERR2), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-03: 2FA Unknown Biometric (Front-only)
inline void drawFrontUnknownFingerprintUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR3, sizeof(epd_bitmap_ERR3), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ERR-04: 2FA Token ID Mismatch / Buddy Punching (Front-only)
inline void drawFrontTokenMismatchUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR4, sizeof(epd_bitmap_ERR4), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// 2FA Retry Attempt 1: 2 Attempts Remaining (Front-only)
inline void drawFrontRetryFingerprint1UI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_RetryFingerPrint1, sizeof(epd_bitmap_RetryFingerPrint1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// 2FA Retry Attempt 2: 1 Attempt Remaining (Front-only)
inline void drawFrontRetryFingerprint2UI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_RetryFingerPrint1, sizeof(epd_bitmap_RetryFingerPrint1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  // Clear the attempt count text bounding box and print "1 Attempt Remaining"
  tft.fillRect(16, 120, 130, 14, ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(18, 123);
  tft.print(F("1 Attempt Remaining"));
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ERR-05: 2FA Verification Timeout (Front-only)
inline void drawFrontTimeoutUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR5, sizeof(epd_bitmap_ERR5), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

// ERR-06: Security Brute-Force Lockout
inline void drawFrontLockoutUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR6, sizeof(epd_bitmap_ERR6), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackLockoutUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR6, sizeof(epd_bitmap_ERR6), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-07: Cloned / Replay Card Attack
inline void drawFrontReplayAttackUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR7, sizeof(epd_bitmap_ERR7), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackReplayAttackUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR7, sizeof(epd_bitmap_ERR7), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-08: Curfew Restriction (Back helper)
inline void drawBackCurfewErrorUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR8, sizeof(epd_bitmap_ERR8), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-09: Fingerprint Enrollment Required
inline void drawFrontFingerprintRequiredUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR9, sizeof(epd_bitmap_ERR9), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackFingerprintRequiredUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR9, sizeof(epd_bitmap_ERR9), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ERR-12: Rapid-Tap Spam Protection
inline void drawFrontRapidTapErrorUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_ERR12, sizeof(epd_bitmap_ERR12), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}
inline void drawBackRapidTapErrorUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_ERR12, sizeof(epd_bitmap_ERR12), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ── SYSTEM & NETWORK DIAGNOSTIC DRAWERS (SYS-07..09) ───────────────
// SYS-07: Net Config / Wi-Fi AP Scanning
inline void drawFrontNetConfigUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_SYS07, sizeof(epd_bitmap_SYS07), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawBackNetConfigUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_SYS07, sizeof(epd_bitmap_SYS07), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// SYS-08: Wifi Connect / Joining Access Point
inline void drawFrontWifiConnectUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_SYS08, sizeof(epd_bitmap_SYS08), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawBackWifiConnectUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_SYS08, sizeof(epd_bitmap_SYS08), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// SYS-09: Wifi Connected / Link Established
inline void drawFrontWifiConnectedUI() {
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  drawRLEBitmap(tft, 0, 0, epd_bitmap_SYS09, sizeof(epd_bitmap_SYS09), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); clearSpiBusPins();
  isFrontDisplayInReady = false;
}

inline void drawBackWifiConnectedUI() {
#if ENABLE_DUAL_ST7789
  isBackDisplayInReady = false;
  clearSpiBusPins(); delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  drawRLEBitmap(tftBack, 0, 0, epd_bitmap_SYS09, sizeof(epd_bitmap_SYS09), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS_INSIDE, HIGH); clearSpiBusPins();
#endif
}

// ── FRAME 2: 2FA BIOMETRIC CHALLENGE DRAWERS ─────────────────────
inline void update2FACountdown(int secondsLeft) {
  if (secondsLeft < 0) secondsLeft = 0;
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);

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

  digitalWrite(TFT_CS, HIGH);
  clearSpiBusPins();
}

inline void draw2FAChallengeUI(String employeeName, int secondsLeft = 15) {
  clearSpiBusPins();
  isFrontDisplayInReady = false;
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);

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

  digitalWrite(TFT_CS, HIGH);
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
    if (isFrontDisplayInReady) return; // Prevent redundant full-frame SPI redrawing & flickering
    clearSpiBusPins();
    delayMicroseconds(50);
    digitalWrite(TFT_CS, LOW);
    isFrontDisplayInReady = true;
    // Render the custom 320x240 image2cpp Frame 1 UI layout
    drawRLEBitmap(tft, 0, 0, epd_bitmap_Frame_1, sizeof(epd_bitmap_Frame_1), 320, 240, ST77XX_WHITE, ST77XX_BLACK);
    digitalWrite(TFT_CS, HIGH);
    clearSpiBusPins();
    return;
  }

  if (header == "2FA CHALLENGE") {
    draw2FAChallengeUI(message, 15);
    return;
  }

  // ERR-01: Unregistered Card / No Entry
  if (header == "CARD_NOT_ENROLLED" || header == "CARD NOT ENROLLED" || (header == "DENIED" && (message.indexOf("Enrolled") >= 0 || message.indexOf("Unregistered") >= 0)) || (header == "ACCESS DENIED" && (message.indexOf("Enrolled") >= 0 || message.indexOf("Unregistered") >= 0))) {
    drawFrontUnregisteredCardUI();
    return;
  }

  // ERR-02: Inactive / Separated Account
  if (header == "ACCOUNT_INACTIVE" || header == "ACCOUNT INACTIVE" || (header == "DENIED" && (message.indexOf("Inactive") >= 0 || message.indexOf("Separated") >= 0)) || (header == "ACCESS DENIED" && (message.indexOf("Inactive") >= 0 || message.indexOf("Separated") >= 0))) {
    drawFrontInactiveAccountUI();
    return;
  }

  // ERR-03: Unknown Biometric
  if (header == "ACCESS FORBIDDEN" || header == "FP_UNKNOWN" || (header == "DENIED" && message.indexOf("Unknown") >= 0) || (header == "ACCESS DENIED" && message.indexOf("Unknown") >= 0)) {
    drawFrontUnknownFingerprintUI();
    return;
  }

  // 2FA Retries (Attempts 1 & 2):
  if (header == "RETRY_FP_1" || ((header == "RETRY SCAN" || header == "RETRY") && (message.indexOf("2") >= 0 || message.indexOf("Two") >= 0))) {
    drawFrontRetryFingerprint1UI();
    return;
  }
  if (header == "RETRY_FP_2" || ((header == "RETRY SCAN" || header == "RETRY" || header == "FINAL ATTEMPT") && (message.indexOf("1") >= 0 || message.indexOf("One") >= 0))) {
    drawFrontRetryFingerprint2UI();
    return;
  }

  // ERR-04: Token Mismatch / Buddy Punching
  if (header == "TOKEN_MISMATCH" || header == "TOKEN MISMATCH" || (header == "SECURITY FAULT" && message.indexOf("Token ID Mismatch") >= 0)) {
    drawFrontTokenMismatchUI();
    return;
  }

  // ERR-05: Timeout
  if (header == "TIMEOUT" || (header == "FP_TIMEOUT" && message.indexOf("Verification") >= 0)) {
    drawFrontTimeoutUI();
    return;
  }

  // ERR-06: Lockout
  if (header == "LOCKED OUT" || header == "LOCKOUT" || header == "LOCKED_OUT" || (header == "DENIED" && message.indexOf("Lockout") >= 0) || (header == "ACCESS DENIED" && message.indexOf("Attempts") >= 0)) {
    drawFrontLockoutUI();
    return;
  }

  // ERR-07: Replay Attack
  if (header == "REPLAY_ATTACK" || (header == "SECURITY FAULT" && (message.indexOf("Replay") >= 0 || message.indexOf("Clone") >= 0))) {
    drawFrontReplayAttackUI();
    return;
  }

  // ERR-08: Curfew Restriction
  if (header == "CURFEW RESTRICTION" || header == "HOURS_RESTRICTED" || message.indexOf("Facility Closed") >= 0 || message.indexOf("Curfew") >= 0) {
    drawFrontCurfewErrorUI();
    return;
  }

  // ERR-09: Fingerprint Required
  if (header == "FINGERPRINT_REQUIRED" || header == "FP_REQUIRED" || (header == "DENIED" && message.indexOf("Fingerprint") >= 0)) {
    drawFrontFingerprintRequiredUI();
    return;
  }

  // ERR-10: Already Inside
  if (header == "ALREADY_INSIDE" || (header == "DENIED" && message.indexOf("Inside") >= 0) || (header == "ACCESS DENIED" && message.indexOf("Inside") >= 0)) {
    drawFrontAlreadyInsideUI();
    return;
  }

  // ERR-11: Already Outside
  if (header == "ALREADY_OUTSIDE" || (header == "DENIED" && message.indexOf("Outside") >= 0) || (header == "ACCESS DENIED" && message.indexOf("Outside") >= 0)) {
    drawFrontAlreadyOutsideUI();
    return;
  }

  // ERR-12: Rapid Tap Protection
  if (header == "RAPID_TAP" || header == "TOO FAST" || message.indexOf("Too fast") >= 0 || message.indexOf("Wait 1s") >= 0) {
    drawFrontRapidTapErrorUI();
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

  if (header == "BOOTING" || header == "HARDWARE_TEST" || header == "SELF_TEST") {
    drawFrontBootSelfTestUI();
    return;
  }

  if (header == "VISITOR ACCESS" || header == "VISITOR") {
    drawFrontVisitorAccessUI();
    return;
  }

  // SYS-07: Net Config / Wi-Fi AP Scanning
  if (header == "NET CONFIG" || header == "NET_CONFIG") {
    drawFrontNetConfigUI();
    return;
  }

  // SYS-08: Wifi Connect / Joining Access Point
  if (header == "WIFI CONNECT" || header == "WIFI_CONNECT") {
    drawFrontWifiConnectUI();
    return;
  }

  // SYS-09: Wifi Connected / Link Established
  if (header == "ONLINE" || header == "WIFI CONNECTED" || header == "WIFI_CONNECTED") {
    drawFrontWifiConnectedUI();
    return;
  }
  
  isFrontDisplayInReady = false;
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW);
  tft.fillScreen(ST77XX_BLACK);

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
  
  digitalWrite(TFT_CS, HIGH);
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
  isBackDisplayInReady = false;
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
  isFrontDisplayInReady = false;
  delay(10);
}

inline void updateBackDisplay(String line1, String line2) {
#if ENABLE_DUAL_ST7789
  if (line1 == "READY") {
    if (isBackDisplayInReady) return; // Prevent redundant full-frame SPI redrawing & flickering
    drawBackReadyUI();
    return;
  }
  isBackDisplayInReady = false;

  // ERR-01: Unregistered Card / No Entry
  if (line1 == "CARD_NOT_ENROLLED" || line1 == "CARD NOT ENROLLED" || (line1 == "DENIED" && (line2.indexOf("Enrolled") >= 0 || line2.indexOf("Unregistered") >= 0))) {
    drawBackUnregisteredCardUI();
    return;
  }

  // ERR-02: Inactive Account
  if (line1 == "ACCOUNT_INACTIVE" || line1 == "ACCOUNT INACTIVE" || (line1 == "DENIED" && (line2.indexOf("Inactive") >= 0 || line2.indexOf("Separated") >= 0))) {
    drawBackInactiveAccountUI();
    return;
  }

  // ERR-06: Security Lockout
  if (line1 == "LOCKED OUT" || line1 == "LOCKOUT" || line1 == "LOCKED_OUT" || (line1 == "LOCKED" && line2.indexOf("Wait") >= 0) || (line1 == "DENIED" && line2.indexOf("Attempts") >= 0)) {
    drawBackLockoutUI();
    return;
  }

  // ERR-07: Cloned / Replay Attack
  if (line1 == "REPLAY_ATTACK" || (line1 == "SECURITY" && line2.indexOf("Replay") >= 0) || (line1 == "DENIED" && line2.indexOf("Replay") >= 0)) {
    drawBackReplayAttackUI();
    return;
  }

  // ERR-08: Curfew Restriction
  if (line1 == "CURFEW RESTRICTION" || line1 == "HOURS_RESTRICTED" || line1 == "RESTRICTED" || line2.indexOf("Facility Closed") >= 0 || line2.indexOf("Curfew") >= 0) {
    drawBackCurfewErrorUI();
    return;
  }

  // ERR-09: Fingerprint Required
  if (line1 == "FINGERPRINT_REQUIRED" || line1 == "FP_REQUIRED" || (line1 == "DENIED" && line2.indexOf("Fingerprint") >= 0)) {
    drawBackFingerprintRequiredUI();
    return;
  }

  // ERR-10: Already Inside
  if (line1 == "ALREADY_INSIDE" || (line1 == "DENIED" && (line2.indexOf("inside") >= 0 || line2.indexOf("Inside") >= 0))) {
    drawBackAlreadyInsideUI();
    return;
  }

  // ERR-11: Already Outside
  if (line1 == "ALREADY_OUTSIDE" || (line1 == "DENIED" && (line2.indexOf("outside") >= 0 || line2.indexOf("Outside") >= 0))) {
    drawBackAlreadyOutsideUI();
    return;
  }

  // ERR-12: Rapid Tap Protection
  if (line1 == "RAPID_TAP" || line1 == "TOO FAST" || (line1 == "DENIED" && line2.indexOf("Too fast") >= 0) || line2.indexOf("Wait 1s") >= 0) {
    drawBackRapidTapErrorUI();
    return;
  }

  if (line1 == "LOCKED" && (line2.indexOf("Admin") >= 0 || line2 == "Admin Management")) {
    drawBackAdminLockedUI();
    return;
  }
  if (line1 == "BOOTING" || line1 == "CHECKING_SENSORS") {
    drawBackBootCheckingSensorsUI();
    return;
  }
  if (line1 == "APPROVED" || line1 == "CLOCK_OUT" || (line1 == "SUCCESS" && line2.indexOf("Goodbye") >= 0)) {
    drawBackClockOutApprovedUI();
    return;
  }
  if (line1 == "VISITOR" || line1 == "VISITOR ACCESS") {
    drawBackVisitorAccessUI();
    return;
  }

  // SYS-07: Net Config / Wi-Fi AP Scanning
  if (line1 == "NET CONFIG" || line1 == "WIFI LINK" || line1 == "NET_CONFIG") {
    drawBackNetConfigUI();
    return;
  }

  // SYS-08: Wifi Connect / Joining Access Point
  if (line1 == "WIFI CONNECT" || line1 == "WIFI_CONNECT") {
    drawBackWifiConnectUI();
    return;
  }

  // SYS-09: Wifi Connected / Link Established
  if (line1 == "ONLINE" || line1 == "WIFI CONNECTED" || line1 == "WIFI_CONNECTED") {
    drawBackWifiConnectedUI();
    return;
  }

  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS_INSIDE, LOW);
  tftBack.fillScreen(ST77XX_BLACK);

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
