import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatDateStr = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

const Logs = () => {
  const { systemToday } = useSystemTime();
  const [viewMode, setViewMode] = useState("raw"); // "raw" or "day"
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

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

  const period = useMemo(() => getCurrentPeriod(systemToday), [systemToday, getCurrentPeriod]);

  const [users, setUsers] = useState([]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUser, statusFilter, itemsPerPage, viewMode]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedUser("all");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || selectedUser !== "all" || statusFilter !== "All";

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
      const response = await fetchWithAuth("/api/attendance/all");
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
            log_Date: log.log_Date
              ? new Date(log.log_Date).toLocaleDateString()
              : "—",
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
  }, []);

  // Fetch day logs
  const fetchDayLogs = useCallback(async () => {
    try {
      let url = `/api/attendance/report?startDate=${period.startDate}&endDate=${period.endDate}`;
      if (selectedUser !== "all") url += `&user_Id=${selectedUser}`;
      else url += `&user_Id=All Employees`;

      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setDayLogsData(data);
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
      const interval = setInterval(fetchDayLogs, 30000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    }
  }, [fetchLogs, fetchUsers, fetchDayLogs, viewMode]);

  const handleGenerateLogs = async (forcedStatus) => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        "/api/attendance/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcedStatus }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setToast({ message: data.message || "Attendance marked successfully!", type: "success" });
        await fetchLogs();
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

    return matchesSearch && matchesUser && matchesStatus;
  });

  // 2. Filter & Sort Day Data
  const sortedAndFilteredDayLogs = useMemo(() => {
    let sortableItems = [...dayLogsData];
    
    // Sort
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
    
    // Filter
    const query = searchQuery.toLowerCase();
    return sortableItems.filter((item) => {
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) ||
        item.user_Id?.toString().toLowerCase().includes(query) ||
        item.status?.toLowerCase().includes(query);
      
      const matchesStatus = statusFilter === "All" || item.status?.toLowerCase().includes(statusFilter.toLowerCase());

      return matchesSearch && matchesStatus;
    });
  }, [dayLogsData, sortConfig, searchQuery, statusFilter]);

  // 3. Unify Active Data
  const activeData = viewMode === "raw" ? filteredRawData : sortedAndFilteredDayLogs;
  
  // 4. Pagination
  const totalItems = activeData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = activeData.slice(startIndex, endIndex);

  // ------------------ STATISTICS CALCULATION ------------------
  const stats = {
    total: viewMode === "raw" ? logData.length : dayLogsData.length,
    metric1: viewMode === "raw" 
      ? logData.filter(l => l.log_type?.toLowerCase().includes("in")).length 
      : dayLogsData.filter(l => l.status === "On Time").length,
    metric2: viewMode === "raw"
      ? logData.filter(l => l.log_type?.toLowerCase().includes("out")).length
      : dayLogsData.filter(l => l.status && l.status !== "On Time").length,
  };

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        
        <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
          
          {/* Header section with Actions & Tabs */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">User Logging Activity</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                {viewMode === "raw" ? "Track real-time biometric and manual clock events" : `Aggregated Day Logs (${period.startDate} to ${period.endDate})`}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                {/* View Mode Toggle (Tabs integrated into Header) */}
                <Tabs value={viewMode} onValueChange={(val) => setViewMode(val)} className="w-full sm:w-[320px] xl:w-[320px]">
                  <TabsList className="grid w-full grid-cols-2 h-11 bg-slate-200/60 p-1 rounded-lg">
                    <TabsTrigger value="raw" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                      Raw Logs
                    </TabsTrigger>
                    <TabsTrigger value="day" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                      Day Summaries
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Clock In / Out Actions */}
                {/* {viewMode === "raw" && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      className="flex-1 sm:flex-none bg-[#2A174E] text-white hover:bg-[#1a0e30] w-full sm:w-[110px] h-11"
                      onClick={() => handleGenerateLogs(1)}
                      disabled={loading}
                    >
                      {loading ? "..." : "Clock In"} 
                    </Button>
                    <Button
                      className="flex-1 sm:flex-none bg-[#2A174E] text-white hover:bg-[#1a0e30] w-full sm:w-[110px] h-11"
                      onClick={() => handleGenerateLogs(2)}
                      disabled={loading}
                    >
                      {loading ? "..." : "Clock Out"}
                    </Button>
                  </div>
                )} */}
            </div>
          </div>

          {/* Dashboard-Style Widgets Row */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            
            {/* Card 1: Total */}
            <Card className="shadow-sm border-0 bg-[#2A174E] py-0 h-full min-w-0">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                      {viewMode === "raw" ? "Total Log Events" : "Total Day Records"}
                    </p>
                    <p className="text-4xl font-bold text-white">{stats.total}</p>
                  </div>
                  <p className="text-xs text-white/70 italic mt-4">All captured records for context</p>
                </div>
                <div className="bg-white/10 text-white p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <FormatListBulletedIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Ins / On Time */}
            <Card className="shadow-sm border-0 bg-[#3B4E17] py-0 h-full min-w-0">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                      {viewMode === "raw" ? "Clock In Events" : "On Time Days"}
                    </p>
                    <p className="text-4xl font-bold text-white">{stats.metric1}</p>
                  </div>
                  <p className="text-xs text-white/70 italic mt-4">
                    {viewMode === "raw" ? "Total entry scans recorded" : "Employees arriving on or before 8:00 AM"}
                  </p>
                </div>
                <div className="bg-white/10 text-white p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <AccessTimeIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Outs / Late/Absent */}
            <Card className="shadow-sm border-0 bg-[#ECC04B] py-0 h-full min-w-0">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                      {viewMode === "raw" ? "Clock Out Events" : "Late & Absent"}
                    </p>
                    <p className="text-4xl font-bold text-white">{stats.metric2}</p>
                  </div>
                  <p className="text-xs text-white/70 italic mt-4">
                    {viewMode === "raw" ? "Total exit scans recorded" : "Days recorded with infractions"}
                  </p>
                </div>
                <div className="bg-white/20 text-[#D4AF37] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <AssignmentLateIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Filters Card */}
          <Card className="shadow-sm border-0 bg-white mb-6 py-0">
            <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
              
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
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                  
                  {/* User Dropdown */}
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
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
                </div>

                {/* Status/Type Dropdown */}
                <div className="flex items-center w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All {viewMode === "raw" ? "Types" : "Statuses"}</SelectItem>
                      {viewMode === "raw" ? (
                        <>
                          <SelectItem value="in">Clock In</SelectItem>
                          <SelectItem value="out">Clock Out</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="On Time">On Time</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Absent">Absent</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Button */}
                {isFiltering && (
                  <Button 
                    variant="ghost" 
                    onClick={handleClearFilters}
                    className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                  >
                    <CloseIcon className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
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
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider hidden sm:table-cell">MaChip ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.length > 0 ? (
                          currentData.map((row) => (
                            <TableRow key={row.user_loggingId} className="border-b-slate-100 hover:bg-slate-50/50">
                              <TableCell className="font-bold text-[#2A174E] py-4 px-6">{row.user_Id_formatted}</TableCell>
                              <TableCell className="font-medium text-slate-800 py-4">{row.fullName}</TableCell>
                              <TableCell className="py-4">
                                <Badge 
                                  variant="secondary" 
                                  className={`font-semibold ${row.log_type.toLowerCase().includes("in") ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}`}
                                >
                                  {row.log_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 py-4 hidden sm:table-cell font-mono text-xs">{row.machip_id}</TableCell>
                              <TableCell className="text-slate-600 py-4">{row.log_Date}</TableCell>
                              <TableCell className="text-slate-600 py-4">{row.time}</TableCell>
                              <TableCell className="py-4 text-right pr-6">
                                <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
                                  <Link to={`/users/${row.user_Id}`}>View</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
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
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">AM In</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">AM Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PM In</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PM Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">OT In</TableHead>
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
                            else if (row.status?.toLowerCase().includes("absent") || row.status?.toLowerCase().includes("late")) badgeStyle = "bg-red-100 text-red-800 hover:bg-red-100";

                            return (
                              <TableRow key={`${row.user_Id}-${row.log_Date}-${index}`} className="border-b-slate-100 hover:bg-slate-50/50">
                                <TableCell className="font-bold text-[#2A174E] py-4 px-6">{formatUserId(row.user_Id)}</TableCell>
                                <TableCell className="font-medium text-slate-800 py-4">{row.userName}</TableCell>
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
                                    <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
                                      <Link to={`/logs/edit/${row.user_Id}/${row.log_Date.split('T')[0]}?from=logs`}>Edit</Link>
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
                                      <Link to={`/users/${row.user_Id}`}>View</Link>
                                    </Button>
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
              {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline">Rows per page:</span>
                      <Select 
                        value={itemsPerPage.toString()} 
                        onValueChange={(val) => setItemsPerPage(Number(val))}
                      >
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
        </div>
      </div>
    </Sidebar>
  );
};

export default Logs;