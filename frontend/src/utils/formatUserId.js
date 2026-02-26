/**
 * formatUserId
 * Converts a raw numeric user_Id (e.g. 1) into the display format "MACJ-001".
 *
 * @param {number|string|null|undefined} id - The raw numeric ID from the database
 * @param {number} [pad=3] - How many digits to zero-pad (default 3 → "001")
 * @returns {string} Formatted ID like "MACJ-001", or "—" if id is falsy
 */
export const formatUserId = (id, pad = 3) => {
  if (id === null || id === undefined || id === "") return "—";
  return `MACJ-${String(id).padStart(pad, "0")}`;
};

/**
 * parseUserId
 * Strips the "MACJ-" prefix from a display ID and returns the raw number.
 * Useful for search inputs where the user might type "MACJ-001" or just "1".
 *
 * @param {string} displayId - e.g. "MACJ-001" or "1"
 * @returns {number|null} The raw number, or null if it cannot be parsed
 */
export const parseUserId = (displayId) => {
  if (!displayId) return null;
  const stripped = String(displayId)
    .replace(/^MACJ-/i, "")
    .trim();
  const num = parseInt(stripped, 10);
  return isNaN(num) ? null : num;
};
