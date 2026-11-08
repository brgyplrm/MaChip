// scripts/test_name_whitelist_guardrails.js
// Verification suite for TICKET-13: Hardened Name Whitelist Guardrails
const assert = require("assert");
const path = require("path");

const {
  HARDENED_NAME_REGEX,
  validateNameString,
  sanitizeHtml,
  sanitizeField
} = require("../backend/src/utils/sanitizer");

async function runTestSuite() {
  console.log("==================================================================");
  console.log("[TICKET-13] Verifying Hardened Name Whitelist & Attack Defenses");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;

  function check(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Test ${total.toString().padStart(2, " ")}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total.toString().padStart(2, " ")}: ${name}`);
      console.error(err.message);
    }
  }

  // --- POSITIVE TEST CASES (Legitimate Names) ---
  check("Accept standard Latin surname ('Santos')", () => {
    assert.strictEqual(validateNameString("Santos"), true);
  });

  check("Accept single hyphenated surname ('Santos-Cuyugan')", () => {
    assert.strictEqual(validateNameString("Santos-Cuyugan"), true);
  });

  check("Accept accented letter with hyphen ('Nuñez-Santos')", () => {
    assert.strictEqual(validateNameString("Nuñez-Santos"), true);
  });

  check("Accept multi-word hyphenated surname ('Dela Peña-Santos')", () => {
    assert.strictEqual(validateNameString("Dela Peña-Santos"), true);
  });

  check("Accept apostrophe surname ('O\'Connor')", () => {
    assert.strictEqual(validateNameString("O'Connor"), true);
  });

  check("Accept typographic curly apostrophe surname ('O’Connor')", () => {
    assert.strictEqual(validateNameString("O’Connor"), true);
  });

  check("Accept abbreviation with dot ('St. John')", () => {
    assert.strictEqual(validateNameString("St. John"), true);
  });

  check("Accept valid two-character name ('Sy')", () => {
    assert.strictEqual(validateNameString("Sy"), true);
  });

  check("Accept boundary length 60-character Latin name", () => {
    const valid60 = "A" + "b".repeat(58) + "c";
    assert.strictEqual(valid60.length, 60);
    assert.strictEqual(validateNameString(valid60), true);
  });

  // --- NEGATIVE TEST CASES (Injection, Attack Vectors & Bounds) ---
  check("Block CLI flag argument injection ('--output')", () => {
    assert.strictEqual(validateNameString("--output"), false);
  });

  check("Block single leading hyphen / CSV formula injection ('-Santos')", () => {
    assert.strictEqual(validateNameString("-Santos"), false);
  });

  check("Block trailing hyphen ('Santos-')", () => {
    assert.strictEqual(validateNameString("Santos-"), false);
  });

  check("Block consecutive hyphens / SQL comment injection ('Santos--Cruz')", () => {
    assert.strictEqual(validateNameString("Santos--Cruz"), false);
  });

  check("Block consecutive apostrophes / SQL quote escape (\"O''Connor\")", () => {
    assert.strictEqual(validateNameString("O''Connor"), false);
  });

  check("Block alphanumeric injection with numbers ('Santos123')", () => {
    assert.strictEqual(validateNameString("Santos123"), false);
  });

  check("Block HTML/XSS injection tags ('<script>')", () => {
    assert.strictEqual(validateNameString("<script>"), false);
  });

  check("Block Cyrillic homoglyph spoofing ('D\\u0430w\\u0430l')", () => {
    // Contains Cyrillic small letter 'a' (U+0430) disguised as Latin 'a'
    const homoglyph = "D\u0430w\u0430l";
    assert.strictEqual(validateNameString(homoglyph), false);
  });

  check("Block Trojan Source Bidi override characters ('Santos\\u202ECruz')", () => {
    const bidiSmuggled = "Santos\u202ECruz";
    assert.strictEqual(validateNameString(bidiSmuggled), false);
  });

  check("Block single character name ('A')", () => {
    assert.strictEqual(validateNameString("A"), false);
  });

  check("Block exceeding max length (>60 chars)", () => {
    const tooLong = "A" + "b".repeat(60) + "c"; // 62 chars
    assert.strictEqual(validateNameString(tooLong), false);
  });

  check("Block empty string and null/undefined values", () => {
    assert.strictEqual(validateNameString(""), false);
    assert.strictEqual(validateNameString(null), false);
    assert.strictEqual(validateNameString(undefined), false);
  });

  // --- SANITIZER DEFENSES ---
  check("Sanitizer strips Bidi override characters and zero-width spaces", () => {
    const dirty = "Santos\u202E\u200B\uFEFFCruz";
    const cleaned = sanitizeHtml(dirty);
    assert.strictEqual(cleaned, "SantosCruz");
  });

  check("Sanitizer defuses leading formula symbols in general text fields", () => {
    assert.strictEqual(sanitizeField("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0");
    assert.strictEqual(sanitizeField("+123456"), "'+123456");
    assert.strictEqual(sanitizeField("@SUM(1,2)"), "'@SUM(1,2)");
  });

  console.log("==================================================================");
  console.log(`[RESULTS] ${passed} / ${total} tests passed successfully.`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("FATAL ERROR in test execution:", err);
  process.exit(1);
});
