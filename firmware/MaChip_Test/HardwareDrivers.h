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
      BuzzerStep steps[] = {
        { 2730, 80 },
        { 0, 30 },
        { 4000, 100 }
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case ERROR_FAIL: {
      setLED(LED_OFF, LED_STEADY_RED);
      // Dual-Pip Staccato Reject: Short 2200Hz pip, 30ms silence, 1600Hz confirmation pip (120ms total)
      BuzzerStep steps[] = {
        { 2200, 40 },
        { 0, 30 },
        { 1600, 50 }
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case RFID_TAP: {
      BuzzerStep steps[] = {
        { 2730, 70 }
      };
      startBuzzerPattern(steps, 1);
      break;
    }

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY: {
      // Crisp, gentle ascending dual-pip boot chime (170ms total, zero harsh tone)
      BuzzerStep steps[] = {
        { 1760, 60 },
        { 0, 30 },
        { 2637, 80 }
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
  if (!solenoidActive) {
    activeUnlockTerminal = sourceTerminal;
    clearSpiBusPins();
    delay(20); // Ensure all in-flight SPI transmissions to both TFTs are 100% finished before relay draws current
    digitalWrite(SOLENOID_PIN, HIGH); // Drive HIGH: Q2 NPN turns ON, pulling J8 IN to GND to trigger Relay
    solenoidActive = true;
    solenoidStartTime = millis();
    sysLog("[SOLENOID] UNLOCKED (Relay triggered) via " + sourceTerminal);
  } else {
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
      isBackDisplayInReady = false;
      updateBackDisplay("READY", "Scan Card Out");
    }
    activeUnlockTerminal = "FRONT";
  }
}
