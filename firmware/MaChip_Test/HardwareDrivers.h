#pragma once
#include "Config.h"
#include "DisplayManager.h"

// ── FEEDBACK ENGINE ──────────────────────────────────────────────
inline void beep(int duration) {
  ledcWriteTone(BUZZER, BUZZER_FREQ);
  delay(duration);
  ledcWriteTone(BUZZER, 0); 
}

inline void setLED(LedMode gMode, LedMode rMode) {
  clearSpiBusPins(); // Isolate SPI line from direct state changes
  greenMode = gMode;
  redMode = rMode;
  if (gMode == LED_OFF) { digitalWrite(GREEN_LED, LOW); greenState = false; }
  if (gMode == LED_STEADY_GREEN) { digitalWrite(GREEN_LED, HIGH); greenState = true; }
  if (rMode == LED_OFF) { digitalWrite(RED_LED, LOW); redState = false; }
  if (rMode == LED_STEADY_RED) { digitalWrite(RED_LED, HIGH); redState = true; }
}

inline void provideFeedback(FeedbackType type) {
  switch (type) {
    case SUCCESS_OK:
      setLED(LED_STEADY_GREEN, LED_OFF);
      beep(80); delay(80);
      beep(80);
      break;

    case ERROR_FAIL:
      setLED(LED_OFF, LED_STEADY_RED);
      beep(800); 
      break;

    case RFID_TAP:
      beep(100); 
      break;

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY:
      for (int i = 0; i < 3; i++) {
        beep(50); delay(50);
      }
      break;
  }
}

inline void updateLEDs() {
  unsigned long now = millis();
  // Safe toggles wrapped to ensure transient states don't trip display drivers
  if (greenMode == LED_SLOW_BLINK && now - lastGreenToggle >= 1000) {
    clearSpiBusPins(); greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  } else if (greenMode == LED_FAST_BLINK && now - lastGreenToggle >= 100) {
    clearSpiBusPins(); greenState = !greenState; digitalWrite(GREEN_LED, greenState ? HIGH : LOW); lastGreenToggle = now;
  }
  if (redMode == LED_SLOW_BLINK && now - lastRedToggle >= 1000) {
    clearSpiBusPins(); redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  } else if (redMode == LED_FAST_BLINK && now - lastRedToggle >= 100) {
    clearSpiBusPins(); redState = !redState; digitalWrite(RED_LED, redState ? HIGH : LOW); lastRedToggle = now;
  }
}

// ── SOLENOID CONTROL ──────────────────────────────────────────────
inline void solenoidUnlock() {
  if (!solenoidActive) {
    clearSpiBusPins();
    delay(20);
    digitalWrite(SOLENOID_PIN, LOW); // Pull Low to activate Relay shield
    solenoidActive = true;
    solenoidStartTime = millis();
    sysLog(F("[SOLENOID] UNLOCKED (Relay triggered)"));
  }
}

inline void solenoidLock() {
  if (solenoidActive) {
    clearSpiBusPins();
    digitalWrite(SOLENOID_PIN, HIGH); // Pull High to return lock to rest
    solenoidActive = false;
    sysLog(F("[SOLENOID] LOCKED (Rest position)"));
  }
}

inline void updateSolenoid() {
  if (solenoidActive && (millis() - solenoidStartTime >= SOLENOID_DURATION)) {
    solenoidLock();
    // Allow relay coil kickback & contact bounce to fully quench before driving SPI bus
    delay(100);
    clearSpiBusPins();
    updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
    updateBackDisplay("READY", "Scan Card Out");
  }
}
