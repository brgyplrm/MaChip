#pragma once
#include "Config.h"
#include "DisplayManager.h"

// ── FEEDBACK ENGINE (NON-BLOCKING RESONANT ACOUSTIC PEAK) ─────────
inline void stopBuzzer() {
#if !BUZZER_IS_ACTIVE
  ledcWrite(BUZZER, 0); // Hard cut PWM duty cycle to 0% for true dead silence
  ledcWriteTone(BUZZER, 0);
#else
  digitalWrite(BUZZER, LOW);
#endif
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
  if (buzzerQueue[0].freq > 0) {
    ledcWriteTone(BUZZER, buzzerQueue[0].freq);
  } else {
    ledcWrite(BUZZER, 0);
  }
}

inline void updateBuzzer() {
  if (!buzzerPlaying) return;
  unsigned long elapsed = millis() - currentBuzzerStepStart;
  if (elapsed >= buzzerQueue[currentBuzzerStepIndex].durationMs) {
    currentBuzzerStepIndex++;
    if (currentBuzzerStepIndex < buzzerStepCount) {
      currentBuzzerStepStart = millis();
      if (buzzerQueue[currentBuzzerStepIndex].freq > 0) {
        ledcWriteTone(BUZZER, buzzerQueue[currentBuzzerStepIndex].freq);
      } else {
        ledcWrite(BUZZER, 0); // Hard cut PWM duty cycle to 0% for true dead silence!
      }
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

inline void setFpLed(bool on, uint8_t auraColor) {
  if (on) {
    finger.LEDcontrol(true);
    finger.LEDcontrol(FINGERPRINT_LED_ON, 0, auraColor, 0);
  } else {
    finger.LEDcontrol(false);
    finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, FINGERPRINT_LED_RED, 0);
  }
}

inline void provideFeedback(FeedbackType type) {
  switch (type) {
    case SUCCESS_OK: {
      setLED(LED_STEADY_GREEN, LED_OFF);
      // Crisp, pleasant, ascending two-tone chime ("Ding-Ding!" - High -> Higher)
      BuzzerStep steps[] = {
        { 1760, 60 }, // Note A6
        { 0,    50 }, // Clean silence gap
        { 2637, 80 }  // Note E7
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case ERROR_FAIL: {
      setLED(LED_OFF, LED_STEADY_RED);
      // Distinct, low-frequency descending two-tone warning ("Buzz-Buzz" - Low -> Lower)
      BuzzerStep steps[] = {
        { 784, 90 },  // Note G5
        { 0,   60 },  // Clean silence gap
        { 523, 120 }  // Note C5
      };
      startBuzzerPattern(steps, 3);
      break;
    }

    case RFID_TAP: {
      // Subtle high-frequency micro-click for instant tactile acoustic feedback
      BuzzerStep steps[] = {
        { 2093, 25 } // Note C7
      };
      startBuzzerPattern(steps, 1);
      break;
    }

    case WAITING_SCAN:
      setLED(LED_FAST_BLINK, LED_OFF);
      break;

    case SYSTEM_READY: {
      // Smooth ascending triple boot chime
      BuzzerStep steps[] = {
        { 1318, 50 }, // E6
        { 0,    25 },
        { 1760, 50 }, // A6
        { 0,    25 },
        { 2637, 70 }  // E7
      };
      startBuzzerPattern(steps, 5);
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
    // Keep-Alive Re-trigger with Hard 30-second Cumulative Safety Ceiling
    if (now - solenoidFirstTriggerTime < MAX_SOLENOID_CEILING_MS) {
      unsigned long remainingCeiling = MAX_SOLENOID_CEILING_MS - (now - solenoidFirstTriggerTime);
      unsigned long elapsedSinceStart = now - solenoidStartTime;
      unsigned long currentRemaining = (elapsedSinceStart < solenoidHoldDurationMs) ? (solenoidHoldDurationMs - elapsedSinceStart) : 0;
      unsigned long desiredHold = currentRemaining + RETRIGGER_EXTEND_MS;
      if (desiredHold > remainingCeiling) desiredHold = remainingCeiling;
      solenoidStartTime = now;
      solenoidHoldDurationMs = (uint16_t)desiredHold;
      sysLog("[SOLENOID] EXTENDED (Keep-Alive +" + String(desiredHold) + "ms remaining) via " + sourceTerminal);
    } else {
      sysLog(F("[SOLENOID] CEILING REACHED (30s max continuous hold). Forcing relock cycle."));
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

    if (pendingVisitorConfirm) {
      pendingVisitorConfirm = false;
      HTTPClient confirmHttp;
      confirmHttp.begin(currentFpUrl + "/visitor-access/confirm");
      signHttpRequest(confirmHttp, "{}");
      confirmHttp.POST("{}"); 
      confirmHttp.end();
      sysLog(F("[VISITOR] Door closed confirmation reported to backend."));
    }

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
    reinitRfidReaders();
    activeUnlockTerminal = "FRONT";
  }
}
