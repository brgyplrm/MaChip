import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
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

const UserLogs = () => {
  const { systemToday } = useSystemTime();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Data States
  const [dailyLogs, setDailyLogs] = useState([]); // For left-side period table
  const [dtrData, setDtrData] = useState([]);     // For right-side DTR document
  const [rawScans, setRawScans] = useState([]);   // For new Raw Logs tab
  const [loading, setLoading] = useState(false);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  
  // Tab & Filter States
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

  const handlePeriodChange = (val) => {
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

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchDailyLogs = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/attendance/logs/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter((log) => {
          const logDate = log.log_Date.split("T")[0];
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
        setDtrData(data);
      }
    } catch (error) {
      console.error("Error fetching DTR:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRawScans = async () => {
    if (!userData?.user_Id) return;
    try {
      // Replicating Logs.jsx behavior: Fetch all raw scans and filter for this user
      const response = await fetchWithAuth("/api/attendance/all");
      if (response.ok) {
        const data = await response.json();
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
  }, [userData?.user_Id, dtrStartDate, dtrEndDate]);

  useEffect(() => {
    if (activeTab === "raw_logs" && rawScans.length === 0) {
      fetchRawScans();
    }
  }, [activeTab]);

  const getDtrLogsForDay = (dayNum) => {
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
      <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">My Attendance & Logs</h1>
            <span className="text-sm text-slate-500 mt-1 block">View your official Daily Time Record and complete raw access logs.</span>
          </div>
          {activeTab === "dtr" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 pl-0 md:pl-4 md:border-l border-slate-200">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider shrink-0">Period:</span>
                <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[180px] bg-white border-slate-200 font-bold text-[#2A174E]">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Period</SelectItem>
                    {payrollPeriods.map((p) => (
                      <SelectItem key={p.periodId} value={p.periodId.toString()}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleDownloadDTR}
                className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700 shadow-sm"
              >
                <FileDownloadIcon className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>
          )}
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2 h-11 bg-slate-200/60 p-1 rounded-lg mb-6">
            <TabsTrigger value="dtr" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
              <ReceiptLongIcon className="mr-2 h-4 w-4" /> DTR View
            </TabsTrigger>
            <TabsTrigger value="raw_logs" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
              <ViewTimelineIcon className="mr-2 h-4 w-4" /> All Raw Scans
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DTR SIDE-BY-SIDE VIEW */}
          <TabsContent value="dtr" className="animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
              
              {/* Left: Attendance History for the Period */}
              <Card className="w-full lg:w-[45%] shadow-sm border-0 bg-white">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-lg text-slate-800">Attendance History</CardTitle>
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
                              <TableCell className="text-slate-600 font-mono text-xs">{log?.time_In || "—"}</TableCell>
                              <TableCell className="text-slate-600 font-mono text-xs">{log?.time_Out || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 ${getBadgeStyle(displayStatus)}`}>
                                  {displayStatus}
                                </Badge>
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
                            <th className="border border-slate-400 p-1 bg-slate-50">Rate</th>
                            <th className="border border-slate-400 p-1 bg-slate-50">Amount</th>
                            <th rowSpan="4" className="border border-slate-400 bg-slate-200 px-1 py-0.5 text-[8px] font-bold tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>DEDUCTIONS</th>
                            <th colSpan="2" className="border border-slate-400 p-1 bg-slate-50">ABSENCES</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">Reg.</td><td className="border border-slate-400 p-1 w-12"></td><td className="border border-slate-400 p-1 w-12"></td><td className="border border-slate-400 p-1 w-12"></td>
                            <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">Fines</td><td className="border border-slate-400 p-1 w-12"></td>
                          </tr>
                          <tr>
                            <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">Total Hrs</td>
                            <td className="border border-slate-400 p-1 text-center font-bold" colSpan="3">{dtrData.reduce((sum, d) => sum + parseFloat(d.hoursWorked || 0), 0).toFixed(2)} hrs</td>
                            <td className="border border-slate-400 p-1 text-left font-normal text-slate-600">Tax</td><td className="border border-slate-400 p-1"></td>
                          </tr>
                          <tr className="font-bold">
                            <td className="border border-slate-400 p-1 text-left text-slate-600" colSpan="3">NET PAY</td><td className="border border-slate-400 p-1 text-slate-400 font-normal">TBD</td>
                            <td className="border border-slate-400 p-1 text-left text-slate-600">TOTAL</td><td className="border border-slate-400 p-1"></td>
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
                            const isSunday = targetDate.getDay() === 0;

                            const log = getDtrLogsForDay(dayNum);
                            const getCell = (val) => (!isSunday && log && val && val !== "—" ? val : "");

                            return (
                              <tr key={dayNum} className={`text-center h-6 ${isSunday ? "bg-slate-200/50 text-slate-400" : ""}`}>
                                <td className="border border-slate-400 font-bold bg-slate-50 w-8">{dayNum}</td>
                                <td className="border border-slate-400">{getCell(log?.morning_In)}</td>
                                <td className="border border-slate-400">{getCell(log?.morning_Out)}</td>
                                <td className="border border-slate-400">{getCell(log?.afternoon_In)}</td>
                                <td className="border border-slate-400">{getCell(log?.afternoon_Out)}</td>
                                <td className="border border-slate-400">{getCell(log?.ot_In)}</td>
                                <td className="border border-slate-400">{getCell(log?.ot_Out)}</td>
                                <td className="border border-slate-400 font-bold bg-slate-50">{!isSunday && log ? log.hoursWorked : ""}</td>
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
          </TabsContent>

          {/* TAB 2: ALL-TIME RAW LOGS */}
          <TabsContent value="raw_logs" className="animate-in fade-in zoom-in-95 duration-200">
            {/* Filters Card */}
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
                    <Button 
                      variant="ghost" 
                      onClick={handleClearFilters}
                      className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                    >
                      <CloseIcon className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

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
                                <Badge variant="secondary" className={`uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 ${getBadgeStyle(logType)}`}>
                                  {logType}
                                </Badge>
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
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Rows per page:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                          <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                            <SelectValue placeholder="10" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="font-medium">
                        Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{totalItems}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">
                        {currentPage}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
      </Sidebar>
    </div>
  );
};

export default UserLogs;