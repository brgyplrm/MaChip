import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import * as zip from "@zip.js/zip.js";

/**
 * Generates a PDF blob for a single employee payslip
 */
const generatePayslipPDF = (p) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const width = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MAC-J INT'L., FORWARDING LTD., CO.", width / 2, 20, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Unit 201, 2nd Floor, Ma. Natividad Bldg., 1007 M.H. Del Pilar St., Ermita, Manila", width / 2, 25, { align: "center" });

  // Employee Info
  doc.setFontSize(10);
  doc.text(`Employee name: ${p.user_FirstName} ${p.user_LastName}`, margin, 40);
  
  const [startY, startM, startD] = p.period_Start.split('-').map(Number);
  const [endY, endM, endD] = p.period_End.split('-').map(Number);
  const startObj = new Date(startY, startM - 1, startD);
  const endObj = new Date(endY, endM - 1, endD);
  const periodStr = `${startObj.toLocaleDateString('en-US', { month: 'long', day: '2-digit' }).toUpperCase()} - ${endObj.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()}`;
  
  doc.text(`Payroll period: ${periodStr}`, margin, 45);
  doc.text(`Account Number: ${p.accountNo || "—"}`, margin, 50);
  doc.text(`Number of Days: ${p.NoDays_Worked}`, margin, 55);

  // Table Data
  const tableData = [
    ["EARNINGS", "Hrs", "Amount", "DEDUCTIONS", "Hrs/Mins", "Amount"],
    ["Pay this period", p.NoHrs_Worked, parseFloat(p.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2}), "Absences", p.absence_Hrs || "0", parseFloat(p.absence_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Overtime pay", p.OT_Hrs || "0", parseFloat(p.OT_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "Tardiness", `${p.tardiness_Mins || "0"}m`, parseFloat(p.tardiness_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Restday OT", p.restDay_OT_Hrs || "0", parseFloat(p.restDay_OT_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "SSS", "", parseFloat(p.SSS_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Night Differential", p.nightDiff_Hrs || "0", parseFloat(p.nightDiff_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "Philhealth", "", parseFloat(p.Philhealth_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Special Holiday", p.specialHol_Hrs || "0", parseFloat(p.specialHol_Amnt || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "HDMF", "", parseFloat(p.HDMF_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Incentives", "", parseFloat(p.incentives || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "Tax", "", parseFloat(p.Tax_Ded || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Allowance", "", parseFloat(p.allowance || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "SSS Loan", "", parseFloat(p.SSS_Loan || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Bonus", "", parseFloat(p.Bonus || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "HDMF Loan", "", parseFloat(p.HDMF_Loan || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    ["Others", "", parseFloat(p.Other_Earnings || 0).toLocaleString(undefined, {minimumFractionDigits: 2}), "Others", "", parseFloat(p.Other_Deductions || 0).toLocaleString(undefined, {minimumFractionDigits: 2})],
    [{content: "Total Pay", styles: {fontStyle: 'bold'}}, "", {content: parseFloat(p.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2}), styles: {fontStyle: 'bold'}}, {content: "Total deduction", styles: {}}, "", {content: parseFloat(p.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2}), styles: {}}],
    ["", "", "", {content: "Net Pay", styles: {fontStyle: 'bold'}}, "", {content: parseFloat(p.netPay).toLocaleString(undefined, {minimumFractionDigits: 2}), styles: {fontStyle: 'bold'}}]
  ];

  autoTable(doc, {
    startY: 65,
    head: [tableData[0]],
    body: tableData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [42, 23, 78], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      2: { halign: 'right' },
      5: { halign: 'right' }
    }
  });

  // Signature
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.text("RECEIVED BY:", margin, finalY);
  doc.line(margin, finalY + 10, margin + 60, finalY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`${p.user_FirstName} ${p.user_LastName}`, margin, finalY + 15);

  return doc.output("blob");
};

/**
 * Batch exports all payrolls in the list to a ZIP file with optional password
 */
export const exportBatchToZip = async (payrolls, periodLabel = "Payroll", password = null) => {
  if (!payrolls || payrolls.length === 0) return;

  // Format period label for filenames (e.g., "March16-31")
  const first = payrolls[0];
  const [startY, startM, startD] = first.period_Start.split('-').map(Number);
  const [endY, endM, endD] = first.period_End.split('-').map(Number);
  const startObj = new Date(startY, startM - 1, startD);
  const endObj = new Date(endY, endM - 1, endD);
  
  const monthName = startObj.toLocaleString('en-US', { month: 'long' });
  const filenamePeriod = `${monthName}${startD}-${endD}`; // e.g. "March16-31"

  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter, { password });

  try {
    for (const p of payrolls) {
      const pdfBlob = generatePayslipPDF(p);
      const pdfFilename = `${filenamePeriod}_Payslip(${p.user_LastName}).pdf`;
      await zipWriter.add(pdfFilename, new zip.BlobReader(pdfBlob));
    }

    await zipWriter.close();
    const zipBlob = await blobWriter.getData();
    const zipFilename = `${filenamePeriod}_MaChipPayslip.zip`;
    saveAs(zipBlob, zipFilename);
  } catch (error) {
    console.error("ZIP Error:", error);
    throw error;
  }
};
