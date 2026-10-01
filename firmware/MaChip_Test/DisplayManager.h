#pragma once
#include "Config.h"

// ── LANDSCAPE OPTIMIZED NON-BLOCKING UI LAYOUT DRAWERS ───────────
inline void updateFrontDisplay(String header, String message, uint16_t color) {
  clearSpiBusPins();
  delayMicroseconds(50);
  digitalWrite(TFT_CS, LOW); // Claim bus cleanly for TFT output
  
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
