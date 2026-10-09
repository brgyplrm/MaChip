import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { fetchWithAuth } from "../../utils/api";
import { formatTime12h } from "../../utils/formatTime";
import { useSystemTime } from "../../context/SystemTimeContext";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Icons
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HistoryIcon from '@mui/icons-material/History';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import { Eye, EyeOff, ShieldAlert, AlertCircle, Loader2 } from "lucide-react";

const VisitorLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "history" ? "history" : "live";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Solenoid Door Release Confirmation Modal States
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [visitorReason, setVisitorReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const { systemToday } = useSystemTime();
  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isManagement = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  // History Tab Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "opening", "closed"

  // History Pagination States
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);

  // Derive today's formatted string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = systemToday || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [systemToday]);

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tabValue === "history") next.set("tab", "history");
      else next.delete("tab");
      return next;
    });
  };

  const fetchVisitorLogs = useCallback(async () => {
    try {
      // Fetch logs specifically for Visitor User (ID 999)
      // The backend attendance controller handles user_Id filtering
      const response = await fetchWithAuth("/api/attendance/all?user_Id=999");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.map(log => ({
          ...log,
          time: formatTime12h(log.time_Logged),
          date: String(log.log_Date).split('T')[0]
        })));
      }
    } catch (err) {
      console.error("Error fetching visitor logs:", err);
    }
  }, []);

  useEffect(() => {
    fetchVisitorLogs();
    // Real-time polling for access events
    const interval = setInterval(fetchVisitorLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchVisitorLogs]);

  const handleOpenDoorClick = () => {
    setAdminPassword("");
    setVisitorReason("");
    setShowPassword(false);
    setConfirmError("");
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirmModal = () => {
    if (confirming) return;
    setIsConfirmModalOpen(false);
    setAdminPassword("");
    setVisitorReason("");
    setShowPassword(false);
    setConfirmError("");
  };

  const handleConfirmOpenDoor = async (e) => {
    if (e) e.preventDefault();
    if (!visitorReason.trim()) {
      setConfirmError("Please enter a reason or purpose for opening the door.");
      return;
    }
    if (!adminPassword) {
      setConfirmError("Please enter your administrator password.");
      return;
    }

    setConfirming(true);
    setConfirmError("");

    try {
      // 1. Verify admin password
      const verifyRes = await fetchWithAuth("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        setConfirmError(verifyData.error || "Incorrect administrator password.");
        setConfirming(false);
        return;
      }

      // 2. Trigger visitor door release with reason and confirmation password
      const accessRes = await fetchWithAuth("/api/esp/visitor-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: visitorReason.trim(), password: adminPassword }),
      });
      const accessData = await accessRes.json();

      if (accessRes.ok) {
        setToast({ message: "Door opening signal sent and logged successfully!", type: "success" });
        setIsConfirmModalOpen(false);
        setAdminPassword("");
        setVisitorReason("");
        setConfirmError("");
        await fetchVisitorLogs();
      } else {
        setConfirmError(accessData.message || "Failed to trigger visitor access.");
      }
    } catch (err) {
      console.error("Error confirming visitor access:", err);
      setConfirmError("An unexpected error occurred while connecting to the server.");
    } finally {
      setConfirming(false);
    }
  };

  const dismissToast = () => setToast({ message: "", type: "success" });

  // ------------------ LIVE / TODAY DATA ------------------
  const todayLogs = useMemo(() => {
    return logs.filter(l => l.date === todayStr);
  }, [logs, todayStr]);

  const todayVisits = todayLogs.filter(l => l.loggedStatusName?.includes("Opening")).length;
  const lastEntryTime = todayLogs.find(l => l.loggedStatusName?.includes("Opening"))?.time || "—";

  // ------------------ HISTORY DATA & FILTERING ------------------
  const filteredHistoryLogs = useMemo(() => {
    return logs.filter(item => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDesc = item.loggedStatusName?.toLowerCase().includes(q);
        const matchDate = item.date?.toLowerCase().includes(q);
        const matchTime = item.time?.toLowerCase().includes(q);
        const matchId = String(item.user_loggingId).includes(q);
        const matchReason = item.reason?.toLowerCase().includes(q);
        const matchAdminId = item.adminDisplayId?.toLowerCase().includes(q) || String(item.admin_id || "").includes(q);
        const matchAdminName = item.adminName?.toLowerCase().includes(q);
        if (!matchDesc && !matchDate && !matchTime && !matchId && !matchReason && !matchAdminId && !matchAdminName) return false;
      }

      // 2. Date Range
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      // 3. Status Filter
      if (statusFilter === "opening" && !item.loggedStatusName?.includes("Opening")) return false;
      if (statusFilter === "closed" && !item.loggedStatusName?.includes("Closed")) return false;

      return true;
    });
  }, [logs, searchQuery, startDate, endDate, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setHistoryPage(1);
  }, [searchQuery, startDate, endDate, statusFilter, historyItemsPerPage]);

  const totalHistoryItems = filteredHistoryLogs.length;
  const totalHistoryPages = Math.ceil(totalHistoryItems / historyItemsPerPage) || 1;
  const historyStartIndex = (historyPage - 1) * historyItemsPerPage;
  const historyEndIndex = Math.min(historyStartIndex + historyItemsPerPage, totalHistoryItems);
  const currentHistoryLogs = filteredHistoryLogs.slice(historyStartIndex, historyEndIndex);

  const isFilteringHistory = searchQuery !== "" || startDate !== "" || endDate !== "" || statusFilter !== "all";

  const handleClearHistoryFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setHistoryPage(1);
  };

  // CSV Export for Compliance & Auditing
  const handleExportCSV = () => {
    if (filteredHistoryLogs.length === 0) return;

    const headers = "Log ID,Date,Time,Event Description,Purpose / Reason,Authorized By (Admin ID),Admin Name,Virtual Account,Status\n";
    const rows = filteredHistoryLogs.map(l => {
      const isOpening = l.loggedStatusName?.includes("Opening");
      const sanitizedReason = (l.reason || (isOpening ? "N/A" : "Solenoid locked")).replace(/"/g, '""');
      const adminId = l.adminDisplayId || (l.admin_id ? `MACJ-${String(l.admin_id).padStart(3, "0")}` : (isOpening ? "N/A" : "Hardware Sensor"));
      const adminName = (l.adminName || (isOpening ? "N/A" : "Hardware Sensor")).replace(/"/g, '""');
      return `${l.user_loggingId},"${l.date}","${l.time}","${l.loggedStatusName || 'Visitor Event'}","${sanitizedReason}","${adminId}","${adminName}","VISITOR-999","${isOpening ? "Authorized" : "Closed"}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Visitor_Access_History_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // History Stats
  const historyOpeningCount = filteredHistoryLogs.filter(l => l.loggedStatusName?.includes("Opening")).length;
  const historyUniqueDays = new Set(filteredHistoryLogs.map(l => l.date)).size;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-6 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
            <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

            {/* --- PAGE HEADER & TABS NAVIGATION --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-bold text-brand-primary tracking-tight">Visitor Access</h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeTab === "live"
                        ? "Real-time solenoid hardware trigger & daily guest entry stream"
                        : "Historical access logs, date filtering, and compliance export"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs Switcher */}
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
                <TabsList className="bg-slate-100 border border-slate-200/80 p-1 rounded-xl h-11 grid grid-cols-2 w-full sm:w-[280px]">
                  <TabsTrigger
                    value="live"
                    className="rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs transition-all"
                  >
                    <LockOpenIcon sx={{ fontSize: 16 }} />
                    <span>Live Access</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs transition-all"
                  >
                    <HistoryIcon sx={{ fontSize: 16 }} />
                    <span>Log History</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* ========================================================= */}
            {/* TAB 1: LIVE ACCESS TAB                                   */}
            {/* ========================================================= */}
            {activeTab === "live" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Solenoid Control Banner */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 border-l-4 border-l-brand-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h2 className="text-lg font-bold tracking-tight text-brand-primary">Manual Hardware Solenoid Control</h2>
                    </div>
                    <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                      Momentarily triggers the physical ESP32 solenoid lock to allow authorized guests into the facility. All operations require password confirmation and are logged under <span className="inline-flex items-center font-mono font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md border border-brand-primary/20 text-[11px]">VISITOR-999</span>.
                    </p>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full md:w-auto inline-block">
                        <Button
                          onClick={handleOpenDoorClick}
                          disabled={loading || confirming || !isManagement}
                          className={`w-full md:w-auto text-white px-6 py-6 rounded-xl shadow-md flex items-center gap-3 transition-all font-bold border-0 ${
                            isManagement 
                              ? "bg-brand-primary hover:bg-[#1f103a] cursor-pointer active:scale-95 group" 
                              : "bg-slate-300 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          <LockOpenIcon className={isManagement ? "group-hover:rotate-12 transition-transform text-white" : "text-slate-500"} />
                          <div className="flex flex-col items-start text-left">
                            <span className="text-sm font-black uppercase tracking-wider leading-none text-white">
                              Open Door
                            </span>
                            <span className="text-[10px] text-purple-200 font-medium">
                              {isManagement ? "Trigger 12V Solenoid" : "Management Only"}
                            </span>
                          </div>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      {isManagement 
                        ? "Requires admin authorization to unlock entrance terminal." 
                        : "Entrance door release is restricted to Admin Manager and Accountant."}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* 3 Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
                  {/* Card 1: Today's Entries */}
                  <Card className="border-t-5 border-brand-primary bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Today's Total Entries</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800">
                              Count of successful visitor gate unlocks today.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-4xl font-black text-brand-primary">{todayVisits}</p>
                          <span className="text-slate-400 text-xs font-medium">{todayVisits === 1 ? "visitor entry" : "visitor entries"}</span>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 italic mt-4">For {todayStr}</p>
                    </CardContent>
                  </Card>

                  {/* Card 2: Last Entry Detected */}
                  <Card className="border-t-5 border-accent-green bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Last Entry Detected</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-accent-green cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800">
                              Precise timestamp of the latest guest entry today.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-3xl font-black text-accent-green">{lastEntryTime}</p>
                          <span className="text-slate-400 text-xs font-medium">PHST</span>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 italic mt-4">Most recent authorized opening</p>
                    </CardContent>
                  </Card>

                  {/* Card 3: Virtual Account */}
                  <Card className="border-t-5 border-accent-gold bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">System User</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-accent-gold cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800">
                              Virtual employee ID mapped to all visitor log entries.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-3xl font-black text-accent-gold">VISITOR-999</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 italic mt-4">Standardized compliance entity</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Today's Real-Time Event Table */}
                <Card className="shadow-xs border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wide">
                        Today's Access Stream
                      </h3>
                      <Badge variant="outline" className="bg-white text-slate-600 text-[10px] font-semibold border-slate-200">
                        {todayLogs.length} events
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <CalendarMonthIcon sx={{ fontSize: 14 }} className="text-slate-400" />
                      <span>{todayStr}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-brand-primary font-bold py-4 px-6 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Time</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Event Description</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Purpose / Reason</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Authorized By</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider text-right pr-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayLogs.length > 0 ? (
                          todayLogs.map((log) => {
                            const isOpening = log.loggedStatusName?.includes("Opening");
                            return (
                              <TableRow key={log.user_loggingId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                                <TableCell className="py-4 px-6 font-semibold text-slate-700">{log.date}</TableCell>
                                <TableCell className="py-4 font-mono text-slate-600 text-xs font-semibold">{log.time}</TableCell>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isOpening ? 'bg-purple-100 text-brand-primary' : 'bg-slate-100 text-slate-600'}`}>
                                      <AccessTimeIcon sx={{ fontSize: 16 }} />
                                    </div>
                                    <span className="font-semibold text-slate-800 text-sm">{log.loggedStatusName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4 max-w-[220px]">
                                  {isOpening ? (
                                    log.reason ? (
                                      <span className="text-xs font-semibold text-slate-800 line-clamp-2" title={log.reason}>
                                        {log.reason}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">No reason provided</span>
                                    )
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Solenoid locked</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-4">
                                  {isOpening ? (
                                    log.adminDisplayId || log.admin_id ? (
                                      <div className="flex flex-col items-start gap-0.5">
                                        <Badge variant="outline" className="font-mono text-[11px] font-bold text-brand-primary bg-purple-50/80 border-purple-200">
                                          {log.adminDisplayId || `ID #${log.admin_id}`}
                                        </Badge>
                                        {log.adminName && (
                                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]" title={log.adminName}>
                                            {log.adminName}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 font-mono">—</span>
                                    )
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Hardware Sensor</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-4 text-right pr-6">
                                  <Badge
                                    variant="secondary"
                                    className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                      isOpening
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    {isOpening ? "Authorized" : "Closed"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                                  <MeetingRoomIcon sx={{ fontSize: 36 }} />
                                </div>
                                <p className="font-bold text-slate-700 text-base">No Visitor Entries Recorded Today</p>
                                <p className="text-xs text-slate-500 max-w-sm">
                                  Events for {todayStr} will appear here in real-time as visitors arrive and the door release is triggered.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleTabChange("history")}
                                  className="mt-2 text-xs font-bold text-brand-primary border-brand-primary/30 hover:bg-purple-50"
                                >
                                  <HistoryIcon sx={{ fontSize: 14 }} className="mr-1" />
                                  View Past Visitor History
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: HISTORY TAB                                       */}
            {/* ========================================================= */}
            {activeTab === "history" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 3 History Summary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
                  <Card className="border-t-5 border-brand-primary bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5">
                      <p className="text-xs font-bold text-brand-primary uppercase tracking-wider mb-1">Total Logs Filtered</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-3xl font-black text-brand-primary">{totalHistoryItems}</p>
                        <span className="text-slate-400 text-xs font-medium">records</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Matching active search & filters</p>
                    </CardContent>
                  </Card>

                  <Card className="border-t-5 border-accent-green bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5">
                      <p className="text-xs font-bold text-accent-green uppercase tracking-wider mb-1">Authorized Openings</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-3xl font-black text-accent-green">{historyOpeningCount}</p>
                        <span className="text-slate-400 text-xs font-medium">entry unlocks</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Verified visitor door releases</p>
                    </CardContent>
                  </Card>

                  <Card className="border-t-5 border-accent-gold bg-white shadow-xs rounded-xl py-0">
                    <CardContent className="p-5">
                      <p className="text-xs font-bold text-accent-gold uppercase tracking-wider mb-1">Active Visitor Days</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-3xl font-black text-accent-gold">{historyUniqueDays}</p>
                        <span className="text-slate-400 text-xs font-medium">distinct dates</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Days with logged visitor foot traffic</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Filters & Actions Card */}
                <Card className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[220px]">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" sx={{ fontSize: 18 }} />
                      <Input
                        placeholder="Search event, date (YYYY-MM-DD), or time..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 border-slate-200 text-sm rounded-xl focus:bg-white focus:border-purple-400"
                      />
                    </div>

                    {/* Date Range Selectors */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">From:</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">To:</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    {/* <div className="w-full lg:w-48">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-slate-50 border-slate-200 rounded-xl text-xs font-semibold text-slate-700 h-10">
                          <SelectValue placeholder="Event Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="all">All Event Types</SelectItem>
                          <SelectItem value="opening">Authorized Opening</SelectItem>
                          <SelectItem value="closed">Door Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}

                    {/* Reset & Export Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isFilteringHistory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearHistoryFilters}
                          className="text-rose-600 hover:bg-rose-50 text-xs font-semibold h-10 px-3 rounded-xl"
                          title="Reset Filters"
                        >
                          <RestartAltIcon sx={{ fontSize: 16 }} className="mr-1" />
                          Clear
                        </Button>
                      )}

                      {/* <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        disabled={filteredHistoryLogs.length === 0}
                        className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold h-10 px-4 rounded-xl shadow-xs"
                      >
                        <FileDownloadIcon sx={{ fontSize: 16 }} className="mr-1 text-slate-500" />
                        Export CSV
                      </Button> */}
                    </div>
                  </div>
                </Card>

                {/* History Table */}
                <Card className="shadow-xs border border-slate-200/80 bg-white rounded-2xl overflow-hidden py-2">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <HistoryIcon sx={{ fontSize: 18 }} className="text-brand-primary" />
                      <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wide">
                        Historical Access Archive
                      </h3>
                      <Badge variant="outline" className="bg-white text-slate-600 text-[10px] font-semibold border-slate-200">
                        {totalHistoryItems} total logs
                      </Badge>
                    </div>
                    {isFilteringHistory && (
                      <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                        Filtered Results Active
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-brand-primary font-bold py-4 px-6 uppercase text-xs tracking-wider">Log ID</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Time</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Event Description</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Purpose / Reason</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Authorized By</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider">Mapped Account</TableHead>
                          <TableHead className="text-brand-primary font-bold py-4 uppercase text-xs tracking-wider text-right pr-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentHistoryLogs.length > 0 ? (
                          currentHistoryLogs.map((log) => {
                            const isOpening = log.loggedStatusName?.includes("Opening");
                            return (
                              <TableRow key={log.user_loggingId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                                <TableCell className="py-4 px-6 font-mono text-xs text-slate-400 font-semibold">
                                  #{log.user_loggingId}
                                </TableCell>
                                <TableCell className="py-4 font-semibold text-slate-700 text-xs">{log.date}</TableCell>
                                <TableCell className="py-4 font-mono text-slate-600 text-xs font-semibold">{log.time}</TableCell>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-full ${isOpening ? 'bg-purple-100 text-brand-primary' : 'bg-slate-100 text-slate-500'}`}>
                                      <AccessTimeIcon sx={{ fontSize: 14 }} />
                                    </div>
                                    <span className="font-semibold text-slate-800 text-xs">{log.loggedStatusName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4 max-w-[220px]">
                                  {isOpening ? (
                                    log.reason ? (
                                      <span className="text-xs text-slate-800 font-medium line-clamp-2" title={log.reason}>
                                        {log.reason}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">No reason provided</span>
                                    )
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Solenoid locked</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-4">
                                  {isOpening ? (
                                    log.adminDisplayId || log.admin_id ? (
                                      <div className="flex flex-col items-start gap-0.5">
                                        <Badge variant="outline" className="font-mono text-[11px] font-bold text-brand-primary bg-purple-50/80 border-purple-200">
                                          {log.adminDisplayId || `ID #${log.admin_id}`}
                                        </Badge>
                                        {log.adminName && (
                                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]" title={log.adminName}>
                                            {log.adminName}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 font-mono">—</span>
                                    )
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Hardware Sensor</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-4">
                                  <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    VISITOR-999
                                  </span>
                                </TableCell>
                                <TableCell className="py-4 text-right pr-6">
                                  <Badge
                                    variant="secondary"
                                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                      isOpening
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    {isOpening ? "Authorized" : "Closed"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                                  <HistoryIcon sx={{ fontSize: 36 }} />
                                </div>
                                <p className="font-bold text-slate-700 text-base">No Historical Logs Found</p>
                                <p className="text-xs text-slate-500 max-w-sm">
                                  {isFilteringHistory
                                    ? "No visitor logs matched your active date range or search terms. Try clearing your filters."
                                    : "No visitor logs have been recorded in the database yet."}
                                </p>
                                {isFilteringHistory && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearHistoryFilters}
                                    className="mt-2 text-xs font-bold text-brand-primary border-brand-primary/30"
                                  >
                                    <RestartAltIcon sx={{ fontSize: 14 }} className="mr-1" />
                                    Reset Filters
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalHistoryItems > 0 && (
                    <TablePagination
                      currentPage={historyPage}
                      totalPages={totalHistoryPages}
                      setCurrentPage={setHistoryPage}
                      totalItems={totalHistoryItems}
                      itemsPerPage={historyItemsPerPage}
                      setItemsPerPage={setHistoryItemsPerPage}
                      startIndex={historyStartIndex}
                      endIndex={historyEndIndex}
                      itemLabel="visitor logs"
                      pageSizeOptions={[10, 25, 50]}
                    />
                  )}
                </Card>
              </div>
            )}
          </div>
        </TooltipProvider>

        {/* Manual Solenoid Door Release Confirmation Modal */}
        <Dialog open={isConfirmModalOpen} onOpenChange={(open) => !confirming && (open ? setIsConfirmModalOpen(true) : handleCloseConfirmModal())}>
          <DialogContent className="sm:max-w-[480px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
            <DialogHeader className="bg-brand-primary text-white p-6 relative">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <ShieldAlert className="h-6 w-6 text-purple-200" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white leading-tight">
                    Authorize Solenoid Door Release
                  </DialogTitle>
                  <DialogDescription className="text-purple-200 text-xs mt-1">
                    Manual hardware override for guest entrance (<span className="font-mono font-semibold text-white">VISITOR-999</span>).
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleConfirmOpenDoor} className="p-6 space-y-4">
              {confirmError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span className="leading-snug">{confirmError}</span>
                </div>
              )}

              {/* Reason Field */}
              <div className="space-y-1.5">
                <Label htmlFor="visitor-reason" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Purpose / Reason for Entry <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="visitor-reason"
                  placeholder="e.g., Client consultation, Delivery courier, Guest meeting..."
                  value={visitorReason}
                  onChange={(e) => {
                    setVisitorReason(e.target.value);
                    if (confirmError) setConfirmError("");
                  }}
                  disabled={confirming}
                  rows={3}
                  className="resize-none border-slate-200 focus:border-brand-primary text-slate-800 text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500">
                  This note will be recorded in the audit trail and access logs.
                </p>
              </div>

              {/* Admin Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Password Confirmation <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your admin password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (confirmError) setConfirmError("");
                    }}
                    disabled={confirming}
                    className="pr-10 border-slate-200 focus:border-brand-primary text-slate-800 text-sm h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={confirming}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Verify your administrative identity before unlocking the solenoid gate.
                </p>
              </div>

              <DialogFooter className="pt-3 gap-2 sm:gap-2 flex sm:flex-row flex-col-reverse justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseConfirmModal}
                  disabled={confirming}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={confirming || !visitorReason.trim() || !adminPassword}
                  className="bg-brand-primary hover:bg-[#1f103a] text-white font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Verifying & Opening...</span>
                    </>
                  ) : (
                    <>
                      <LockOpenIcon sx={{ fontSize: 18 }} className="text-white" />
                      <span>Confirm & Open Door</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Sidebar>
    </div>
  );
};

export default VisitorLogs;
