/**
 * MaChip Input & CSV Sanitizer Utility
 * Enforces OWASP guidelines for CSV formula injection (CWE-1236)
 * and stored XSS prevention across batch uploads and user inputs.
 */

/**
 * Defuses CSV / Excel formula injection (DDE execution).
 * If a text string starts with any formula trigger (=, +, -, @, \t, \r),
 * prepends a single quote (') so spreadsheets treat it strictly as literal text.
 */
function defuseFormula(val) {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (/^[\=\+\-\@\t\r]/.test(trimmed)) {
    // If it starts with a formula trigger, neutralize with leading single quote
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Strips HTML tags, script elements, and dangerous control characters.
 * Preserves standard punctuation, diacritics, and international names.
 */
function sanitizeHtml(val) {
  if (typeof val !== "string") return val;
  return val
    // Remove null bytes and dangerous control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove script tags and their inner executable content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove style tags and their inner content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Strip remaining HTML/XML tags
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Comprehensive sanitization for general text fields:
 * 1. Strips HTML/Script tags (anti-XSS)
 * 2. Defuses formula injection prefixes (anti-DDE / CSV injection)
 */
function sanitizeField(val) {
  if (typeof val !== "string") return val;
  const noHtml = sanitizeHtml(val);
  return defuseFormula(noHtml);
}

/**
 * RFC-4180 compliant CSV line parser.
 * Safely parses fields containing commas, double quotes, and escaped quotes ("").
 */
function parseCSVLine(line) {
  if (!line || typeof line !== "string") return [];
  const result = [];
  let currentToken = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        currentToken += '"';
        i++; // Skip the escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(currentToken.trim());
      currentToken = "";
    } else {
      currentToken += char;
    }
  }
  result.push(currentToken.trim());
  return result;
}

module.exports = {
  defuseFormula,
  sanitizeHtml,
  sanitizeField,
  parseCSVLine
};
