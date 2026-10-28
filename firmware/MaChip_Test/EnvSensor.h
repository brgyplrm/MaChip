#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "Config.h"

// ── GLOBAL ENVIRONMENTAL & SYSTEM TELEMETRY VARIABLES ─────────────
extern float envTemperature;   // Casing Ambient Celsius (°C) from AHT20
extern float envHumidity;      // Casing Relative Humidity (% RH) from AHT20
extern float envPressure;      // Barometric Pressure (hPa / mbar) from BMP280
extern float envBmpTemp;       // Casing Ambient Celsius (°C) from BMP280
extern float esp32ChipTemp;    // ESP32 Silicon Junction / Core Temperature (°C)
extern bool  envAhtOk;         // True if AHT20 online & responding
extern bool  envBmpOk;         // True if BMP280 online & responding
extern uint8_t envBmpAddr;     // Detected BMP280 address (0x76 or 0x77)

// ── CALIBRATION STORAGE FOR BMP280 ───────────────────────────────
struct BMP280_Calib {
  uint16_t dig_T1;
  int16_t  dig_T2;
  int16_t  dig_T3;
  uint16_t dig_P1;
  int16_t  dig_P2;
  int16_t  dig_P3;
  int16_t  dig_P4;
  int16_t  dig_P5;
  int16_t  dig_P6;
  int16_t  dig_P7;
  int16_t  dig_P8;
  int16_t  dig_P9;
};

extern BMP280_Calib bmpCalib;
extern int32_t bmp_t_fine;

// ── FUNCTION DECLARATIONS ────────────────────────────────────────
void initEnvSensors();
void readEnvSensors();
float getEsp32ChipTemp();
bool scanI2CBus();
bool initAHT20();
bool readAHT20();
bool initBMP280(uint8_t addr);
bool readBMP280();
