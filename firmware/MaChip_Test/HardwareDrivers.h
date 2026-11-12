#pragma once
#include "Config.h"
#include "DisplayManager.h"

// ── FEEDBACK ENGINE (NON-BLOCKING RESONANT ACOUSTIC PEAK) ─────────
inline void stopBuzzer() {
  ledcWriteTone(BUZZER, 0);
  buzzerPlaying = false;
  buzzerStepCount = 0;
  currentBuzzerStepIndex = 0;
}

inline void startBuzzerPattern(const BuzzerStep *steps, int count) {
  if (count <= 0 || count > MAX_BUZZER_STEPS) return;
  for (int i = 0; i < count; i++) {
    buzzerQueue[i] = steps[i];
  }
  buzzerStepCount = count;
  currentBuzzerStepIndex = 0;
  currentBuzzerStepStart = millis();
  buzzerPlaying = true;
  ledcWriteTone(BUZZER, buzzerQueue[0].freq);
}

inline void updateBuzzer() {
  if (!buzzerPlaying) return;
  unsigned long elapsed = millis() - currentBuzzerStepStart;
  if (elapsed >= buzzerQueue[currentBuzzerStepIndex].durationMs) {
    currentBuzzerStepIndex++;
    if (currentBuzzerStepIndex < buzzerStepCount) {
      currentBuzzerStepStart = millis();
      ledcWriteTone(BUZZER, buzzerQueue[currentBuzzerStepIndex].freq);
    } else {
      stopBuzzer();
    }
  }
}

inline void beepTone(int duration, int freq = BUZZER_FREQ) {
  BuzzerStep steps[] = { { (uint16_t)freq, (uint16_t)duration } };
  startBuzzerPattern(steps, 1);
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
    case SUCCESS_OK: {
      setLED(LED_STEADY_GREEN, LED_OFF);
      // Modern, pleasant musical ascending chime: 1760 Hz (A6) -> 2349 Hz (D7)
      BuzzerStep steps[] = {
        { 1760, 35 },
        { 0, 15 },
        { 2349, 45 }
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case ERROR_FAIL: {
      setLED(LED_OFF, LED_STEADY_RED);
      // Discrete, low-pitch double-pip reject (988Hz B5 -> 880Hz A5, non-piercing)
      BuzzerStep steps[] = {
        { 988, 35 },
        { 0, 20 },
        { 880, 40 }
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case RFID_TAP: {
      // Subtle high-frequency micro-pip for instant tactile acoustic feedback
      BuzzerStep steps[] = {
        { 2093, 20 }
      };
      startBuzzerPattern(steps, 1);
      break;
    }

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY: {
      // Gentle ascending boot chime
      BuzzerStep steps[] = {
        { 1568, 45 },
        { 0, 20 },
        { 2093, 55 }
      };
      startBuzzerPattern(steps, 3);
      break;
    }
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
inline void solenoidUnlock(String sourceTerminal = "FRONT") {
  unsigned long now = millis();
  if (!solenoidActive) {
    activeUnlockTerminal = sourceTerminal;
    clearSpiBusPins();
    delay(20); // Ensure all in-flight SPI transmissions to both TFTs are 100% finished before relay draws current
    digitalWrite(SOLENOID_PIN, HIGH); // Drive HIGH: Q2 NPN turns ON, pulling J8 IN to GND to trigger Relay
    solenoidActive = true;
    solenoidStartTime = now;
    solenoidFirstTriggerTime = now;
    sysLog("[SOLENOID] UNLOCKED (Relay triggered) via " + sourceTerminal);
  } else {
    // Keep-Alive Re-trigger with Hard 15-second Cumulative Ceiling
    if (now - solenoidFirstTriggerTime < MAX_SOLENOID_CEILING_MS) {
      unsigned long remainingCeiling = MAX_SOLENOID_CEILING_MS - (now - solenoidFirstTriggerTime);
      unsigned long extension = (RETRIGGER_EXTEND_MS < remainingCeiling) ? RETRIGGER_EXTEND_MS : remainingCeiling;
      // Smoothly reset hold window to extension duration from now
      solenoidStartTime = now;
      solenoidHoldDurationMs = (uint16_t)extension;
      sysLog("[SOLENOID] EXTENDED (Keep-Alive +" + String(extension) + "ms) via " + sourceTerminal);
    } else {
      sysLog(F("[SOLENOID] CEILING REACHED (15s max continuous hold). Forcing relock cycle."));
    }
    if (activeUnlockTerminal != sourceTerminal) {
      activeUnlockTerminal = "ALL";
    }
  }
}

inline void solenoidLock() {
  if (solenoidActive) {
    clearSpiBusPins();
    digitalWrite(SOLENOID_PIN, LOW); // Drive LOW: Q2 NPN turns OFF, returning Relay to normal rest
    solenoidActive = false;
    solenoidHoldDurationMs = DEFAULT_SOLENOID_DURATION;
    sysLog(F("[SOLENOID] LOCKED (Rest position)"));
  }
}

inline void updateSolenoid() {
  if (solenoidActive && (millis() - solenoidStartTime >= solenoidHoldDurationMs)) {
    solenoidLock();
    // Allow relay coil kickback & contact bounce to fully quench before driving SPI bus
    delay(40);
    clearSpiBusPins();

    // Cleanly redraw without calling tft.init() / SWRESET to eliminate white flash
    if (activeUnlockTerminal == "FRONT" || activeUnlockTerminal == "ALL") {
      frontStatusResetActive = false;
      isFrontDisplayInReady = false;
      updateFrontDisplay("READY", "Scan RFID Card to Login", ST77XX_GREEN);
      setLED(LED_SLOW_BLINK, LED_OFF);
    }
    if (activeUnlockTerminal == "BACK" || activeUnlockTerminal == "ALL") {
      backStatusResetActive = false;
      if (!isBackDisplayInReady) {
        updateBackDisplay("READY", "Scan Card Out");
      }
    }
    activeUnlockTerminal = "FRONT";
  }
}
