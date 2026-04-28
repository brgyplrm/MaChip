/**
 * Robust CSV Exporter
 * @param {Array} headers - Column headers
 * @param {Array<Array>} data - Row data
 * @param {string} filename - Output filename
 */
export const exportToCSV = (headers, data, filename) => {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    let str = String(val);
    // Escape double quotes by doubling them
    str = str.replace(/"/g, '""');
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = `"${str}"`;
    }
    return str;
  };

  const csvRows = [
    headers.map(escapeCSV).join(","),
    ...data.map(row => row.map(escapeCSV).join(","))
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n"); // Add BOM for Excel UTF-8 support
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
