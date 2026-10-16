#pragma once
#include "Config.h"
#include "DisplayManager.h"

// ── FEEDBACK ENGINE (RESONANT ACOUSTIC PEAK) ──────────────────────
inline void beepTone(int duration, int freq = BUZZER_FREQ) {
  // Drives Passive Buzzer at mechanical diaphragm resonance using hardware LEDC PWM
  ledcWriteTone(BUZZER, freq);
  delay(duration);
  ledcWriteTone(BUZZER, 0);
}

inline void beep(int duration) {
  beepTone(duration, BUZZER_FREQ);
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
      beepTone(100, 2730); delay(60);
      beepTone(120, 4000); // Cheerful two-tone confirmation
      break;

    case ERROR_FAIL:
      setLED(LED_OFF, LED_STEADY_RED);
      beepTone(600, 1500); // Low warning buzz
      break;

    case RFID_TAP:
      beepTone(120, 2730); // Crisp access tap tone
      break;

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY:
      // Resonant 3-tone diagnostic startup chime (Sweeps 2048Hz -> 2730Hz -> 4000Hz)
      // Whichever frequency hits your buzzer's physical resonance will sound at maximum volume!
      beepTone(120, 2048); delay(60);
      beepTone(120, 2730); delay(60);
      beepTone(150, 4000);
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
    delay(50); // Ensure all in-flight SPI transmissions to both TFTs are 100% finished before relay draws current
    digitalWrite(SOLENOID_PIN, HIGH); // Drive HIGH: Q2 NPN turns ON, pulling J8 IN to GND to trigger Relay
    solenoidActive = true;
    solenoidStartTime = millis();
    sysLog(F("[SOLENOID] UNLOCKED (Relay triggered)"));
  }
}

inline void solenoidLock() {
  if (solenoidActive) {
    clearSpiBusPins();
    digitalWrite(SOLENOID_PIN, LOW); // Drive LOW: Q2 NPN turns OFF, returning Relay to normal rest
    solenoidActive = false;
    sysLog(F("[SOLENOID] LOCKED (Rest position)"));
  }
}

inline void updateSolenoid() {
  if (solenoidActive && (millis() - solenoidStartTime >= SOLENOID_DURATION)) {
    solenoidLock();
    // Allow relay coil kickback & contact bounce to fully quench before driving SPI bus
    delay(150);
    clearSpiBusPins();

    // Re-initialize Back TFT to immediately recover and heal from any inductive solenoid kickback
    resetBackDisplay();

    updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
    updateBackDisplay("READY", "Scan Card Out");
  }
}
