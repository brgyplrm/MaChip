const PDFDocument = require("pdfkit");
const path = require("path");

/**
 * Generates a Government Loan Report PDF.
 */
exports.generateGovLoanReportPDF = async (history, filters = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // --- Header ---
    try {
      const logoPath = path.join(__dirname, "../../../frontend/public/logo2.png");
      doc.image(logoPath, 40, 35, { width: 50 });
    } catch (e) {}

    doc.fillColor("#1e3a8a")
       .font("Helvetica-Bold").fontSize(16)
       .text("MAC-J INT'L., FORWARDING LTD., CO.", 100, 40);
    
    doc.fillColor("#444")
       .font("Helvetica").fontSize(8)
       .text("GOVERNMENTAL LOAN REMITTANCE REPORT", 100, 60);

    const reportDate = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.text(`Generated on: ${reportDate}`, 100, 72);

    // --- Filter Info ---
    doc.fontSize(9).font("Helvetica-Bold").text("FILTERS APPLIED:", 40, 100);
    doc.font("Helvetica").text(`Year: ${filters.year || 'All'} | Type: ${filters.type || 'All'}`, 130, 100);

    doc.moveTo(40, 115).lineTo(800, 115).lineWidth(1).stroke("#eee");

    // --- Table ---
    const tableTop = 130;
    const colWidths = [100, 200, 150, 100, 100];
    const colStarts = [40, 140, 340, 490, 590];
    const headers = ["DATE PROCESSED", "EMPLOYEE NAME", "LOAN CATEGORY", "AMOUNT", "STATUS"];

    // Table Header
    doc.rect(40, tableTop, 760, 25).fill("#2A174E");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10);
    headers.forEach((h, i) => doc.text(h, colStarts[i] + 5, tableTop + 8));

    let rowY = tableTop + 25;
    doc.fillColor("black").font("Helvetica").fontSize(9);

    const peso = (val) => `P${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    history.forEach((item, idx) => {
      // Alternate row background
      if (idx % 2 === 1) {
        doc.rect(40, rowY, 760, 20).fill("#f9fafb");
      }
      
      doc.fillColor("#444");
      const dateStr = new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.text(dateStr, colStarts[0] + 5, rowY + 6);
      doc.text(item.userName || `User #${item.user_Id}`, colStarts[1] + 5, rowY + 6);
      doc.text(item.type || item.government_type || "N/A", colStarts[2] + 5, rowY + 6);
      doc.text(peso(item.amount), colStarts[3] + 5, rowY + 6, { width: 90, align: 'right' });
      doc.text("PAID", colStarts[4] + 5, rowY + 6);

      doc.moveTo(40, rowY + 20).lineTo(800, rowY + 20).lineWidth(0.5).stroke("#eee");
      rowY += 20;

      // Page break check
      if (rowY > 500) {
        doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
        rowY = 40;
        // Re-draw headers on new page
        doc.rect(40, rowY, 760, 25).fill("#2A174E");
        doc.fillColor("white").font("Helvetica-Bold").fontSize(10);
        headers.forEach((h, i) => doc.text(h, colStarts[i] + 5, rowY + 8));
        rowY += 25;
        doc.fillColor("black").font("Helvetica").fontSize(9);
      }
    });

    // --- Summary ---
    const totalRemitted = history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(11).text("TOTAL REMITTED:", 400, doc.y);
    doc.fontSize(14).fillColor("#1e3a8a").text(peso(totalRemitted), 550, doc.y - 3, { align: 'right', width: 140 });

    doc.end();
  });
};

/**
 * Generates an Individual Loan Ledger PDF.
 */
exports.generateIndividualLoanPDF = async (loan, ledger) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // --- Header ---
    doc.fillColor("#1e3a8a")
       .font("Helvetica-Bold").fontSize(18)
       .text("INDIVIDUAL LOAN LEDGER", 40, 50, { align: "center" });
    
    doc.moveTo(40, 75).lineTo(555, 75).lineWidth(1).stroke("#ddd");

    // --- Employee & Loan Info ---
    let infoY = 90;
    const drawRow = (label, value, y) => {
      doc.fillColor("#666").font("Helvetica-Bold").fontSize(9).text(label, 60, y);
      doc.fillColor("black").font("Helvetica").text(String(value || "—"), 180, y);
    };

    drawRow("BORROWER", loan.employeeName, infoY);
    drawRow("LOAN TYPE", loan.notes || loan.deductionType, infoY + 15);
    drawRow("PRINCIPAL", `P${parseFloat(loan.totalAmount).toLocaleString()}`, infoY + 30);
    drawRow("REMAINING", `P${parseFloat(loan.remainingBalance).toLocaleString()}`, infoY + 45);
    drawRow("STATUS", loan.status.toUpperCase(), infoY + 60);

    // --- Ledger Table ---
    const tableTop = 180;
    const headers = ["#", "DUE DATE", "AMOUNT", "BALANCE", "STATUS"];
    const colStarts = [60, 100, 220, 340, 460];

    doc.rect(60, tableTop, 480, 20).fill("#f1f5f9");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8);
    headers.forEach((h, i) => doc.text(h, colStarts[i], tableTop + 6));

    let rowY = tableTop + 20;
    doc.font("Helvetica").fontSize(8);

    ledger.forEach((item, idx) => {
      // Page break check
      if (rowY > 750) {
        doc.addPage({ margin: 40, size: "A4" });
        rowY = 50;
        
        // Re-draw headers on new page
        doc.rect(60, rowY, 480, 20).fill("#f1f5f9");
        doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8);
        headers.forEach((h, i) => doc.text(h, colStarts[i], rowY + 6));
        rowY += 20;
        doc.font("Helvetica").fontSize(8);
      }

      doc.fillColor("black").text(idx + 1, colStarts[0], rowY + 6);
      doc.text(new Date(item.dueDate).toLocaleDateString(), colStarts[1], rowY + 6);
      doc.text(`P${parseFloat(item.total).toLocaleString()}`, colStarts[2], rowY + 6);
      doc.text(`P${parseFloat(item.remaining).toLocaleString()}`, colStarts[3], rowY + 6);
      doc.fillColor(item.status === 'PAID' ? 'green' : 'orange').text(item.status, colStarts[4], rowY + 6);
      doc.fillColor('black');

      doc.moveTo(60, rowY + 18).lineTo(540, rowY + 18).lineWidth(0.5).stroke("#eee");
      rowY += 18;
    });

    doc.end();
  });
};