const axios = require('axios');

/**
 * Philippine Regular Holidays — fixed by law (RA 9492 as amended by RA 10966).
 * These are matched against holiday names returned by the Nager.Date API.
 * Everything else that is "Public" in the API is treated as Special Holiday.
 */
const REGULAR_HOLIDAY_KEYWORDS = [
  "new year",           // Jan 1
  "maundy thursday",    // moveable
  "good friday",        // moveable
  "araw ng kagitingan", // Apr 9  – Day of Valor
  "day of valor",       // Apr 9  – English alias
  "labor day",          // May 1
  "independence day",   // Jun 12
  "national heroes day",// last Mon of Aug
  "bonifacio day",      // Nov 30
  "christmas day",      // Dec 25
  "rizal day",          // Dec 30
];

/**
 * Fetches Philippine public holidays from the free Nager.Date API.
 * Classifies each as "Regular Holiday" or "Special Holiday".
 *
 * API docs: https://date.nager.at/swagger/index.html
 * Endpoint: GET /api/v3/PublicHolidays/{year}/PH
 */
const scrapeHolidays = async (year = new Date().getFullYear()) => {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
    console.log(`[Scraper] Fetching ${year} PH holidays from Nager.Date API: ${url}`);

    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[Scraper] No holidays returned for ${year}.`);
      return [];
    }

    const holidays = [];

    for (const h of data) {
      // Only include nationally applicable public holidays
      const types = h.types || [];
      const isPublic = types.includes('Public');
      if (!isPublic) continue;

      // Determine Regular vs Special by matching the holiday name
      const nameLower = (h.localName + ' ' + h.name).toLowerCase();
      const isRegular = REGULAR_HOLIDAY_KEYWORDS.some(kw => nameLower.includes(kw));
      const holidayType = isRegular ? 'Regular Holiday' : 'Special Holiday';

      // Prefer the local Filipino name; fall back to English
      const displayName = h.name;

      holidays.push({
        name: displayName,
        date: h.date,       // already "YYYY-MM-DD"
        type: holidayType,
      });

      console.log(`[Scraper] ${h.date} | ${displayName} | ${holidayType}`);
    }

    console.log(`[Scraper] Done — ${holidays.length} holidays for ${year}.`);
    return holidays;

  } catch (error) {
    console.error(`[Scraper Error]: ${error.message}`);
    return [];
  }
};

module.exports = scrapeHolidays;