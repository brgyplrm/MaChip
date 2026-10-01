import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import Toast from "../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";

const UserLogs = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));

  const formatCurrency = (val) =>
    `₱${parseFloat(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const cleanTime = (time, isSystem) => {
    if (!time || time === "—" || time === "00:00") return "";
    return time;
  };

  const isPMPunch = (timeStr) => {
    if (!timeStr || timeStr === "—" || timeStr === "00:00") return false;
    const parts = String(timeStr).substring(0, 5).split(":");
    if (parts.length < 2) return false;
    const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    return mins >= 720;
  };

  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Data States
  const [dailyLogs, setDailyLogs] = useState([]); // For left-side period table
  const [dtrData, setDtrData] = useState([]);     // For right-side DTR document
  const [rawScans, setRawScans] = useState([]);   // For new Raw Logs tab
  const [loading, setLoading] = useState(true);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Tab & Filter States
  const [selectedYear, setSelectedYear] = useState(() => systemToday.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => systemToday.getMonth().toString());
  const [selectedPeriodId, setSelectedPeriodId] = useState("current");
  const [activeTab, setActiveTab] = useState("dtr");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Pagination States for Raw Logs
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
  const [dtrSummary, setDtrSummary] = useState(null);

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

  // Compute available years from existing periods + system current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    yearsSet.add(systemToday.getFullYear().toString());

    payrollPeriods.forEach((p) => {
      if (p.startDate) {
        const y = new Date(p.startDate).getFullYear().toString();
        if (y && !isNaN(Number(y))) {
          yearsSet.add(y);
        }
      }
    });

    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [payrollPeriods, systemToday]);

  // Compute uncluttered periods filtered by selected Year and Month
  const availablePeriods = useMemo(() => {
    const dbPeriods = payrollPeriods.filter((p) => {
      if (!p.startDate) return false;
      const pDate = new Date(p.startDate);
      const pYear = pDate.getFullYear().toString();
      const pMonth = pDate.getMonth().toString();

      const matchesYear = selectedYear === "all" || pYear === selectedYear;
      const matchesMonth = selectedMonth === "all" || pMonth === selectedMonth;

      return matchesYear && matchesMonth;
    });

    if (dbPeriods.length > 0 || selectedMonth === "all" || selectedYear === "all") {
      return dbPeriods;
    }

    // Fallback: Generate standard Philippine cutoffs if no DB entry exists yet for the picked month
    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    if (isNaN(y) || isNaN(m)) return [];

    const monthDate = new Date(y, m, 1);
    const monthName = monthDate.toLocaleString("en-US", { month: "long" });
    const lastDay = new Date(y, m + 1, 0).getDate();

    const pad = (n) => String(n).padStart(2, "0");
    const p1 = {
      periodId: `std_${y}_${m}_1`,
      startDate: `${y}-${pad(m + 1)}-01`,
      endDate: `${y}-${pad(m + 1)}-15`,
      label: `${monthName} 1-15, ${y}`,
    };
    const p2 = {
      periodId: `std_${y}_${m}_2`,
      startDate: `${y}-${pad(m + 1)}-16`,
      endDate: `${y}-${pad(m + 1)}-${lastDay}`,
      label: `${monthName} 16-${lastDay}, ${y}`,
    };

    return [p1, p2];
  }, [payrollPeriods, selectedYear, selectedMonth]);

  const isCurrentMonthView = 
    selectedYear === systemToday.getFullYear().toString() && 
    (selectedMonth === "all" || selectedMonth === systemToday.getMonth().toString());

  const handlePeriodChange = (val) => {
    setSelectedPeriodId(val);
    if (val === "current") {
      const p = getPayrollDates(systemToday);
      setDtrStartDate(p.start);
      setDtrEndDate(p.end);
      setPayEndingLabel(p.payEnding);
    } else {
      const period = availablePeriods.find((p) => p.periodId.toString() === val) ||
                     payrollPeriods.find((p) => p.periodId.toString() === val);
      if (period) {
        setDtrStartDate(period.startDate);
        setDtrEndDate(period.endDate);
        setPayEndingLabel(period.label);
      }
    }
  };

  const handleResetToCurrent = () => {
    setSelectedYear(systemToday.getFullYear().toString());
    setSelectedMonth(systemToday.getMonth().toString());
    handlePeriodChange("current");
  };

  // Sync selected cutoff when year or month changes so it doesn't get stuck on invalid period
  useEffect(() => {
    if (isCurrentMonthView && selectedPeriodId === "current") {
      return;
    }

    const exists = availablePeriods.some((p) => p.periodId.toString() === selectedPeriodId);
    if (!exists) {
      if (isCurrentMonthView) {
        handlePeriodChange("current");
      } else if (availablePeriods.length > 0) {
        handlePeriodChange(availablePeriods[0].periodId.toString());
      }
    }
  }, [selectedYear, selectedMonth, availablePeriods, isCurrentMonthView]);

  useEffect(() => {
    if (selectedPeriodId === "current") {
      const p = getPayrollDates(systemToday);
      setDtrStartDate(p.start);
      setDtrEndDate(p.end);
      setPayEndingLabel(p.payEnding);
    }
  }, [systemToday.getDate(), systemToday.getMonth(), selectedPeriodId]);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchDailyLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/attendance/logs/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter((log) => {
          const logDate = String(log.log_Date).split("T")[0];
          return logDate >= dtrStartDate && logDate <= dtrEndDate;
        });
        setDailyLogs(filtered);
      }
    } catch (error) {
      console.error("Error fetching daily logs:", error);
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
        if (data.logs) {
          setDtrData(data.logs);
          setDtrSummary(data.summary);
        } else {
          setDtrData(data);
          setDtrSummary(null);
        }
      }
    } catch (error) {
      console.error("Error fetching DTR:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRawScans = async () => {
    if (!userData?.user_Id || !dtrStartDate || !dtrEndDate) return;
    try {
      // Use backend filtering for the selected period
      const response = await fetchWithAuth(`/api/attendance/all?startDate=${dtrStartDate}&endDate=${dtrEndDate}`);
      if (response.ok) {
        const data = await response.json();
        // Still filter for the specific user as /all returns everything
        const userScans = data.filter(log => String(log.user_Id ?? log.user_id) === String(userData.user_Id));
        setRawScans(userScans);
      }
    } catch (error) {
      console.error("Error fetching raw scans:", error);
    }
  };

  useEffect(() => {
    fetchDailyLogs();
    fetchDTR();
    // Also fetch raw scans if we are on that tab so it updates when period changes
    if (activeTab === "raw_logs") {
      fetchRawScans();
    }
  }, [userData?.user_Id, dtrStartDate, dtrEndDate, activeTab]);

  // Real-time update listener for new RFID/biometric scans
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchDailyLogs();
      fetchDTR();
      fetchRawScans();
    };
    window.addEventListener("dataRefresh", handleDataRefresh);
    return () => {
      window.removeEventListener("dataRefresh", handleDataRefresh);
    };
  }, [userData?.user_Id, dtrStartDate, dtrEndDate]);

  useEffect(() => {
    if (activeTab === "raw_logs") {
      fetchRawScans();
    }
  }, [activeTab]);

  const getDtrLogsForDay = (dayNum, dateStrParam = null) => {
    if (dateStrParam) {
      return dtrData.find((d) => d.log_Date.split("T")[0] === dateStrParam);
    }
    const targetDate = new Date(dtrStartDate + "T00:00:00");
    targetDate.setDate(dayNum);
    const dateStr = formatToYYYYMMDD(targetDate);
    return dtrData.find((d) => d.log_Date.split("T")[0] === dateStr);
  };

  // ── PDF via print iframe ─────────────────────────────────────────────────
  const handleDownloadDTR = () => {
    const totalHrs = dtrData
      .reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0)
      .toFixed(2);

    const empName = `${userData?.user_FirstName} ${userData?.user_LastName}`;
    const empId = formatUserId(userData?.user_Id);

    const start = new Date(dtrStartDate + "T00:00:00");
    const end = new Date(dtrEndDate + "T00:00:00");
    let dayRowsHTML = "";

    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dayNum = cur.getDate();
      const isSunday = cur.getDay() === 0;
      const dateStr = formatToYYYYMMDD(new Date(cur));

      const log = dtrData.find((d) => d.log_Date.split("T")[0] === dateStr);
      const cell = (val) => `<td>${!isSunday && log && val && val !== "—" ? val : ""}</td>`;
      const dailyTotal = !isSunday && log ? log.hoursWorked || "" : "";

      const isIrregularDay = log?.status === "Irregular" || 
                             log?.attendanceStatus === "Irregular" || 
                             Number(log?.attendance_StatusId) === 8 || 
                             Number(log?.attendanceStatusId) === 8 ||
                             Number(log?.attendance_StatusId) === 7;

      const morningInVal = isIrregularDay
        ? ""
        : ((log?.morning_In && log?.morning_In !== "—")
            ? log.morning_In
            : (log?.time_In && log?.time_In !== "—" ? log.time_In : (log?.inArr && log.inArr.length > 0 ? log.inArr[0] : "")));

      const candidateOut = isIrregularDay
        ? ""
        : ((log?.afternoon_Out && log?.afternoon_Out !== "—")
            ? log.afternoon_Out
            : (log?.time_Out && log?.time_Out !== "—" && log.time_Out !== morningInVal && log.time_Out !== log?.morning_Out
              ? log.time_Out
              : (log?.outArr && log.outArr.length > 0 ? log.outArr[log.outArr.length - 1] : "")));

      const afternoonOutVal = (candidateOut && isPMPunch(candidateOut) && candidateOut !== morningInVal && candidateOut !== log?.morning_Out)
        ? candidateOut
        : "";

      dayRowsHTML += `
        <tr class="${isSunday ? "weekend" : ""}">
          <td class="dayCol">${dayNum}</td>
          ${cell(morningInVal)}
          ${cell(log?.morning_Out)}
          ${cell(log?.afternoon_In)}
          ${cell(afternoonOutVal)}
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
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 15mm; display: flex; flex-direction: column; min-height: 267mm; }
  .cardTopHeader { border: 2px solid #333; margin-bottom: 0; }
  .headerLine { display: flex; justify-content: space-between; border-bottom: 1px solid #555; padding: 8px 12px; gap: 16px; }
  .headerLine:last-of-type { border-bottom: none; }
  .field { display: flex; gap: 6px; flex: 1; font-size: 11px; color: #555; }
  .field span { font-weight: bold; color: #111; border-bottom: 1px solid #999; flex: 1; padding-bottom: 1px; }
  .summaryTable { width: 100%; border-collapse: collapse; border-top: 1px solid #333; font-size: 10.5px; }
  .summaryTable th, .summaryTable td { border: 1px solid #888; padding: 3px 6px; text-align: center; }
  .summaryTable .label { text-align: left; font-weight: normal; color: #555; }
  .summaryTable .empty { min-width: 60px; }
  .summaryTable .finalRow td { font-weight: bold; font-size: 11px; }
  .deductionsTh { width: 18px; padding: 2px 0; border: 1px solid #888; background: #f0f0f0; text-align: center; vertical-align: middle; font-size: 8.5px; font-weight: bold; letter-spacing: 1px; line-height: 1.3; }
  .mainAttendanceGrid { width: 100%; border-collapse: collapse; border: 2px solid #333; border-top: none; font-size: 11px; flex: 1; }
  .mainAttendanceGrid th, .mainAttendanceGrid td { border: 1px solid #aaa; padding: 7px 4px; text-align: center; min-width: 46px; }
  .mainAttendanceGrid thead th { background: #f5f5f5; font-size: 10px; font-weight: bold; padding: 10px 4px; }
  .mainAttendanceGrid .dayCol { font-weight: bold; width: 30px; background: #fafafa; }
  .mainAttendanceGrid .totalCol { font-weight: bold; background: #fafafa; }
  .mainAttendanceGrid .weekend { background: #f8f4f0; color: #bbb; }
  .cardFooter { border: 2px solid #333; border-top: none; padding: 20px 12px 30px; }
  .certification { font-size: 10px; color: #555; margin-bottom: 25px; }
  .signatureLine { display: flex; flex-direction: column; align-items: center; gap: 4px; max-width: 220px; margin: 0 auto; }
  .signatureLine .line { border-bottom: 1px solid #333; width: 100%; height: 24px; }
  .signatureLine span { font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: #555; }
  .dtrTitle { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; color: #1a1a1a; }
  .dtrSubtitle { text-align: center; font-size: 10px; color: #666; margin-bottom: 14px; }
  @media print { html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; } body { padding: 10mm; } @page { size: A4 portrait; margin: 0; } .cardFooter { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="dtrTitle">Daily Time Record</div>
  <div class="dtrSubtitle">MAC-J Int'l Forwarding Ltd., Co.</div>
  <div class="cardTopHeader">
    <div class="headerLine"><div class="field">No. <span>${empId}</span></div><div class="field">Pay Ending <span>${payEndingLabel}</span></div></div>
    <div class="headerLine"><div class="field">Name <span>${empName}</span></div><div class="field">Position <span>Employee</span></div></div>
    <table class="summaryTable">
      <thead><tr><th colspan="2">Hours</th><th>Rate</th><th>Amount</th><th class="deductionsTh" rowspan="4">D<br/>E<br/>D<br/>U<br/>C<br/>T<br/>I<br/>O<br/>N<br/>S</th><th colspan="2">ABSENCES</th></tr></thead>
      <tbody>
        <tr><td class="label">Reg.</td><td class="empty"></td><td class="empty"></td><td class="empty"></td><td class="label">Fines</td><td class="empty"></td></tr>
        <tr><td class="label">Total Hrs</td><td class="empty" colspan="3">${totalHrs} hrs</td><td class="label">Tax</td><td class="empty"></td></tr>
        <tr class="finalRow"><td class="label" colspan="3">NET PAY</td><td class="empty">TBD</td><td class="label">TOTAL</td><td class="empty"></td></tr>
      </tbody>
    </table>
  </div>
  <table class="mainAttendanceGrid">
    <thead>
      <tr><th rowspan="2">Days</th><th colspan="2">MORNING</th><th colspan="2">AFTERNOON</th><th colspan="2">OVERTIME</th><th rowspan="2">Daily<br/>Total</th></tr>
      <tr><th>IN</th><th>OUT</th><th>IN</th><th>OUT</th><th>IN</th><th>OUT</th></tr>
    </thead>
    <tbody>${dayRowsHTML}</tbody>
  </table>
  <div class="cardFooter">
    <p class="certification">I hereby certify that the above records are true and correct.</p>
    <div class="signatureLine"><div class="line"></div><span>Employee's Signature</span></div>
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setToast({ message: "Popup blocked — please allow popups for this site.", type: "error" });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadRawLogs = () => {
    const empName = `${userData?.user_FirstName} ${userData?.user_LastName}`;
    const empId = formatUserId(userData?.user_Id);
    
    let rowsHTML = "";
    filteredScans.forEach((log) => {
      const date = log.log_Date ? new Date(log.log_Date).toLocaleDateString() : "—";
      const time = log.time_Logged ? formatTime12h(log.time_Logged) : "—";
      const type = log.loggedStatusName || "—";
      const action = log.attendanceStatusName || "—";
      
      rowsHTML += `
        <tr>
          <td>${date}</td>
          <td>${time}</td>
          <td>${type}</td>
          <td>${action}</td>
        </tr>`;
    });

    const totalScans = filteredScans.length;
    const inCount = filteredScans.filter(s => (s.loggedStatusName || "").toLowerCase().includes("in")).length;
    const outCount = filteredScans.filter(s => (s.loggedStatusName || "").toLowerCase().includes("out")).length;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Raw Access Logs - ${empName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 20mm; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2A174E; padding-bottom: 10px; }
  .header h1 { font-size: 20px; color: #2A174E; text-transform: uppercase; margin-bottom: 5px; }
  .header p { color: #666; font-size: 10px; }
  .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .info-item { display: flex; flex-direction: column; gap: 4px; }
  .info-label { font-size: 9px; font-bold: true; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
  .stats-row { display: flex; gap: 20px; margin-bottom: 20px; }
  .stat-card { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
  .stat-card.blue { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
  .stat-card.green { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  .stat-card.amber { background: #fffbeb; border-color: #fef3c7; color: #92400e; }
  .stat-title { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
  .stat-value { font-size: 18px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  thead th { background-color: #2A174E; color: white; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
  tbody tr:nth-child(even) { background-color: #f8fafc; }
  .footer { margin-top: 40px; font-style: italic; font-size: 9px; text-align: center; color: #94a3b8; }
</style>
</head>
<body>
  <div class="header">
    <h1>Raw Access Logs Report</h1>
    <p>MAC-J Int'l Forwarding Ltd., Co. • System Generated Document</p>
  </div>
  <div class="info-grid">
    <div class="info-item">
      <span class="info-label">Employee Name</span>
      <span class="info-value">${empName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Employee ID</span>
      <span class="info-value">${empId}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Payroll Period</span>
      <span class="info-value">${payEndingLabel}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Generated Date</span>
      <span class="info-value">${new Date().toLocaleString()}</span>
    </div>
  </div>
  <div class="stats-row">
    <div class="stat-card blue">
      <p class="stat-title">Total Scans</p>
      <p class="stat-value">${totalScans}</p>
    </div>
    <div class="stat-card green">
      <p class="stat-title">Clock-In Count</p>
      <p class="stat-value">${inCount}</p>
    </div>
    <div class="stat-card amber">
      <p class="stat-title">Clock-Out Count</p>
      <p class="stat-value">${outCount}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time Scanned</th>
        <th>Scan Type</th>
        <th>System Action</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <div class="footer">
    This report contains raw data captured directly from biometric/RFID hardware sensors. 
    Final attendance calculations may differ based on shift rules and administrative adjustments.
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setToast({ message: "Popup blocked — please allow popups for this site.", type: "error" });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Helper for Status Badges ─────────────────────────────────────────────
  const getBadgeStyle = (status) => {
    const s = (status || "").toLowerCase().replace(/[- ]/g, "");
    if (["ontime", "clockin", "in"].includes(s)) return "bg-green-100 text-green-800 hover:bg-green-100";
    if (["late", "clockout", "out"].includes(s)) return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    if (["onfield"].includes(s)) return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    if (s === "absent") return "bg-red-50 text-red-800 border-red-200 hover:bg-red-50";
    if (s === "upcoming") return "bg-white text-slate-400 border-dashed border-slate-300 hover:bg-white";
    if (s === "norecord") return "bg-slate-100 text-slate-500 hover:bg-slate-200";
    if (s === "sunday") return "bg-slate-100 text-slate-500 hover:bg-slate-100";
    return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  };

  const getBadgeTooltip = (status) => {
    const s = (status || "").toLowerCase().replace(/[- ]/g, "");
    if (["ontime", "clockin", "in"].includes(s)) return "On Time: Arrival logged within shift schedule/grace period.";
    if (["late"].includes(s)) return "Late: Arrival logged after the scheduled shift start time.";
    if (["clockout", "out"].includes(s)) return "Clock Out: RFID or biometric exit scan.";
    if (["onfield"].includes(s)) return "On Field: Shift on official travel, delivery, or field assignment.";
    if (s === "absent") return "Absent: No shift logging recorded for this working day.";
    if (s === "upcoming") return "Upcoming: Scheduled date in the future.";
    if (s === "norecord") return "No Record: No check-in or check-out events registered.";
    if (s === "sunday") return "Sunday: Rest day (non-working day).";
    return `Status: ${status}`;
  };

  // ── Filtering & Pagination Logic for Raw Logs Tab ────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || statusFilter !== "All";

  const filteredScans = useMemo(() => {
    return rawScans.filter((log) => {
      const logDate = log.log_Date ? new Date(log.log_Date).toLocaleDateString() : "";
      const logType = log.loggedStatusName || "—";
      const action = log.attendanceStatusName || "—";
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        logDate.toLowerCase().includes(query) || 
        logType.toLowerCase().includes(query) ||
        action.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All" || logType.toLowerCase().includes(statusFilter.toLowerCase());

      return matchesSearch && matchesStatus;
    });
  }, [rawScans, searchQuery, statusFilter]);

  const totalItems = filteredScans.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentScansData = filteredScans.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
            
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">My Attendance & Logs</h1>
                <span className="text-sm text-slate-500 mt-1 block">View your official Daily Time Record and complete raw access logs.</span>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={activeTab === "dtr" ? handleDownloadDTR : handleDownloadRawLogs}
                      className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#7A52B5] shadow-sm"
                    >
                      <FileDownloadIcon className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                    {activeTab === "dtr" ? "Download formatted DTR sheet as PDF" : "Download raw access logs as PDF"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-2 h-11 bg-slate-200/60 rounded-lg mb-6 p-0.5">
                <TabsTrigger value="dtr" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center w-full h-full">
                        <ReceiptLongIcon className="mr-2 h-4 w-4" /> DTR View
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                      Formatted Daily Time Record and estimated basic pay summary
                    </TooltipContent>
                  </Tooltip>
                </TabsTrigger>
                <TabsTrigger value="raw_logs" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center w-full h-full">
                        <ViewTimelineIcon className="mr-2 h-4 w-4" /> All Raw Scans
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                      Raw time logging events captured by sensors/readers
                    </TooltipContent>
                  </Tooltip>
                </TabsTrigger>
              </TabsList>

              {/* Attendance Period Filter Card */}
            <Card className="shadow-sm border-0 bg-white mb-6 py-0">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Title / Info */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-[#2A174E] shrink-0">
                      <DateRangeIcon sx={{ fontSize: 20 }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#2A174E]">Attendance Period Filter</span>
                        {/* {selectedPeriodId === "current" && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] font-semibold">
                            Live Cutoff
                          </Badge>
                        )} */}
                      </div>
                      <span className="text-xs text-slate-500 font-medium block">
                        Showing logs for: <span className="font-semibold text-slate-700">{payEndingLabel}</span>
                      </span>
                    </div>
                  </div>

                  {/* Year, Month, Cutoff Period Selectors */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Year Select */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Year:</span>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px] h-9 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableYears.map((y) => (
                            <SelectItem key={y} value={y} className="text-xs">
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Month Select */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Month:</span>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[130px] h-9 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Months</SelectItem>
                          {MONTH_NAMES.map((name, idx) => (
                            <SelectItem key={idx} value={idx.toString()} className="text-xs">
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cutoff Period Select */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Cutoff:</span>
                      <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="min-w-[170px] max-w-[240px] h-9 bg-white border-slate-200 font-bold text-[#2A174E] text-xs">
                          <SelectValue placeholder="Select Cutoff" />
                        </SelectTrigger>
                        <SelectContent>
                          {isCurrentMonthView && (
                            <SelectItem value="current" className="text-xs font-semibold text-[#2A174E]">
                              Current Period (Live)
                            </SelectItem>
                          )}
                          {availablePeriods.map((p) => (
                            <SelectItem key={p.periodId} value={p.periodId.toString()} className="text-xs">
                              {p.label}
                            </SelectItem>
                          ))}
                          {!isCurrentMonthView && availablePeriods.length === 0 && (
                            <SelectItem value="none" disabled className="text-xs">
                              No cutoffs available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reset to Current Button */}
                    {(!isCurrentMonthView || selectedPeriodId !== "current") && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetToCurrent}
                            className="h-9 px-2.5 text-xs text-slate-500 hover:text-[#2A174E] hover:bg-purple-50 font-semibold transition-colors"
                          >
                            Reset to Current
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                          Jump back to today's active payroll period
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

              {/* TAB 1: DTR SIDE-BY-SIDE VIEW */}
              <TabsContent value="dtr" className="animate-in fade-in zoom-in-95 duration-200">
                {loading ? (
                  <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                    {/* Left Card Skeleton */}
                    <Card className="w-full lg:w-[45%] shadow-sm border-0 bg-white">
                      <CardHeader className="pb-3 border-b border-slate-50">
                        <Skeleton className="h-6 w-36" />
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-5 w-14 rounded-full" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Right Card Skeleton (DTR Doc) */}
                    <div className="w-full lg:w-[55%] bg-[#f7f1e3]/45 p-6 rounded-xl shadow-sm border border-amber-100 flex flex-col gap-6">
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-44 mx-auto" />
                        <Skeleton className="h-3 w-32 mx-auto" />
                      </div>
                      <Card className="p-4 border-slate-300 bg-white space-y-4 shadow-none">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </Card>
                      <Card className="p-4 border-slate-300 bg-white space-y-3 shadow-none">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-6 w-full" />
                        ))}
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                    
                    {/* Left: Attendance History for the Period */}
                    <Card className="w-full lg:w-[45%] shadow-sm border-0 bg-white py-0">
                      <CardHeader className="pb-3 border-b border-slate-50 bg-[#2A174E] pt-5" >
                        <CardTitle className="text-lg text-white">Attendance History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                        <Table className="min-w-[400px]">
                          <TableHeader className="bg-slate-50/50">
                            <TableRow>
                              <TableHead className="font-semibold text-slate-600">Date</TableHead>
                              <TableHead className="font-semibold text-slate-600">Time In</TableHead>
                              <TableHead className="font-semibold text-slate-600">Time Out</TableHead>
                              <TableHead className="font-semibold text-slate-600">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from(
                              { length: Math.round((new Date(dtrEndDate) - new Date(dtrStartDate)) / (1000 * 60 * 60 * 24)) + 1 },
                              (_, i) => {
                                const targetDate = new Date(dtrStartDate + "T00:00:00");
                                targetDate.setDate(targetDate.getDate() + i);
                                const dateStr = formatToYYYYMMDD(targetDate);
                                const todayStr = formatToYYYYMMDD(systemToday);
  
                                const log = dailyLogs.find((l) => l.log_Date.split("T")[0] === dateStr);
  
                                let displayStatus = log ? log.attendanceStatus : "—";
                                if (!log) {
                                  if (dateStr > todayStr) displayStatus = "Upcoming";
                                  else {
                                    const dow = targetDate.getDay();
                                    displayStatus = dow === 0 ? "Sunday" : "No Record";
                                  }
                                }
  
                                return (
                                  <TableRow key={dateStr} className={`hover:bg-slate-50/50 ${dateStr === todayStr ? "bg-blue-50/30 border-l-4 border-[#2A174E]" : ""}`}>
                                    <TableCell className="font-medium text-slate-700">
                                      {targetDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                    </TableCell>
                                    <TableCell className="text-slate-600 font-mono text-xs">{cleanTime(log?.time_In, log?.systemGenerated)}</TableCell>
                                    <TableCell className="text-slate-600 font-mono text-xs">{cleanTime(log?.time_Out, log?.systemGenerated)}</TableCell>
                                    <TableCell>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className={`uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 cursor-help ${getBadgeStyle(displayStatus)}`}>
                                            {displayStatus}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                          {getBadgeTooltip(displayStatus)}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
  
                    {/* Right: DTR Preview Document */}
                    <div className="w-full lg:w-[55%] bg-[#f7f1e3] p-4 sm:p-6 rounded-xl shadow-sm font-serif overflow-x-auto text-slate-900 border border-amber-100 custom-scrollbar">
                      <div className="min-w-[500px]">
                        <h2 className="text-lg font-bold text-center uppercase tracking-widest mb-1">Daily Time Record</h2>
                        <p className="text-xs text-center text-slate-600 mb-4">MAC-J Int'l Forwarding Ltd., Co.</p>
  
                        <div className="border-2 border-slate-800 bg-white">
                          <div className="border-b-2 border-slate-800 pb-2 mb-2 p-3">
                            <div className="flex justify-between mb-2 text-xs">
                              <div className="flex gap-2 flex-1"><span className="font-bold text-slate-600">No.</span> <span className="font-bold border-b border-slate-500 flex-1">{formatUserId(userData?.user_Id)}</span></div>
                              <div className="flex gap-2 flex-1"><span className="font-bold text-slate-600">Pay Ending</span> <span className="font-bold border-b border-slate-500 flex-1">{payEndingLabel}</span></div>
                            </div>
                            <div className="flex justify-between mb-2 text-xs">
                              <div className="flex gap-2 flex-1"><span className="font-bold text-slate-600">Name</span> <span className="font-bold border-b border-slate-500 flex-1">{userData?.user_FirstName} {userData?.user_LastName}</span></div>
                              <div className="flex gap-2 flex-1"><span className="font-bold text-slate-600">Position</span> <span className="font-bold border-b border-slate-500 flex-1">Employee</span></div>
                            </div>
  
                            <table className="w-full border-collapse border-t border-slate-800 text-[10px] mt-2">
                              <thead>
                                <tr>
                                  <th colSpan="2" className="border border-slate-400 p-1 bg-slate-50">Hours</th>
                                  <th className="border border-slate-400 p-1 bg-slate-50">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help">Rate</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Computed basic hourly rate based on current Daily Rate.
                                      </TooltipContent>
                                    </Tooltip>
                                  </th>
                                  <th className="border border-slate-400 p-1 bg-slate-50">Amount</th>
                                  <th rowSpan="4" className="border border-slate-400 bg-slate-200 px-1 py-0.5 text-[8px] font-bold tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>DEDUCTIONS</th>
                                  <th colSpan="2" className="border border-slate-400 p-1 bg-slate-50">ABSENCES</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">Reg.</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Regular working hours logged (excluding overtime).
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 w-12 text-center text-slate-700">{parseFloat(dtrSummary?.reg_hrs || 0).toFixed(2)}</td>
                                  <td className="border border-slate-400 p-1 w-12 text-center text-slate-700">{formatCurrency(dtrSummary?.ratePerHr || 0)}</td>
                                  <td className="border border-slate-400 p-1 w-12 text-center text-slate-700">{formatCurrency(dtrSummary?.basicPay || 0)}</td>
                                  <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">Fines</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Deductions due to late logs and attendance violations.
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 w-12 text-center text-slate-700">({formatCurrency(dtrSummary?.tardiness_Amnt || 0)})</td>
                                </tr>
                                <tr>
                                  <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">Total Hrs</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Sum of all hours worked (regular + approved overtime).
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 text-center font-bold text-slate-800" colSpan="3">
                                    {dtrData.reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0).toFixed(2)} hrs
                                  </td>
                                  <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">Count</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Number of days absent within this payroll period.
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 text-center text-slate-700">{dtrSummary?.absence_Days || 0} days</td>
                                </tr>
                                <tr className="font-bold">
                                  <td className="border border-slate-400 p-1 text-left text-slate-600" colSpan="3">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">NET PAY (Payroll)</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Estimated net pay before taxes and government contributions.
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 text-slate-800">
                                    {dtrSummary?.netPay ? formatCurrency(dtrSummary.netPay) : "TBD"}
                                  </td>
                                  <td className="border border-slate-400 p-1 text-left text-slate-600">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-slate-400">TOTAL (Attn.)</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                        Net attendance payout (Basic Pay minus Tardiness/Fines).
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                  <td className="border border-slate-400 p-1 text-slate-800">
                                    {formatCurrency(parseFloat(dtrSummary?.basicPay || 0) - parseFloat(dtrSummary?.tardiness_Amnt || 0))}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
  
                          <table className="w-full border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th rowSpan="2" className="border border-slate-400 p-1">Days</th>
                                <th colSpan="2" className="border border-slate-400 p-1">MORNING</th>
                                <th colSpan="2" className="border border-slate-400 p-1">AFTERNOON</th>
                                <th colSpan="2" className="border border-slate-400 p-1">OVERTIME</th>
                                <th rowSpan="2" className="border border-slate-400 p-1">Daily<br/>Total</th>
                              </tr>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-400 p-1">IN</th><th className="border border-slate-400 p-1">OUT</th>
                                <th className="border border-slate-400 p-1">IN</th><th className="border border-slate-400 p-1">OUT</th>
                                <th className="border border-slate-400 p-1">IN</th><th className="border border-slate-400 p-1">OUT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from(
                                { length: Math.round((new Date(dtrEndDate) - new Date(dtrStartDate)) / (1000 * 60 * 60 * 24)) + 1 },
                                (_, i) => {
                                  const targetDate = new Date(dtrStartDate + "T00:00:00");
                                  targetDate.setDate(targetDate.getDate() + i);
                                  const dayNum = targetDate.getDate();
                                  const dateStr = formatToYYYYMMDD(targetDate);
                                  const isSunday = targetDate.getDay() === 0;
  
                                  const log = getDtrLogsForDay(dayNum, dateStr);
                                  const getCell = (val) => (!isSunday && log ? cleanTime(val, log.systemGenerated) : "");

                                  const isIrregularDay = log?.status === "Irregular" || 
                                                         log?.attendanceStatus === "Irregular" || 
                                                         Number(log?.attendance_StatusId) === 8 || 
                                                         Number(log?.attendanceStatusId) === 8 ||
                                                         Number(log?.attendance_StatusId) === 7;

                                  const morningInVal = isIrregularDay
                                    ? ""
                                    : ((log?.morning_In && log?.morning_In !== "—")
                                        ? log.morning_In
                                        : (log?.time_In && log?.time_In !== "—" ? log.time_In : (log?.inArr && log.inArr.length > 0 ? log.inArr[0] : "")));

                                  const candidateOut = isIrregularDay
                                    ? ""
                                    : ((log?.afternoon_Out && log?.afternoon_Out !== "—")
                                        ? log.afternoon_Out
                                        : (log?.time_Out && log?.time_Out !== "—" && log.time_Out !== morningInVal && log.time_Out !== log?.morning_Out
                                          ? log.time_Out
                                          : (log?.outArr && log.outArr.length > 0 ? log.outArr[log.outArr.length - 1] : "")));

                                  const afternoonOutVal = (candidateOut && isPMPunch(candidateOut) && candidateOut !== morningInVal && candidateOut !== log?.morning_Out)
                                    ? candidateOut
                                    : "";
  
                                  return (
                                    <tr key={dayNum} className={`text-center h-6 ${isSunday ? "bg-slate-200/50 text-slate-400" : ""}`}>
                                      <td className="border border-slate-400 font-bold bg-slate-50 w-8">{dayNum}</td>
                                      <td className="border border-slate-400">{getCell(morningInVal)}</td>
                                      <td className="border border-slate-400">{getCell(log?.morning_Out)}</td>
                                      <td className="border border-slate-400">{getCell(log?.afternoon_In)}</td>
                                      <td className="border border-slate-400">{getCell(afternoonOutVal)}</td>
                                      <td className="border border-slate-400">{getCell(log?.ot_In)}</td>
                                      <td className="border border-slate-400">{getCell(log?.ot_Out)}</td>
                                      <td className="border border-slate-400 font-bold bg-slate-50">{!isSunday && log ? (log.hoursWorkedFormatted || log.hoursWorked) : ""}</td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
  
                          <div className="mt-4 p-4 text-center pb-8">
                            <p className="text-[10px] text-slate-600 italic mb-8">I hereby certify that the above records are true and correct.</p>
                            <div className="w-48 mx-auto border-b-2 border-slate-800 mb-1"></div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Employee's Signature</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: ALL-TIME RAW LOGS */}
              <TabsContent value="raw_logs" className="animate-in fade-in zoom-in-95 duration-200">
                {loading ? (
                  <div className="space-y-6">
                    {/* Filters Skeleton */}
                    <Card className="shadow-sm border-0 bg-white mb-6 py-0">
                      <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
                        <Skeleton className="h-10 w-full xl:max-w-md" />
                        <Skeleton className="h-10 w-full xl:w-[200px]" />
                      </CardContent>
                    </Card>

                    {/* Table Skeleton */}
                    <Card className="shadow-sm border-0 bg-white py-0 flex flex-col">
                      <CardContent className="p-0">
                        <div className="p-4 border-b border-slate-100 flex gap-4">
                          {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-5 w-24" />
                          ))}
                        </div>
                        <div className="p-4 space-y-4">
                          {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex gap-4">
                              <Skeleton className="h-5 w-24" />
                              <Skeleton className="h-5 w-24" />
                              <Skeleton className="h-5 w-16 rounded-full" />
                              <Skeleton className="h-5 flex-1" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <>
                    {/* Filters Card
                    <Card className="shadow-sm border-0 bg-white mb-6 py-0">
                      <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full xl:max-w-md">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                            type="text"
                            placeholder="Search raw scans..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
                          />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                                <SelectValue placeholder="Filter by Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="All">All Types</SelectItem>
                                <SelectItem value="Clock In">Clock In</SelectItem>
                                <SelectItem value="Clock Out">Clock Out</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
    
                          {isFiltering && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  onClick={handleClearFilters}
                                  className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                                >
                                  <CloseIcon className="h-4 w-4 mr-1" /> Clear
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Reset search query and status filters
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </CardContent>
                    </Card> */}
    
                    {/* Table Card */}
                    <Card className="shadow-sm border-0 bg-white py-0 flex flex-col">
                      <CardContent className="p-0 flex flex-col">
                        <div className="overflow-x-auto">
                          <Table className="min-w-[800px] md:min-w-full">
                            <TableHeader className="bg-[#2B174F]">
                              <TableRow className="hover:bg-transparent border-b-slate-200">
                                <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Date</TableHead>
                                <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time Scanned</TableHead>
                                <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Scan Type</TableHead>
                                <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">System Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentScansData.length > 0 ? (
                                currentScansData.map((log, i) => {
                                  const logType = log.loggedStatusName || "—";
                                  const action = log.attendanceStatusName || "—";
                                  
                                  return (
                                    <TableRow key={i} className="hover:bg-slate-50/50 border-b-slate-100 transition-colors">
                                      <TableCell className="font-bold text-[#2A174E] px-6 py-4">
                                        {log.log_Date ? new Date(log.log_Date).toLocaleDateString() : "—"}
                                      </TableCell>
                                      <TableCell className="text-slate-600 font-mono text-[13px] py-4">
                                        {log.time_Logged ? formatTime12h(log.time_Logged) : "—"}
                                      </TableCell>
                                      <TableCell className="py-4">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="secondary" className={`uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 cursor-help ${getBadgeStyle(logType)}`}>
                                              {logType}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                            {getBadgeTooltip(logType)}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TableCell>
                                      <TableCell className="text-slate-700 font-medium py-4">{action}</TableCell>
                                    </TableRow>
                                  );
                                })
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                                      <span className="font-semibold text-slate-600">No raw scans found</span>
                                      <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
    
                        {/* Pagination Controls */}
                        <TablePagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          setCurrentPage={setCurrentPage}
                          totalItems={totalItems}
                          itemsPerPage={itemsPerPage}
                          setItemsPerPage={setItemsPerPage}
                          startIndex={startIndex}
                          endIndex={endIndex}
                          itemLabel="scans"
                        />
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

            </Tabs>

            {/* Global styling for custom scrollbars */}
            <style dangerouslySetInnerHTML={{__html: `
              .custom-scrollbar::-webkit-scrollbar {
                height: 10px;
                width: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f5f9; 
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #cbd5e1; 
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #94a3b8; 
              }
            `}} />

          </div>
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default UserLogs;