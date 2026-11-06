import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";
import { EyeIcon, SquarePen } from "lucide-react";  

// Icons
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from '@mui/icons-material/Close';
import AssessmentIcon  from "@mui/icons-material/Assessment";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "recharts";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";

const formatDateStr = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

const Logs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view") === "day" ? "day" : (searchParams.get("view") === "visitor" ? "visitor" : "raw");
  const { systemToday } = useSystemTime();
  const [viewMode, setViewMode] = useState(initialView); // "raw", "day", or "visitor"
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  

  // New Filter States
const [filterDate, setFilterDate] = useState(""); // Specific date (YYYY-MM-DD)
const [startTime, setStartTime] = useState(""); // Start time (HH:mm)
const [endTime, setEndTime] = useState("");     // End time (HH:mm)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all"); 
  const [statusFilter, setStatusFilter] = useState("All");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const getCurrentPeriod = useCallback((baseDate) => {
    const today = baseDate || new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let startDate, endDate;
    if (date <= 15) {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month, 15);
    } else {
      startDate = new Date(year, month, 16);
      endDate = new Date(year, month + 1, 0);
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return {
      startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
      endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
    };
  }, []);

  const [logData, setLogData] = useState([]);
  const [dayLogsData, setDayLogsData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'log_Date', direction: 'desc' });
  
  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminOrAccountant = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  const systemDateKey = systemToday?.toDateString() || "";
  const period = useMemo(() => {
    // Lock period strictly to the current active payroll period based on system time
    return getCurrentPeriod(systemToday);
  }, [systemDateKey, systemToday, getCurrentPeriod]);

  const [users, setUsers] = useState([]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUser, statusFilter, itemsPerPage, viewMode]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedUser("all");
    setStatusFilter("All");
    setFilterDate("");
    setStartTime("");
    setEndTime("");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || selectedUser !== "all" || statusFilter !== "All" || filterDate !== "" || startTime !== "" || endTime !== "";

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  // Fetch all logs from the backend (raw)
  const fetchLogs = useCallback(async () => {
    try {
      // Always fetch the whole period to allow period-wide stats in the cards
      const start = period.startDate;
      const end = period.endDate;
      const response = await fetchWithAuth(`/api/attendance/all?startDate=${start}&endDate=${end}`);
      if (response.ok) {
        const logs = await response.json();
        const mapped = logs.map((log) => {
          const u_Id = log.user_Id ?? log.user_id;
          const firstName = log.user_FirstName ?? "";
          const lastName = log.user_LastName ?? "";
          const fullName = `${firstName} ${lastName}`.trim();

          const rawStatusName = log.loggedStatusName ?? "—";
          let displayType = rawStatusName;
          if (log.attendance_StatusId === 8 || log.attendanceStatusName === "Irregular") {
            displayType = rawStatusName?.startsWith("Irregular") 
              ? rawStatusName 
              : `Irregular ${[1, 3, 5, 10].includes(log.logged_StatusId) ? "Clock In" : "Clock Out"}`;
          } else if (rawStatusName === "Morning IN") {
            displayType = "Clock In";
          } else if (rawStatusName === "Morning OUT") {
            displayType = "Clock Out";
          }

          return {
              user_loggingId: log.user_loggingId,
              user_Id: u_Id,
              user_Id_formatted: formatUserId(u_Id),
              first_name: firstName || "—",
              last_name: lastName || "—",
              fullName: fullName || "—",
              machip_id: log.user_MachipId || "—",
              log_Date: log.log_Date ? String(log.log_Date).split('T')[0] : "—",
              time: formatTime12h(log.time_Logged),
              log_type: displayType,
              raw_log_type: rawStatusName,
              action: log.attendanceStatusName ?? "—",
              attendance_StatusId: log.attendance_StatusId,
              logged_StatusId: log.logged_StatusId,
            };
        });
        setLogData(mapped);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, [period.startDate, period.endDate]);

  // Fetch day logs
  const fetchDayLogs = useCallback(async () => {
    try {
      const start = period.startDate;
      const end = period.endDate;
      let url = `/api/attendance/report?startDate=${start}&endDate=${end}`;
      if (selectedUser !== "all") url += `&user_Id=${selectedUser}`;
      else url += `&user_Id=All Employees`;

      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        const actualLogs = Array.isArray(data) ? data : (data.logs || []);
        const mapped = actualLogs.map(d => ({
          ...d,
          log_Date: String(d.log_Date).split('T')[0]
        }));
        setDayLogsData(mapped);
      }
    } catch (error) {
      console.error("Error fetching day logs:", error);
    }
  }, [period.startDate, period.endDate, selectedUser]);

  // Load logs on mount and start polling/listening
  useEffect(() => {
    fetchUsers();
    
    const handleRefresh = () => {
      if (viewMode === "raw") fetchLogs();
      else fetchDayLogs();
    };

    if (viewMode === "raw") {
      fetchLogs();
      // Socket.io instantly triggers dataRefresh on new card taps.
      // 30s background fallback only runs if the browser tab is active.
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") fetchLogs();
      }, 30000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    } else {
      fetchDayLogs();
      fetchLogs(); // Pre-load raw logs to calculate system-generated counts
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") fetchDayLogs();
      }, 45000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    }
  }, [fetchLogs, fetchUsers, fetchDayLogs, viewMode, period.startDate, period.endDate]);

  const handleGenerateLogs = async (forcedStatus) => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        "/api/attendance/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcedStatus, user_Id: selectedUser }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setToast({ message: data.message || "Attendance marked successfully!", type: "success" });
        if (viewMode === "raw") await fetchLogs();
        else await fetchDayLogs();
      } else {
        setToast({ message: data.error || "Failed to mark attendance. Please try again.", type: "error" });
      }
    } catch (err) {
      console.error("Error marking attendance:", err);
      setToast({ message: "Could not connect to the server. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ------------------ FILTERING & PAGINATION LOGIC ------------------

  // 1. Filter Raw Data
  const filteredRawData = logData.filter((item) => {
    // Date Filter - Ensure consistent string format for comparison (YYYY-MM-DD)
    let matchesDate = true;
    if (filterDate) {
      // Assuming item.log_Date might be "2024-05-21" or "2024-05-21T00:00:00.000Z"
      const itemDateStr = String(item.log_Date).split('T')[0];
      matchesDate = itemDateStr === filterDate;
    }

    // Time Range Filter Logic
    let matchesTime = true;
    if (startTime || endTime) {
      // Helper to convert "08:30 AM" to "08:30" (24h)
      const convertTo24h = (timeStr) => {
        if (!timeStr || timeStr === "—") return null;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      };

      const logTime24 = convertTo24h(item.time);
      
      if (logTime24) {
        const startMatch = !startTime || logTime24 >= startTime;
        const endMatch = !endTime || logTime24 <= endTime;
        matchesTime = startMatch && endMatch;
      } else {
        matchesTime = false;
      }
  }

    const query = searchQuery.toLowerCase().trim();
    const formattedId = item.user_Id ? formatUserId(item.user_Id).toLowerCase() : "";
    const rawId = String(item.user_Id || "");
    const dateStr = item.log_Date ? String(item.log_Date).split('T')[0] : "";
    const formattedDate = item.log_Date ? new Date(item.log_Date).toLocaleDateString().toLowerCase() : "";
    const timeStr = (item.time || "").toLowerCase();

    const matchesSearch = !query ||
      item.user_Id_formatted?.toLowerCase().includes(query) ||
      formattedId.includes(query) ||
      rawId.includes(query) ||
      item.fullName?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.log_type?.toLowerCase().includes(query) ||
      item.raw_log_type?.toLowerCase().includes(query) ||
      item.machip_id?.toLowerCase().includes(query) ||
      dateStr.includes(query) ||
      formattedDate.includes(query) ||
      timeStr.includes(query);

    const matchesUser = selectedUser === "all" || item.user_Id?.toString() === selectedUser;
    
    let matchesStatus = true;
    if (statusFilter !== "All") {
      const filterLower = statusFilter.toLowerCase();
      if (filterLower === "irregular") {
        matchesStatus = item.action?.toLowerCase() === "irregular" || 
                        item.attendance_StatusId === 8 || 
                        item.log_type?.toLowerCase().includes("irregular");
      } else if (filterLower === "system" || filterLower === "system generated") {
        matchesStatus = item.log_type?.toLowerCase().includes("system") || 
                        item.raw_log_type?.toLowerCase().includes("system") ||
                        item.logged_StatusId === 7;
      } else if (filterLower === "clock in" || filterLower === "in") {
        matchesStatus = item.log_type?.toLowerCase().includes("in") || 
                        [1, 3, 5, 10].includes(item.logged_StatusId);
      } else if (filterLower === "clock out" || filterLower === "out") {
        matchesStatus = item.log_type?.toLowerCase().includes("out") || 
                        [2, 4, 6, 11].includes(item.logged_StatusId);
      } else if (filterLower === "morning in" || filterLower === "manual") {
        matchesStatus = item.raw_log_type === "Morning IN" || 
                        item.logged_StatusId === 1 || 
                        item.log_type === "Clock In";
      } else if (filterLower === "morning out" || filterLower === "manual_out") {
        matchesStatus = item.raw_log_type === "Morning OUT" || 
                        item.logged_StatusId === 2 || 
                        item.log_type === "Clock Out";
      } else if (filterLower === "afternoon in") {
        matchesStatus = item.raw_log_type === "Afternoon IN" || item.logged_StatusId === 3;
      } else if (filterLower === "afternoon out") {
        matchesStatus = item.raw_log_type === "Afternoon OUT" || item.logged_StatusId === 4;
      } else {
        matchesStatus = item.log_type?.toLowerCase().includes(filterLower) ||
                        item.raw_log_type?.toLowerCase().includes(filterLower);
      }
    }

    return matchesSearch && matchesUser && matchesStatus && matchesDate && matchesTime;
  });

  // 2. Filter & Sort Day Data
  // 2. Filter & Sort Day Data
const sortedAndFilteredDayLogs = useMemo(() => {
  let sortableItems = [...dayLogsData];
  
  // Sorting logic remains the same
  if (sortConfig !== null) {
    sortableItems.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'log_Date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  const query = searchQuery.toLowerCase().trim();

  return sortableItems.filter((item) => {
    // Basic Search & Status Filters
    const formattedId = item.user_Id ? formatUserId(item.user_Id).toLowerCase() : "";
    const rawId = String(item.user_Id || "");
    const userName = (item.userName || "").toLowerCase();
    const statusStr = (item.status || "").toLowerCase();
    const dateStr = item.log_Date ? String(item.log_Date).split('T')[0] : "";
    const formattedDate = item.log_Date ? new Date(item.log_Date).toLocaleDateString().toLowerCase() : "";
    const amIn = (item.morningIn || "").toLowerCase();
    const amOut = (item.morningOut || "").toLowerCase();
    const pmIn = (item.afternoonIn || "").toLowerCase();
    const pmOut = (item.afternoonOut || "").toLowerCase();

    const matchesSearch = !query ||
      userName.includes(query) ||
      rawId.includes(query) ||
      formattedId.includes(query) ||
      statusStr.includes(query) ||
      dateStr.includes(query) ||
      formattedDate.includes(query) ||
      amIn.includes(query) ||
      amOut.includes(query) ||
      pmIn.includes(query) ||
      pmOut.includes(query);
    
    const matchesStatus = statusFilter === "All" || item.status?.toLowerCase().includes(statusFilter.toLowerCase());

    // --- NEW: Temporal Filters ---

    // 1. Specific Date Filter
    // Format the log_Date (ISO) to YYYY-MM-DD for comparison
    let matchesDate = true;
    if (filterDate) {
      const itemDateStr = String(item.log_Date).split('T')[0];
      matchesDate = itemDateStr === filterDate;
    }

    // 2. Time Range Filter (Applied to 'Morning In')
    let matchesTime = true;
    if (startTime || endTime) {
      const convertTo24h = (timeStr) => {
        if (!timeStr || timeStr === "—") return null;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
        return `${hours.padStart(2, '0')}:${minutes}`;
      };

      const amIn24 = convertTo24h(item.morning_In);
      
      if (amIn24) {
        const startMatch = !startTime || amIn24 >= startTime;
        const endMatch = !endTime || amIn24 <= endTime;
        matchesTime = startMatch && endMatch;
      } else {
        // If they haven't clocked in yet and a time filter is set, hide the record
        matchesTime = false;
      }
    }

    return matchesSearch && matchesStatus && matchesDate && matchesTime;
  });
}, [dayLogsData, sortConfig, searchQuery, statusFilter, filterDate, startTime, endTime]); // Ensure dependencies are updated

  // 3. Unify Active Data
  const activeData = viewMode === "raw" ? filteredRawData : sortedAndFilteredDayLogs;
  
  // 4. Pagination
  const totalItems = activeData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = activeData.slice(startIndex, endIndex);

  // ------------------ STATISTICS & KPI CALCULATION ------------------
  const kpiStats = useMemo(() => {
    if (viewMode === "raw") {
      let data = logData;
      if (selectedUser !== "all") {
        data = data.filter(l => String(l.user_Id) === String(selectedUser));
      }
      if (filterDate) {
        data = data.filter(l => String(l.log_Date).split('T')[0] === filterDate);
      }

      const totalLogs = data.length;
      const inLogs = data.filter(l => l.log_type?.toLowerCase().includes("in") || [1, 3, 5, 10].includes(l.logged_StatusId));
      const distinctUsers = new Set(data.map(l => l.user_Id).filter(Boolean)).size || 1;
      const distinctDays = new Set(data.map(l => l.log_Date).filter(Boolean)).size || 1;

      // 1. Avg Punches / Employee
      const avgPunches = totalLogs > 0 
        ? (selectedUser !== "all" ? (totalLogs / distinctDays).toFixed(1) : (totalLogs / distinctUsers).toFixed(1))
        : "0.0";
      const card1Subtitle = totalLogs === 0 
        ? "No event scans recorded" 
        : (selectedUser !== "all"
          ? `Avg scans/day across ${distinctDays} ${distinctDays === 1 ? 'day' : 'days'}`
          : `${totalLogs} scans across ${distinctUsers} active ${distinctUsers === 1 ? 'employee' : 'employees'}`);

      // 2. Clock-In Compliance Rate
      const onTimeIn = inLogs.filter(l => l.action === "On Time" || l.action === "On-Field" || l.action === "Present" || l.action === "Exempt").length;
      const compliancePct = inLogs.length > 0 ? ((onTimeIn / inLogs.length) * 100).toFixed(1) : "0.0";
      const card2Subtitle = inLogs.length === 0
        ? "0 clock-in scans in this period"
        : `${onTimeIn} on-time of ${inLogs.length} clock-in ${inLogs.length === 1 ? 'scan' : 'scans'}`;

      // 3. Tardiness & Incidents Rate
      const lateIn = inLogs.filter(l => l.action === "Late" || l.action === "Irregular").length;
      const latePct = inLogs.length > 0 ? ((lateIn / inLogs.length) * 100).toFixed(1) : "0.0";
      const card3Subtitle = inLogs.length === 0
        ? "0 infractions recorded"
        : `${lateIn} late clock-in ${lateIn === 1 ? 'incident' : 'incidents'}`;

      // 4. Attendance Exceptions
      const sysGenCount = data.filter(l => l.log_type === "System Generated" || l.logged_StatusId === 7).length;
      const irregularCount = data.filter(l => l.action === "Irregular" || l.attendance_StatusId === 8 || l.log_type?.toLowerCase().includes("irregular")).length;
      const exceptions = sysGenCount + irregularCount;
      const card4Subtitle = exceptions === 0
        ? "Clean records (no flags)"
        : `${sysGenCount} auto-marks, ${irregularCount} irregular scans`;

      return {
        avgPunches,
        compliancePct,
        latePct,
        exceptions,
        card1Subtitle,
        card2Subtitle,
        card3Subtitle,
        card4Subtitle
      };
    } else {
      // Day Summaries View
      let data = dayLogsData;
      if (selectedUser !== "all") {
        data = data.filter(d => String(d.user_Id) === String(selectedUser));
      }
      if (filterDate) {
        data = data.filter(d => String(d.log_Date).split('T')[0] === filterDate);
      }

      const totalDays = data.length;
      let totalPunches = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let undertimeCount = 0;
      let exceptionCount = 0;

      data.forEach(d => {
        if (d.morning_In && d.morning_In !== "—") totalPunches++;
        if (d.morning_Out && d.morning_Out !== "—") totalPunches++;
        if (d.afternoon_In && d.afternoon_In !== "—") totalPunches++;
        if (d.afternoon_Out && d.afternoon_Out !== "—") totalPunches++;
        if (d.ot_In && d.ot_In !== "—") totalPunches++;
        if (d.ot_Out && d.ot_Out !== "—") totalPunches++;

        const status = (d.status || "").toLowerCase();
        if (status.includes("on time") || status.includes("on-field") || status.includes("present") || status.includes("exempt")) {
          onTimeCount++;
        } else if (status.includes("late")) {
          lateCount++;
        } else if (status.includes("absent")) {
          absentCount++;
        } else if (status.includes("undertime") || status.includes("half day")) {
          undertimeCount++;
        }

        const isUnclosed = d.morning_In && d.morning_In !== "—" && (!d.afternoon_Out || d.afternoon_Out === "—") && (!d.time_Out || d.time_Out === "—");
        if (d.systemGenerated || status.includes("irregular") || isUnclosed) {
          exceptionCount++;
        }
      });

      const avgPunches = totalDays > 0 ? (totalPunches / totalDays).toFixed(1) : "0.0";
      const card1Subtitle = totalDays === 0
        ? "No day records in this period"
        : (selectedUser !== "all"
          ? `Avg punches/day across ${totalDays} ${totalDays === 1 ? 'day' : 'days'}`
          : "Target: 4 punches/day (AM & PM)");

      const compliancePct = totalDays > 0 ? ((onTimeCount / totalDays) * 100).toFixed(1) : "0.0";
      const card2Subtitle = totalDays === 0
        ? "0 day records in this period"
        : `${onTimeCount} on-time of ${totalDays} day ${totalDays === 1 ? 'record' : 'records'}`;

      const totalInfractions = lateCount + absentCount + undertimeCount;
      const latePct = totalDays > 0 ? ((totalInfractions / totalDays) * 100).toFixed(1) : "0.0";
      const card3Subtitle = totalDays === 0
        ? "0 infractions recorded"
        : `${lateCount} Late, ${absentCount} Absent${undertimeCount > 0 ? `, ${undertimeCount} UT` : ""}`;

      const card4Subtitle = exceptionCount === 0
        ? "All records regularized"
        : "Auto-marks & missing tap-outs";

      return {
        avgPunches,
        compliancePct,
        latePct,
        exceptions: exceptionCount,
        card1Subtitle,
        card2Subtitle,
        card3Subtitle,
        card4Subtitle
      };
    }
  }, [viewMode, logData, dayLogsData, selectedUser, filterDate]);

  // State tracking visibility masking state mapped to log identifiers
const [revealedMachipRows, setRevealedMachipRows] = useState({});

const toggleMachipVisibility = (rowId) => {
  setRevealedMachipRows((prev) => ({
    ...prev,
    [rowId]: !prev[rowId],
  }));
};

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="flex flex-col w-full min-h-screen">
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
          
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header section with Actions & Tabs */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">User Logging Activity</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                {viewMode === "raw" ? "Real-time biometric and manual clock events" : "Aggregated Day Logs"} ({period.startDate} to {period.endDate})
              </span>
            </div>
            {/* NEW: Redirect to Reports Button */}
            <Button 
              variant="outline" 
              asChild
              className="w-full sm:w-auto border-brand-primary/30 text-brand-primary/80 hover:text-brand-primary font-semibold"
            >
              <Link to="/adminReports" state={{ activeTab: "attendance" }}>
                <AssessmentIcon className="mr-2 h-4 w-4" /> View Detailed Reports
              </Link>
            </Button>
           
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              
          </div>
           {/* View Mode Toggle (Tabs integrated into Header) */}
              <Tabs value={viewMode} onValueChange={(val) => {
                setViewMode(val);
                setSearchParams({ view: val });
                setStatusFilter("All");
              }} className="w-full sm:w-[250px] xl:w-[250px]">
                <TabsList className="grid w-full grid-cols-2 h-11 bg-slate-200/60 rounded-lg">
                  <TabsTrigger value="raw" className="data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-md! font-semibold text-slate-500 transition-all rounded-md">
                    Raw Logs
                  </TabsTrigger>
                  <TabsTrigger value="day" className="data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-md! font-semibold text-slate-500 transition-all rounded-md">
                    Day Summaries
                  </TabsTrigger>
                </TabsList>
              </Tabs>
          <div className="h-6"></div>
 
                    {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Avg Punches / Employee */}
            <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between w-full">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                        {viewMode === "raw" ? "Avg Punches / Employee" : "Avg Daily Punches"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Average card/biometric punches per active employee in this period (standard policy expects 4.0 punches/day)." 
                            : "Average punches recorded per employee-day across morning and afternoon shifts (standard policy expects 4 punches: In/Out for AM & PM)."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold text-brand-primary">{kpiStats.avgPunches}</span>
                      <span className="text-sm font-semibold text-brand-primary/60">/ 4.0</span>
                    </div>
                  </div>
                  <p className="text-xs text-brand-primary/70 italic mt-4">
                    {kpiStats.card1Subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: On-Time Attendance Rate */}
            <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between w-full">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-green uppercase tracking-wider">
                        {viewMode === "raw" ? "Clock-In Compliance" : "On-Time Rate"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Percentage of entry scans recorded on time on or before scheduled shift start." 
                            : "Percentage of employee workdays completed on time without tardiness infractions."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-4xl font-bold text-accent-green">{kpiStats.compliancePct}</span>
                      <span className="text-xl font-bold text-accent-green/80">%</span>
                    </div>
                  </div>
                  <p className="text-xs text-accent-green/70 italic mt-4">
                    {kpiStats.card2Subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Tardiness & Infraction Rate */}
            <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between w-full">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">
                        {viewMode === "raw" ? "Tardiness & Incidents" : "Infraction Rate"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Percentage of entry scans recorded late against scheduled shift start." 
                            : "Percentage of day records containing late arrivals, absences, or undertime infractions."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-4xl font-bold text-accent-gold">{kpiStats.latePct}</span>
                      <span className="text-xl font-bold text-accent-gold/80">%</span>
                    </div>
                  </div>
                  <p className="text-xs text-accent-gold/70 italic mt-4">
                    {kpiStats.card3Subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Attendance Exceptions / Regularization */}
            <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between w-full">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-status-danger uppercase tracking-wider">
                        {viewMode === "raw" ? "Attendance Exceptions" : "Regularization Needed"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw"
                            ? "System-generated fallback scans and irregular punches requiring administrative review."
                            : "Day records with automated system markers, irregular punches, or missing tap-outs requiring HR review."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold text-status-danger">{kpiStats.exceptions}</span>
                      <span className="text-sm font-semibold text-status-danger/70">
                        {viewMode === "raw" ? "Flags" : "Records"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-status-danger/70 italic mt-4">
                    {kpiStats.card4Subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Card */}
          <Card className="shadow-sm border-0 bg-white mb-6 py-0">
            <CardContent className="p-4 sm:p-6 space-y-4">
              
              {/* First Row: Search and Basic Filters */}
              <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
                <div className="relative w-full xl:max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search by ID, name, date, time, or status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                  {/* <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:w-[180px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.user_Id} value={user.user_Id.toString()}>
                          {user.user_LastName}, {user.user_FirstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> */}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All" title="Show all event types and records">
                              All {viewMode === "raw" ? "Types" : "Statuses"}
                            </SelectItem>
                            {viewMode === "raw" ? (
                              <>
                                <SelectItem value="Clock In" title="Standard morning or shift entry scans">Clock In</SelectItem>
                                <SelectItem value="Clock Out" title="Standard exit or shift departure scans">Clock Out</SelectItem>
                                <SelectItem value="Morning In" title="Morning entry punch">Morning In</SelectItem>
                                <SelectItem value="Morning Out" title="Morning exit / lunch departure punch">Morning Out</SelectItem>
                                <SelectItem value="Afternoon In" title="Afternoon entry / lunch return punch">Afternoon In</SelectItem>
                                <SelectItem value="Afternoon Out" title="Afternoon end-of-day departure punch">Afternoon Out</SelectItem>
                                <SelectItem value="System Generated" title="Automated entries created by MAChip (fallback auto-outs, leave markers)">System Generated</SelectItem>
                                <SelectItem value="Irregular" title="Scans outside regular shifts, incidental card taps, or unpaired entries">Irregular</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="On Time" title="Shift arrivals recorded on or before scheduled start (8:00 AM)">On Time</SelectItem>
                                <SelectItem value="Late" title="Arrivals recorded after grace period">Late</SelectItem>
                                <SelectItem value="Absent" title="Unexcused non-attendance for scheduled workday">Absent</SelectItem>
                                <SelectItem value="On Leave" title="Approved leave request (Vacation, Sick, Emergency, Statutory)">On Leave</SelectItem>
                                <SelectItem value="On-Field" title="Approved official off-site work assignment (credits 8.0 hrs)">On-Field</SelectItem>
                                <SelectItem value="Half Day" title="Approved half-day leave filing (credits 4.0 hrs)">Half Day</SelectItem>
                                <SelectItem value="Irregular" title="Day records with abnormal punches requiring supervisor review">Irregular</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      {viewMode === "raw" 
                        ? "Filter logs by scan event type (Clock In, Out, System Generated, Irregular)" 
                        : "Filter records by attendance status (On Time, Late, Absent, Leave, On-Field)"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Second Row: Specific Date & Time Filtering */}
              <div className="flex flex-col lg:flex-row items-center gap-4 pt-2 border-t border-slate-50">
                <div className="flex flex-col w-full lg:w-auto">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Date (Current Period)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Input 
                          type="date" 
                          value={filterDate} 
                          min={period.startDate}
                          max={period.endDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setFilterDate("");
                              return;
                            }
                            if (val < period.startDate || val > period.endDate) {
                              setToast({ message: `Date must be within the current payroll period (${period.startDate} to ${period.endDate}).`, type: "warning" });
                              return;
                            }
                            setFilterDate(val);
                          }}
                          className="h-9 border-slate-200 bg-slate-50 w-full lg:w-[170px]"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Filtering is restricted to the active payroll cutoff ({period.startDate} to {period.endDate}).
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                    Allowed: {period.startDate} to {period.endDate}
                  </span>
                </div>

                <div className="flex flex-col w-full lg:w-auto">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Time Range (From — To)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 h-9">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase">From</span>
                          <Input 
                            type="time" 
                            value={startTime} 
                            onChange={(e) => setStartTime(e.target.value)}
                            className="h-7 w-[105px] border-0 bg-transparent p-0 focus-visible:ring-0 text-xs"
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase">to</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 h-9">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase">To</span>
                          <Input 
                            type="time" 
                            value={endTime} 
                            onChange={(e) => setEndTime(e.target.value)}
                            className="h-7 w-[105px] border-0 bg-transparent p-0 focus-visible:ring-0 text-xs"
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Filter logs by clock-in/punch time between From (earliest) and To (latest).
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex gap-2 w-full lg:w-auto lg:ml-auto items-end h-full">
                  {(isFiltering || filterDate || startTime || endTime) && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        handleClearFilters();
                        setFilterDate("");
                        setStartTime("");
                        setEndTime("");
                      }}
                      className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-9"
                    >
                      <CloseIcon className="h-4 w-4 mr-1" /> Clear All
                    </Button>
                  )}
                  {/* <Button
                    className="bg-[#B91C1C] text-white hover:bg-[#991B1B] h-9 px-4 text-xs font-bold uppercase"
                    onClick={() => handleGenerateLogs(2)}
                    disabled={loading}
                  >
                    {loading ? "..." : "Manual Out"}
                  </Button> */}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Card */}
          <Card className="shadow-sm border-0 bg-white py-0">
            <CardContent className="p-0 flex flex-col">
              <div className="overflow-x-auto">
                <Table className="min-w-[800px] md:min-w-full">
                  {viewMode === "raw" ? (
                    <>
                      <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent border-b-slate-200">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">User ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Full Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Type</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider hidden sm:table-cell">
                            <div className="flex items-center gap-1">
                              MaChip ID
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpOutlineIcon sx={{ fontSize: 12 }} className="text-white/60 hover:text-white cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                  Unique serial token read from the physical card.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.length > 0 ? (
                          currentData.map((row) => {
                            const isMachipRevealed = revealedMachipRows[row.user_loggingId];
                            return (
                              <TableRow key={row.user_loggingId} className="border-b-slate-100 hover:bg-slate-50/50">
                                <TableCell className="font-bold text-brand-primary-dark py-4 px-6">{row.user_Id_formatted}</TableCell>
                                
                                {/* Truncated Full Name (Raw View) */}
                                <TableCell className="font-medium text-slate-800 py-4">
                                  {row.fullName ? (
                                    <span className="inline-block max-w-[150px] truncate align-bottom" title={row.fullName}>
                                      {row.fullName}
                                    </span>
                                  ) : "—"}
                                </TableCell>

                                <TableCell className="py-4">
                                  <Badge 
                                    variant="secondary" 
                                    className={`font-semibold ${
                                      (row.action === "Irregular" || row.attendance_StatusId === 8 || row.log_type.includes("Irregular"))
                                        ? "bg-rose-100 text-rose-800 hover:bg-rose-100 border border-rose-200"
                                        : row.log_type.toLowerCase().includes("in") 
                                          ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                    }`}
                                  >
                                    {(row.action === "Irregular" || row.attendance_StatusId === 8 || row.log_type.includes("Irregular"))
                                      ? (row.log_type.startsWith("Irregular") 
                                          ? row.log_type 
                                          : `Irregular ${[1, 3, 5, 10].includes(row.logged_StatusId) || row.log_type.toLowerCase().includes("in") ? "Clock In" : "Clock Out"}`)
                                      : (row.log_type === "Morning IN" ? "Clock In" : row.log_type === "Morning OUT" ? "Clock Out" : row.log_type)}
                                  </Badge>
                                </TableCell>

                                {/* Masked MaChip ID with Toggle (Raw View) */}
                                <TableCell className="text-slate-500 py-4 hidden sm:table-cell font-mono text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="tracking-wider">
                                      {row.machip_id ? (isMachipRevealed ? row.machip_id : "••••••••••••") : "—"}
                                    </span>
                                    {row.machip_id && (
                                      <button
                                        type="button"
                                        onClick={() => toggleMachipVisibility(row.user_loggingId)}
                                        className="text-slate-400 hover:text-brand-primary transition-colors p-0.5 rounded focus:outline-none"
                                        title={isMachipRevealed ? "Hide MaChip ID" : "Show MaChip ID"}
                                      >
                                        {isMachipRevealed ? (
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                          </svg>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                          </svg>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell className="text-slate-600 py-4">{row.log_Date}</TableCell>
                                <TableCell className="text-slate-600 py-4">{row.time}</TableCell>
                                <TableCell className="py-4 text-right pr-6">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-block">
                                        <Button variant="outline" size="sm" asChild className="border-brand-primary-light text-brand-primary hover:bg-brand-primary-light hover:border-brand-primary hover:text-brand-primary transition-colors">
                                          <Link to={`/users/${row.user_Id}`}>
                                            <EyeIcon className="h-4 w-4" />
                                          </Link>
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                      View Profile
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                                <span className="font-semibold text-slate-600">No logs found</span>
                                <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </>
                  ) : (
                    <>
                      <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent border-b-slate-200">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider cursor-pointer hover:bg-[#3B206D] transition-colors" onClick={() => handleSort('user_Id')}>
                            # {sortConfig.key === 'user_Id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider cursor-pointer hover:bg-[#3B206D] transition-colors" onClick={() => handleSort('userName')}>
                            Name {sortConfig.key === 'userName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider cursor-pointer hover:bg-[#3B206D] transition-colors" onClick={() => handleSort('log_Date')}>
                            Date {sortConfig.key === 'log_Date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">
                            <div className="flex items-center gap-0.5">
                              AM In
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpOutlineIcon sx={{ fontSize: 11 }} className="text-white/60 hover:text-white cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                  Morning Entry Clock-in (Default: 8:00 AM shift start).
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">AM Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PM In</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PM Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">
                            <div className="flex items-center gap-0.5">
                              OT In
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpOutlineIcon sx={{ fontSize: 11 }} className="text-white/60 hover:text-white cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                  Overtime shift start mapping.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">OT Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider cursor-pointer hover:bg-[#3B206D] transition-colors" onClick={() => handleSort('status')}>
                            Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.length > 0 ? (
                          currentData.map((row, index) => {
                            let badgeStyle = "bg-slate-100 text-slate-800 hover:bg-slate-100";
                            if (row.status === "On Time") badgeStyle = "bg-green-100 text-green-800 hover:bg-green-100";
                            else if (row.status === "On-Field") badgeStyle = "bg-blue-100 text-blue-800 hover:bg-blue-100";
                            else if (row.status === "On Leave" || row.status?.toLowerCase().includes("leave")) badgeStyle = "bg-sky-100 text-sky-800 hover:bg-sky-100";
                            else if (row.status === "Half Day" || row.status?.toLowerCase().includes("half")) badgeStyle = "bg-orange-100 text-orange-800 hover:bg-orange-100";
                            else if (row.status?.toLowerCase().includes("late")) badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-100";
                            else if (row.status?.toLowerCase().includes("irregular")) badgeStyle = "bg-rose-100 text-rose-800 hover:bg-rose-100 border border-rose-200";
                            else if (row.status?.toLowerCase().includes("absent")) badgeStyle = "bg-red-100 text-red-800 hover:bg-red-100";

                            return (
                              <TableRow key={`${row.user_Id}-${row.log_Date}-${index}`} className="border-b-slate-100 hover:bg-slate-50/50">
                                <TableCell className="font-bold text-brand-primary-dark py-4 px-6">{formatUserId(row.user_Id)}</TableCell>
                                
                                {/* Truncated Name (Structured View) */}
                                <TableCell className="font-medium text-slate-800 py-4">
                                  {row.userName ? (
                                    <span className="inline-block max-w-[150px] truncate align-bottom" title={row.userName}>
                                      {row.userName}
                                    </span>
                                  ) : "—"}
                                </TableCell>

                                <TableCell className="text-slate-600 py-4">{formatDateStr(row.log_Date)}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.morning_In || "—"}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.morning_Out || "—"}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.afternoon_In || "—"}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.afternoon_Out || "—"}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.ot_In || "—"}</TableCell>
                                <TableCell className="text-slate-600 py-4 font-mono text-[13px]">{row.ot_Out || "—"}</TableCell>
                                <TableCell className="py-4">
                                  <Badge variant="secondary" className={`font-semibold ${badgeStyle}`}>
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right py-4 pr-6">
                                  {isAdminOrAccountant ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block">
                                          <Button variant="outline" size="sm" asChild className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-brand-primary-light hover:border-[#9c7de0] transition-colors">
                                            <Link to={`/logs/edit/${row.user_Id}/${row.log_Date.split('T')[0]}?from=logs`}>
                                              <SquarePen className="h-4 w-4" />
                                            </Link>
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                        Edit Log Times
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block">
                                          <Button variant="outline" size="sm" asChild className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                                            <Link to={`/users/${row.user_Id}`}>View</Link>
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                        View Profile
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                                <span className="font-semibold text-slate-600">No logs found</span>
                                <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </>
                  )}
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
                itemLabel={totalItems === 1 ? "log entry" : "log entries"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default Logs;