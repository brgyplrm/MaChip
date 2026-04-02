import React, { useRef, useState, useEffect, useCallback } from "react";
import "./UserLogs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import HistoryIcon from '@mui/icons-material/History';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { formatUserId } from "../../utils/formatUserId";
import { useSystemTime } from "../../context/SystemTimeContext";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const UserLogs = () => {
  const dtrRef = useRef();
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [rawLogs, setRawLogs] = useState([]);
  const [dtrData, setDtrData] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatToYYYYMMDD = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
        payEnding: `${date.toLocaleString('en-US', { month: 'long' }).toUpperCase()} 1-15, ${year}`
      };
    } else {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        start: formatToYYYYMMDD(new Date(year, month, 16)),
        end: formatToYYYYMMDD(new Date(year, month + 1, 0)),
        payEnding: `${date.toLocaleString('en-US', { month: 'long' }).toUpperCase()} 16-${lastDay}, ${year}`
      };
    }
  };

  const payroll = getPayrollDates(systemToday);
  const [dtrStartDate, setDtrStartDate] = useState(payroll.start);
  const [dtrEndDate, setDtrEndDate] = useState(payroll.end);

  // Sync state if systemToday changes significantly
  useEffect(() => {
    const p = getPayrollDates(systemToday);
    setDtrStartDate(p.start);
    setDtrEndDate(p.end);
  }, [systemToday.getDate(), systemToday.getMonth()]);

  const handleDownloadDTR = async () => {
    const element = dtrRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#fdfaf5" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DTR_${userData?.user_LastName}_${dtrStartDate}.pdf`);
    } catch (error) {
      setToast({ message: "Failed to generate PDF", type: "error" });
    }
  };

  // Fetch Raw Logs (for the table)
  const fetchRawLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetch(`/api/attendance/logs/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        // Filter logs for current period using split to ignore time/timezone
        const filtered = data.filter(log => {
          const logDate = log.log_Date.split('T')[0];
          return logDate >= dtrStartDate && logDate <= dtrEndDate;
        });
        setRawLogs(filtered);
      }
    } catch (error) { console.error("Error fetching raw logs:", error); }
  };

  // Fetch DTR Summarized Data
  const fetchDTR = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/attendance/report?startDate=${dtrStartDate}&endDate=${dtrEndDate}&user_Id=${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setDtrData(data);
      }
    } catch (error) { console.error("Error fetching DTR:", error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRawLogs();
    fetchDTR();
  }, [userData?.user_Id, dtrStartDate, dtrEndDate]);

  const getDtrLogsForDay = (dayNum) => {
    const targetDate = new Date(dtrStartDate);
    targetDate.setDate(dayNum);
    const dateStr = formatToYYYYMMDD(targetDate);
    return dtrData.find(d => {
      const dDate = d.log_Date.split('T')[0];
      return dDate === dateStr;
    });
  };

  const formatTime = (time) => {
    if (!time || time === "—") return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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
              <span className="subtitle">Period: {payroll.payEnding}</span>
            </div>
            <button className="exportBtn" onClick={handleDownloadDTR}>Export DTR (PDF)</button>
          </div>

        <div className="splitLayout">
          {/* Left Side: Raw Logs Table */}
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
                {Array.from({ length: (new Date(dtrEndDate).getDate() - new Date(dtrStartDate).getDate() + 1) }, (_, i) => {
                  const dayNum = new Date(dtrStartDate).getDate() + i;
                  const targetDate = new Date(dtrStartDate);
                  targetDate.setDate(dayNum);
                  const dateStr = formatToYYYYMMDD(targetDate);
                  const todayStr = formatToYYYYMMDD(systemToday);
                  
                  // Find existing log for this date (split ensures we only compare date part)
                  const log = rawLogs.find(l => l.log_Date.split('T')[0] === dateStr);
                  
                  // Determine status for days without logs
                  let displayStatus = log ? log.attendanceStatus : "—";
                  if (!log) {
                    if (dateStr > todayStr) displayStatus = "Upcoming";
                    else {
                      const dayOfWeek = targetDate.getDay();
                      displayStatus = (dayOfWeek === 0) ? "Sunday" : "No Record";
                    }
                  }

                  return (
                    <tr key={dateStr} className={dateStr === todayStr ? "currentDayRow" : ""}>
                      <td className="dateCell">
                        {targetDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="timeCell">{log?.time_In || "—"}</td>
                      <td className="timeCell">{log?.time_Out || "—"}</td>
                      <td>
                        <span className={`actionTag ${(displayStatus || "").toLowerCase().replace(" ","")}`}>
                          {displayStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right Side: DTR Section */}
          <div className="dtrSection">
            <div className="dtrHeader">
              <h2 className="cardTitle">Daily Time Record</h2>
            </div>

            <div className="timeCardContainer" ref={dtrRef}>
              <div className="cardTopHeader">
                <div className="headerLine">
                  <div className="field">No. <span>{formatUserId(userData?.user_Id)}</span></div>
                  <div className="field">Pay Ending <span>{payroll.payEnding}</span></div>
                </div>
                <div className="headerLine">
                  <div className="field">Name <span>{userData?.user_FirstName} {userData?.user_LastName}</span></div>
                  <div className="field">Position <span>Employee</span></div>
                </div>

                  <table className="summaryTable">
                    <thead>
                      <tr>
                        <th colSpan="2">Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th className="verticalTh" rowSpan="6">DEDUCTIONS</th>
                        <th colSpan="2">ABSENCES</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label">Reg.</td><td className="empty"></td><td className="empty"></td><td className="empty"></td><td className="label">Fines</td><td className="empty"></td>
                      </tr>
                      <tr>
                        <td className="label">Total Hrs</td><td className="empty" colSpan="3">{dtrData.reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0).toFixed(2)} hrs</td><td className="label">Tax</td><td className="empty"></td>
                      </tr>
                      <tr className="finalRow">
                        <td className="label" colSpan="3">NET PAY</td><td className="empty">TBD</td><td className="label">TOTAL</td><td className="empty"></td>
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
                        <th>IN</th><th>OUT</th><th>IN</th><th>OUT</th><th>IN</th><th>OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: (new Date(dtrEndDate).getDate() - new Date(dtrStartDate).getDate() + 1) }, (_, i) => {
                        const dayNum = new Date(dtrStartDate).getDate() + i;
                        const log = getDtrLogsForDay(dayNum);

                        let morningIn = "", morningOut = "12:00", afternoonIn = "13:00", afternoonOut = "";

                        if (log && log.time_In !== "—") {
                          const hour = parseInt(log.time_In.split(":")[0]);
                          if (hour < 12) morningIn = log.time_In;
                          else afternoonIn = log.time_In;
                        }

                        if (log && log.time_Out !== "—") {
                          const hour = parseInt(log.time_Out.split(":")[0]);
                          if (hour < 13) morningOut = log.time_Out;
                          else afternoonOut = log.time_Out;
                        }

                        const isWeekend = new Date(new Date(dtrStartDate).getFullYear(), new Date(dtrStartDate).getMonth(), dayNum).getDay() === 0;

                        return (
                          <tr key={dayNum} className={isWeekend ? "weekend" : ""}>
                            <td className="dayCol">{dayNum}</td>
                            <td>{morningIn}</td>
                            <td>{log ? morningOut : ""}</td>
                            <td>{log ? afternoonIn : ""}</td>
                            <td>{afternoonOut}</td>
                            <td></td>
                            <td></td>
                            <td className="totalCol">{log ? log.hoursWorked : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="cardFooter">
                    <p className="certification">I hereby certify that the above records are true and correct.</p>
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