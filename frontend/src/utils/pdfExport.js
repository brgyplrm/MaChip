import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Universal PDF Table Exporter for MAChip
 * @param {string} title - The title displayed on the PDF
 * @param {Array} headers - Column headers
 * @param {Array<Array>} data - Row data
 * @param {string} filename - Output filename
 * @param {Object} options - Custom options (orientation, unit, format)
 */
export const exportToPDF = (title, headers, data, filename, options = {}) => {
  const { orientation = "p", unit = "mm", format = "a4" } = options;
  const doc = new jsPDF(orientation, unit, format);
  const width = doc.internal.pageSize.getWidth();

  // Header Section
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(42, 23, 78); // #2A174E
  doc.text("MAC-J INT'L., FORWARDING LTD., CO.", width / 2, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Unit 201, 2nd Floor, Ma. Natividad Bldg., 10 St., Ermita, Manila", width / 2, 20, { align: "center" });
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(220);
  doc.line(15, 25, width - 15, 25);

  // Report Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(title.toUpperCase(), 15, 35);

  // Timestamp
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, width - 15, 35, { align: "right" });

  // Table Generation
  autoTable(doc, {
    startY: 40,
    head: [headers],
    body: data,
    theme: 'striped',
    headStyles: { 
      fillColor: [42, 23, 78], 
      textColor: 255, 
      fontSize: 8, 
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      fontSize: 7,
      textColor: 50
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    margin: { top: 40, bottom: 20, left: 15, right: 15 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.text(str, width / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
    }
  });

  doc.save(filename || `${title.replace(/\s+/g, '_')}_Report.pdf`);
};
