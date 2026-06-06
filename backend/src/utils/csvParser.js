/**
 * Parses raw CSV text into an array of objects.
 * Handles headers and trims whitespace.
 * Robust against potential carriage returns (\r).
 */
exports.parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== "string") return [];

  // Split lines and filter out empty ones
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return [];

  // Check if this is the multi-header SSS CSV format (Circular 2023 / 2025 table)
  const isMultiHeaderSSS = lines[0].includes("Range of Compensation") || (lines[0].startsWith(",") && lines[0].includes("Range of Compensation"));

  if (isMultiHeaderSSS) {
    if (lines.length < 3) return [];
    const results = [];
    
    // Skip first 2 lines (headers)
    for (let i = 2; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 11) continue; // Must have at least the primary columns

      const row = {};
      
      const cleanNum = (str) => {
        if (!str) return 0;
        const cleaned = str.replace(/[₱$,%\s]/g, "");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Handle Range Min & Max boundaries
      const range1Str = values[1] ? values[1].trim() : "";
      const range2Str = values[2] ? values[2].trim() : "";

      if (range1Str.toLowerCase().startsWith("below")) {
        row.range_Min = 0.00;
        const numMatch = range1Str.replace(/,/g, "").match(/\d+(\.\d+)?/);
        if (numMatch) {
          const limitVal = parseFloat(numMatch[0]);
          row.range_Max = isNaN(limitVal) ? 0.00 : Math.round((limitVal - 0.01) * 100) / 100;
        } else {
          row.range_Max = 0.00;
        }
      } else {
        row.range_Min = cleanNum(range1Str);
        if (range2Str.toLowerCase() === "over" || range2Str.toLowerCase() === "over" || range2Str === "") {
          row.range_Max = 9999999.00;
        } else {
          row.range_Max = cleanNum(range2Str);
        }
      }

      row.monthlySalaryCredit = cleanNum(values[3]);
      
      // Employer Columns: Regular SS = index 6, MPF = index 7, EC = index 8
      row.er_SS = cleanNum(values[6]);
      row.er_Provident = cleanNum(values[7]);
      row.er_EC = cleanNum(values[8]);
      
      // Employee Columns: Regular SS = index 10, MPF = index 11, EC = index 12
      row.ee_SS = cleanNum(values[10]);
      row.ee_Provident = cleanNum(values[11]);
      row.ee_EC = cleanNum(values[12]);

      results.push(row);
    }
    return results;
  }

  if (lines.length < 2) return [];

  // Parse standard single-line headers
  const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h));

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row = {};
    headers.forEach((header, index) => {
      let val = values[index];
      if (val === undefined || val === null || val.trim() === "") {
        row[header] = 0;
      } else {
        // Strip out currency signs, commas, and percentage signs
        const cleanedVal = val.replace(/[₱$,%\s]/g, "");
        const num = parseFloat(cleanedVal);
        row[header] = isNaN(num) ? val.trim() : num;
      }
    });
    results.push(row);
  }

  return results;
};

/**
 * Parses a single CSV line, handling potential quoted fields containing commas.
 */
function parseCSVLine(line) {
  const result = [];
  let currentToken = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[charIndex(i)];
    if (char === '"') {
      insideQuotes = !insideQuotes;
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

// Workaround function for safe index access
function charIndex(i) {
  return i;
}

/**
 * Normalizes header keys to match our database column names.
 * Standardizes common variants of headers used in Excel exports.
 */
function normalizeHeader(header) {
  const h = header.trim().toLowerCase().replace(/[\s_\-.]+/g, "");

  // SSS mappings
  if (h === "rangemin" || h === "min" || h === "salaryfloor") return "range_Min";
  if (h === "rangemax" || h === "max" || h === "salaryceiling") return "range_Max";
  if (h === "msc" || h === "monthlysalarycredit") return "monthlySalaryCredit";
  if (h === "erss" || h === "ssemployer" || h === "employerss") return "er_SS";
  if (h === "eess" || h === "ssemployee" || h === "employeess") return "ee_SS";
  if (h === "erec" || h === "ecemployer" || h === "employerec") return "er_EC";
  if (h === "eeec" || h === "ecemployee" || h === "employeeec") return "ee_EC";
  if (h === "erprovident" || h === "erwisp" || h === "employerprovident") return "er_Provident";
  if (h === "eeprovident" || h === "eewisp" || h === "employeeprovident") return "ee_Provident";

  // PhilHealth mappings
  if (h === "rate" || h === "philhealthrate" || h === "phrate") return "rate";
  if (h === "employeeshareratio" || h === "eeshare" || h === "eeshareratio") return "employeeShareRatio";

  // Pag-IBIG mappings
  if (h === "eerate" || h === "pagibigeerate" || h === "employeehdmf") return "ee_Rate";
  if (h === "errate" || h === "pagibigerrate" || h === "employerhdmf") return "er_Rate";
  if (h === "contributionceiling" || h === "hdmfceiling" || h === "pagibigceiling") return "contributionCeiling";

  // BIR Tax mappings
  if (h === "basetax" || h === "flatrate" || h === "flattax") return "baseTax";
  if (h === "excessrate" || h === "percentage" || h === "percent") return "excessRate";
  if (h === "excessover" || h === "subtrahend" || h === "exceeding") return "excessOver";

  return header.trim();
}
