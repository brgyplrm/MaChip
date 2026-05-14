import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUserId } from "./formatUserId";

export const exportLeaveSummaryPDF = (data, months, year, activeTab, rates) => {
  const doc = new jsPDF("l", "mm", "a4"); // Landscape orientation
  const width = doc.internal.pageSize.getWidth();

  // Title mapping
  const titles = {
    vl: "Vacation Leaves",
    sl: "Sick Leaves",
    ot: "Overtime (Hours)",
    lates: "Tardiness (Minutes)",
    absences: "Absences (Days)"
  };

  const title = titles[activeTab] || "Leave Summary";

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MAC-J INT'L., FORWARDING LTD., CO.", width / 2, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text(`${title} Summary - Year ${year}`, width / 2, 22, { align: "center" });

  // Prepare table headers
  const isTimeSummary = ["ot", "lates", "absences"].includes(activeTab);
  const showRemaining = activeTab === "vl" || activeTab === "sl";
  const showConversion = activeTab === "vl" || activeTab === "sl";

  const headers = ["Employee Name", ...months];
  if (isTimeSummary) {
    headers.push("Total Minutes", "Total Hours");
  } else {
    headers.push("Total");
    if (showRemaining) headers.push("Remaining");
    if (showConversion) headers.push("Conversion");
  }

  // Prepare table data
  const tableData = data.map(row => {
    const monthlyValues = row[activeTab] || [];
    const total = monthlyValues.reduce((a, b) => a + b, 0);
    const remaining = activeTab === "vl" ? row.vlRemaining : row.slRemaining;
    const rate = row.dailyRate;
    
    // Format: Full Name (e.g., John Doe)
    const formattedName = `${row.name}\n${formatUserId(row.user_Id)}`;
    
    const bodyRow = [
      formattedName,
      ...monthlyValues.map(v => v > 0 ? v : "—")
    ];

    if (isTimeSummary) {
      let mins = 0, hrs = 0;
      if (activeTab === "ot") { mins = total * 60; hrs = total; }
      else if (activeTab === "lates") { mins = total; hrs = total / 60; }
      else if (activeTab === "absences") { mins = total * 8 * 60; hrs = total * 8; }
      bodyRow.push(mins, hrs.toFixed(2));
    } else {
      bodyRow.push(total > 0 ? total : "0");
      if (showRemaining) bodyRow.push(remaining);
      if (showConversion) {
        const conversion = (remaining * rate).toLocaleString(undefined, { minimumFractionDigits: 2 });
        bodyRow.push(`P${conversion}`);
      }
    }

    return bodyRow;
  });

  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [42, 23, 78], textColor: 255, fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', minCellWidth: 40 },
      // All month columns center aligned
      ...Object.fromEntries(months.map((_, i) => [i + 1, { halign: 'center' }])),
    },
    // Adjust right-most columns if they exist
    didParseCell: (data) => {
      const isLastCol = data.column.index === headers.length - 1;
      const isSecondToLast = data.column.index === headers.length - 2;

      if (data.section === 'body' && !isTimeSummary) {
        if (showConversion && isLastCol) {
          data.cell.styles.halign = 'right';
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
        if (showRemaining && data.column.index === headers.length - (showConversion ? 2 : 1)) {
          data.cell.styles.halign = 'center';
          data.cell.styles.textColor = [37, 99, 235];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      
      if (data.section === 'body' && isTimeSummary) {
        if (isLastCol || isSecondToLast) {
          data.cell.styles.halign = 'center';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [42, 23, 78];
        }
      }
    }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`${title}_Summary_${year}_${timestamp}.pdf`);
};
