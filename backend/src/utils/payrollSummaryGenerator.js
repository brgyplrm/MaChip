const PDFDocument = require("pdfkit");

/**
 * Generates a Payroll Summary PDF (Bank Voucher style) for the admin.
 */
exports.generatePayrollSummaryPDF = async (rows, periodLabel) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.font("Helvetica-Bold").fontSize(14).text("MAC-J INT'L., FORWARDING LTD., CO.", { align: "center" });
    doc.fontSize(12).text(`PAYROLL SUMMARY REPORT: ${periodLabel}`, { align: "center" });
    doc.moveDown();

    // Table Setup
    const startX = 30;
    const rowHeight = 20;
    const colWidths = [120, 80, 80, 80, 80, 80, 80, 80]; // Name, Basic, OT, Gross, Govt Ded, Other Ded, Net, Account
    const headers = ["Employee Name", "Basic Pay", "OT/Others", "Gross Pay", "Govt Ded", "Other Ded", "Net Pay", "Account No"];

    let currentY = doc.y;

    // Draw Headers
    doc.rect(startX, currentY, 730, rowHeight).fill("#eeeeee").stroke("#333");
    doc.fillColor("black").font("Helvetica-Bold").fontSize(9);
    
    let tempX = startX;
    headers.forEach((h, i) => {
      doc.text(h, tempX + 5, currentY + 6);
      tempX += colWidths[i] || 80;
    });

    currentY += rowHeight;
    doc.font("Helvetica").fontSize(8);

    let pageTotalNet = 0;

    rows.forEach((r, idx) => {
      // New page if needed
      if (currentY > 500) {
        doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
        currentY = 40;
        // Redraw headers on new page
        doc.rect(startX, currentY, 730, rowHeight).fill("#eeeeee").stroke("#333");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(9);
        let tx = startX;
        headers.forEach((h, i) => {
          doc.text(h, tx + 5, currentY + 6);
          tx += colWidths[i] || 80;
        });
        currentY += rowHeight;
        doc.font("Helvetica").fontSize(8).fillColor("black");
      }

      const govtDed = (parseFloat(r.SSS_Ded || 0) + parseFloat(r.Philhealth_Ded || 0) + parseFloat(r.HDMF_Ded || 0) + parseFloat(r.Tax_Ded || 0));
      const otherDed = (parseFloat(r.healthCard_Amnt || 0) + parseFloat(r.SSS_Loan || 0) + parseFloat(r.HDMF_Loan || 0) + parseFloat(r.calamityLoan_Amnt || 0) + parseFloat(r.multiPurposeSavings || 0) + parseFloat(r.advances_Amnt || 0) + parseFloat(r.globe_Deduction || 0));
      const otOthers = parseFloat(r.totalEarnings || 0) - parseFloat(r.basicPay || 0);

      const data = [
        `${r.user_LastName}, ${r.user_FirstName}`,
        parseFloat(r.basicPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        otOthers.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        parseFloat(r.totalEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        govtDed.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        otherDed.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        parseFloat(r.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        r.accountNo || "—"
      ];

      doc.rect(startX, currentY, 730, rowHeight).stroke("#cccccc");
      let tx = startX;
      data.forEach((val, i) => {
        doc.text(val, tx + 5, currentY + 6, { width: colWidths[i] - 10, ellipsis: true });
        tx += colWidths[i] || 80;
      });

      pageTotalNet += parseFloat(r.netPay || 0);
      currentY += rowHeight;
    });

    // Totals Row
    doc.rect(startX, currentY, 730, rowHeight).fill("#f9f9f9").stroke("#333");
    doc.fillColor("black").font("Helvetica-Bold");
    doc.text("TOTAL", startX + 5, currentY + 6);
    doc.text(pageTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 }), startX + 520 + 5, currentY + 6);

    // Signatures
    doc.moveDown(3);
    const sigY = doc.y;
    doc.font("Helvetica").fontSize(10);
    doc.text("Prepared by:", 50, sigY);
    doc.text("_______________________", 50, sigY + 30);
    doc.text("Approved by (Ma'am Grace):", 300, sigY);
    doc.text("_______________________", 300, sigY + 30);
    
    doc.end();
  });
};
