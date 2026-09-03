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
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
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
    // If a specific date is filtered, show the period containing that date
    const baseDate = filterDate ? new Date(filterDate) : systemToday;
    return getCurrentPeriod(baseDate);
  }, [systemDateKey, filterDate, getCurrentPeriod]);

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
            log_type: log.loggedStatusName ?? "—",
            action: log.attendanceStatusName ?? "—",
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
      const interval = setInterval(fetchLogs, 5000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    } else {
      fetchDayLogs();
      fetchLogs(); // Pre-load raw logs to calculate system-generated counts
      const interval = setInterval(fetchDayLogs, 30000); 
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

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.user_Id_formatted?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.fullName?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.log_type?.toLowerCase().includes(query) ||
      item.machip_id?.toLowerCase().includes(query);

    const matchesUser = selectedUser === "all" || item.user_Id?.toString() === selectedUser;
    const matchesStatus = statusFilter === "All" || item.log_type?.toLowerCase().includes(statusFilter.toLowerCase());

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
  
  const query = searchQuery.toLowerCase();

  return sortableItems.filter((item) => {
    // Basic Search & Status Filters
    const matchesSearch = 
      item.userName?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query);
    
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

  // ------------------ STATISTICS CALCULATION ------------------
  // Stats should reflect the entire period being viewed (Current or Filtered)
  const stats = {
    total: viewMode === "raw" ? logData.length : dayLogsData.length,
    metric1: viewMode === "raw" 
      ? logData.filter(l => l.log_type?.toLowerCase().includes("in")).length 
      : dayLogsData.filter(l => l.status === "On Time" || l.status === "On-Field" || l.status === "On-time").length,
    metric2: viewMode === "raw"
      ? logData.filter(l => l.log_type?.toLowerCase().includes("out")).length
      : dayLogsData.filter(l => l.status && !["On Time", "On-Field", "On-time"].includes(l.status)).length,
    systemGenerated: logData.filter(l => l.log_type === "System Generated").length,
  };

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
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">User Logging Activity</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                {viewMode === "raw" ? "Real-time biometric and manual clock events" : "Aggregated Day Logs"} ({period.startDate} to {period.endDate})
              </span>
            </div>
            {/* NEW: Redirect to Reports Button */}
            <Button 
              variant="outline" 
              asChild
              className="w-full sm:w-auto border-[#2A174E]/30 text-[#2A174E]/80 hover:text-[#2A174E] font-semibold"
            >
              <Link to="/adminReports" state={{ activeTab: "attendance" }}>
                <AssessmentIcon className="mr-2 h-4 w-4" /> View Detailed Reports
              </Link>
            </Button>
          
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              {/* View Mode Toggle (Tabs integrated into Header) */}
              <Tabs value={viewMode} onValueChange={(val) => {
                setViewMode(val);
                setSearchParams({ view: val });
              }}  className="w-full sm:w-[320px] xl:w-[320px]">
                <TabsList className="grid w-full grid-cols-2 h-11 bg-slate-200/60 rounded-lg">
                  <TabsTrigger value="raw" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-md! font-semibold text-slate-500 transition-all rounded-md">
                    Raw Logs
                  </TabsTrigger>
                  <TabsTrigger value="day" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-md! font-semibold text-slate-500 transition-all rounded-md">
                    Day Summaries
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          <div className="h-6"></div>
 
          {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Active Users */}
            <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider">
                        {viewMode === "raw" ? "Total Log Events" : "Total Day Records"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#2A174E]/60 hover:text-[#2A174E] cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Total clock-in/out logging events registered in this pay period." 
                            : "Total day summary listings registered in this pay period."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#2A174E]">{stats.total}</p>
                  </div>
                  <p className="text-xs text-[#2A174E]/70 italic mt-4">
                    {viewMode === "raw" ? "Total events captured in this period" : "All captured records for context"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Employees */}
            <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider">
                        {viewMode === "raw" ? "Clock In Events" : "On Time Days"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#3B4E17]/60 hover:text-[#3B4E17] cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Total entry scans recorded in this period." 
                            : "Total employee days arriving on or before the 8:00 AM shift start."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#3B4E17]">{stats.metric1}</p>
                  </div>
                  <p className="text-xs text-[#3B4E17]/70 italic mt-4">
                    {viewMode === "raw" ? "Entry scans recorded in this period" : "Employees arriving on or before 8:00 AM"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Admins & Supervisors */}
            <Card className="border-t-5 border-[#B06E16] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-[#B06E16] uppercase tracking-wider">
                        {viewMode === "raw" ? "Clock Out Events" : "Late & Absent"}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#B06E16]/60 hover:text-[#B06E16] cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          {viewMode === "raw" 
                            ? "Total exit scans recorded in this period." 
                            : "Total day records containing a Late or Absent infraction."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#B06E16]">{stats.metric2}</p>
                  </div>
                  <p className="text-xs text-[#B06E16]/70 italic mt-4">
                    {viewMode === "raw" ? "Exit scans recorded in this period" : "Days recorded with infractions"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: System Generated Logs */}
            <Card className="border-t-5 border-[#E11D48] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-[#E11D48] uppercase tracking-wider">
                        System Generated
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#E11D48]/60 hover:text-[#E11D48] cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Logs created automatically by the MAChip system (such as automated absence flags).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#E11D48]">{stats.systemGenerated}</p>
                  </div>
                  <p className="text-xs text-[#E11D48]/70 italic mt-4">
                    System markers in this period
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
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
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
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All {viewMode === "raw" ? "Types" : "Statuses"}</SelectItem>
                      {viewMode === "raw" ? (
                        <><SelectItem value="in">Clock In</SelectItem><SelectItem value="out">Clock Out</SelectItem></>
                      ) : (
                        <>
                          <SelectItem value="On Time">On Time</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Absent">Absent</SelectItem>
                          <SelectItem value="On-Field">On-Field</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Second Row: Specific Date & Time Filtering */}
              <div className="flex flex-col lg:flex-row items-center gap-4 pt-2 border-t border-slate-50">
                <div className="flex flex-col w-full lg:w-auto">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Specific Date</Label>
                  <Input 
                    type="date" 
                    value={filterDate} 
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-9 border-slate-200 bg-slate-50 w-full lg:w-[160px]"
                  />
                </div>

                <div className="flex items-end gap-2 w-full lg:w-auto">
                  <div className="flex flex-col flex-1 lg:w-[120px]">
                    <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Start Time</Label>
                    <Input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-9 border-slate-200 bg-slate-50"
                    />
                  </div>
                  <span className="mb-2 text-slate-300">—</span>
                  <div className="flex flex-col flex-1 lg:w-[120px]">
                    <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">End Time</Label>
                    <Input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-9 border-slate-200 bg-slate-50"
                    />
                  </div>
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
                      <TableHeader className="bg-[#2B174F]">
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
                                <TableCell className="font-bold text-[#2A174E] py-4 px-6">{row.user_Id_formatted}</TableCell>
                                
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
                                    className={`font-semibold ${row.log_type.toLowerCase().includes("in") ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}`}
                                  >
                                    {row.log_type}
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
                                        className="text-slate-400 hover:text-[#2A174E] transition-colors p-0.5 rounded focus:outline-none"
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
                                        <Button variant="outline" size="sm" asChild className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0] transition-colors">
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
                      <TableHeader className="bg-[#2B174F]">
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
                            else if (row.status?.toLowerCase().includes("absent") || row.status?.toLowerCase().includes("late")) badgeStyle = "bg-red-100 text-red-800 hover:bg-red-100";

                            return (
                              <TableRow key={`${row.user_Id}-${row.log_Date}-${index}`} className="border-b-slate-100 hover:bg-slate-50/50">
                                <TableCell className="font-bold text-[#2A174E] py-4 px-6">{formatUserId(row.user_Id)}</TableCell>
                                
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
                                          <Button variant="outline" size="sm" asChild className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0] transition-colors">
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
                                          <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
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