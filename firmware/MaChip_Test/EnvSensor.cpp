#include "EnvSensor.h"

// Global telemetry state
float envTemperature = 0.0f;
float envHumidity    = 0.0f;
float envPressure    = 0.0f;
float envBmpTemp     = 0.0f;
float esp32ChipTemp  = 0.0f;
bool  envAhtOk       = false;
bool  envBmpOk       = false;
uint8_t envBmpAddr   = 0x77;

BMP280_Calib bmpCalib;
int32_t bmp_t_fine = 0;

// ── I2C BUS SCANNER ──────────────────────────────────────────────
bool scanI2CBus() {
  sysLog("[I2C] Scanning bus on SDA:" + String(I2C_SDA_PIN) + " SCL:" + String(I2C_SCL_PIN) + "...");
  int foundCount = 0;
  
  for (uint8_t addr = 0x08; addr < 0x78; addr++) {
    Wire.beginTransmission(addr);
    byte err = Wire.endTransmission();
    if (err == 0) {
      foundCount++;
      if (addr == 0x38) {
        sysLog(F("  [+] Found AHT20 Temperature & Humidity Sensor at 0x38!"));
      } else if (addr == 0x76 || addr == 0x77) {
        envBmpAddr = addr;
        sysLog("  [+] Found BMP280 Barometric Pressure Sensor at 0x" + String(addr, HEX) + "!");
      } else {
        sysLog("  [+] Found I2C Device at 0x" + String(addr, HEX));
      }
    }
  }

  if (foundCount == 0) {
    sysLog("[I2C] [WARNING] No I2C devices responded! Check wiring (SDA:" + String(I2C_SDA_PIN) + ", SCL:" + String(I2C_SCL_PIN) + ", GND, 3V3)");
    return false;
  }
  return true;
}

// ── AHT20 INITIALIZATION & READING ───────────────────────────────
bool initAHT20() {
  delay(40); // Wait 40ms power-on time
  
  // Check if AHT20 is present at 0x38
  Wire.beginTransmission(0x38);
  if (Wire.endTransmission() != 0) return false;

  // Send initialization command
  Wire.beginTransmission(0x38);
  Wire.write(0xBE);
  Wire.write(0x08);
  Wire.write(0x00);
  Wire.endTransmission();
  delay(10);

  envAhtOk = true;
  return true;
}

bool readAHT20() {
  if (!envAhtOk) {
    if (!initAHT20()) return false;
  }

  // Trigger measurement command: 0xAC, 0x33, 0x00
  Wire.beginTransmission(0x38);
  Wire.write(0xAC);
  Wire.write(0x33);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) {
    envAhtOk = false;
    return false;
  }

  delay(80); // Measurement takes ~75-80ms

  if (Wire.requestFrom((uint8_t)0x38, (uint8_t)6) != 6) {
    envAhtOk = false;
    return false;
  }

  uint8_t data[6];
  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }

  // Check status bit 7 (0 = measurement ready)
  if ((data[0] & 0x80) != 0) {
    return false;
  }

  // Raw 20-bit values
  uint32_t rawH = (((uint32_t)data[1] << 12) | ((uint32_t)data[2] << 4) | (data[3] >> 4));
  uint32_t rawT = ((((uint32_t)data[3] & 0x0F) << 16) | ((uint32_t)data[4] << 8) | data[5]);

  envHumidity    = ((float)rawH * 100.0f) / 1048576.0f;
  envTemperature = (((float)rawT * 200.0f) / 1048576.0f) - 50.0f;

  return true;
}

// ── BMP280 INITIALIZATION & BOSCH COMPENSATION ───────────────────
static int32_t bmp280_compensate_T(int32_t adc_T) {
  int32_t var1, var2, T;
  var1 = ((((adc_T >> 3) - ((int32_t)bmpCalib.dig_T1 << 1))) * ((int32_t)bmpCalib.dig_T2)) >> 11;
  var2 = (((((adc_T >> 4) - ((int32_t)bmpCalib.dig_T1)) * ((adc_T >> 4) - ((int32_t)bmpCalib.dig_T1))) >> 12) * ((int32_t)bmpCalib.dig_T3)) >> 14;
  bmp_t_fine = var1 + var2;
  T = (bmp_t_fine * 5 + 128) >> 8;
  return T;
}

static uint32_t bmp280_compensate_P(int32_t adc_P) {
  int64_t var1, var2, p;
  var1 = ((int64_t)bmp_t_fine) - 128000;
  var2 = var1 * var1 * (int64_t)bmpCalib.dig_P6;
  var2 = var2 + ((var1 * (int64_t)bmpCalib.dig_P5) << 17);
  var2 = var2 + (((int64_t)bmpCalib.dig_P4) << 35);
  var1 = ((var1 * var1 * (int64_t)bmpCalib.dig_P3) >> 8) + ((var1 * (int64_t)bmpCalib.dig_P2) << 12);
  var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)bmpCalib.dig_P1) >> 33;
  if (var1 == 0) return 0;
  p = 1048576 - adc_P;
  p = (((p << 31) - var2) * 3125) / var1;
  var1 = (((int64_t)bmpCalib.dig_P9) * (p >> 13) * (p >> 13)) >> 25;
  var2 = (((int64_t)bmpCalib.dig_P8) * p) >> 19;
  p = ((p + var1 + var2) >> 8) + (((int64_t)bmpCalib.dig_P7) << 4);
  return (uint32_t)p;
}

bool initBMP280(uint8_t addr) {
  envBmpAddr = addr;
  
  // Read Chip ID (Register 0xD0)
  Wire.beginTransmission(envBmpAddr);
  Wire.write(0xD0);
  if (Wire.endTransmission() != 0) return false;

  Wire.requestFrom(envBmpAddr, (uint8_t)1);
  if (Wire.available() < 1) return false;
  uint8_t chipId = Wire.read();
  
  // 0x58 = BMP280, 0x60 = BME280
  if (chipId != 0x58 && chipId != 0x60) {
    return false;
  }

  // Read Calibration parameters (Registers 0x88..0x9F: 24 bytes)
  Wire.beginTransmission(envBmpAddr);
  Wire.write(0x88);
  if (Wire.endTransmission() != 0) return false;

  Wire.requestFrom(envBmpAddr, (uint8_t)24);
  if (Wire.available() < 24) return false;

  uint8_t cal[24];
  for (int i = 0; i < 24; i++) cal[i] = Wire.read();

  bmpCalib.dig_T1 = (cal[1] << 8) | cal[0];
  bmpCalib.dig_T2 = (cal[3] << 8) | cal[2];
  bmpCalib.dig_T3 = (cal[5] << 8) | cal[4];
  bmpCalib.dig_P1 = (cal[7] << 8) | cal[6];
  bmpCalib.dig_P2 = (cal[9] << 8) | cal[8];
  bmpCalib.dig_P3 = (cal[11] << 8) | cal[10];
  bmpCalib.dig_P4 = (cal[13] << 8) | cal[12];
  bmpCalib.dig_P5 = (cal[15] << 8) | cal[14];
  bmpCalib.dig_P6 = (cal[17] << 8) | cal[16];
  bmpCalib.dig_P7 = (cal[19] << 8) | cal[18];
  bmpCalib.dig_P8 = (cal[21] << 8) | cal[20];
  bmpCalib.dig_P9 = (cal[23] << 8) | cal[22];

  // Configure BMP280:
  // Register 0xF4 (ctrl_meas): osrs_t=x1 (001), osrs_p=x1 (001), mode=Normal (11) -> 0x27
  Wire.beginTransmission(envBmpAddr);
  Wire.write(0xF4);
  Wire.write(0x27);
  Wire.endTransmission();

  // Register 0xF5 (config): t_sb=1000ms (101), filter=x16 (100) -> 0xA0
  Wire.beginTransmission(envBmpAddr);
  Wire.write(0xF5);
  Wire.write(0xA0);
  Wire.endTransmission();

  envBmpOk = true;
  return true;
}

bool readBMP280() {
  if (!envBmpOk) {
    if (!initBMP280(envBmpAddr)) return false;
  }

  // Request 6 bytes from register 0xF7 (Press MSB, LSB, XLSB; Temp MSB, LSB, XLSB)
  Wire.beginTransmission(envBmpAddr);
  Wire.write(0xF7);
  if (Wire.endTransmission() != 0) {
    envBmpOk = false;
    return false;
  }

  if (Wire.requestFrom(envBmpAddr, (uint8_t)6) != 6) {
    envBmpOk = false;
    return false;
  }

  uint8_t data[6];
  for (int i = 0; i < 6; i++) data[i] = Wire.read();

  int32_t adc_P = ((int32_t)data[0] << 12) | ((int32_t)data[1] << 4) | (data[2] >> 4);
  int32_t adc_T = ((int32_t)data[3] << 12) | ((int32_t)data[4] << 4) | (data[5] >> 4);

  int32_t t_raw = bmp280_compensate_T(adc_T);
  envBmpTemp = (float)t_raw / 100.0f;

  uint32_t p_raw = bmp280_compensate_P(adc_P);
  envPressure = (float)p_raw / 25600.0f; // Convert Q24.8 Pa to hPa

  return true;
}

float getEsp32ChipTemp() {
  esp32ChipTemp = temperatureRead();
  return esp32ChipTemp;
}

// ── UNIFIED HIGH-LEVEL TELEMETRY MANAGER ─────────────────────────
void initEnvSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 100000);
  delay(50);
  
  scanI2CBus();
  
  bool ahtFound = initAHT20();
  bool bmpFound = initBMP280(envBmpAddr);
  
  getEsp32ChipTemp();
  if (ahtFound || bmpFound) {
    readEnvSensors();
  }
}

void readEnvSensors() {
  readAHT20();
  readBMP280();
  getEsp32ChipTemp();
}
