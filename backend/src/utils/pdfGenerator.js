const PDFDocument = require("pdfkit");
const path = require("path");

/**
 * Generates an exact replica of the Frontend Payslip PDF using pdfkit.
 */
exports.generatePayslipPDF = async (payroll) => {
  return new Promise((resolve, reject) => {
    // Standard A4: 595.28 x 841.89 points
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // --- Red Outer Border (Matching .payslipCard border: 2px solid #b91c1c) ---
    doc.rect(20, 20, 555, 800).lineWidth(2).stroke("#b91c1c");

    // --- Logo (Optional check) ---
    try {
      const logoPath = path.join(__dirname, "../../../frontend/public/logo2.png");
      doc.image(logoPath, 50, 40, { width: 60 });
    } catch (e) {
      console.warn("[PDF LOGO ERROR]: Logo not found at path.");
    }

    // --- Company Header (Matching .companyHeader color: #1e3a8a) ---
    doc.fillColor("#1e3a8a")
       .font("Helvetica-Bold").fontSize(18)
       .text("MAC-J INT'L., FORWARDING LTD., CO.", 40, 50, { align: "center" });
    
    doc.fillColor("#444")
       .font("Helvetica").fontSize(8)
       .text("Unit 201, 2nd Floor, Ma. Natividad Bldg., 1007 M.H. Del Pilar St., Ermita, Manila", { align: "center" });
    
    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).lineWidth(0.5).stroke("#ddd");
    doc.moveDown(2);

    // --- Employee Info Section (Grid layout 150px / 20px / 1fr) ---
    const drawInfoRow = (label, value, y) => {
      doc.fillColor("black").font("Helvetica-Bold").fontSize(10).text(label, 60, y);
      doc.text(":", 210, y);
      doc.font("Helvetica").text(String(value || "—").toUpperCase(), 230, y);
    };

    let infoY = doc.y;
    const formatDateRange = (start, end) => {
      const opt = { month: 'long', day: '2-digit' };
      const s = new Date(start).toLocaleDateString('en-US', opt).toUpperCase();
      const e = new Date(end).toLocaleDateString('en-US', { ...opt, year: 'numeric' }).toUpperCase();
      return `${s} - ${e}`;
    };

    drawInfoRow("Employee name", `${payroll.user_FirstName} ${payroll.user_LastName}`, infoY);
    drawInfoRow("Payroll period", formatDateRange(payroll.period_Start, payroll.period_End), infoY + 18);
    drawInfoRow("Account Number", payroll.accountNo, infoY + 36);
    drawInfoRow("Number of Days", payroll.NoDays_Worked, infoY + 54);
    
    doc.y = infoY + 80;

    // --- Table Layout ---
    const tableTop = doc.y;
    const colWidths = [140, 40, 75, 140, 40, 75];
    const colStarts = [60, 200, 240, 315, 455, 495];

    // Header Background
    doc.rect(60, tableTop, 510, 20).fill("#f8fafc").stroke("#ddd");
    doc.fillColor("black").font("Helvetica-Bold").fontSize(9);
    
    const headers = ["EARNINGS", "Hrs", "Amount", "DEDUCTIONS", "Hrs/Mins", "Amount"];
    headers.forEach((h, i) => doc.text(h, colStarts[i] + 2, tableTop + 6));

    let rowY = tableTop + 20;
    const formatCurrency = (val) => parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    const rows = [
      { eL: "Pay this period", eH: payroll.NoHrs_Worked, eA: formatCurrency(payroll.basicPay), dL: "Absences", dH: payroll.absence_Hrs, dA: formatCurrency(payroll.absence_Amnt) },
      { eL: "Overtime pay", eH: payroll.OT_Hrs, eA: formatCurrency(payroll.OT_Amnt), dL: "Tardiness", dH: `${payroll.tardiness_Mins}m`, dA: formatCurrency(payroll.tardiness_Amnt) },
      { eL: "Restday OT", eH: payroll.restDay_OT_Hrs, eA: formatCurrency(payroll.restDay_OT_Amnt), dL: "SSS / Philhealth", dH: "", dA: formatCurrency(parseFloat(payroll.SSS_Ded || 0) + parseFloat(payroll.Philhealth_Ded || 0)) },
      { eL: "Night Differential", eH: payroll.nightDiff_Hrs, eA: formatCurrency(payroll.nightDiff_Amnt), dL: "HDMF (Pag-IBIG)", dH: "", dA: formatCurrency(payroll.HDMF_Ded) },
      { eL: "Special Holiday", eH: payroll.specialHol_Hrs, eA: formatCurrency(payroll.specialHol_Amnt), dL: "Withholding Tax", dH: "", dA: formatCurrency(payroll.Tax_Ded) },
      { eL: "Incentives", eH: "", eA: formatCurrency(payroll.incentives), dL: "SSS / HDMF Loan", dH: "", dA: formatCurrency(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0)) },
      { eL: "Allowance", eH: "", eA: formatCurrency(payroll.allowance), dL: "Health Card / Calamity", dH: "", dA: formatCurrency(parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.calamityLoan_Amnt || 0)) },
      { eL: "Bonus", eH: "", eA: formatCurrency(payroll.Bonus), dL: "Advances / Globe", dH: "", dA: formatCurrency(parseFloat(payroll.advances_Amnt || 0) + parseFloat(payroll.globe_Deduction || 0)) },
      { eL: "Others", eH: "", eA: formatCurrency(payroll.Other_Earnings), dL: "MP Savings / Others", dH: "", dA: formatCurrency(parseFloat(payroll.multiPurposeSavings || 0)) },
    ];

    doc.font("Helvetica").fontSize(8.5);
    rows.forEach(r => {
      // Draw grid lines
      doc.rect(60, rowY, 510, 18).stroke("#ddd");
      doc.moveTo(colStarts[1]-2, rowY).lineTo(colStarts[1]-2, rowY+18).stroke("#ddd");
      doc.moveTo(colStarts[2]-2, rowY).lineTo(colStarts[2]-2, rowY+18).stroke("#ddd");
      doc.moveTo(colStarts[3]-2, rowY).lineTo(colStarts[3]-2, rowY+18).stroke("#ddd");
      doc.moveTo(colStarts[4]-2, rowY).lineTo(colStarts[4]-2, rowY+18).stroke("#ddd");
      doc.moveTo(colStarts[5]-2, rowY).lineTo(colStarts[5]-2, rowY+18).stroke("#ddd");

      doc.text(r.eL, colStarts[0] + 5, rowY + 5);
      doc.text(String(r.eH || ""), colStarts[1], rowY + 5);
      doc.text(r.eA, colStarts[2], rowY + 5);
      doc.text(r.dL, colStarts[3] + 5, rowY + 5);
      doc.text(String(r.dH || ""), colStarts[4], rowY + 5);
      doc.text(r.dA, colStarts[5], rowY + 5);
      rowY += 18;
    });

    // --- Subtotals ---
    doc.rect(60, rowY, 510, 20).stroke("#333");
    doc.font("Helvetica-Bold");
    doc.text("Total Pay", colStarts[0] + 5, rowY + 6);
    doc.text(formatCurrency(payroll.totalEarnings), colStarts[2], rowY + 6);
    doc.text("Total deduction", colStarts[3] + 5, rowY + 6);
    doc.text(formatCurrency(payroll.totalDeductions), colStarts[5], rowY + 6);
    
    // --- Net Pay Section ---
    rowY += 35;
    doc.fontSize(12).text("Net Pay", 320, rowY);
    doc.fontSize(14).text(`P ${formatCurrency(payroll.netPay)}`, 495 - 20, rowY);
    // Double underline for Net Pay
    doc.moveTo(450, rowY + 16).lineTo(540, rowY + 16).lineWidth(1).stroke("#333");
    doc.moveTo(450, rowY + 19).lineTo(540, rowY + 19).lineWidth(1).stroke("#333");

    // --- Signature Section ---
    doc.moveDown(5);
    const sigY = doc.y;
    doc.font("Helvetica").fontSize(10).text("RECEIVED BY:", 60, sigY);
    doc.moveTo(60, sigY + 40).lineTo(310, sigY + 40).lineWidth(1.5).stroke("#333");
    doc.font("Helvetica-Bold").text(`${payroll.user_FirstName} ${payroll.user_LastName}`, 60, sigY + 45);

    doc.end();
  });
};