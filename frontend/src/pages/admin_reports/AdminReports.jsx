import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useSystemTime } from "../../context/SystemTimeContext";
import { FileInput } from "lucide-react";
import EmptyState from "../../components/EmptyState";
import Toast from "../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "../../components/SearchableSelect";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ShieldIcon from '@mui/icons-material/Shield';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import CelebrationIcon from "@mui/icons-material/Celebration";
import MoreTimeIcon from "@mui/icons-material/MoreTime";
import GroupIcon from "@mui/icons-material/Group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

const PERIOD_OPTIONS = [
  { value: "1", label: "1st Period (1st – 15th)" },
  { value: "2", label: "2nd Period (16th – End)" }
];

// Helper to determine the ongoing/current payroll period (benchmarking Attendance)
const getCurrentCutoff = (refDate) => {
  const d = new Date(refDate || new Date());
  return {
    year: d.getFullYear().toString(),
    month: (d.getMonth() + 1).toString(),
    period: d.getDate() <= 15 ? "1" : "2"
  };
};

// Helper to determine the completed/previous payroll period (benchmarking Payroll reports)
const getPreviousCutoff = (refDate) => {
  const d = new Date(refDate || new Date());
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  if (day <= 15) {
    if (month === 1) {
      return {
        year: (year - 1).toString(),
        month: "12",
        period: "2"
      };
    } else {
      return {
        year: year.toString(),
        month: (month - 1).toString(),
        period: "2"
      };
    }
  } else {
    return {
      year: year.toString(),
      month: month.toString(),
      period: "1"
    };
  }
};

const computeCutoffDates = (yearStr, monthStr, periodStr) => {
  const isYearValid = yearStr && yearStr !== "all";
  const isMonthValid = monthStr && monthStr !== "all";
  const isPeriodValid = periodStr && periodStr !== "all";

  if (!isYearValid && !isMonthValid && !isPeriodValid) {
    return { startDate: "", endDate: "" };
  }

  const currentY = new Date().getFullYear();
  const y = isYearValid ? parseInt(yearStr, 10) : currentY;
  const pad = (n) => String(n).padStart(2, '0');

  if (isMonthValid) {
    const m = parseInt(monthStr, 10);
    if (periodStr === "1") {
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-15`
      };
    } else if (periodStr === "2") {
      const lastDay = new Date(y, m, 0).getDate();
      return {
        startDate: `${y}-${pad(m)}-16`,
        endDate: `${y}-${pad(m)}-${pad(lastDay)}`
      };
    } else {
      // Entire month (1st to last day)
      const lastDay = new Date(y, m, 0).getDate();
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay)}`
      };
    }
  }

  if (isYearValid) {
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`
    };
  }

  return { startDate: "", endDate: "" };
};

const AdminReports = () => {
  const { systemToday } = useSystemTime();
  const location = useLocation();
  const [activeReport, setActiveReport] = useState(() => location.state?.activeTab || "attendance");
  const currentSysDate = useMemo(() => systemToday || new Date(), [systemToday]);

  // Available years: current year + 1 down to 5 years past (7 years)
  const availableYears = useMemo(() => {
    const currentY = currentSysDate.getFullYear();
    return Array.from({ length: 7 }, (_, i) => (currentY + 1 - i).toString());
  }, [currentSysDate]);

  // Dynamic Cutoff Benchmarks
  const currentCutoff = useMemo(() => getCurrentCutoff(systemToday), [systemToday]);
  const previousCutoff = useMemo(() => getPreviousCutoff(systemToday), [systemToday]);

  // Tab-Isolated Filter States (Default Clear State: All Years, All Months, All Periods, All Employees)
  const [attFilters, setAttFilters] = useState({
    year: "all",
    month: "all",
    period: "all",
    employee: "All Employees"
  });

  const [payFilters, setPayFilters] = useState({
    year: "all",
    month: "all",
    period: "all",
    employee: "All Employees"
  });

  // Active filter accessors based on activeReport
  const activeFilters = activeReport === "payroll" ? payFilters : attFilters;
  const setActiveFilters = activeReport === "payroll" ? setPayFilters : setAttFilters;

  const defaultCutoffLabel = activeReport === "payroll" ? "Previous Cutoff" : "Current Cutoff";

  // Derive active cutoff dates per tab
  const attDates = useMemo(() => {
    return computeCutoffDates(attFilters.year, attFilters.month, attFilters.period);
  }, [attFilters.year, attFilters.month, attFilters.period]);

  const payDates = useMemo(() => {
    return computeCutoffDates(payFilters.year, payFilters.month, payFilters.period);
  }, [payFilters.year, payFilters.month, payFilters.period]);

  const { startDate, endDate } = activeReport === "payroll" ? payDates : attDates;
  const selectedEmployee = activeFilters.employee;
  
  // --- Calendar/Events Specific Filters ---
  const [calendarStartDate, setCalendarStartDate] = useState("");
  const [calendarEndDate, setCalendarEndDate] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("All Types");

  // --- Requests Tab Specific Filters ---
  const [searchQuery, setSearchQuery] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [toast, setToast] = useState({ message: "", type: "success" });

  const [employees, setEmployees] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_users");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [attendanceData, setAttendanceData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_report_att_data");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [payrollData, setPayrollData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_report_pay_data");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [calendarData, setCalendarData] = useState([]);
  const [requests, setRequests] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_admin_requests");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(false);



  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [payrollSummary, setPayrollSummary] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_report_pay_summary");
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [attendanceSummary, setAttendanceSummary] = useState(() => {
    try {
      const cached = sessionStorage.getItem("machip_cached_report_att_summary");
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [payrollPagination, setPayrollPagination] = useState({ total: 0, totalPages: 1 });
  const [attendancePagination, setAttendancePagination] = useState({ total: 0, totalPages: 1 });

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

  const fetchRequestsReport = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const url = requestDate 
        ? `/api/request/all?startDate=${requestDate}&endDate=${requestDate}`
        : `/api/request/all`;
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Error fetching requests report:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [requestDate]);

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

  const fetchAttendanceReport = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (attDates.startDate) params.append("startDate", attDates.startDate);
      if (attDates.endDate) params.append("endDate", attDates.endDate);
      if (attFilters.employee && attFilters.employee !== "All Employees" && attFilters.employee !== "all") {
        params.append("user_Id", attFilters.employee);
      } else {
        params.append("user_Id", "All Employees");
      }
      params.append("page", currentPage);
      params.append("limit", itemsPerPage);
      const response = await fetchWithAuth(`/api/attendance/report?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.logs)) {
          setAttendanceData(data.logs);
          try { sessionStorage.setItem("machip_cached_report_att_data", JSON.stringify(data.logs)); } catch {}
          if (data.summary) {
            setAttendanceSummary(data.summary);
            try { sessionStorage.setItem("machip_cached_report_att_summary", JSON.stringify(data.summary)); } catch {}
          }
          if (data.pagination) setAttendancePagination(data.pagination);
        } else if (Array.isArray(data)) {
          setAttendanceData(data);
          try { sessionStorage.setItem("machip_cached_report_att_data", JSON.stringify(data)); } catch {}
          setAttendancePagination({ total: data.length, totalPages: Math.ceil(data.length / itemsPerPage) || 1 });
        }
      }
    } catch (error) {
      console.error("Error fetching attendance report:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [attDates.startDate, attDates.endDate, attFilters.employee, currentPage, itemsPerPage]);

  const fetchPayrollReport = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (payDates.startDate) params.append("startDate", payDates.startDate);
      if (payDates.endDate) params.append("endDate", payDates.endDate);
      if (payFilters.employee && payFilters.employee !== "All Employees" && payFilters.employee !== "all") {
        params.append("user_Id", payFilters.employee);
      } else {
        params.append("user_Id", "All Employees");
      }
      params.append("page", currentPage);
      params.append("limit", itemsPerPage);
      const response = await fetchWithAuth(`/api/payroll/report?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.data)) {
          setPayrollData(data.data);
          try { sessionStorage.setItem("machip_cached_report_pay_data", JSON.stringify(data.data)); } catch {}
          if (data.summary) {
            setPayrollSummary(data.summary);
            try { sessionStorage.setItem("machip_cached_report_pay_summary", JSON.stringify(data.summary)); } catch {}
          }
          if (data.pagination) setPayrollPagination(data.pagination);
        } else if (Array.isArray(data)) {
          setPayrollData(data);
          try { sessionStorage.setItem("machip_cached_report_pay_data", JSON.stringify(data)); } catch {}
          setPayrollPagination({ total: data.length, totalPages: Math.ceil(data.length / itemsPerPage) || 1 });
        }
      }
    } catch (error) {
      console.error("Error fetching payroll report:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [payDates.startDate, payDates.endDate, payFilters.employee, currentPage, itemsPerPage]);

  const fetchCalendarReport = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (calendarStartDate) params.append("startDate", calendarStartDate);
      if (calendarEndDate) params.append("endDate", calendarEndDate);
      params.append("user_Id", "All Employees");
      const response = await fetchWithAuth(`/api/request/report/calendar?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data);
      }
    } catch (error) {
      console.error("Error fetching calendar report:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [calendarStartDate, calendarEndDate]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (activeReport === "attendance") fetchAttendanceReport();
    else if (activeReport === "payroll") fetchPayrollReport();
    else if (activeReport === "calendar") fetchCalendarReport();
    else if (activeReport === "requests") fetchRequestsReport();
  }, [activeReport, fetchAttendanceReport, fetchPayrollReport, fetchCalendarReport, fetchRequestsReport]);

  // Real-time synchronization when RFID/Biometric scans or approvals occur
  useEffect(() => {
    const handleDataRefresh = () => {
      if (activeReport === "attendance") fetchAttendanceReport(true);
      else if (activeReport === "payroll") fetchPayrollReport(true);
      else if (activeReport === "calendar") fetchCalendarReport(true);
      else if (activeReport === "requests") fetchRequestsReport(true);
    };
    window.addEventListener("dataRefresh", handleDataRefresh);
    return () => window.removeEventListener("dataRefresh", handleDataRefresh);
  }, [activeReport, fetchAttendanceReport, fetchPayrollReport, fetchCalendarReport, fetchRequestsReport]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveReport(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeReport,
    attDates.startDate,
    attDates.endDate,
    attFilters.employee,
    payDates.startDate,
    payDates.endDate,
    payFilters.employee,
    calendarStartDate,
    calendarEndDate,
    eventTypeFilter,
    requestDate,
    searchQuery,
    typeFilter,
    statusFilter,
    itemsPerPage
  ]);

  const handleResetToDefaultCutoff = () => {
    if (activeReport === "payroll") {
      setPayFilters({
        year: previousCutoff.year,
        month: previousCutoff.month,
        period: previousCutoff.period,
        employee: "All Employees"
      });
    } else {
      setAttFilters({
        year: currentCutoff.year,
        month: currentCutoff.month,
        period: currentCutoff.period,
        employee: "All Employees"
      });
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    if (activeReport === "attendance" || activeReport === "payroll") {
      setActiveFilters({
        year: "all",
        month: "all",
        period: "all",
        employee: "All Employees"
      });
    } else if (activeReport === "calendar") {
      setCalendarStartDate("");
      setCalendarEndDate("");
      setEventTypeFilter("All Types");
    } else if (activeReport === "requests") {
      setSearchQuery("");
      setRequestDate("");
      setTypeFilter("All Types");
      setStatusFilter("All Statuses");
    }
    setCurrentPage(1);
  };

  const isFiltering = useMemo(() => {
    if (activeReport === "attendance" || activeReport === "payroll") {
      return Boolean(
        activeFilters.year !== "all" ||
        activeFilters.month !== "all" ||
        activeFilters.period !== "all" ||
        (activeFilters.employee && activeFilters.employee !== "All Employees" && activeFilters.employee !== "all")
      );
    }
    if (activeReport === "calendar") {
      return Boolean(
        calendarStartDate !== "" ||
        calendarEndDate !== "" ||
        (eventTypeFilter && eventTypeFilter !== "All Types" && eventTypeFilter !== "all")
      );
    }
    if (activeReport === "requests") {
      return Boolean(
        searchQuery !== "" ||
        requestDate !== "" ||
        (typeFilter && typeFilter !== "All Types" && typeFilter !== "all") ||
        (statusFilter && statusFilter !== "All Statuses" && statusFilter !== "all")
      );
    }
    return false;
  }, [
    activeReport,
    activeFilters,
    previousCutoff,
    currentCutoff,
    calendarStartDate,
    calendarEndDate,
    eventTypeFilter,
    searchQuery,
    requestDate,
    typeFilter,
    statusFilter
  ]);

  const handleCSVExport = () => {
    let dataToExport = [];
    const dateRangeTag = activeReport === "calendar"
      ? (calendarStartDate && calendarEndDate ? `${calendarStartDate}_to_${calendarEndDate}` : "all")
      : (startDate && endDate ? `${startDate}_to_${endDate}` : "all");
    let filename = `${activeReport}_report_${dateRangeTag}.csv`;

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
    const dateRangeTag = activeReport === "calendar"
      ? (calendarStartDate && calendarEndDate ? `${calendarStartDate}_to_${calendarEndDate}` : "all")
      : (startDate && endDate ? `${startDate}_to_${endDate}` : "all");
    let filename = `${activeReport}_report_${dateRangeTag}.pdf`;
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
    } else if (activeReport === "requests") {
      orientation = "l";
      headers = ["REQ ID", "Employee", "Type", "Filed", "Status", "Processed By"];
      dataToExport = filteredRequests.map(req => [
        `REQ-${req.emp_reqId}`,
        `${req.userName} (${formatUserId(req.user_Id)})`,
        req.reqTypeName,
        req.date_Filed,
        req.status,
        req.approverName || "—"
      ]);
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
    if (!startDate || !endDate) {
      setToast({ message: "Please select a specific Year, Month, and Period before batch exporting ZIP payslips.", type: "error" });
      return;
    }
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const month = new Date(sY, sM - 1, sD).toLocaleString('en-US', { month: 'long' });
    const label = `${month}${String(sD).padStart(2, '0')}-${String(eD).padStart(2, '0')}`;
    const periodCode = `${sY}_${String(sM).padStart(2, '0')}${String(sD).padStart(2, '0')}-${String(eD).padStart(2, '0')}MAChipPayroll`;
    
    setZipPassword(periodCode);
    setZipLabel(label);
    setShowBatchZipModal(true);
  };

  // --- WORKFORCE & FINANCIAL KPI CALCULATIONS ---
  const attKpi = useMemo(() => {
    const totalShifts = attendanceData.length;
    let onTimeCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let undertimeCount = 0;
    let totalHours = 0;
    let totalOtHours = 0;
    let otShiftsCount = 0;

    attendanceData.forEach(curr => {
      const s = (curr.status || "").toLowerCase();
      if (s.includes("on time") || s.includes("ontime") || s.includes("on-field") || s.includes("present") || s.includes("exempt")) {
        onTimeCount++;
      } else if (s.includes("late")) {
        lateCount++;
      } else if (s.includes("absent")) {
        absentCount++;
      } else if (s.includes("undertime") || s.includes("half day")) {
        undertimeCount++;
      }

      const hrs = parseFloat(curr.hoursWorked) || 0;
      totalHours += hrs;

      const otHrs = parseFloat(curr.ot_hrs) || 0;
      if (otHrs > 0) {
        totalOtHours += otHrs;
        otShiftsCount++;
      }
    });

    const presentShifts = onTimeCount + lateCount + undertimeCount;
    const onTimeRate = totalShifts > 0 ? ((onTimeCount / totalShifts) * 100).toFixed(1) : "0.0";
    const avgHoursPerShift = presentShifts > 0 ? (totalHours / presentShifts).toFixed(1) : (totalShifts > 0 ? (totalHours / totalShifts).toFixed(1) : "0.0");
    const infractions = lateCount + absentCount + undertimeCount;
    const infractionRate = totalShifts > 0 ? ((infractions / totalShifts) * 100).toFixed(1) : "0.0";

    return {
      totalShifts,
      onTimeCount,
      onTimeRate,
      presentShifts,
      totalHours,
      avgHoursPerShift,
      lateCount,
      absentCount,
      undertimeCount,
      infractionRate,
      totalOtHours: totalOtHours.toFixed(1),
      otShiftsCount
    };
  }, [attendanceData]);

  const payKpi = useMemo(() => {
    let totalNet = 0;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalBasic = 0;
    const employeeIds = new Set();

    payrollData.forEach(curr => {
      totalNet += parseFloat(curr.netPay) || 0;
      totalGross += parseFloat(curr.grossEarnings || curr.totalEarnings) || 0;
      totalDeductions += parseFloat(curr.totalDeductions) || 0;
      totalBasic += parseFloat(curr.potentialBasicPay || curr.basicPay) || 0;
      if (curr.user_Id) employeeIds.add(curr.user_Id);
    });

    const headcount = employeeIds.size || payrollData.length || 0;
    const deductionRatio = totalGross > 0 ? ((totalDeductions / totalGross) * 100).toFixed(1) : "0.0";
    const avgNet = headcount > 0 ? totalNet / headcount : 0;

    return {
      net: totalNet,
      gross: totalGross,
      ded: totalDeductions,
      basic: totalBasic,
      headcount,
      deductionRatio,
      avgNet
    };
  }, [payrollData]);

  const filteredCalendarData = useMemo(() => {
    return calendarData.filter(item => eventTypeFilter === "All Types" || item.type === eventTypeFilter);
  }, [calendarData, eventTypeFilter]);

  const calKpi = useMemo(() => {
    let holidays = 0;
    let leaves = 0;
    let onField = 0;
    let otherEvents = 0;

    filteredCalendarData.forEach(item => {
      const type = (item.type || "").toLowerCase();
      const details = (item.details || "").toLowerCase();
      const name = (item.name || "").toLowerCase();

      if (type.includes("holiday") || name.includes("holiday")) {
        holidays++;
      } else if (type.includes("leave") || details.includes("leave")) {
        leaves++;
      } else if (type.includes("field") || name.includes("field") || details.includes("field")) {
        onField++;
      } else {
        otherEvents++;
      }
    });

    return {
      total: filteredCalendarData.length,
      holidays,
      leaves,
      onField,
      otherEvents
    };
  }, [filteredCalendarData]);

  const filteredRequests = requests.filter(req => {
    const query = searchQuery.trim().toLowerCase();
    const reqIdStr = String(req.emp_reqId || "");
    const prefixedReqId = `req-${reqIdStr}`.toLowerCase();
    const formattedId = req.user_Id ? formatUserId(req.user_Id).toLowerCase() : "";
    const rawId = String(req.user_Id || "");
    const userName = (req.userName || "").toLowerCase();
    const typeName = (req.reqTypeName || "").toLowerCase();
    const status = (req.status || "").toLowerCase();
    const approver = (req.processedByName || req.approverName || "").toLowerCase();
    const remarks = (req.emp_reqRemarks || req.remarks || "").toLowerCase();
    const dateFiled = (req.date_Filed || "").toLowerCase();

    const matchesSearch = !query ||
      userName.includes(query) ||
      reqIdStr.includes(query) ||
      prefixedReqId.includes(query) ||
      formattedId.includes(query) ||
      rawId.includes(query) ||
      typeName.includes(query) ||
      status.includes(query) ||
      approver.includes(query) ||
      remarks.includes(query) ||
      dateFiled.includes(query);

    const matchesType = typeFilter === "All Types" || req.reqTypeName === typeFilter;
    const matchesStatus = statusFilter === "All Statuses" || req.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const reqKpi = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let returned = 0;

    requests.forEach(r => {
      if (r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4) pending++;
      else if (r.emp_reqStatusId === 2) approved++;
      else if (r.emp_reqStatusId === 3) rejected++;
      else if (r.emp_reqStatusId === 5) returned++;
    });

    const total = requests.length;
    const decided = approved + rejected;
    const approvalRate = decided > 0 ? ((approved / decided) * 100).toFixed(1) : "100.0";
    const totalProcessed = approved + rejected + returned;
    const declinedRate = totalProcessed > 0 ? (((rejected + returned) / totalProcessed) * 100).toFixed(1) : "0.0";
    const throughputRate = total > 0 ? (((approved + rejected) / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      pending,
      approved,
      rejected,
      returned,
      decided,
      approvalRate,
      declinedRate,
      throughputRate,
      totalResolved: approved + rejected
    };
  }, [requests]);

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeData = activeReport === "attendance" 
    ? attendanceData 
    : activeReport === "payroll" 
      ? payrollData 
      : activeReport === "calendar" 
        ? filteredCalendarData 
        : filteredRequests;

  const totalItems = activeReport === "attendance" 
    ? attendancePagination.total 
    : activeReport === "payroll" 
      ? payrollPagination.total 
      : activeData.length;

  const totalPages = activeReport === "attendance" 
    ? attendancePagination.totalPages 
    : activeReport === "payroll" 
      ? payrollPagination.totalPages 
      : Math.ceil(totalItems / itemsPerPage) || 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // For attendance and payroll, data is already sliced to current page rows by server
  const currentData = (activeReport === "attendance" || activeReport === "payroll")
    ? activeData
    : activeData.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Reports & Analytics</h1>
                <span className="text-sm text-slate-500 mt-1 block">Generate, analyze, and export system attendance and payroll data.</span>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                {/* <Button onClick={handleCSVExport} variant="outline" className="w-full md:w-auto border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-sm">
                  <FileInput className="mr-2 h-4 w-4 text-slate-500" /> Export CSV
                </Button> */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handlePDFExport} className="w-full md:w-auto bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm">
                      <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Export current report data to PDF format
                  </TooltipContent>
                </Tooltip>
                {activeReport === "payroll" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleBatchExport} disabled={payrollData.length === 0 || loading} className="w-full md:w-auto bg-green-600 text-white hover:bg-green-700 shadow-sm">
                        <ReceiptLongIcon className="mr-2 h-4 w-4" /> Batch ZIP Payslips
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Batch download protected employee payslips in a ZIP archive
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

          {/* Navigation Tabs */}
          <Tabs value={activeReport} onValueChange={(val) => setActiveReport(val)} className="w-full mb-6">
          {/* TabsList container matches your layout switcher backgrounds perfectly */}
          <TabsList className="grid grid-cols-1 sm:grid-cols-4 h-auto sm:h-11 bg-slate-200/60 rounded-lg p-0.5 gap-1 sm:gap-0 shrink-0">
            
            {/* Attendance Report Tab */}
            <TabsTrigger 
              value="attendance" 
              className="text-xs font-semibold text-slate-500 transition-all rounded-md
                data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm 
                hover:text-slate-700"
            >
              <AssessmentIcon className="mr-2 h-4 w-4 shrink-0" /> 
              <span>Attendance Report</span>
            </TabsTrigger>

            {/* Payroll Report Tab */}
            <TabsTrigger 
              value="payroll" 
              className="text-xs font-semibold text-slate-500 transition-all rounded-md
                data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm 
                hover:text-slate-700"
            >
              <PaymentsIcon className="mr-2 h-4 w-4 shrink-0" /> 
              <span>Payroll Report</span>
            </TabsTrigger>

            {/* Calendar / Events Tab */}
            <TabsTrigger 
              value="calendar" 
              className="text-xs font-semibold text-slate-500 transition-all rounded-md
                data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm 
                hover:text-slate-700"
            >
              <CalendarMonthIcon className="mr-2 h-4 w-4 shrink-0" /> 
              <span>Calendar / Events</span>
            </TabsTrigger>

            {/* Requests Tab */}
            <TabsTrigger 
              value="requests" 
              className="text-xs font-semibold text-slate-500 transition-all rounded-md
                data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-sm 
                hover:text-slate-700"
            >
              <FileInput className="mr-2 h-4 w-4 shrink-0" /> 
              <span>Requests</span>
            </TabsTrigger>

          </TabsList>
        </Tabs>

          {/* Statistics Display Grid Area */}
          <div className="w-full animate-in fade-in zoom-in-95 duration-200">
            {/* ATTENDANCE REPORT KPIS */}
            {activeReport === "attendance" && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
                {/* Card 1: On-Time Compliance */}
                <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Compliance</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Percentage of recorded employee shifts completed on time without tardiness.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-brand-primary">{attKpi.onTimeRate}</span>
                          <span className="text-xl font-bold text-brand-primary/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-brand-primary/70 italic mt-4">
                        {attKpi.onTimeCount} on-time of {attKpi.totalShifts} shifts
                      </p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <CheckCircleOutlineIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Avg Hours / Shift */}
                <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Avg Hours / Shift</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Average daily hours rendered per present employee (standard benchmark: 8.0 hrs/day).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-accent-green">{attKpi.avgHoursPerShift}</span>
                          <span className="text-lg opacity-80 font-bold text-accent-green">hrs</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-green/70 italic mt-4">
                        Total rendered: {attKpi.totalHours.toFixed(1)} hrs
                      </p>
                    </div>
                    <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <AccessTimeIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Infraction Rate */}
                <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Infraction Rate</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Percentage of work records containing Late, Absent, or Undertime infractions.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-accent-gold">{attKpi.infractionRate}</span>
                          <span className="text-xl font-bold text-accent-gold/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-gold/70 italic mt-4">
                        {attKpi.lateCount} Late, {attKpi.absentCount} Absent
                      </p>
                    </div>
                    <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <AssignmentLateIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Overtime Volume */}
                <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Overtime Volume</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Total approved overtime hours rendered across the workforce in this period.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-status-danger">{attKpi.totalOtHours}</span>
                          <span className="text-lg opacity-80 font-bold text-status-danger">hrs</span>
                        </div>
                      </div>
                      <p className="text-xs text-status-danger/70 italic mt-4">
                        {attKpi.otShiftsCount} shifts with approved OT
                      </p>
                    </div>
                    <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <MoreTimeIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PAYROLL REPORT KPIS */}
            {activeReport === "payroll" && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
                {/* Card 1: Total Net Disbursement */}
                <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Net Disbursement</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Sum of take-home pay distributed to employees after all deductions.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-3xl font-bold text-brand-primary">{peso(payKpi.net)}</p>
                      </div>
                      <p className="text-xs text-brand-primary/70 italic mt-4">
                        {payKpi.headcount} employees paid in payload
                      </p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <PaymentsIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Gross Labor Cost */}
                <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Gross Labor Cost</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Sum of gross wages (including Basic, OT, Night Diff, and Holiday pay) before deductions.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-3xl font-bold text-accent-green">{peso(payKpi.gross)}</p>
                      </div>
                      <p className="text-xs text-accent-green/70 italic mt-4">
                        Base pay: {peso(payKpi.basic)}
                      </p>
                    </div>
                    <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <KeyboardDoubleArrowUpIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Deduction Burden */}
                <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Deduction Burden</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Percentage of gross earnings withheld for taxes, statutory contributions, and loans.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-accent-gold">{payKpi.deductionRatio}</span>
                          <span className="text-xl font-bold text-accent-gold/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-gold/70 italic mt-4">
                        {peso(payKpi.ded)} total withholdings
                      </p>
                    </div>
                    <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <KeyboardDoubleArrowDownIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Avg Take-Home Pay */}
                <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Avg Take-Home Pay</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Average net take-home compensation per employee across this period.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-3xl font-bold text-status-danger">{peso(payKpi.avgNet)}</p>
                      </div>
                      <p className="text-xs text-status-danger/70 italic mt-4">
                        Per-employee net salary average
                      </p>
                    </div>
                    <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <GroupIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div> 
            )}

            {/* CALENDAR & SHIFTS REPORT KPIS */}
            {activeReport === "calendar" && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
                {/* Card 1: Active Schedule Entries */}
                <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Schedule Entries</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Total corporate events, holidays, and employee leave entries active in this window.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold text-brand-primary">{calKpi.total}</span>
                          <span className="text-sm font-semibold text-brand-primary/60">Events</span>
                        </div>
                      </div>
                      <p className="text-xs text-brand-primary/70 italic mt-4">
                        Active entries in selected date window
                      </p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <EventNoteIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Holidays in Window */}
                <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Holidays in Window</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Official Philippine regular and special non-working public holidays in window.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold text-accent-green">{calKpi.holidays}</span>
                          <span className="text-sm font-semibold text-accent-green/60">Days</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-green/70 italic mt-4">
                        Philippine recognized public holidays
                      </p>
                    </div>
                    <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <CelebrationIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Employee Leaves */}
                <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Employee Leaves</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Total scheduled employee leaves (Vacation, Sick, Emergency, Statutory) active in this range.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold text-accent-gold">{calKpi.leaves}</span>
                          <span className="text-sm font-semibold text-accent-gold/60">Filings</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-gold/70 italic mt-4">
                        Approved scheduled employee absences
                      </p>
                    </div>
                    <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <CalendarMonthIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Field Deployments */}
                <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Field Deployments</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Approved on-field operations and off-site client assignments active in this window.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold text-status-danger">{calKpi.onField}</span>
                          <span className="text-sm font-semibold text-status-danger/60">Missions</span>
                        </div>
                      </div>
                      <p className="text-xs text-status-danger/70 italic mt-4">
                        Official off-site work assignments
                      </p>
                    </div>
                    <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <FlightTakeoffIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* REQUESTS & LEAVES REPORT KPIS */}
            {activeReport === "requests" && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
                {/* Card 1: Pending Review */}
                <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Pending Review</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Total number of requests currently pending recommendation or authorization.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold text-brand-primary">{reqKpi.pending}</span>
                          <span className="text-sm font-semibold text-brand-primary/60">Tickets</span>
                        </div>
                      </div>
                      <p className="text-xs text-brand-primary/70 italic mt-4">
                        Awaiting supervisory/admin review
                      </p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <AccessTimeIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Approval Compliance */}
                <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Approval Rate</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Processing compliance percentage of evaluated requests approved without rejection.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-accent-green">{reqKpi.approvalRate}</span>
                          <span className="text-xl font-bold text-accent-green/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-green/70 italic mt-4">
                        {reqKpi.approved} approved of {reqKpi.decided} decided
                      </p>
                    </div>
                    <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <CheckCircleOutlineIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Declined & Returned */}
                <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Declined & Returned</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Rate of requests declined or returned for policy, attachment, or balance deficits.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-accent-gold">{reqKpi.declinedRate}</span>
                          <span className="text-xl font-bold text-accent-gold/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-accent-gold/70 italic mt-4">
                        {reqKpi.rejected} Rejected, {reqKpi.returned} Returned
                      </p>
                    </div>
                    <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <CancelOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Resolution Throughput */}
                <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Resolution Rate</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Percentage of total filed requests that have been evaluated and closed.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-4xl font-bold text-status-danger">{reqKpi.throughputRate}</span>
                          <span className="text-xl font-bold text-status-danger/80">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-status-danger/70 italic mt-4">
                        {reqKpi.totalResolved} of {reqKpi.total} tickets resolved
                      </p>
                    </div>
                    <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start ml-2">
                      <AssessmentIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Tab-Isolated Filters */}
          <Card className="mb-6 mt-6 shadow-sm border-0 bg-white py-0 overflow-visible relative z-30">
            <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between overflow-visible">
              
              <div className="flex items-center gap-2 font-bold text-slate-700 w-full xl:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5" /> Filters
              </div>

              {/* FILTER VIEW 1: Attendance & Payroll (Year, Month, Period, Employee) */}
              {(activeReport === "attendance" || activeReport === "payroll") && (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-wrap">
                  {/* Year Selection */}
                  <div className="w-full sm:w-[130px]">
                    <SearchableSelect
                      searchable={false}
                      value={activeFilters.year}
                      onChange={(val) => setActiveFilters(prev => ({ ...prev, year: val }))}
                      options={[
                        { value: "all", label: "All Years" },
                        ...availableYears.map(year => ({
                          value: year.toString(),
                          label: year.toString()
                        }))
                      ]}
                      placeholder="All Years"
                    />
                  </div>

                  {/* Month Selection */}
                  <div className="w-full sm:w-[140px]">
                    <SearchableSelect
                      searchable={false}
                      value={activeFilters.month}
                      onChange={(val) => setActiveFilters(prev => ({ ...prev, month: val }))}
                      options={[
                        { value: "all", label: "All Months" },
                        ...MONTHS.map(m => ({
                          value: m.value,
                          label: m.label
                        }))
                      ]}
                      placeholder="All Months"
                    />
                  </div>

                  {/* Period Selection (1st or 2nd) */}
                  <div className="w-full sm:w-[180px]">
                    <SearchableSelect
                      searchable={false}
                      value={activeFilters.period}
                      onChange={(val) => setActiveFilters(prev => ({ ...prev, period: val }))}
                      options={[
                        { value: "all", label: "All Periods" },
                        ...PERIOD_OPTIONS.map(p => ({
                          value: p.value,
                          label: p.label
                        }))
                      ]}
                      placeholder="All Periods"
                    />
                  </div>

                  {/* Employee Selection */}
                  <div className="w-full sm:w-[220px]">
                    <SearchableSelect
                      options={[
                        { value: "All Employees", label: "All Employees" },
                        ...employees.map(emp => ({
                          value: emp.user_Id.toString(),
                          label: `${emp.user_LastName}, ${emp.user_FirstName}`,
                          sublabel: formatUserId(emp.user_Id)
                        }))
                      ]}
                      value={activeFilters.employee}
                      onChange={(val) => setActiveFilters(prev => ({ ...prev, employee: val }))}
                      placeholder="All Employees"
                      searchPlaceholder="Filter employee..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {isFiltering && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearFilters} 
                        className="text-slate-500 hover:text-red-600 font-semibold h-9 gap-1 transition-colors"
                      >
                        <CloseIcon className="h-4 w-4" /> Clear Filters
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleResetToDefaultCutoff}
                      className="border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 font-semibold h-9 gap-1 transition-colors text-xs"
                    >
                      {defaultCutoffLabel}
                    </Button>
                  </div>
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
                      placeholder="Search by Employee, REQ ID, type, or status..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 border-slate-200 focus-visible:ring-brand-primary w-full bg-slate-50"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      value={requestDate} 
                      onChange={(e) => setRequestDate(e.target.value)} 
                      className="w-full sm:w-[150px] h-9 border-slate-200 bg-slate-50 text-slate-700 font-medium" 
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
                      <TableHeader className="bg-brand-primary">
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
                          const sNorm = (r.status || "").toLowerCase().replace(/[^a-z]/g, "");
                          let badgeStyle = "bg-slate-100 text-slate-800 font-bold";
                          if (sNorm === "ontime" || sNorm === "present" || sNorm === "exempt") badgeStyle = "bg-green-100 text-green-800 font-bold";
                          else if (sNorm === "late") badgeStyle = "bg-amber-100 text-amber-800 font-bold";
                          else if (sNorm === "absent") badgeStyle = "bg-red-100 text-red-800 font-bold";

                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-brand-primary-semi-dark px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
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
                      <TableHeader className="bg-brand-primary">
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
                              <TableCell className="font-bold text-brand-primary px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" asChild className="text-brand-primary hover:bg-brand-primary-light">
                                      <Link to={`/adminReports/payslip/${r.payrollId}`} state={{ fromTab: activeReport }}>
                                        <ReceiptLongIcon className="h-5 w-5" />
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                    View Payslip details
                                  </TooltipContent>
                                </Tooltip>
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
                      <TableHeader className="bg-brand-primary">
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
                              <TableCell className="font-semibold text-brand-primary py-4">{r.name}</TableCell>
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
                      <TableHeader className="bg-brand-primary">
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
                              <TableCell className="font-bold text-brand-primary py-4 px-6">REQ-{req.emp_reqId}</TableCell>
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
                itemLabel="records"
              />
            </CardContent>
          </Card>
        </div>

        {/* Batch ZIP Modal Overlay */}
        <Dialog open={showBatchZipModal} onOpenChange={setShowBatchZipModal}>
          <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-0 shadow-2xl">
            <div className="bg-brand-primary p-6 text-white flex flex-col items-center text-center">
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
                  <code className="text-lg font-black text-brand-primary tracking-tight">{zipPassword}</code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5" onClick={() => navigator.clipboard.writeText(zipPassword)}>
                        <ContentCopyIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Copy password to clipboard
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 text-xs text-slate-500 bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <div className="mt-0.5">⚠️</div>
                  <p>This password is required by anyone opening the ZIP. Make sure to share it with authorized personnel only.</p>
                </div>
                <Button onClick={confirmBatchZip} className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-6 text-base shadow-lg shadow-brand-primary/20">Download Protected ZIP</Button>
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
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
      </TooltipProvider>
    </Sidebar>
  );
};

export default AdminReports;