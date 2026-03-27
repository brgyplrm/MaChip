const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes Philippine holidays from timeanddate.com for a specific year.
 * Captures all months and filters for Regular and Special Non-working holidays.
 */
const scrapeHolidays = async (year = new Date().getFullYear()) => {
    try {
        const url = `https://www.timeanddate.com/holidays/philippines/${year}`;
        console.log(`[Scraper] Fetching ${year} holidays from: ${url}`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const holidays = [];

        // Select all rows in the holiday table body
        $('#holidays-table tbody tr').each((index, element) => {
            // Rows with id starting with 'hol-' are actual holiday rows
            // Header rows (month names) usually don't have this or have different classes
            const row = $(element);
            const cells = row.find('td');
            
            if (cells.length >= 2) {
                // Date is in the <th> tag of this <tr>
                const dateText = row.find('th').text().trim();
                
                // Usually: cells[0] = Day, cells[1] = Name, cells[2] = Type
                // But let's be safe and find the name and type by their positions
                const name = $(cells[cells.length - 2]).text().trim();
                const typeText = $(cells[cells.length - 1]).text().trim();
                const lowerType = typeText.toLowerCase();
                
                // Debug log to see what's being processed
                // console.log(`[Scraper Debug] Row: ${dateText} | Name: ${name} | Type: ${typeText}`);
                const isRegular = lowerType.includes("regular holiday");
                const isSpecial = lowerType.includes("special non-working holiday") || 
                                  lowerType.includes("special non working holiday");

                if (dateText && name && (isRegular || isSpecial)) {
                    const holidayType = isRegular ? "Regular Holiday" : "Special Holiday";

                    // Convert "Jan 1" or "Jan 1 (Thu)" to "YYYY-MM-DD"
                    const cleanDateText = dateText.split('(')[0].trim();
                    const date = new Date(`${cleanDateText} ${year}`);

                    if (!isNaN(date)) {
                        const formattedDate = date.toISOString().split('T')[0];
                        holidays.push({
                            name: name,
                            date: formattedDate,
                            type: holidayType
                        });
                    }
                }
            }
        });

        console.log(`[Scraper] Successfully found ${holidays.length} holidays for ${year}.`);
        return holidays;

    } catch (error) {
        console.error(`[Scraper Error]: Failed to scrape holidays. ${error.message}`);
        return [];
    }
};

module.exports = scrapeHolidays;
