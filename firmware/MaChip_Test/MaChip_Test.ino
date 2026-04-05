#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN   5
#define RST_PIN  22

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  SPI.begin();           // SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();

  Serial.println("MAChip RFID Reader Ready");
  Serial.println("Scan a card...");
}

void loop() {
  // Wait for a card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Build UID string
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();

  Serial.println("Card UID: " + uid);

  // Halt the card so it doesn't re-trigger instantly
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000); // debounce
}
