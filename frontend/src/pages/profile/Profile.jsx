import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// UI Components
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");

  // Derive unique months available in user's attendance history
  const availableMonths = useMemo(() => {
    const monthsMap = new Map();
    attendanceLogs.forEach((log) => {
      if (!log.log_Date) return;
      const d = new Date(log.log_Date + "T00:00:00");
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!monthsMap.has(key)) {
        monthsMap.set(key, label);
      }
    });
    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ value: key, label }));
  }, [attendanceLogs]);

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== "All" || monthFilter !== "All";

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setMonthFilter("All");
    setCurrentPage(1);
  };

  // Memoized Pagination & Filtering Logic
  const { paginatedLogs, totalItems, totalPages, startIndex, endIndex } = useMemo(() => {
    // 1. Filter
    const q = searchQuery.toLowerCase().trim();
    const filtered = attendanceLogs.filter((log) => {
      // A. Status Filter
      if (statusFilter !== "All") {
        const rawStatus = (log.attendanceStatus || "").toLowerCase();
        const filterKey = statusFilter.toLowerCase();
        if (filterKey === "on time") {
          if (!rawStatus.includes("on time") && !rawStatus.includes("present") && !rawStatus.includes("exempt")) return false;
        } else if (filterKey === "late") {
          if (!rawStatus.includes("late")) return false;
        } else if (filterKey === "absent") {
          if (!rawStatus.includes("absent")) return false;
        } else if (filterKey === "half day") {
          if (!rawStatus.includes("half")) return false;
        } else if (filterKey === "on-field") {
          if (!rawStatus.includes("field")) return false;
        } else {
          if (!rawStatus.includes(filterKey)) return false;
        }
      }

      // B. Month Filter
      if (monthFilter !== "All") {
        if (!log.log_Date || !log.log_Date.startsWith(monthFilter)) return false;
      }

      // C. Search Query
      if (q) {
        const dateObj = log.log_Date ? new Date(log.log_Date + "T00:00:00") : null;
        const dateFormatted = dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }).toLowerCase() : "";
        const dateFullMonth = dateObj ? dateObj.toLocaleDateString("en-US", { month: "long" }).toLowerCase() : "";
        const dateNumeric = dateObj ? dateObj.toLocaleDateString().toLowerCase() : "";
        const dateIso = String(log.log_Date || "").toLowerCase();
        const timeIn = String(formatTime12h(log.time_In) || "").toLowerCase();
        const timeOut = String(formatTime12h(log.time_Out) || "").toLowerCase();
        const rawIn = String(log.time_In || "").toLowerCase();
        const rawOut = String(log.time_Out || "").toLowerCase();
        const logStatus = String(log.logStatus || "").toLowerCase();
        const attStatus = String(log.attendanceStatus || "").toLowerCase();

        const matches = (
          dateFormatted.includes(q) ||
          dateFullMonth.includes(q) ||
          dateNumeric.includes(q) ||
          dateIso.includes(q) ||
          timeIn.includes(q) ||
          timeOut.includes(q) ||
          rawIn.includes(q) ||
          rawOut.includes(q) ||
          logStatus.includes(q) ||
          attStatus.includes(q)
        );
        if (!matches) return false;
      }

      return true;
    });

    // 2. Paginate
    const total = filtered.length;
    const pages = Math.ceil(total / itemsPerPage) || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, total);
    
    return {
      paginatedLogs: filtered.slice(start, end),
      totalItems: total,
      totalPages: pages,
      startIndex: start,
      endIndex: end
    };
  }, [attendanceLogs, searchQuery, statusFilter, monthFilter, currentPage, itemsPerPage]);

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, monthFilter, itemsPerPage]);

  useEffect(() => {
    const fetchProfileData = async () => {
      const userDataString = localStorage.getItem("userData");
      const storedUserData = userDataString ? JSON.parse(userDataString) : null;
      const userId = storedUserData?.user_Id;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const [userRes, logsRes] = await Promise.all([
          fetchWithAuth(`/api/users/${userId}`),
          fetchWithAuth(`/api/attendance/logs/${userId}`)
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          localStorage.setItem("userData", JSON.stringify(userData));
        }
        
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setAttendanceLogs(Array.isArray(logsData) ? logsData : []);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const getLogStatusVariant = (status) => {
    if (status?.includes("In")) return "success";
    if (status?.includes("Out")) return "destructive";
    return "secondary";
  };

  const getAttendanceVariant = (status) => {
    const s = status?.toLowerCase();
    if (s?.includes("present")) return "outline";
    if (s?.includes("absent")) return "destructive";
    if (s?.includes("late")) return "warning";
    return "secondary";
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">User Profile</h1>
              <span className="text-sm text-slate-500 mt-1 block">View and manage your personal information and activity history.</span>
            </div>
            {user && (
              <Button asChild className="w-full md:w-auto bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm h-10">
                <Link to={`/users/edit/${user.user_Id}`}>
                  <EditOutlinedIcon className="mr-2 h-4 w-4" /> Edit Profile
                </Link>
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : !user ? (
            <div className="text-center p-12 text-slate-500 bg-white border border-slate-200 rounded-xl">
              User profile data could not be found.
            </div>
          ) : (
            <>
              {/* Hero Banner Section */}
              <Card className="bg-white border-0 shadow-sm mb-6 relative overflow-hidden py-0">
                <div className="h-28 bg-gradient-to-r from-brand-primary to-[#45297e]"></div>
                <CardContent className="px-6 pb-6 pt-0 relative">
                  <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12">
                    <div className="w-28 h-28 rounded-full bg-white p-1.5 shadow-md">
                      <div className="w-full h-full rounded-full bg-brand-primary-light text-[#4a2b8c] flex items-center justify-center text-4xl font-black uppercase tracking-widest">
                        {user.user_FirstName?.[0]}{user.user_LastName?.[0]}
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">
                        {user.user_FirstName} {user.user_LastName}
                      </h2>
                      <p className="text-slate-500 flex items-center justify-center md:justify-start gap-2 mt-1.5 font-medium">
                        <EmailOutlinedIcon className="h-4 w-4" /> {user.user_Email || "No Email Provided"}
                      </p>
                    </div>
                    <div className="mb-3">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm">
                        Active Account
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dashboard Identity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full animate-in fade-in zoom-in-95 duration-200">
                <Card className="shadow-sm border-0 bg-[#FAF2FF] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-brand-primary uppercase tracking-wider mb-2">Account Identifier</p>
                        <p className="text-3xl font-bold text-brand-primary font-mono">{formatUserId(user.user_Id)}</p>
                      </div>
                      <p className="text-xs text-brand-primary/70 italic mt-4">System generated employee ID</p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <BadgeOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 bg-[#F8FFF2] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-accent-green uppercase tracking-wider mb-2">System Role</p>
                        <p className="text-3xl font-bold text-accent-green">{user.user_Role}</p>
                      </div>
                      <p className="text-xs text-accent-green/70 italic mt-4">Current authorization access level</p>
                    </div>
                    <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <AdminPanelSettingsOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 bg-[#FFFFF2] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-accent-gold uppercase tracking-wider mb-2">MaChip Biometrics</p>
                        <p className="text-2xl font-bold text-accent-gold font-mono leading-tight max-w-[200px] truncate">
                          {user.user_MachipId || "Unlinked"}
                        </p>
                      </div>
                      <p className="text-xs text-accent-gold/70 italic mt-4">Hardware authentication token</p>
                    </div>
                    <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <FingerprintOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart Section */}
              <Card className="bg-white border border-slate-200/80 shadow-sm mb-6 overflow-hidden">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-800">Attendance Consistency (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-4 overflow-x-auto overflow-y-hidden">
                  <div className="w-full h-[260px] min-w-[600px] overflow-hidden">
                    <Chart
                      title=""
                      userId={user.user_Id}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Table Section */}
              <Card className="border border-slate-200/80 shadow-sm bg-white mb-6 overflow-hidden">
                <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0">
                        <BadgeOutlinedIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-800">Personal Attendance Logs</CardTitle>
                        <p className="text-xs text-slate-500 font-medium">Historical records of daily time ins, time outs, and attendance status</p>
                      </div>
                    </div>
                  </div>

                  {/* Filter Controls Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search date, time, status..." 
                        className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-slate-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} 
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs bg-white border-slate-200">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Statuses</SelectItem>
                          <SelectItem value="On Time">On Time / Present</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Absent">Absent</SelectItem>
                          <SelectItem value="Half Day">Half Day</SelectItem>
                          <SelectItem value="On-Field">On Field</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="h-9 w-full sm:w-[170px] text-xs bg-white border-slate-200">
                          <SelectValue placeholder="All Months" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Months</SelectItem>
                          {availableMonths.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {isFiltering && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFilters}
                          className="h-9 px-2.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-medium"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 flex flex-col justify-between min-h-[460px]">
                  <div className="overflow-x-auto flex-1">
                    <Table>
                      <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                        <TableRow className="h-11 hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-slate-600 uppercase text-[11px] tracking-wider py-3.5 px-6">Date</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-center uppercase text-[11px] tracking-wider py-3.5">Time In</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-center uppercase text-[11px] tracking-wider py-3.5">Time Out</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-center uppercase text-[11px] tracking-wider py-3.5">Log Type</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-center uppercase text-[11px] tracking-wider py-3.5 px-6">Attendance Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLogs.length > 0 ? (
                          paginatedLogs.map((log, index) => {
                            const rawStatus = (log.attendanceStatus || "").toLowerCase();
                            const isPresent = rawStatus.includes("present") || rawStatus.includes("on time");
                            const isLate = rawStatus.includes("late");
                            const isAbsent = rawStatus.includes("absent");
                            const isHalfDay = rawStatus.includes("half");
                            const isOnField = rawStatus.includes("field");

                            return (
                              <TableRow key={log.sessionId || index} className="h-12 border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                                <TableCell className="py-2.5 px-6">
                                  <span className="font-semibold text-slate-800 text-xs block">
                                    {log.log_Date ? new Date(log.log_Date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1 rounded-md inline-block">
                                    {formatTime12h(log.time_In)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 border border-slate-200/80 px-2.5 py-1 rounded-md inline-block">
                                    {formatTime12h(log.time_Out)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${
                                    log.logStatus?.includes("In")
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : log.logStatus?.includes("Out")
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      log.logStatus?.includes("In") ? "bg-emerald-500" : log.logStatus?.includes("Out") ? "bg-indigo-500" : "bg-slate-400"
                                    }`} />
                                    {log.logStatus || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5 px-6">
                                  <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${
                                    isPresent
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : isLate
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : isAbsent
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : isHalfDay
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : isOnField
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                    {log.attendanceStatus !== "—" ? log.attendanceStatus : "—"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow className="h-48">
                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm italic">
                              {isFiltering ? "No attendance records match your filter criteria." : "No attendance records found."}
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
                    itemLabel="records"
                  />
                </CardContent>
              </Card>

            </>
          )}
        </div>
      </Sidebar>
    </div>
  );
};

export default Profile;