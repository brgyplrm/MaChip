import React, { useRef, useState, useEffect, useCallback } from "react";
import "./UserLogs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { formatUserId } from "../../utils/formatUserId";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";

const UserLogs = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [rawLogs, setRawLogs] = useState([]);
  const [dtrData, setDtrData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("current");

  const formatToYYYYMMDD = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPayrollDates = (referenceDate) => {
    const date = new Date(referenceDate);
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    if (day <= 15) {
      return {
        start: formatToYYYYMMDD(new Date(year, month, 1)),
        end: formatToYYYYMMDD(new Date(year, month, 15)),
        payEnding: `${date.toLocaleString("en-US", { month: "long" }).toUpperCase()} 1-15, ${year}`,
      };
    } else {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        start: formatToYYYYMMDD(new Date(year, month, 16)),
        end: formatToYYYYMMDD(new Date(year, month + 1, 0)),
        payEnding: `${date.toLocaleString("en-US", { month: "long" }).toUpperCase()} 16-${lastDay}, ${year}`,
      };
    }
  };

  const currentPayroll = getPayrollDates(systemToday);
  const [dtrStartDate, setDtrStartDate] = useState(currentPayroll.start);
  const [dtrEndDate, setDtrEndDate] = useState(currentPayroll.end);
  const [payEndingLabel, setPayEndingLabel] = useState(currentPayroll.payEnding);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await fetchWithAuth("/api/system/payroll-periods");
        if (res.ok) {
          const data = await res.json();
          setPayrollPeriods(data);
        }
      } catch (err) {
        console.error("Error fetching periods:", err);
      }
    };
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId === "current") {
      const p = getPayrollDates(systemToday);
      setDtrStartDate(p.start);
      setDtrEndDate(p.end);
      setPayEndingLabel(p.payEnding);
    }
  }, [systemToday.getDate(), systemToday.getMonth(), selectedPeriodId]);

  const handlePeriodChange = (e) => {
    const val = e.target.value;
    setSelectedPeriodId(val);
    if (val === "current") {
      const p = getPayrollDates(systemToday);
      setDtrStartDate(p.start);
      setDtrEndDate(p.end);
      setPayEndingLabel(p.payEnding);
    } else {
      const period = payrollPeriods.find((p) => p.periodId.toString() === val);
      if (period) {
        setDtrStartDate(period.startDate);
        setDtrEndDate(period.endDate);
        setPayEndingLabel(period.label);
      }
    }
  };

  // ── PDF via print iframe ─────────────────────────────────────────────────
  const handleDownloadDTR = () => {
    const totalHrs = dtrData
      .reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0)
      .toFixed(2);

    const empName = `${userData?.user_FirstName} ${userData?.user_LastName}`;
    const empId = formatUserId(userData?.user_Id);

    // Build day rows
    const start = new Date(dtrStartDate + "T00:00:00");
    const end = new Date(dtrEndDate + "T00:00:00");
    let dayRowsHTML = "";

    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dayNum = cur.getDate();
      const isSunday = cur.getDay() === 0;
      const dateStr = formatToYYYYMMDD(new Date(cur));

      const log = dtrData.find((d) => d.log_Date.split("T")[0] === dateStr);

      const cell = (val) =>
        `<td>${!isSunday && log && val && val !== "—" ? val : ""}</td>`;

      const dailyTotal = !isSunday && log ? log.hoursWorked || "" : "";

      dayRowsHTML += `
        <tr class="${isSunday ? "weekend" : ""}">
          <td class="dayCol">${dayNum}</td>
          ${cell(log?.morning_In)}
          ${cell(log?.morning_Out)}
          ${cell(log?.afternoon_In)}
          ${cell(log?.afternoon_Out)}
          ${cell(log?.ot_In)}
          ${cell(log?.ot_Out)}
          <td class="totalCol">${dailyTotal}</td>
        </tr>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>DTR - ${empName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    padding: 15mm;
    display: flex;
    flex-direction: column;
    min-height: 267mm;
  }

  /* ── Top header card ── */
  .cardTopHeader {
    border: 2px solid #333;
    margin-bottom: 0;
  }
  .headerLine {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #555;
    padding: 8px 12px;
    gap: 16px;
  }
  .headerLine:last-of-type { border-bottom: none; }
  .field {
    display: flex;
    gap: 6px;
    flex: 1;
    font-size: 11px;
    color: #555;
  }
  .field span {
    font-weight: bold;
    color: #111;
    border-bottom: 1px solid #999;
    flex: 1;
    padding-bottom: 1px;
  }

  /* ── Summary table ── */
  .summaryTable {
    width: 100%;
    border-collapse: collapse;
    border-top: 1px solid #333;
    font-size: 10.5px;
  }
  .summaryTable th,
  .summaryTable td {
    border: 1px solid #888;
    padding: 3px 6px;
    text-align: center;
  }
  .summaryTable .label { text-align: left; font-weight: normal; color: #555; }
  .summaryTable .empty { min-width: 60px; }
  .summaryTable .finalRow td { font-weight: bold; font-size: 11px; }

  /* ── DEDUCTIONS vertical header — letter stacking, zero CSS transforms ── */
  .deductionsTh {
    width: 18px;
    padding: 2px 0;
    border: 1px solid #888;
    background: #f0f0f0;
    text-align: center;
    vertical-align: middle;
    font-size: 8.5px;
    font-weight: bold;
    letter-spacing: 1px;
    line-height: 1.3;
  }

  /* ── Main grid ── */
  .mainAttendanceGrid {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #333;
    border-top: none;
    font-size: 11px;
    flex: 1;
  }
  .mainAttendanceGrid th,
  .mainAttendanceGrid td {
    border: 1px solid #aaa;
    padding: 7px 4px;
    text-align: center;
    min-width: 46px;
  }
  .mainAttendanceGrid thead th {
    background: #f5f5f5;
    font-size: 10px;
    font-weight: bold;
    padding: 10px 4px;
  }
  .mainAttendanceGrid .dayCol   { font-weight: bold; width: 30px; background: #fafafa; }
  .mainAttendanceGrid .totalCol { font-weight: bold; background: #fafafa; }
  .mainAttendanceGrid .weekend  { background: #f8f4f0; color: #bbb; }

  /* ── Footer ── */
  .cardFooter {
    border: 2px solid #333;
    border-top: none;
    padding: 20px 12px 30px;
  }
  .certification { font-size: 10px; color: #555; margin-bottom: 25px; }
  .signatureLine {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    margin: 0 auto;
  }
  .signatureLine .line {
    border-bottom: 1px solid #333;
    width: 100%;
    height: 24px;
  }
  .signatureLine span {
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #555;
  }

  /* ── Title ── */
  .dtrTitle {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
    color: #1a1a1a;
  }
  .dtrSubtitle {
    text-align: center;
    font-size: 10px;
    color: #666;
    margin-bottom: 14px;
  }

  @media print {
    html, body { 
      margin: 0; 
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    body { 
      padding: 10mm; 
    }
    @page { 
      size: A4 portrait; 
      margin: 0; 
    }
    .cardFooter {
      break-inside: avoid;
    }
  }
</style>
</head>
<body>
  <div class="dtrTitle">Daily Time Record</div>
  <div class="dtrSubtitle">MAC-J Int'l Forwarding Ltd., Co.</div>

  <div class="cardTopHeader">
    <div class="headerLine">
      <div class="field">No. <span>${empId}</span></div>
      <div class="field">Pay Ending <span>${payEndingLabel}</span></div>
    </div>
    <div class="headerLine">
      <div class="field">Name <span>${empName}</span></div>
      <div class="field">Position <span>Employee</span></div>
    </div>

    <table class="summaryTable">
      <thead>
        <tr>
          <th colspan="2">Hours</th>
          <th>Rate</th>
          <th>Amount</th>
          <th class="deductionsTh" rowspan="4">D<br/>E<br/>D<br/>U<br/>C<br/>T<br/>I<br/>O<br/>N<br/>S</th>
          <th colspan="2">ABSENCES</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="label">Reg.</td>
          <td class="empty"></td>
          <td class="empty"></td>
          <td class="empty"></td>
          <td class="label">Fines</td>
          <td class="empty"></td>
        </tr>
        <tr>
          <td class="label">Total Hrs</td>
          <td class="empty" colspan="3">${totalHrs} hrs</td>
          <td class="label">Tax</td>
          <td class="empty"></td>
        </tr>
        <tr class="finalRow">
          <td class="label" colspan="3">NET PAY</td>
          <td class="empty">TBD</td>
          <td class="label">TOTAL</td>
          <td class="empty"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <table class="mainAttendanceGrid">
    <thead>
      <tr>
        <th rowspan="2">Days</th>
        <th colspan="2">MORNING</th>
        <th colspan="2">AFTERNOON</th>
        <th colspan="2">OVERTIME</th>
        <th rowspan="2">Daily<br/>Total</th>
      </tr>
      <tr>
        <th>IN</th><th>OUT</th>
        <th>IN</th><th>OUT</th>
        <th>IN</th><th>OUT</th>
      </tr>
    </thead>
    <tbody>
      ${dayRowsHTML}
    </tbody>
  </table>

  <div class="cardFooter">
    <p class="certification">I hereby certify that the above records are true and correct.</p>
    <div class="signatureLine">
      <div class="line"></div>
      <span>Employee's Signature</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      // Close the tab after print dialog (optional)
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

    // Open in a new tab and trigger print-to-PDF
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setToast({ message: "Popup blocked — please allow popups for this site.", type: "error" });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };
  // ────────────────────────────────────────────────────────────────────────

  const fetchRawLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/attendance/logs/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter((log) => {
          const logDate = log.log_Date.split("T")[0];
          return logDate >= dtrStartDate && logDate <= dtrEndDate;
        });
        setRawLogs(filtered);
      }
    } catch (error) {
      console.error("Error fetching raw logs:", error);
    }
  };

  const fetchDTR = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        `/api/attendance/report?startDate=${dtrStartDate}&endDate=${dtrEndDate}&user_Id=${userData.user_Id}`
      );
      if (response.ok) {
        const data = await response.json();
        setDtrData(data);
      }
    } catch (error) {
      console.error("Error fetching DTR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRawLogs();
    fetchDTR();
  }, [userData?.user_Id, dtrStartDate, dtrEndDate]);

  const getDtrLogsForDay = (dayNum) => {
    const targetDate = new Date(dtrStartDate + "T00:00:00");
    targetDate.setDate(dayNum);
    const dateStr = formatToYYYYMMDD(targetDate);
    return dtrData.find((d) => {
      const dDate = d.log_Date.split("T")[0];
      return dDate === dateStr;
    });
  };

  return (
    <div className="logsListPage">
      <Sidebar />
      <div className="logsListContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="title">
              <h1>Access Logs & DTR</h1>
              <div className="periodFilter">
                <label>View Period:</label>
                <select value={selectedPeriodId} onChange={handlePeriodChange}>
                  <option value="current">Current Period</option>
                  {payrollPeriods.map((p) => (
                    <option key={p.periodId} value={p.periodId}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="exportBtn" onClick={handleDownloadDTR}>
              Export DTR (PDF)
            </button>
          </div>

          {toast.message && (
            <div className={`toast ${toast.type}`}>
              {toast.message}
              <button onClick={() => setToast({ message: "" })}>×</button>
            </div>
          )}

          <div className="splitLayout">
            {/* Left: Raw Logs Table */}
            <div className="tableWrapper">
              <div className="cardHeader">
                <h3>Attendance History</h3>
              </div>
              <table className="logsTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    {
                      length:
                        Math.round(
                          (new Date(dtrEndDate) - new Date(dtrStartDate)) /
                            (1000 * 60 * 60 * 24)
                        ) + 1,
                    },
                    (_, i) => {
                      const targetDate = new Date(dtrStartDate + "T00:00:00");
                      targetDate.setDate(targetDate.getDate() + i);
                      const dateStr = formatToYYYYMMDD(targetDate);
                      const todayStr = formatToYYYYMMDD(systemToday);

                      const log = rawLogs.find(
                        (l) => l.log_Date.split("T")[0] === dateStr
                      );

                      let displayStatus = log ? log.attendanceStatus : "—";
                      if (!log) {
                        if (dateStr > todayStr) displayStatus = "Upcoming";
                        else {
                          const dow = targetDate.getDay();
                          displayStatus = dow === 0 ? "Sunday" : "No Record";
                        }
                      }

                      return (
                        <tr
                          key={dateStr}
                          className={dateStr === todayStr ? "currentDayRow" : ""}
                        >
                          <td className="dateCell">
                            {targetDate.toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="timeCell">{log?.time_In || "—"}</td>
                          <td className="timeCell">{log?.time_Out || "—"}</td>
                          <td>
                            <span
                              className={`actionTag ${(displayStatus || "")
                                .toLowerCase()
                                .replace(" ", "")}`}
                            >
                              {displayStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: DTR Preview */}
            <div className="dtrSection">
              <div className="dtrHeader">
                <h2 className="cardTitle">Daily Time Record</h2>
              </div>

              <div className="timeCardContainer">
                <div className="cardTopHeader">
                  <div className="headerLine">
                    <div className="field">
                      No. <span>{formatUserId(userData?.user_Id)}</span>
                    </div>
                    <div className="field">
                      Pay Ending <span>{payEndingLabel}</span>
                    </div>
                  </div>
                  <div className="headerLine">
                    <div className="field">
                      Name{" "}
                      <span>
                        {userData?.user_FirstName} {userData?.user_LastName}
                      </span>
                    </div>
                    <div className="field">
                      Position <span>Employee</span>
                    </div>
                  </div>

                  <table className="summaryTable">
                    <thead>
                      <tr>
                        <th colSpan="2">Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th className="verticalTh" rowSpan="4">
                          DEDUCTIONS
                        </th>
                        <th colSpan="2">ABSENCES</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label">Reg.</td>
                        <td className="empty"></td>
                        <td className="empty"></td>
                        <td className="empty"></td>
                        <td className="label">Fines</td>
                        <td className="empty"></td>
                      </tr>
                      <tr>
                        <td className="label">Total Hrs</td>
                        <td className="empty" colSpan="3">
                          {dtrData
                            .reduce(
                              (sum, d) => sum + parseFloat(d.hoursWorked || 0),
                              0
                            )
                            .toFixed(2)}{" "}
                          hrs
                        </td>
                        <td className="label">Tax</td>
                        <td className="empty"></td>
                      </tr>
                      <tr className="finalRow">
                        <td className="label" colSpan="3">
                          NET PAY
                        </td>
                        <td className="empty">TBD</td>
                        <td className="label">TOTAL</td>
                        <td className="empty"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <table className="mainAttendanceGrid">
                  <thead>
                    <tr>
                      <th rowSpan="2">Days</th>
                      <th colSpan="2">MORNING</th>
                      <th colSpan="2">AFTERNOON</th>
                      <th colSpan="2">OVERTIME</th>
                      <th rowSpan="2">Daily Total</th>
                    </tr>
                    <tr>
                      <th>IN</th>
                      <th>OUT</th>
                      <th>IN</th>
                      <th>OUT</th>
                      <th>IN</th>
                      <th>OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      {
                        length:
                          Math.round(
                            (new Date(dtrEndDate) - new Date(dtrStartDate)) /
                              (1000 * 60 * 60 * 24)
                          ) + 1,
                      },
                      (_, i) => {
                        const targetDate = new Date(dtrStartDate + "T00:00:00");
                        targetDate.setDate(targetDate.getDate() + i);
                        const dayNum = targetDate.getDate();
                        const isSunday = targetDate.getDay() === 0;

                        const log = getDtrLogsForDay(dayNum);

                        let morningIn = "",
                          morningOut = "",
                          afternoonIn = "",
                          afternoonOut = "",
                          otIn = "",
                          otOut = "";

                        if (!isSunday && log) {
                          morningIn = log.morning_In !== "—" ? log.morning_In : "";
                          morningOut = log.morning_Out !== "—" ? log.morning_Out : "";
                          afternoonIn = log.afternoon_In !== "—" ? log.afternoon_In : "";
                          afternoonOut = log.afternoon_Out !== "—" ? log.afternoon_Out : "";
                          otIn = log.ot_In !== "—" ? log.ot_In : "";
                          otOut = log.ot_Out !== "—" ? log.ot_Out : "";
                        }

                        return (
                          <tr
                            key={dayNum}
                            className={isSunday ? "weekend" : ""}
                          >
                            <td className="dayCol">{dayNum}</td>
                            <td>{morningIn}</td>
                            <td>{morningOut}</td>
                            <td>{afternoonIn}</td>
                            <td>{afternoonOut}</td>
                            <td>{otIn}</td>
                            <td>{otOut}</td>
                            <td className="totalCol">
                              {!isSunday && log ? log.hoursWorked : ""}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                <div className="cardFooter">
                  <p className="certification">
                    I hereby certify that the above records are true and correct.
                  </p>
                  <div className="signatureLine">
                    <div className="line"></div>
                    <span>EMPLOYEE'S SIGNATURE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogs;