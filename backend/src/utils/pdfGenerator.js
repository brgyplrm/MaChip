const PDFDocument = require("pdfkit");
const path = require("path");

const formatCurrency = (val) =>
  Math.max(0, parseFloat(val || 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
};

const formatDateShort = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
  }).toUpperCase();
};

/**
 * Generates the Standard Compliance Payslip PDF (matching left side of ViewPayslipModal).
 * @param {Object} payroll - Complete payroll record or stats object
 * @param {string|null} password - Optional PDF encryption password
 * @returns {Promise<Buffer>}
 */
exports.generatePayslipPDF = async (payroll, password = null) => {
  return new Promise((resolve, reject) => {
    const pdfOptions = { margin: 30, size: "A4" };
    if (password) {
      pdfOptions.userPassword = password;
      pdfOptions.ownerPassword = "machip_admin"; // Admin master override
      pdfOptions.permissions = {
        printing: "highResolution",
        modifying: false,
        copying: true,
      };
    }

    const doc = new PDFDocument(pdfOptions);
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const leftMargin = 35;
    const rightMargin = pageWidth - 35;
    const contentWidth = rightMargin - leftMargin;

    // Outer Red Border
    doc.rect(leftMargin - 10, 20, contentWidth + 20, pageHeight - 40).lineWidth(1.5).stroke("#b91c1c");

    // Optional Logo
    try {
      const logoPath = path.join(__dirname, "../../../frontend/public/logo2.png");
      doc.image(logoPath, leftMargin + 10, 30, { width: 45 });
    } catch (e) {
      // Ignore if logo image is absent
    }

    // Company Header
    doc.fillColor("#1e3a8a").font("Helvetica-Bold").fontSize(15).text("MAC-J INT'L., FORWARDING LTD., CO.", leftMargin, 35, { width: contentWidth, align: "center" });
    doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text("Unit 201, 2nd Floor, Ma. Natividad Bldg., 1007 M.H. Del Pilar St., Ermita, Manila", leftMargin, doc.y + 2, { width: contentWidth, align: "center" });

    doc.moveTo(leftMargin + 20, doc.y + 6).lineTo(rightMargin - 20, doc.y + 6).lineWidth(0.5).stroke("#cbd5e1");
    doc.y += 12;

    // Subtitle badge
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("STANDARD COMPLIANCE PAYSLIP", leftMargin, doc.y, { width: contentWidth, align: "center" });
    doc.y += 8;

    // Info Section
    const infoY = doc.y;
    const drawInfoRow = (label, val, y) => {
      doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(8.5).text(label, leftMargin + 10, y, { width: 110 });
      doc.text(":", leftMargin + 125, y);
      doc.font("Helvetica").text(String(val || "—"), leftMargin + 135, y);
    };

    drawInfoRow("Employee name", `${payroll.user_FirstName || ""} ${payroll.user_LastName || ""}`.toUpperCase(), infoY);
    drawInfoRow("Payroll period", `${formatDateShort(payroll.period_Start)} - ${formatDate(payroll.period_End)}`.toUpperCase(), infoY + 14);
    drawInfoRow("Account Number", payroll.accountNo || payroll.account_Number || "—", infoY + 28);
    drawInfoRow("Number of Days", payroll.NoDays_Worked || 0, infoY + 42);

    doc.y = infoY + 62;

    // Earnings / Deductions Table
    const tableTop = doc.y;
    const colWidths = [135, 35, 75, 150, 45, 75];
    const colStarts = [
      leftMargin,
      leftMargin + colWidths[0],
      leftMargin + colWidths[0] + colWidths[1],
      leftMargin + colWidths[0] + colWidths[1] + colWidths[2],
      leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
      leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
    ];
    const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header Row
    doc.rect(leftMargin, tableTop, totalTableWidth, 18).fill("#f1f5f9").stroke("#cbd5e1");
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(8);
    const headers = ["EARNINGS", "Hrs", "Amount", "DEDUCTIONS", "Hrs/Mins", "Amount"];
    headers.forEach((h, i) => {
      const align = (i === 2 || i === 5) ? "right" : (i === 1 || i === 4 ? "center" : "left");
      doc.text(h, colStarts[i] + 4, tableTop + 5, { width: colWidths[i] - 8, align });
    });

    const rows = [
      {
        eL: "Pay this period",
        eH: `${payroll.NoHrs_Worked || 0}`,
        eA: formatCurrency(payroll.potentialBasicPay ?? (payroll.dailyRate ? payroll.dailyRate * 13 : payroll.basicPay)),
        dL: "Absences",
        dH: `${payroll.absence_Hrs || 0}`,
        dA: formatCurrency(payroll.absence_Amnt)
      },
      {
        eL: "Overtime pay",
        eH: `${payroll.OT_Hrs || 0}`,
        eA: formatCurrency(payroll.OT_Amnt),
        dL: "Tardiness",
        dH: `${payroll.tardiness_Mins || 0}m`,
        dA: formatCurrency(payroll.tardiness_Amnt)
      },
      {
        eL: "Restday OT",
        eH: `${payroll.restDay_OT_Hrs || 0}`,
        eA: formatCurrency(payroll.restDay_OT_Amnt),
        dL: "SSS Contribution",
        dH: "",
        dA: formatCurrency(payroll.SSS_Ded)
      },
      {
        eL: "Night Differential",
        eH: `${payroll.nightDiff_Hrs || 0}`,
        eA: formatCurrency(payroll.nightDiff_Amnt),
        dL: "Philhealth",
        dH: "",
        dA: formatCurrency(payroll.Philhealth_Ded)
      },
      {
        eL: "Holidays",
        eH: `${payroll.holidaysTotal || 0}`,
        eA: formatCurrency(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0)),
        dL: "HDMF (Pag-IBIG)",
        dH: "",
        dA: formatCurrency(payroll.HDMF_Ded)
      },
      {
        eL: "Allowance",
        eH: "",
        eA: formatCurrency(payroll.allowance),
        dL: "Withholding Tax",
        dH: "",
        dA: formatCurrency(payroll.Tax_Ded)
      },
      {
        eL: "Incentives",
        eH: "",
        eA: formatCurrency(payroll.incentives),
        dL: "SSS / HDMF Loans",
        dH: "",
        dA: formatCurrency(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0))
      },
      {
        eL: "Others",
        eH: "",
        eA: formatCurrency(payroll.Bonus || 0),
        dL: "Calamity / Personal Loans",
        dH: "",
        dA: formatCurrency(parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0))
      },
      {
        eL: "",
        eH: "",
        eA: "",
        dL: "Advances / Health Card",
        dH: "",
        dA: formatCurrency(parseFloat(payroll.advances_Amnt || 0) + parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0))
      }
    ];

    let rowY = tableTop + 18;
    const rowHeight = 16;
    doc.font("Helvetica").fontSize(7.5);

    rows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#fafafa";
      doc.rect(leftMargin, rowY, totalTableWidth, rowHeight).fill(bg).stroke("#e2e8f0");
      doc.fillColor("#334155");

      for (let i = 1; i < colStarts.length; i++) {
        doc.moveTo(colStarts[i], rowY).lineTo(colStarts[i], rowY + rowHeight).lineWidth(0.5).stroke("#e2e8f0");
      }

      doc.text(r.eL, colStarts[0] + 4, rowY + 4, { width: colWidths[0] - 8, align: "left" });
      doc.text(r.eH, colStarts[1] + 2, rowY + 4, { width: colWidths[1] - 4, align: "center" });
      doc.text(r.eA, colStarts[2] + 2, rowY + 4, { width: colWidths[2] - 6, align: "right" });
      doc.text(r.dL, colStarts[3] + 4, rowY + 4, { width: colWidths[3] - 8, align: "left" });
      doc.text(r.dH, colStarts[4] + 2, rowY + 4, { width: colWidths[4] - 4, align: "center" });
      doc.text(r.dA, colStarts[5] + 2, rowY + 4, { width: colWidths[5] - 6, align: "right" });

      rowY += rowHeight;
    });

    // Subtotal Row
    doc.rect(leftMargin, rowY, totalTableWidth, 18).fill("#f8fafc").stroke("#94a3b8");
    doc.font("Helvetica-Bold").fontSize(8);
    doc.fillColor("#1e3a8a").text("Total Pay", colStarts[0] + 4, rowY + 5);
    doc.text(formatCurrency(payroll.totalEarnings), colStarts[2] + 2, rowY + 5, { width: colWidths[2] - 6, align: "right" });
    doc.fillColor("#b91c1c").text("Total Ded.", colStarts[3] + 4, rowY + 5);
    doc.text(formatCurrency(payroll.totalDeductions), colStarts[5] + 2, rowY + 5, { width: colWidths[5] - 6, align: "right" });
    rowY += 24;

    // NET PAY Block
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(10).text("NET PAY:", leftMargin + 260, rowY + 4);
    doc.fontSize(12).text(`P ${formatCurrency(payroll.netPay)}`, leftMargin + 350, rowY + 3, { width: 150, align: "right" });
    doc.moveTo(leftMargin + 350, rowY + 18).lineTo(rightMargin - 15, rowY + 18).lineWidth(1).stroke("#1e293b");
    doc.moveTo(leftMargin + 350, rowY + 20.5).lineTo(rightMargin - 15, rowY + 20.5).lineWidth(1).stroke("#1e293b");
    rowY += 32;

    // Year-to-date (YTD) Box
    doc.rect(leftMargin, rowY, totalTableWidth, 54).lineWidth(0.5).stroke("#cbd5e1");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(7.5).text("YEAR-TO-DATE (YTD) ACCUMULATED", leftMargin + 8, rowY + 6);
    doc.moveTo(leftMargin, rowY + 16).lineTo(leftMargin + totalTableWidth, rowY + 16).lineWidth(0.5).stroke("#e2e8f0");

    const ytdColW = totalTableWidth / 2;
    const ytdY = rowY + 22;
    const drawYtdRow = (label, val, x, y) => {
      doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(label, x + 8, y, { width: ytdColW - 90 });
      doc.font("Helvetica-Bold").fillColor("#1e293b").text(val, x + ytdColW - 85, y, { width: 75, align: "right" });
    };

    drawYtdRow("Gross Earnings:", `P ${formatCurrency(payroll.ytdGross || 0)}`, leftMargin, ytdY);
    drawYtdRow("Total Deductions:", `(${formatCurrency(payroll.ytdDeductions || 0)})`, leftMargin + ytdColW, ytdY);
    drawYtdRow("Non-Taxable / De Minimis:", `P ${formatCurrency(payroll.ytdNonTaxable || 0)}`, leftMargin, ytdY + 14);
    drawYtdRow("Withholding Tax (BIR):", `(${formatCurrency(payroll.ytdBIR || 0)})`, leftMargin + ytdColW, ytdY + 14);
    rowY += 66;

    // Received by / Signature Section
    const sigY = rowY + 10;
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8).text("RECEIVED BY:", leftMargin + 10, sigY);
    doc.moveTo(leftMargin + 10, sigY + 38).lineTo(leftMargin + 220, sigY + 38).lineWidth(1).stroke("#475569");
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(8.5).text(`${payroll.user_FirstName || ""} ${payroll.user_LastName || ""}`.toUpperCase(), leftMargin + 10, sigY + 42, { width: 210, align: "center" });
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(6.5).text("Signed Over Printed Name", leftMargin + 10, sigY + 52, { width: 210, align: "center" });

    doc.fillColor("#475569").font("Helvetica").fontSize(8).text("Date:", leftMargin + 280, sigY + 42);
    doc.moveTo(leftMargin + 310, sigY + 50).lineTo(leftMargin + 440, sigY + 50).lineWidth(0.5).stroke("#94a3b8");

    doc.end();
  });
};

/**
 * Generates the Detailed Computation Payslip PDF (matching right side of ViewPayslipModal).
 * @param {Object} payroll - Complete payroll record or stats object
 * @param {string|null} password - Optional PDF encryption password
 * @returns {Promise<Buffer>}
 */
exports.generateDetailedPayslipPDF = async (payroll, password = null) => {
  return new Promise((resolve, reject) => {
    const pdfOptions = { margin: 30, size: "A4" };
    if (password) {
      pdfOptions.userPassword = password;
      pdfOptions.ownerPassword = "machip_admin"; // Admin master override
      pdfOptions.permissions = {
        printing: "highResolution",
        modifying: false,
        copying: true,
      };
    }

    const doc = new PDFDocument(pdfOptions);
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const leftMargin = 32;
    const rightMargin = pageWidth - 32;
    const contentWidth = rightMargin - leftMargin;

    // Outer subtle card border
    doc.roundedRect(leftMargin - 8, 16, contentWidth + 16, pageHeight - 32, 6).lineWidth(1).stroke("#cbd5e1");

    // Header Block
    doc.fillColor("#2A174E").font("Helvetica-Bold").fontSize(15).text("MAC-J INT'L., FORWARDING LTD., CO.", leftMargin, 26, { width: contentWidth, align: "center" });
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(7.5).text(`Pay Period: ${formatDate(payroll.period_Start)} - ${formatDate(payroll.period_End)}`, leftMargin, doc.y + 2, { width: contentWidth, align: "center" });
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7).text(`Payroll Date: ${formatDate(payroll.updatedAt || payroll.createdAt || new Date())}`, leftMargin, doc.y + 1, { width: contentWidth, align: "center" });

    doc.moveTo(leftMargin + 30, doc.y + 5).lineTo(rightMargin - 30, doc.y + 5).lineWidth(0.5).stroke("#e2e8f0");
    doc.y += 9;

    let currY = doc.y;

    // Table 1: Employee Bio & Rate Information side-by-side
    const colHalf = (contentWidth - 8) / 2;

    // Left Box: Bio
    doc.roundedRect(leftMargin, currY, colHalf, 36, 4).fill("#f8fafc").stroke("#e2e8f0");
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(6.5).text("EMPLOYEE NAME", leftMargin + 8, currY + 5);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5).text(`${payroll.user_FirstName || ""} ${payroll.user_LastName || ""}`.toUpperCase(), leftMargin + 8, currY + 13, { width: colHalf - 16 });
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(6.5).text("POSITION", leftMargin + 8, currY + 23);
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(8).text(payroll.user_Position || payroll.position || "Staff", leftMargin + 65, currY + 23, { width: colHalf - 75 });

    // Right Box: Rate Information
    const rightBoxX = leftMargin + colHalf + 8;
    doc.roundedRect(rightBoxX, currY, colHalf, 36, 4).fill("#f8fafc").stroke("#e2e8f0");
    const dailyRate = parseFloat(payroll.dailyRate || 0);
    const hourlyRate = parseFloat(payroll.ratePerHr || (dailyRate / 8) || 0);
    const monthlyRate = dailyRate * 26;

    const drawRateRow = (label, val, y) => {
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(6.5).text(label, rightBoxX + 8, y);
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(7.5).text(val, rightBoxX + colHalf - 75, y, { width: 65, align: "right" });
    };
    drawRateRow("Monthly Rate:", `P ${formatCurrency(monthlyRate)}`, currY + 4);
    drawRateRow("Daily Rate:", `P ${formatCurrency(dailyRate)}`, currY + 14);
    drawRateRow("Hourly Rate:", `P ${formatCurrency(hourlyRate)}`, currY + 24);

    currY += 42;

    // 2. Computation Metric Categories Table
    const compHeaderH = 15;
    doc.rect(leftMargin, currY, contentWidth, compHeaderH).fill("#2A174E").stroke("#2A174E");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
    doc.text("COMPUTATION METRIC CATEGORIES", leftMargin + 6, currY + 4, { width: 260 });
    doc.text("RENDERED DATA", leftMargin + 270, currY + 4, { width: 90, align: "center" });
    doc.text("FINANCIAL IMPACT", leftMargin + 370, currY + 4, { width: contentWidth - 376, align: "right" });
    currY += compHeaderH;

    const basePayHours = payroll.NoHrs_Worked || 0;
    const basePayAmnt = (basePayHours / 8) * dailyRate;

    const compRows = [
      { cat: "Regular Base Pay Hours Calculated", data: `${basePayHours} hrs`, impact: `P ${formatCurrency(basePayAmnt)}` },
      { cat: "Standard Overtime Pay", data: `${payroll.OT_Hrs || 0} hrs`, impact: `P ${formatCurrency(payroll.OT_Amnt || 0)}` },
      { cat: "Overtime with Night Shift", data: `${payroll.nightOT_Hrs || 0} hrs`, impact: `P ${formatCurrency(payroll.nightOT_Amnt || 0)}` },
      { cat: "Night Differential Premium", data: `${payroll.nightDiff_Hrs || 0} hrs`, impact: `P ${formatCurrency(payroll.nightDiff_Amnt || 0)}` },
      { cat: "Statutory Holiday Compensation Matrix", data: `${payroll.holidaysTotal || 0} days`, impact: `P ${formatCurrency(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}` }
    ];

    doc.font("Helvetica").fontSize(7);
    compRows.forEach((r, idx) => {
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#fafafa";
      doc.rect(leftMargin, currY, contentWidth, 14).fill(rowBg).stroke("#e2e8f0");
      doc.fillColor("#334155").text(r.cat, leftMargin + 6, currY + 3.5);
      doc.text(r.data, leftMargin + 270, currY + 3.5, { width: 90, align: "center" });
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(r.impact, leftMargin + 370, currY + 3.5, { width: contentWidth - 376, align: "right" });
      doc.font("Helvetica");
      currY += 14;
    });

    // Gross Earnings Row
    doc.rect(leftMargin, currY, contentWidth, 15).fill("#ecfdf5").stroke("#10b981");
    doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(7.5).text("Gross Earnings (Total Compensation)", leftMargin + 6, currY + 3.5);
    doc.text("—", leftMargin + 270, currY + 3.5, { width: 90, align: "center" });
    doc.text(`P ${formatCurrency(payroll.totalEarnings)}`, leftMargin + 370, currY + 3.5, { width: contentWidth - 376, align: "right" });
    currY += 19;

    // 3. Gross Earnings Analysis (Non-Taxable)
    doc.rect(leftMargin, currY, contentWidth, 13).fill("#f1f5f9").stroke("#cbd5e1");
    doc.fillColor("#2A174E").font("Helvetica-Bold").fontSize(7).text("GROSS EARNINGS ANALYSIS", leftMargin + 6, currY + 3);
    currY += 13;

    doc.rect(leftMargin, currY, contentWidth, 13).fill("#ffffff").stroke("#e2e8f0");
    doc.fillColor("#475569").font("Helvetica").fontSize(7).text("Non-Taxable Earnings (Allowances/De Minimis)", leftMargin + 6, currY + 3);
    doc.fillColor("#059669").font("Helvetica-Bold").text(`P ${formatCurrency(payroll.allowance)}`, leftMargin + 370, currY + 3, { width: contentWidth - 376, align: "right" });
    currY += 13;

    doc.rect(leftMargin, currY, contentWidth, 13).fill("#f8fafc").stroke("#e2e8f0");
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(7).text("Total Non-Taxable Earnings", leftMargin + 6, currY + 3);
    doc.fillColor("#059669").text(`P ${formatCurrency(payroll.allowance)}`, leftMargin + 370, currY + 3, { width: contentWidth - 376, align: "right" });
    currY += 17;

    // 4. Mandatory and Other Deductions Table
    doc.rect(leftMargin, currY, contentWidth, 13).fill("#fff1f2").stroke("#fecdd3");
    doc.fillColor("#9f1239").font("Helvetica-Bold").fontSize(7).text("LESS: MANDATORY AND OTHER DEDUCTIONS", leftMargin + 6, currY + 3);
    currY += 13;

    const absenceTardy = parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0);
    const deductionRows = [
      { name: "Absences & Tardiness", amnt: absenceTardy },
      { name: "SSS Contribution", amnt: parseFloat(payroll.SSS_Ded || 0) },
      { name: "PhilHealth Contribution", amnt: parseFloat(payroll.Philhealth_Ded || 0) },
      { name: "Pag-IBIG (HDMF) Contribution", amnt: parseFloat(payroll.HDMF_Ded || 0) },
      { name: "SSS Salary Loan", amnt: parseFloat(payroll.SSS_Loan || 0), cond: true },
      { name: "Pag-IBIG (HDMF) Loan", amnt: parseFloat(payroll.HDMF_Loan || 0), cond: true },
      { name: "Calamity Loan", amnt: parseFloat(payroll.calamityLoan_Amnt || 0), cond: true },
      { name: "Personal Loan (Eastwest)", amnt: parseFloat(payroll.eastwest_Loan || 0), cond: true },
      { name: "Cash Advances", amnt: parseFloat(payroll.advances_Amnt || 0), cond: true },
      { name: "Health Card (HMO)", amnt: parseFloat(payroll.healthCard_Amnt || 0), cond: true },
      { name: "Multi-Purpose Savings", amnt: parseFloat(payroll.multiPurposeSavings || 0), cond: true },
    ].filter(d => !d.cond || d.amnt > 0);

    deductionRows.forEach((d, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#fafafa";
      doc.rect(leftMargin, currY, contentWidth, 12.5).fill(bg).stroke("#f1f5f9");
      doc.fillColor("#475569").font("Helvetica").fontSize(6.8).text(d.name, leftMargin + 6, currY + 2.5);
      doc.fillColor("#e11d48").font("Helvetica-Bold").text(`(${formatCurrency(d.amnt)})`, leftMargin + 370, currY + 2.5, { width: contentWidth - 376, align: "right" });
      currY += 12.5;
    });

    const nonTaxDeductions = parseFloat(payroll.totalDeductions || 0) - parseFloat(payroll.Tax_Ded || 0);
    doc.rect(leftMargin, currY, contentWidth, 13).fill("#f8fafc").stroke("#e2e8f0");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(7).text("Total Mandatory & Other Deductions", leftMargin + 6, currY + 3);
    doc.fillColor("#e11d48").text(`(${formatCurrency(nonTaxDeductions)})`, leftMargin + 370, currY + 3, { width: contentWidth - 376, align: "right" });
    currY += 13;

    doc.rect(leftMargin, currY, contentWidth, 13).fill("#ffffff").stroke("#e2e8f0");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(7).text("BIR (Withholding Tax)", leftMargin + 6, currY + 3);
    doc.fillColor("#e11d48").text(`(${formatCurrency(payroll.Tax_Ded)})`, leftMargin + 370, currY + 3, { width: contentWidth - 376, align: "right" });
    currY += 17;

    // 5. Payroll Summary Statement Box
    doc.rect(leftMargin, currY, contentWidth, 14).fill("#2A174E").stroke("#2A174E");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5).text("PAYROLL SUMMARY STATEMENT", leftMargin + 6, currY + 3.5);
    currY += 14;

    const summaryRows = [
      { label: "Gross Earnings", val: `P ${formatCurrency(payroll.totalEarnings)}`, color: "#0f172a" },
      { label: "Total Non-Taxable Earnings", val: `P ${formatCurrency(payroll.allowance)}`, color: "#059669" },
      { label: "Total Deductions (Excl. Tax)", val: `(${formatCurrency(nonTaxDeductions)})`, color: "#e11d48" },
      { label: "BIR (Withholding Tax)", val: `(${formatCurrency(payroll.Tax_Ded)})`, color: "#e11d48" }
    ];

    summaryRows.forEach(sr => {
      doc.rect(leftMargin, currY, contentWidth, 12.5).fill("#ffffff").stroke("#f1f5f9");
      doc.fillColor("#334155").font("Helvetica").fontSize(7).text(sr.label, leftMargin + 6, currY + 2.5);
      doc.fillColor(sr.color).font("Helvetica-Bold").text(sr.val, leftMargin + 370, currY + 2.5, { width: contentWidth - 376, align: "right" });
      currY += 12.5;
    });

    // NET PAY ROW
    doc.rect(leftMargin, currY, contentWidth, 18).fill("#fffbeb").stroke("#fde68a");
    doc.fillColor("#2A174E").font("Helvetica-Bold").fontSize(9).text("NET PAY RECORD", leftMargin + 6, currY + 4.5);
    doc.fontSize(11).text(`P ${formatCurrency(payroll.netPay)}`, leftMargin + 350, currY + 3.5, { width: contentWidth - 356, align: "right" });
    currY += 22;

    // 6. YTD Summary Block
    doc.rect(leftMargin, currY, contentWidth, 38).fill("#f8fafc").stroke("#cbd5e1");
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(6.5).text("YEAR-TO-DATE (YTD) ACCUMULATED TOTALS", leftMargin + 6, currY + 4);
    doc.moveTo(leftMargin, currY + 12).lineTo(leftMargin + contentWidth, currY + 12).lineWidth(0.5).stroke("#e2e8f0");

    const ytdHalf = contentWidth / 2;
    const ytdTop = currY + 15;
    const drawDetailedYtd = (lbl, val, x, y) => {
      doc.fillColor("#64748b").font("Helvetica").fontSize(6.8).text(lbl, x + 6, y);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(val, x + ytdHalf - 65, y, { width: 55, align: "right" });
    };

    drawDetailedYtd("YTD Gross Earnings:", `P ${formatCurrency(payroll.ytdGross || 0)}`, leftMargin, ytdTop);
    drawDetailedYtd("YTD Total Deductions:", `(${formatCurrency(payroll.ytdDeductions || 0)})`, leftMargin + ytdHalf, ytdTop);
    drawDetailedYtd("YTD Non-Taxable:", `P ${formatCurrency(payroll.ytdNonTaxable || 0)}`, leftMargin, ytdTop + 10);
    drawDetailedYtd("YTD BIR (Withholding):", `(${formatCurrency(payroll.ytdBIR || 0)})`, leftMargin + ytdHalf, ytdTop + 10);
    currY += 44;

    // 7. Signature Block
    const sigBlockY = currY + 5;
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("Received by:", leftMargin + 300, sigBlockY);
    doc.moveTo(leftMargin + 300, sigBlockY + 28).lineTo(rightMargin - 10, sigBlockY + 28).lineWidth(1).stroke("#475569");
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(`${payroll.user_FirstName || ""} ${payroll.user_LastName || ""}`.toUpperCase(), leftMargin + 300, sigBlockY + 31, { width: contentWidth - 310, align: "center" });
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(6).text("Signed Over Printed Name", leftMargin + 300, sigBlockY + 40, { width: contentWidth - 310, align: "center" });

    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("Date:", leftMargin + 300, sigBlockY + 48);
    doc.moveTo(leftMargin + 325, sigBlockY + 54).lineTo(rightMargin - 10, sigBlockY + 54).lineWidth(0.5).stroke("#94a3b8");

    doc.end();
  });
};