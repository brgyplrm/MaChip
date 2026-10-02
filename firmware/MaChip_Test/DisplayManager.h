#pragma once
#include "Config.h"
#include "Bitmaps.h"

// ── CUSTOM BITMAP & UI FRAME DRAWERS ─────────────────────────────
inline void drawFrame1UI() {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW); // Claim bus cleanly for TFT output
  tft.drawBitmap(0, 0, epd_bitmap_Frame_1, 320, 240, ST77XX_WHITE, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH); // Release bus back to general pool
  isFrontDisplayInReady = true;
}

// ── FRAME 2: 2FA BIOMETRIC CHALLENGE DRAWERS ─────────────────────
inline void update2FACountdown(int secondsLeft) {
  if (secondsLeft < 0) secondsLeft = 0;
  clearSpiBusPins();
  delayMicroseconds(20);
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
}

inline void draw2FAChallengeUI(String employeeName, int secondsLeft = 15) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW); // Claim bus cleanly for TFT output

  isFrontDisplayInReady = false;

  // 1. Render Frame 2 base template (Fingerprint icon, banner, instructions, border)
  tft.drawBitmap(0, 0, epd_bitmap_Frame_2, 320, 240, ST77XX_WHITE, ST77XX_BLACK);

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
}

// ── NON-BLOCKING RFID PULSE ANIMATION (112x80 at X=200, Y=78) ─────
inline void tickRfidPulseAnimation() {
  if (!isFrontDisplayInReady) return;

  static unsigned long lastPulseMs = 0;
  static uint8_t pulseStep = 0;

  unsigned long now = millis();
  if (now - lastPulseMs < 200) return; // 200ms per animation step
  lastPulseMs = now;

  // Step sequence: 0 -> 1 -> 2 -> 3 -> hold (3) -> hold (3) -> repeat (0)
  pulseStep = (pulseStep + 1) % 6;
  uint8_t frameIdx = (pulseStep < 4) ? pulseStep : 3;

  clearSpiBusPins();
  delayMicroseconds(20);
  digitalWrite(TFT_CS, LOW);
  tft.drawBitmap(200, 78, epd_rfid_pulse_frames[frameIdx], 112, 80, RFID_PULSE_COLOR, ST77XX_BLACK);
  digitalWrite(TFT_CS, HIGH);
}

// ── LANDSCAPE OPTIMIZED NON-BLOCKING UI LAYOUT DRAWERS ───────────
inline void updateFrontDisplay(String header, String message, uint16_t color) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW); // Claim bus cleanly for TFT output
  
  if (header == "READY") {
    isFrontDisplayInReady = true;
    // Render the custom 320x240 image2cpp Frame 1 UI layout
    tft.drawBitmap(0, 0, epd_bitmap_Frame_1, 320, 240, ST77XX_WHITE, ST77XX_BLACK);
    digitalWrite(TFT_CS, HIGH);
    return;
  }

  if (header == "2FA CHALLENGE") {
    draw2FAChallengeUI(message, 15);
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
  
  tft.setCursor(15, 55);
  tft.setTextColor(color, ST77XX_BLACK);
  tft.setTextSize(3); 
  tft.println(header);
  
  tft.setCursor(15, 115);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(2);
  tft.println(message);
  
  digitalWrite(TFT_CS, HIGH); // Release bus back to general pool
}

inline void updateBackDisplay(String line1, String line2) {
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
}
