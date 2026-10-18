import { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { Link, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";
import { getStoredUser, setStoredUser } from "../../utils/authStorage";

// UI Components
import { Input } from "@/components/ui/input";
import { Search, X, Shield, History, Calendar, Eye, Sparkles, CheckCircle, AlertCircle, Info, Lock, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const PROPERTY_FRIENDLY_NAMES = {
  dailyRate: "Daily Wage Rate",
  previousDailyRate: "Previous Daily Rate",
  rateUpdatedAt: "Rate Last Modified",
  user_ShiftId: "Work Shift Schedule",
  user_EmploymentStatusId: "Employment Status",
  user_RoleId: "System Role",
  is_time_exempt: "Time Tracking Exemption",
  is_solo_parent: "Solo Parent Status",
  civil_status: "Civil / Marital Status",
  taxStatus: "Tax Exemption Status",
  account_Number: "Bank Account Number",
  bank_Company: "Bank Entity",
  bank_AccountName: "Account Holder Name",
  user_DOB: "Date of Birth",
  user_Phone: "Contact Phone Number",
  user_Address: "Home Address",
  user_Email: "Corporate Email",
  department: "Assigned Department",
  position: "Job Position",
  hireDate: "Official Hire Date",
  sss_Share: "SSS Contribution Share",
  philhealth_Share: "PhilHealth Contribution Share",
  hdmf_Share: "Pag-IBIG Contribution Share",
  tax_Share: "Withholding Tax Share",
  healthCard_Amnt: "Maxicare / Health Card",
  SSS_Loan: "SSS Loan Deduction",
  HDMF_Loan: "Pag-IBIG Loan Deduction",
  calamityLoan_Amnt: "Calamity Loan Deduction",
  advances_Amnt: "Cash Advances Balance",
  globe_Deduction: "Telecom / Globe Deduction",
  eastwest_Loan: "EastWest Loan Deduction",
  multiPurposeSavings: "Multi-Purpose Savings",
  user_MachipId: "RFID Card UID",
  user_FingerprintId: "Fingerprint Slot ID",
  reason: "Audit Note / Reason",
  attendanceStatus: "Attendance Status"
};

const formatFriendlyValue = (key, val) => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Enabled / Active" : "Disabled / Inactive";
  if (key === "user_ShiftId") return val === 1 || val === "1" ? "Morning Shift (08:30 – 17:30)" : "Night Shift (20:30 – 05:30)";
  if (key === "account_Number") {
    const s = String(val);
    return s.length > 4 ? `••••••••${s.slice(-4)}` : "••••••••";
  }
  if (
    key.toLowerCase().includes("rate") ||
    key.toLowerCase().includes("share") ||
    key.toLowerCase().includes("amnt") ||
    key.toLowerCase().includes("loan") ||
    key.toLowerCase().includes("savings") ||
    key.toLowerCase().includes("deduction")
  ) {
    const num = parseFloat(val);
    if (!isNaN(num)) return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMachipId, setShowMachipId] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = parseInt(searchParams.get("page") || "1", 10);
  const [currentPage, setCurrentPage] = useState(urlPage > 0 ? urlPage : 1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");

  useEffect(() => {
    const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);
    if (pageFromUrl > 0 && pageFromUrl !== currentPage) {
      setCurrentPage(pageFromUrl);
    }
  }, [searchParams]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(newPage));
      return next;
    }, { replace: true });
  };

  // Transparency & Activity Log States
  const [activeProfileTab, setActiveProfileTab] = useState("attendance"); // "attendance" | "transparency"
  const [transparencyData, setTransparencyData] = useState({ transparencyTrail: [], personalActivity: [] });
  const [transparencySubTab, setTransparencySubTab] = useState("admin"); // "admin" | "personal"
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [adminLogPage, setAdminLogPage] = useState(1);
  const [personalLogPage, setPersonalLogPage] = useState(1);
  const LOGS_PER_PAGE = 8;

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
      const storedUserData = getStoredUser();
      const userId = storedUserData?.user_Id;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const [userRes, logsRes, transRes] = await Promise.allSettled([
          fetchWithAuth(`/api/users/${userId}`),
          fetchWithAuth(`/api/attendance/logs/${userId}`),
          fetchWithAuth("/api/system/my-transparency-logs")
        ]);

        if (userRes.status === "fulfilled" && userRes.value.ok) {
          const userData = await userRes.value.json();
          setUser(userData);
          setStoredUser(userData);
        }
        
        if (logsRes.status === "fulfilled" && logsRes.value.ok) {
          const logsData = await logsRes.value.json();
          setAttendanceLogs(Array.isArray(logsData) ? logsData : []);
        }

        if (transRes.status === "fulfilled" && transRes.value.ok) {
          const tData = await transRes.value.json();
          setTransparencyData(tData || { transparencyTrail: [], personalActivity: [] });
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
                <Card className="shadow-sm border-0 bg-brand-primary-light/50 py-0 h-full min-w-0">
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

                <Card className="shadow-sm border-0 bg-accent-green/10 py-0 h-full min-w-0">
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
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[13px] font-bold text-accent-gold uppercase tracking-wider">MaChip Biometrics</p>
                          {user.user_MachipId && (
                            <button
                              type="button"
                              onClick={() => setShowMachipId(!showMachipId)}
                              className="text-accent-gold/70 hover:text-accent-gold focus:outline-none transition-colors"
                              title={showMachipId ? "Hide UID" : "Show UID"}
                            >
                              {showMachipId ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                            </button>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-accent-gold font-mono leading-tight max-w-[200px] truncate">
                          {user.user_MachipId 
                            ? (showMachipId ? user.user_MachipId : "••••••••" + (user.user_MachipId.length > 4 ? user.user_MachipId.slice(-4) : ""))
                            : "Unlinked"}
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

              {/* Primary Profile Tabs Navigation */}
              <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab} className="w-full sm:w-auto">
                  <TabsList className="bg-slate-200/80 p-1 w-full sm:w-auto grid grid-cols-2">
                    <TabsTrigger value="attendance" className="text-xs font-bold gap-2 py-2 px-4 data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs">
                      <Calendar className="w-4 h-4 text-brand-primary" /> Attendance & Time Tracking
                    </TabsTrigger>
                    <TabsTrigger value="transparency" className="text-xs font-bold gap-2 py-2 px-4 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs">
                      <Shield className="w-4 h-4 text-emerald-600" /> Data Transparency & Logs
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {activeProfileTab === "transparency" && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs py-1 px-3 self-start sm:self-auto font-medium">
                    <Shield className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" /> RA 10173 DPA Protected
                  </Badge>
                )}
              </div>

              {activeProfileTab === "attendance" && (
                <>
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
              <Card className="py-0 border border-slate-200/80 shadow-sm bg-white mb-6 overflow-hidden">
                <CardHeader className="border-b border-slate-100 pt-8 px-6 bg-slate-50/50 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      
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
                          {/* <TableHead className="font-semibold text-slate-600 text-center uppercase text-[11px] tracking-wider py-3.5">Log Type</TableHead> */}
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
                                {/* <TableCell className="text-center py-2.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${
                                    log.logStatus === "Overtime OUT"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : log.logStatus === "Afternoon OUT"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : log.logStatus?.includes("In")
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : log.logStatus?.includes("Out")
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      log.logStatus === "Overtime OUT"
                                        ? "bg-purple-500"
                                        : log.logStatus?.includes("In")
                                        ? "bg-emerald-500"
                                        : log.logStatus?.includes("Out")
                                        ? "bg-indigo-500"
                                        : "bg-slate-400"
                                    }`} />
                                    {log.logStatus || "—"}
                                  </span>
                                </TableCell> */}
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
                    setCurrentPage={handlePageChange}
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

          {/* DATA TRANSPARENCY & AUDIT TRAIL (RA 10173 SECTION 16 COMPLIANCE) */}
          {activeProfileTab === "transparency" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Legal Banner */}
              <Card className="border-l-4 border-l-emerald-600 border-slate-200/80 shadow-xs bg-white py-0">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Employee Data Transparency & Right of Access</h3>
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">SEC. 16 COMPLIANT</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Under the Philippine <strong>Data Privacy Act of 2012 (RA 10173)</strong>, you have the full statutory right to review every administrative access or change made to your profile, wage rate, and deductions, alongside your personal terminal punch history.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Sub-Tabs: Admin Access Trail vs. Personal System Activity */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setTransparencySubTab("admin")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transparencySubTab === "admin"
                      ? "bg-brand-primary text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Admin Access & Changes
                  <Badge variant="secondary" className={`ml-1 text-[10px] ${transparencySubTab === "admin" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {transparencyData.transparencyTrail?.length || 0}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setTransparencySubTab("personal")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transparencySubTab === "personal"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  My System & Hardware History
                  <Badge variant="secondary" className={`ml-1 text-[10px] ${transparencySubTab === "personal" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {transparencyData.personalActivity?.length || 0}
                  </Badge>
                </button>
              </div>

              {/* Sub-Panel 1: Admin Access & Changes Table */}
              {transparencySubTab === "admin" && (
                <Card className="py-0 border border-slate-200/80 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">Administrative Transparency Audit Trail</CardTitle>
                      <p className="text-xs text-slate-500">Record of who in HR / Administration viewed or updated your employee data</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-xs">
                      {transparencyData.transparencyTrail?.length || 0} Total Events
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[800px] md:min-w-full text-xs">
                      <TableHeader className="bg-brand-primary">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-3.5 px-6 uppercase text-xs w-[180px]">Date & Time</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs w-[200px]">Administrator</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs w-[200px]">Action Category</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs">Operational Summary</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 text-right pr-6 uppercase text-xs w-[80px]">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transparencyData.transparencyTrail?.length > 0 ? (
                          transparencyData.transparencyTrail
                            .slice((adminLogPage - 1) * LOGS_PER_PAGE, adminLogPage * LOGS_PER_PAGE)
                            .map((log) => {
                              const action = (log.action || "").toUpperCase();
                              let headline = "Updated account details";
                              let badgeColor = "bg-blue-100 text-blue-800 border-blue-200";

                              if (action.includes("RATE")) {
                                headline = "Adjusted daily wage rate";
                                badgeColor = "bg-amber-100 text-amber-800 border-amber-200";
                              } else if (action.includes("DEDUCT")) {
                                headline = "Updated statutory / loan deductions";
                                badgeColor = "bg-purple-100 text-purple-800 border-purple-200";
                              } else if (action.includes("DELETE") || action.includes("DEACT")) {
                                headline = "Deactivated employee profile access";
                                badgeColor = "bg-rose-100 text-rose-800 border-rose-200";
                              } else if (action.includes("RESTORE")) {
                                headline = "Restored employee profile access";
                                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                              } else if (action.includes("CREATE")) {
                                headline = "Registered initial employee account";
                                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                              }

                              return (
                                <TableRow key={log.auditId} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                                  <TableCell className="text-slate-600 text-xs py-3.5 px-6 font-medium whitespace-nowrap">
                                    <div className="font-bold text-slate-800">
                                      {new Date(log.createdAt).toLocaleDateString("en-US", {
                                        timeZone: "Asia/Manila",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                      })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {new Date(log.createdAt).toLocaleTimeString("en-US", {
                                        timeZone: "Asia/Manila",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      })}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3.5">
                                    <p className="font-bold text-slate-900 text-xs">
                                      {log.admin_FirstName ? `${log.admin_FirstName} ${log.admin_LastName}` : "System Automated"}
                                    </p>
                                    <Badge variant="outline" className="mt-0.5 text-[10px] font-bold bg-slate-100 text-slate-700">
                                      {log.admin_Role || "Administrator"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3.5">
                                    <Badge variant="outline" className={`${badgeColor} uppercase tracking-wider text-[10px] font-bold py-0.5 px-2`}>
                                      {log.action.replace(/_/g, " ")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs py-3.5">
                                    <p className="font-semibold text-slate-800">{headline}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Module: <span className="font-mono font-medium">{log.module || "System"}</span> • Target: <span className="font-mono">{log.target_Table || "Profile"}</span>
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right pr-6 py-3.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedAuditLog(log)}
                                      className="border-brand-primary text-brand-primary hover:text-brand-primary-hover hover:bg-brand-primary-light h-8 px-2.5 text-xs gap-1"
                                    >
                                      <Eye className="w-3.5 h-3.5" /> View
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-xs italic">
                              No administrative modifications have been recorded for your account.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    {transparencyData.transparencyTrail?.length > LOGS_PER_PAGE && (
                      <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Showing {(adminLogPage - 1) * LOGS_PER_PAGE + 1} to {Math.min(adminLogPage * LOGS_PER_PAGE, transparencyData.transparencyTrail.length)} of {transparencyData.transparencyTrail.length}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={adminLogPage === 1}
                            onClick={() => setAdminLogPage(p => Math.max(1, p - 1))}
                            className="h-7 text-xs"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={adminLogPage * LOGS_PER_PAGE >= transparencyData.transparencyTrail.length}
                            onClick={() => setAdminLogPage(p => p + 1)}
                            className="h-7 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sub-Panel 2: My System & Hardware History Table */}
              {transparencySubTab === "personal" && (
                <Card className="py-0 border border-slate-200/80 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">My System & Punch Activity</CardTitle>
                      <p className="text-xs text-slate-500">Logins, physical RFID terminal taps, biometric scans, and submitted requests</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-xs">
                      {transparencyData.personalActivity?.length || 0} Total Events
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[800px] md:min-w-full text-xs">
                      <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-3.5 px-6 uppercase text-xs w-[180px]">Date & Time</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs w-[180px]">Event Type</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs">Operational Description</TableHead>
                          <TableHead className="font-semibold text-white py-3.5 uppercase text-xs w-[160px]">Device / IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transparencyData.personalActivity?.length > 0 ? (
                          transparencyData.personalActivity
                            .slice((personalLogPage - 1) * LOGS_PER_PAGE, personalLogPage * LOGS_PER_PAGE)
                            .map((t) => {
                              const type = (t.event_Type || "").toUpperCase();
                              let badgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                              if (type.includes("TIME_IN") || type.includes("TIME_OUT") || type.includes("ATTENDANCE")) {
                                badgeColor = "bg-teal-100 text-teal-800 border-teal-200";
                              } else if (type.includes("LOGIN") || type.includes("AUTH")) {
                                badgeColor = "bg-blue-100 text-blue-800 border-blue-200";
                              } else if (type.includes("PAYROLL")) {
                                badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                              } else if (type.includes("FAIL") || type.includes("UNAUTH")) {
                                badgeColor = "bg-rose-100 text-rose-800 border-rose-200";
                              }

                              return (
                                <TableRow key={t.transId} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                                  <TableCell className="text-slate-600 text-xs py-3.5 px-6 font-medium whitespace-nowrap">
                                    <div className="font-bold text-slate-800">
                                      {new Date(t.createdAt).toLocaleDateString("en-US", {
                                        timeZone: "Asia/Manila",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                      })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {new Date(t.createdAt).toLocaleTimeString("en-US", {
                                        timeZone: "Asia/Manila",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit"
                                      })}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3.5">
                                    <Badge variant="outline" className={`${badgeColor} uppercase tracking-wider text-[10px] font-bold py-0.5 px-2`}>
                                      {t.event_Type.replace(/_/g, " ")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs py-3.5">
                                    <p className="font-medium text-slate-900 leading-snug">
                                      {t.description || "Operational event recorded in system"}
                                    </p>
                                  </TableCell>
                                  <TableCell className="py-3.5 whitespace-nowrap">
                                    <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      {t.ip_Address || "Internal"}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-slate-400 text-xs italic">
                              No personal activity logs recorded.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    {transparencyData.personalActivity?.length > LOGS_PER_PAGE && (
                      <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Showing {(personalLogPage - 1) * LOGS_PER_PAGE + 1} to {Math.min(personalLogPage * LOGS_PER_PAGE, transparencyData.personalActivity.length)} of {transparencyData.personalActivity.length}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={personalLogPage === 1}
                            onClick={() => setPersonalLogPage(p => Math.max(1, p - 1))}
                            className="h-7 text-xs"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={personalLogPage * LOGS_PER_PAGE >= transparencyData.personalActivity.length}
                            onClick={() => setPersonalLogPage(p => p + 1)}
                            className="h-7 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Detailed Audit Diff Dialog for Employee */}
          <Dialog open={!!selectedAuditLog} onOpenChange={() => setSelectedAuditLog(null)}>
            <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden rounded-xl bg-white shadow-2xl border-0">
              {selectedAuditLog && (() => {
                let oldVal = {};
                let newVal = {};
                try {
                  oldVal = typeof selectedAuditLog.old_Value === "object" ? (selectedAuditLog.old_Value || {}) : JSON.parse(selectedAuditLog.old_Value || "{}");
                  newVal = typeof selectedAuditLog.new_Value === "object" ? (selectedAuditLog.new_Value || {}) : JSON.parse(selectedAuditLog.new_Value || "{}");
                } catch (e) {}

                const allChangedKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]))
                  .filter(k => !["createdAt", "updatedAt", "deletedAt", "user_Password", "password"].includes(k));

                return (
                  <div className="space-y-0">
                    <div className="bg-brand-primary text-white p-5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <Badge className="bg-emerald-400 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
                          DPA AUDIT RECORD #{selectedAuditLog.auditId}
                        </Badge>
                        <span className="text-xs text-purple-200 font-mono">
                          {new Date(selectedAuditLog.createdAt).toLocaleString("en-US", { timeZone: "Asia/Manila" })}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedAuditLog.action.replace(/_/g, " ")}
                      </h3>
                      <p className="text-purple-100 text-xs mt-1">
                        Modified by <strong>{selectedAuditLog.admin_FirstName} {selectedAuditLog.admin_LastName}</strong> ({selectedAuditLog.admin_Role || "Administrator"})
                      </p>
                    </div>

                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800">
                        <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>This verified log record confirms the exact attributes modified by management during this administrative session.</span>
                      </div>

                      {allChangedKeys.length > 0 ? (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Modified Data Fields ({allChangedKeys.length})
                          </h4>
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                            {allChangedKeys.map((key) => {
                              const friendlyName = PROPERTY_FRIENDLY_NAMES[key] || key.replace(/_/g, " ");
                              const before = formatFriendlyValue(key, oldVal[key]);
                              const after = formatFriendlyValue(key, newVal[key]);
                              return (
                                <div key={key} className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-white hover:bg-slate-50/50">
                                  <div className="font-bold text-slate-700 capitalize sm:col-span-1">
                                    {friendlyName}
                                  </div>
                                  <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded line-through text-[11px]">
                                      {before}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">→</span>
                                    <span className="text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                                      {after}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-slate-400 italic text-xs py-6">
                          No direct property diffs recorded for this administrative event.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  </Sidebar>
</div>
  );
};

export default Profile;