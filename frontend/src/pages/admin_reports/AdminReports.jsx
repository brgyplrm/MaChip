import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PaymentsIcon from "@mui/icons-material/Payments";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from '@mui/icons-material/Close';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { Link, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { exportBatchToZip } from "../../utils/payrollExport";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";
import { exportToPDF } from "../../utils/pdfExport";
import { FileInput } from "lucide-react";
import EmptyState from "../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ShieldIcon from '@mui/icons-material/Shield';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const AdminReports = () => {
  // Constant Baseline Fallback Variable References
  const defaultStartDate = useMemo(() => new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().split('T')[0], []);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultEmployee = "All Employees";
  const defaultPeriod = "custom";
  const defaultEventType = "All Types";

  // --- Attendance & Payroll Filters ---
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedEmployee, setSelectedEmployee] = useState(defaultEmployee);
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  
  // --- Calendar/Events Specific Filters ---
  const [calendarStartDate, setCalendarStartDate] = useState(defaultStartDate);
  const [calendarEndDate, setCalendarEndDate] = useState(defaultEndDate);
  const [eventTypeFilter, setEventTypeFilter] = useState(defaultEventType);

  // --- Requests Tab Specific Filters ---
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const [activeReport, setActiveReport] = useState("attendance");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showBatchZipModal, setShowBatchZipModal] = useState(false);
  const [zipPassword, setZipPassword] = useState("");
  const [zipLabel, setZipLabel] = useState("");

  const userData = JSON.parse(localStorage.getItem("userData") || "null");
  const roleId = userData?.user_RoleId;
  const isAdminOrAccountant = roleId === 1 || roleId === 4;

  // --- FIXED: Re-added Missing getStatusBadge helper function ---
  const getStatusBadge = (statusId) => {
    switch (statusId) {
      case 1: case 4: return "bg-orange-100 text-orange-800 hover:bg-orange-100"; // Pending/Recommended
      case 2: return "bg-green-100 text-green-800 hover:bg-green-100"; // Approved
      case 3: return "bg-red-100 text-red-800 hover:bg-red-100"; // Rejected
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const formatDateStr = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fetchAllRequestsData = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/request/all");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to populate statistics summary rows:", err);
    }
  }, []);

  const fetchPayrollPeriods = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      if (response.ok) {
        const data = await response.json();
        setPayrollPeriods(data);
      }
    } catch (error) {
      console.error("Error fetching payroll periods:", error);
    }
  }, []);

  const handlePeriodChange = (val) => {
    setSelectedPeriod(val);
    if (val === "custom") return;

    const period = payrollPeriods.find(p => p.periodId.toString() === val);
    if (period) {
      setStartDate(period.startDate);
      setEndDate(period.endDate);
    }
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  const fetchAttendanceReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/attendance/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
      }
    } catch (error) {
      console.error("Error fetching attendance report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchPayrollReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/payroll/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error("Error fetching payroll report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchCalendarReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/request/report/calendar?startDate=${calendarStartDate}&endDate=${calendarEndDate}&user_Id=All Employees`);
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data);
      }
    } catch (error) {
      console.error("Error fetching calendar report:", error);
    } finally {
      setLoading(false);
    }
  }, [calendarStartDate, calendarEndDate]);

  useEffect(() => {
    fetchEmployees();
    fetchPayrollPeriods();
    fetchAllRequestsData();
  }, [fetchEmployees, fetchPayrollPeriods, fetchAllRequestsData]);

  useEffect(() => {
    if (activeReport === "attendance") fetchAttendanceReport();
    else if (activeReport === "payroll") fetchPayrollReport();
    else if (activeReport === "calendar") fetchCalendarReport();
  }, [activeReport, fetchAttendanceReport, fetchPayrollReport, fetchCalendarReport]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveReport(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeReport, startDate, endDate, selectedEmployee, calendarStartDate, calendarEndDate, eventTypeFilter, searchQuery, typeFilter, statusFilter, itemsPerPage]);

  const handleClearFilters = () => {
    if (activeReport === "attendance" || activeReport === "payroll") {
      setSelectedEmployee(defaultEmployee);
      setSelectedPeriod(defaultPeriod);
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
    } else if (activeReport === "calendar") {
      setCalendarStartDate(defaultStartDate);
      setCalendarEndDate(defaultEndDate);
      setEventTypeFilter(defaultEventType);
    } else if (activeReport === "requests") {
      setSearchQuery("");
      setTypeFilter("All Types");
      setStatusFilter("All Statuses");
    }
    setCurrentPage(1);
  };

  const isFiltering = useMemo(() => {
    if (activeReport === "attendance" || activeReport === "payroll") {
      return selectedEmployee !== defaultEmployee || selectedPeriod !== defaultPeriod || startDate !== defaultStartDate || endDate !== defaultEndDate;
    }
    if (activeReport === "calendar") {
      return calendarStartDate !== defaultStartDate || calendarEndDate !== defaultEndDate || eventTypeFilter !== defaultEventType;
    }
    if (activeReport === "requests") {
      return searchQuery !== "" || typeFilter !== "All Types" || statusFilter !== "All Statuses";
    }
    return false;
  }, [activeReport, selectedEmployee, selectedPeriod, startDate, endDate, calendarStartDate, calendarEndDate, eventTypeFilter, searchQuery, typeFilter, statusFilter, defaultStartDate, defaultEndDate, defaultEmployee, defaultPeriod, defaultEventType]);

  const handleCSVExport = () => {
    let dataToExport = [];
    let filename = `${activeReport}_report_${startDate}_to_${endDate}.csv`;

    if (activeReport === "attendance") {
      dataToExport = attendanceData.map(r => ({
        "Employee ID": formatUserId(r.user_Id),
        "Employee Name": r.userName,
        "Log Date": new Date(r.log_Date).toLocaleDateString(),
        "Time In": r.time_In || "—",
        "Time Out": r.time_Out || "—",
        "Hours Worked": r.hoursWorked,
        "Status": r.status,
        "Remarks": r.remarks || ""
      }));
    } else if (activeReport === "payroll") {
      dataToExport = payrollData.map(r => ({
        "Employee ID": formatUserId(r.user_Id),
        "Employee Name": `${r.user_FirstName} ${r.user_LastName}`,
        "Days Worked": r.NoDays_Worked,
        "Hours Worked": r.NoHrs_Worked,
        "Basic Pay": r.basicPay,
        "Overtime Pay": (parseFloat(r.OT_Amnt) || 0) + (parseFloat(r.restDay_OT_Amnt) || 0),
        "Night Diff Pay": r.nightDiff_Amnt,
        "Holiday Pay": r.specialHol_Amnt,
        "Gross Earnings": r.totalEarnings,
        "Deductions": r.totalDeductions,
        "Net Pay": r.netPay,
        "Status": r.statusName
      }));
    } else if (activeReport === "calendar") {
      dataToExport = filteredCalendarData.map(r => ({
        "Event Type": r.type,
        "Date": new Date(r.date).toLocaleDateString(),
        "Event Subject": r.name,
        "Details": r.details || ""
      }));
    }
    exportToCSV(dataToExport, filename);
  };

  const handlePDFExport = () => {
    let dataToExport = [];
    let filename = `${activeReport}_report_${activeReport === "calendar" ? calendarStartDate : startDate}_to_${activeReport === "calendar" ? calendarEndDate : endDate}.pdf`;
    let headers = [];
    let title = `${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report`;
    let orientation = "p";

    if (activeReport === "attendance") {
      headers = ["Emp ID", "Employee Name", "Date", "In", "Out", "Hrs", "Status"];
      dataToExport = attendanceData.map(r => [formatUserId(r.user_Id), r.userName, new Date(r.log_Date).toLocaleDateString(), r.time_In, r.time_Out, r.hoursWorked, r.status]);
    } else if (activeReport === "payroll") {
      orientation = "l";
      headers = ["ID", "Name", "Worked", "Basic", "OT", "ND", "Hol", "Earn", "Deductions", "Net"];
      dataToExport = payrollData.map(r => [formatUserId(r.user_Id), `${r.user_FirstName} ${r.user_LastName}`, `${r.NoDays_Worked}d/${r.NoHrs_Worked}h`, peso(r.basicPay), peso((parseFloat(r.OT_Amnt) || 0) + (parseFloat(r.restDay_OT_Amnt) || 0)), peso(r.nightDiff_Amnt), peso(r.specialHol_Amnt), peso(r.totalEarnings), peso(r.totalDeductions), peso(r.netPay)]);
    } else if (activeReport === "calendar") {
      headers = ["Type", "Date", "Name/Employee", "Details"];
      dataToExport = filteredCalendarData.map(r => [r.type, r.date, r.name, r.details]);
    }

    exportToPDF(title, headers, dataToExport, filename, { orientation });
  };

  const confirmBatchZip = async () => {
    setShowBatchZipModal(false);
    setLoading(true);
    try {
      await exportBatchToZip(payrollData, zipLabel, zipPassword);
    } catch (error) {
      console.error("Batch Zip Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchExport = () => {
    if (payrollData.length === 0) return;
    let label = "Payroll_Report";
    let periodCode = "MAChipPayroll";
    
    // FIXED: Corrected syntax scoping error where 'val' was unreferenced
    if (selectedPeriod !== "custom") {
      const period = payrollPeriods.find(p => p.periodId.toString() === selectedPeriod);
      if (period) {
        const [startY, startM, startD] = period.startDate.split('-').map(Number);
        const [endY, endM, endD] = period.endDate.split('-').map(Number);
        const month = new Date(startY, startM - 1, startD).toLocaleString('en-US', { month: 'long' });
        label = `${month}${startD}-${endD}`;
        const monthNum = String(startM).padStart(2, '0');
        const pRange = `${String(startD).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;
        periodCode = `${startY}_${monthNum}${pRange}MAChipPayroll`;
      }
    } else {
      label = `Payroll_${startDate}_to_${endDate}`;
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      periodCode = `${sY}_${String(sM).padStart(2, '0')}${String(sD).padStart(2, '0')}-${String(eD).padStart(2, '0')}MAChipPayroll`;
    }
    setZipPassword(periodCode);
    setZipLabel(label);
    setShowBatchZipModal(true);
  };

  // --- Reducer Operational Loops ---
  const attStats = attendanceData.reduce((acc, curr) => {
    if (curr.status === "On-Time") acc.present++;
    else if (curr.status === "Late") { acc.present++; acc.late++; }
    else if (curr.status === "Absent") acc.absent++;
    acc.totalHours += parseFloat(curr.hoursWorked) || 0;
    return acc;
  }, { present: 0, absent: 0, late: 0, totalHours: 0 });

  const payStats = payrollData.reduce((acc, curr) => {
    acc.net += parseFloat(curr.netPay) || 0;
    acc.earn += parseFloat(curr.totalEarnings) || 0;
    acc.ded += parseFloat(curr.totalDeductions) || 0;
    return acc;
  }, { net: 0, earn: 0, ded: 0 });

  const filteredCalendarData = useMemo(() => {
    return calendarData.filter(item => eventTypeFilter === "All Types" || item.type === eventTypeFilter);
  }, [calendarData, eventTypeFilter]);

  const filteredRequests = requests.filter(req => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = req.userName?.toLowerCase().includes(query) || req.emp_reqId?.toString().includes(query) || formatUserId(req.user_Id).toLowerCase().includes(query);
    const matchesType = typeFilter === "All Types" || req.reqTypeName === typeFilter;
    const matchesStatus = statusFilter === "All Statuses" || req.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const requestStats = {
    total: requests.length,
    pending: requests.filter(r => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4).length,
    approved: requests.filter(r => r.emp_reqStatusId === 2).length,
    rejected: requests.filter(r => r.emp_reqStatusId === 3).length,
  };

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeData = activeReport === "attendance" 
    ? attendanceData 
    : activeReport === "payroll" 
      ? payrollData 
      : activeReport === "calendar" 
        ? filteredCalendarData 
        : filteredRequests;

  const totalItems = activeData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = activeData.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Reports & Analytics</h1>
              <span className="text-sm text-slate-500 mt-1 block">Generate, analyze, and export system attendance and payroll data.</span>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* <Button onClick={handleCSVExport} variant="outline" className="w-full md:w-auto border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-sm">
                <FileInput className="mr-2 h-4 w-4 text-slate-500" /> Export CSV
              </Button> */}
              <Button onClick={handlePDFExport} className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm">
                <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF
              </Button>
              {activeReport === "payroll" && (
                <Button onClick={handleBatchExport} disabled={payrollData.length === 0 || loading} className="w-full md:w-auto bg-green-600 text-white hover:bg-green-700 shadow-sm">
                  <ReceiptLongIcon className="mr-2 h-4 w-4" /> Batch ZIP Payslips
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeReport} onValueChange={(val) => setActiveReport(val)} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto sm:h-12 bg-slate-200/60 p-1 rounded-lg gap-1 sm:gap-0">
              <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <AssessmentIcon className="mr-2 h-4 w-4" /> Attendance Report
              </TabsTrigger>
              <TabsTrigger value="payroll" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <PaymentsIcon className="mr-2 h-4 w-4" /> Payroll Report
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <CalendarMonthIcon className="mr-2 h-4 w-4" /> Calendar / Events
              </TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <FileInput className="mr-2 h-4 w-4" /> Requests
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Statistics Display Grid Area */}
          <div className="w-full animate-in fade-in zoom-in-95 duration-200">
            {activeReport === "attendance" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 w-full">
                <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Present</p><p className="text-4xl font-bold text-[#2A174E]">{attStats.present}</p></div><p className="text-xs text-[#2A174E]/70 italic mt-4">Total present records</p></div><div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><CheckCircleOutlineIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Total Hours</p><p className="text-4xl font-bold text-[#3B4E17]">{attStats.totalHours.toFixed(1)}<span className="text-lg opacity-80 ml-1">hrs</span></p></div><p className="text-xs text-[#3B4E17]/70 italic mt-4">Total working hours</p></div><div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><AccessTimeIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Lates / Absences</p><p className="text-4xl font-bold text-[#BB8B26]">{attStats.late + attStats.absent}</p></div><p className="text-xs text-[#BB8B26]/70 italic mt-4">Recorded schedule infractions</p></div><div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><AssignmentLateIcon /></div></CardContent></Card>
              </div>
            )}

            {activeReport === "payroll" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 w-full">
                <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Net Pay</p><p className="text-4xl font-bold text-[#2A174E]">{peso(payStats.net)}</p></div><p className="text-xs text-[#2A174E]/70 italic mt-4">Distribution payload volume</p></div><div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><PaymentsIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Total Earnings</p><p className="text-4xl font-bold text-[#3B4E17]">{peso(payStats.earn)}</p></div><p className="text-xs text-[#3B4E17]/70 italic mt-4">Gross operational pay index</p></div><div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><KeyboardDoubleArrowUpIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Total Deductions</p><p className="text-4xl font-bold text-[#BB8B26]">{peso(payStats.ded)}</p></div><p className="text-xs text-[#BB8B26]/70 italic mt-4">Withholdings ledger volume</p></div><div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><KeyboardDoubleArrowDownIcon /></div></CardContent></Card>
              </div> 
            )}

            {activeReport === "calendar" && (
              <div className="grid grid-cols-1 mb-6 w-full">
                <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Logged Events</p><p className="text-4xl font-bold text-[#2A174E]">{filteredCalendarData.length}</p></div><p className="text-xs text-[#2A174E]/70 italic mt-4">Holidays and leave logs active in window</p></div><div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start"><EventNoteIcon /></div></CardContent></Card>
              </div>
            )}

            {activeReport === "requests" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 w-full">
                <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full items-center"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-1">Queue Total</p><p className="text-4xl font-extrabold text-[#2A174E]">{requestStats.pending}</p></div><p className="text-xs text-[#2A174E]/70 font-medium italic mt-2">Pending review entries</p></div><div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0"><AccessTimeIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full items-center"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-1">Approved History</p><p className="text-4xl font-extrabold text-[#3B4E17]">{requestStats.approved}</p></div><p className="text-xs text-[#3B4E17]/70 font-medium italic mt-2">Accepted historical logs</p></div><div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0"><CheckCircleOutlineIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full items-center"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-1">Rejected Records</p><p className="text-4xl font-extrabold text-[#BB8B26]">{requestStats.rejected}</p></div><p className="text-xs text-[#BB8B26]/70 font-medium italic mt-2">Declined system entries</p></div><div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0"><AssignmentLateIcon /></div></CardContent></Card>
                <Card className="border-t-5 border-[#475569] bg-white py-0 h-full"><CardContent className="px-5 py-5 flex justify-between h-full items-center"><div className="flex flex-col justify-between"><div><p className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gross Logs Filed</p><p className="text-4xl font-extrabold text-slate-700">{requestStats.total}</p></div><p className="text-xs text-slate-400 font-medium italic mt-2">Operational ledger history volume</p></div><div className="bg-slate-100 text-slate-600 p-3 rounded-lg flex items-center justify-center shrink-0"><AssessmentIcon /></div></CardContent></Card>
              </div>
            )}
          </div>

          {/* Tab-Isolated Filters */}
          <Card className="mb-6 mt-6 shadow-sm border-0 bg-white py-0">
            <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
              
              <div className="flex items-center gap-2 font-bold text-slate-700 w-full xl:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5" /> Filters
              </div>

              {/* FILTER VIEW 1: Attendance & Payroll (Includes Period and Employee) */}
              {(activeReport === "attendance" || activeReport === "payroll") && (
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto flex-wrap">
                  <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 font-medium text-slate-700">
                      <SelectValue placeholder="-- Select Period --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                      {payrollPeriods.map(p => (
                        <SelectItem key={p.periodId} value={p.periodId.toString()}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedPeriod === "custom" && (
                    <>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 font-medium text-slate-700" />
                      <span className="hidden sm:block text-slate-400 font-bold">to</span>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 font-medium text-slate-700" />
                    </>
                  )}

                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 font-medium text-slate-700">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Employees">All Employees</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                          {emp.user_LastName}, {emp.user_FirstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isFiltering && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-slate-500 hover:text-red-600 font-semibold h-9 gap-1 transition-colors">
                      <CloseIcon className="h-4 w-4" /> Clear Filters
                    </Button>
                  )}
                </div>
              )}

              {/* FILTER VIEW 2: Calendar/Events (Excludes Employee Dropdown) */}
              {activeReport === "calendar" && (
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto flex-wrap">
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] border-slate-200 bg-slate-50 font-medium text-slate-700">
                      <SelectValue placeholder="All Event Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Types">All Event Types</SelectItem>
                      <SelectItem value="Holiday">Holidays</SelectItem>
                      <SelectItem value="Leave">Leaves</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input type="date" value={calendarStartDate} onChange={(e) => setCalendarStartDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 font-medium text-slate-700" />
                  <span className="hidden sm:block text-slate-400 font-bold">to</span>
                  <Input type="date" value={calendarEndDate} onChange={(e) => setCalendarEndDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 font-medium text-slate-700" />

                  {isFiltering && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-slate-500 hover:text-red-600 font-semibold h-9 gap-1 transition-colors">
                      <CloseIcon className="h-4 w-4" /> Clear Filters
                    </Button>
                  )}
                </div>
              )}

              {/* FILTER VIEW 3: Requests Panel */}
              {activeReport === "requests" && (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-wrap">
                  <div className="relative w-full sm:w-[240px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search key criteria..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 border-slate-200 focus-visible:ring-[#2A174E] w-full bg-slate-50"
                    />
                  </div>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 border-slate-200 bg-slate-50 text-slate-700">
                      <SelectValue placeholder="All Request Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Types">All Types</SelectItem>
                      <SelectItem value="Vacation Leave">Vacation Leave</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                      <SelectItem value="Overtime">Overtime</SelectItem>
                      <SelectItem value="OnField Work">OnField Work</SelectItem>
                      <SelectItem value="Log Correction">Log Correction</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] h-9 border-slate-200 bg-slate-50 text-slate-700">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Statuses">All Statuses</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Recommended">Recommended</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>

                  {isFiltering && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-slate-500 hover:text-red-600 font-semibold h-9 gap-1 transition-colors">
                      <CloseIcon className="h-4 w-4" /> Clear Filters
                    </Button>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Master Operational Data Tables */}
          <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
            <CardContent className="p-0 flex flex-col">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Loading report data...</div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  
                  {/* Attendance Report Table */}
                  {activeReport === "attendance" && (
                    <Table className="min-w-[1000px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Emp ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time In</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Hours</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider pr-6">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let badgeStyle = "bg-slate-100 text-slate-800 font-bold";
                          if (r.status === "On-Time") badgeStyle = "bg-green-100 text-green-800 font-bold";
                          else if (r.status === "Late") badgeStyle = "bg-amber-100 text-amber-800 font-bold";
                          else if (r.status === "Absent") badgeStyle = "bg-red-100 text-red-800 font-bold";

                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-[#2A174E] px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
                              <TableCell className="font-semibold text-slate-800 py-4">{r.userName}</TableCell>
                              <TableCell className="text-slate-600 py-4">{new Date(r.log_Date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-slate-600 font-mono text-[13px] py-4">{r.time_In}</TableCell>
                              <TableCell className="text-slate-600 font-mono text-[13px] py-4">{r.time_Out}</TableCell>
                              <TableCell className="text-slate-700 font-bold py-4">{r.hoursWorkedFormatted || r.hoursWorked}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={badgeStyle}>{r.status}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 italic max-w-[200px] truncate pr-6 py-4">{r.remarks || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic p-6">No attendance records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* Payroll Report Table */}
                  {activeReport === "payroll" && (
                    <Table className="min-w-[1200px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Emp ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Period</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Days/Hrs</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Basic Pay</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Earnings</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Deductions</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Net Pay</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Payslip</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let badgeStyle = "bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px]";
                          if (r.statusName === "Paid" || r.statusName === "Released") badgeStyle = "bg-green-100 text-green-800 font-bold uppercase tracking-wider text-[10px]";
                          else if (r.statusName === "Processed") badgeStyle = "bg-blue-100 text-blue-800 font-bold uppercase tracking-wider text-[10px]";
                          
                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-[#2A174E] px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
                              <TableCell className="font-semibold text-slate-800 py-4">{r.user_FirstName} {r.user_LastName}</TableCell>
                              <TableCell className="text-slate-500 text-xs py-4 font-medium">
                                {new Date(r.period_Start).toLocaleDateString()} - <br/>{new Date(r.period_End).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-slate-600 font-semibold py-4">{r.NoDays_Worked}d / {r.NoHrs_Worked}h</TableCell>
                              <TableCell className="text-slate-700 py-4 font-mono text-[13px]">{peso(r.basicPay)}</TableCell>
                              <TableCell className="text-green-600 font-bold py-4 font-mono text-[13px]">{peso(r.totalEarnings)}</TableCell>
                              <TableCell className="text-red-500 font-bold py-4 font-mono text-[13px]">{peso(r.totalDeductions)}</TableCell>
                              <TableCell className="font-black text-slate-900 py-4 font-mono text-[13px]">{peso(r.netPay)}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={badgeStyle}>{r.statusName}</Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6 py-4">
                                <Button variant="ghost" size="icon" asChild className="text-[#2A174E] hover:bg-[#f0ebfa]">
                                  <Link title="View Payslip" to={`/adminReports/payslip/${r.payrollId}`} state={{ fromTab: activeReport }}>
                                    <ReceiptLongIcon className="h-5 w-5" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={10} className="h-24 text-center text-muted-foreground italic p-6">No payroll records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* Calendar / Corporate Events Data Table Container */}
                  {activeReport === "calendar" && (
                    <Table className="min-w-[800px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Type</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Subject / Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider pr-6">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let typeBadge = "bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px]";
                          if (r.type === "Holiday") typeBadge = "bg-purple-100 text-purple-800 font-bold uppercase tracking-wider text-[10px]";
                          else if (r.type === "Leave") typeBadge = "bg-blue-100 text-blue-800 font-bold uppercase tracking-wider text-[10px]";

                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-slate-700 px-6 py-4">{formatDateStr(r.date)}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={typeBadge}>{r.type}</Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-[#2A174E] py-4">{r.name}</TableCell>
                              <TableCell className="text-slate-600 italic pr-6 py-4">{r.details || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic p-6">No calendar events found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* Requests Audit Ledger Table Panel */}
                  {activeReport === "requests" && (
                    <Table className="min-w-[1000px] md:min-w-full">
                      <TableHeader className="bg-[#2A174E]">
                        <TableRow className="hover:bg-transparent border-b-slate-200">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">REQ ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Request Type</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date Filed</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Processed By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.length > 0 ? (
                          currentData.map((req) => (
                            <TableRow key={req.emp_reqId} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-bold text-[#2A174E] py-4 px-6">REQ-{req.emp_reqId}</TableCell>
                              <TableCell className="py-4">
                                <p className="font-semibold text-slate-800">{req.userName}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{formatUserId(req.user_Id)}</p>
                              </TableCell>
                              <TableCell className="text-slate-600 py-4 font-medium">{req.reqTypeName}</TableCell>
                              <TableCell className="text-slate-600 py-4 text-sm">{req.date_Filed}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={`font-semibold px-3 py-1 ${getStatusBadge(req.emp_reqStatusId)}`}>
                                  {req.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 text-right pr-6 font-medium text-slate-700">
                                {req.approverName || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="p-0 border-0">
                              <EmptyState
                                icon={<AssessmentOutlinedIcon className="h-8 w-8 text-slate-400" />}
                                title={isFiltering ? "No matching requests" : "Request queue empty"}
                                description={isFiltering ? "Try adjusting your filters to find specific records." : "No records currently exist in the database."}
                                action={isFiltering && (
                                  <Button variant="outline" onClick={handleClearFilters} className="text-slate-600 border-slate-200 mt-2">Clear Filters</Button>
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {/* Centralized Pagination Area */}
              {totalItems > 0 && !loading && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30 mt-auto">
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
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                    <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">{currentPage}</div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Batch ZIP Modal Overlay */}
        <Dialog open={showBatchZipModal} onOpenChange={setShowBatchZipModal}>
          <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-0 shadow-2xl">
            <div className="bg-[#2A174E] p-6 text-white flex flex-col items-center text-center">
              <div className="bg-white/10 p-4 rounded-full mb-4">
                <ShieldIcon className="h-10 w-10 text-green-400" />
              </div>
              <DialogTitle className="text-xl font-bold mb-2">Protected Batch Export</DialogTitle>
              <DialogDescription className="text-blue-100 text-sm">For security, this ZIP file will be encrypted. Please save the password below to access the documents.</DialogDescription>
            </div>

            <div className="p-8">
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">File Encryption Password</p>
                <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                  <code className="text-lg font-black text-[#2A174E] tracking-tight">{zipPassword}</code>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-[#2A174E] hover:bg-[#2A174E]/5" onClick={() => navigator.clipboard.writeText(zipPassword)}>
                    <ContentCopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 text-xs text-slate-500 bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <div className="mt-0.5">⚠️</div>
                  <p>This password is required by anyone opening the ZIP. Make sure to share it with authorized personnel only.</p>
                </div>
                <Button onClick={confirmBatchZip} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white font-bold py-6 text-base shadow-lg shadow-[#2A174E]/20">Download Protected ZIP</Button>
                <Button variant="ghost" onClick={() => setShowBatchZipModal(false)} className="w-full text-slate-400 hover:text-slate-600 font-medium">Cancel Export</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Table Scroll Bar Custom Styling */}
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
    </Sidebar>
  );
};

export default AdminReports;