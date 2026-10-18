import { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PaymentsIcon from "@mui/icons-material/Payments";
import SyncIcon from "@mui/icons-material/Sync";
import GppBadIcon from "@mui/icons-material/GppBad";
import LanguageIcon from "@mui/icons-material/Language";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";
import { exportToPDF } from "../../utils/pdfExport";
import { EyeIcon, UserCheck, Terminal, Layers, Sparkles, Cpu } from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

const TransactionLog = () => {
  const [transactions, setTransactions] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Dual-Mode Toggle: 'friendly' | 'technical'
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("machip_trans_view_mode") || "friendly");
  const handleToggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("machip_trans_view_mode", mode);
  };

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchTransactionsAndUsers = async () => {
      try {
        const [transRes, usersRes] = await Promise.allSettled([
          fetchWithAuth("/api/system/transaction-logs"),
          fetchWithAuth("/api/users")
        ]);

        if (transRes.status === "fulfilled" && transRes.value.ok) {
          const data = await transRes.value.json();
          if (Array.isArray(data)) {
            setTransactions(data);
          }
        }

        if (usersRes.status === "fulfilled" && usersRes.value.ok) {
          const uData = await usersRes.value.json();
          if (Array.isArray(uData)) {
            const map = {};
            uData.forEach(u => {
              map[u.user_Id] = {
                name: `${u.user_FirstName} ${u.user_LastName}`,
                formattedId: formatUserId(u.user_Id),
                dept: u.positionDepartment || u.department || "",
                position: u.positionTitle || u.position || u.user_Role || ""
              };
            });
            setUsersMap(map);
          }
        }
      } catch (error) {
        console.error("Error fetching transaction logs or users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactionsAndUsers();
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setActionFilter("All Actions");
    setCurrentPage(1);
  };

  const isFiltering = searchTerm !== "" || actionFilter !== "All Actions";

  const getEventLabel = (type) => {
    const labels = {
      "UNAUTHORIZED_SCAN": "Unauthorized scan",
      "UNRECOGNIZED_SCAN": "Unrecognized card or scan",
      "IRREGULAR_LOG": "Irregular logs",
      "ATTENDANCE_LOG_SUSPICIOUS": "Suspicious Activity",
      "2FA_FAILURE": "Biometric Mismatch",
      "PAYROLL_RELEASE": "Payroll Released",
      "BATCH_PAYROLL_GEN": "Batch Payroll Generation",
      "TIME_IN": "Time In Recorded",
      "TIME_OUT": "Time Out Recorded"
    };
    return labels[type] || type.replace(/_/g, " ");
  };

  const getFriendlyEvent = (t) => {
    const targetUser = t.user_Id && usersMap[t.user_Id] ? usersMap[t.user_Id] : null;
    const initiatorUser = t.initiated_By && usersMap[t.initiated_By] ? usersMap[t.initiated_By] : null;

    const actorName = t.admin_FirstName 
      ? `${t.admin_FirstName} ${t.admin_LastName}`
      : t.emp_FirstName
        ? `${t.emp_FirstName} ${t.emp_LastName}`
        : initiatorUser
          ? initiatorUser.name
          : "System Automated";

    const actorId = t.initiated_By 
      ? formatUserId(t.initiated_By) 
      : t.user_Id 
        ? formatUserId(t.user_Id) 
        : "SYS-000";

    const targetLabel = targetUser 
      ? `${targetUser.name} (${targetUser.formattedId})`
      : t.user_Id 
        ? `Employee #${formatUserId(t.user_Id)}` 
        : "System Core";

    const type = (t.event_Type || "").toUpperCase();

    if (type === "PAYROLL_RELEASE") {
      return {
        badge: "Payroll Released",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        headline: "Disbursed employee payroll funds",
        narrative: t.description || "Successfully released and finalized payroll payouts for employees.",
        actor: actorName,
        actorId,
        target: targetLabel,
        explanation: "A payroll release finalizes calculations and marks wages as officially disbursed to employee accounts."
      };
    }

    if (type === "BATCH_PAYROLL_GEN") {
      return {
        badge: "Batch Payroll",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        headline: "Generated bulk payroll calculations",
        narrative: t.description || "Executed automated computation across active employee roster for the current cutoff.",
        actor: actorName,
        actorId,
        target: "Active Roster",
        explanation: "Automated engine processed time cards, daily rates, and statutory contribution formulas in bulk."
      };
    }

    if (type === "UNAUTHORIZED_SCAN" || type === "UNRECOGNIZED_SCAN") {
      return {
        badge: "Unknown Badge",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        headline: "Hardware reader scanned unknown RFID / Card",
        narrative: t.description || "An unregistered badge or card was tapped on the terminal.",
        actor: "Physical Terminal",
        actorId: t.ip_Address || "READER",
        target: "Terminal Access Gate",
        explanation: "A card UID was scanned by the MFRC522 reader that does not match any enrolled employee profile in the database."
      };
    }

    if (type === "2FA_FAILURE" || type === "BIOMETRIC_MISMATCH") {
      return {
        badge: "Biometric Mismatch",
        badgeColor: "bg-red-100 text-red-800 border-red-200",
        headline: "Fingerprint verification failed",
        narrative: t.description || "Fingerprint scan did not match the enrolled template for this card.",
        actor: actorName !== "System Automated" ? actorName : "Biometric Reader",
        actorId,
        target: targetLabel,
        explanation: "Two-factor authentication requirement failed: the fingerprint presented at sensor R307 did not match the user associated with the scanned RFID card."
      };
    }

    if (type === "IRREGULAR_LOG" || type === "ATTENDANCE_LOG_SUSPICIOUS") {
      return {
        badge: "Irregular Punch",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        headline: "Flagged irregular attendance punch",
        narrative: t.description || "A time log was recorded outside regular shift parameters or in rapid succession.",
        actor: actorName,
        actorId,
        target: targetLabel,
        explanation: "The system flagged an attendance event because timestamps were unusually clustered (possible duplicate swipe) or recorded during non-standard hours."
      };
    }

    if (type.includes("LOGIN_FAIL") || type.includes("AUTH_FAIL")) {
      return {
        badge: "Failed Login",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        headline: "Authentication challenge rejected",
        narrative: t.description || "Invalid credentials provided during login attempt.",
        actor: actorName,
        actorId,
        target: "Security Gateway",
        explanation: "A user or external client attempted to authenticate with an incorrect password, expired token, or invalid session."
      };
    }

    if (type.includes("LOGIN") || type.includes("SIGNIN")) {
      return {
        badge: "User Sign In",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
        headline: "Signed in to the MaChip Web Portal",
        narrative: t.description || "Authenticated web portal session initiated.",
        actor: actorName,
        actorId,
        target: "System Session",
        explanation: "User successfully verified their credentials and opened an active authenticated session."
      };
    }

    if (type.includes("TIME_IN") || type.includes("TIME_OUT")) {
      return {
        badge: type.includes("TIME_IN") ? "Time In" : "Time Out",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
        headline: `Recorded employee ${type.includes("TIME_IN") ? "morning punch-in" : "shift punch-out"}`,
        narrative: t.description || "Recorded attendance timestamp from terminal reader.",
        actor: actorName,
        actorId,
        target: targetLabel,
        explanation: "Terminal successfully validated credential and recorded shift timestamp."
      };
    }

    return {
      badge: getEventLabel(t.event_Type),
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
      headline: t.description || `Executed ${getEventLabel(t.event_Type)}`,
      narrative: t.description || "Operational event recorded in system history.",
      actor: actorName,
      actorId,
      target: targetLabel,
      explanation: "Transactional record capturing an operational milestone or hardware interaction."
    };
  };

  const filteredData = transactions.filter(t => {
    const userNumber = t.user_Id ? formatUserId(t.user_Id) : "";
    const adminNumber = t.initiated_By ? formatUserId(t.initiated_By) : "";
    const rawUserId = String(t.user_Id || "");
    const ipAddr = t.ip_Address || t.metadata?.deviceIp || "";
    const friendly = getFriendlyEvent(t);
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchLower) || 
                          (t.admin_FirstName + " " + t.admin_LastName).toLowerCase().includes(searchLower) ||
                          t.event_Type.toLowerCase().includes(searchLower) ||
                          t.description.toLowerCase().includes(searchLower) ||
                          friendly.headline.toLowerCase().includes(searchLower) ||
                          friendly.badge.toLowerCase().includes(searchLower) ||
                          friendly.target.toLowerCase().includes(searchLower) ||
                          friendly.actor.toLowerCase().includes(searchLower) ||
                          userNumber.toLowerCase().includes(searchLower) ||
                          adminNumber.toLowerCase().includes(searchLower) ||
                          rawUserId.includes(searchLower) ||
                          ipAddr.includes(searchLower);

    const matchesAction = actionFilter === "All Actions" || t.event_Type === actionFilter;
    return matchesSearch && matchesAction;
  });

  // Pagination Logic
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLogs = filteredData.slice(startIndex, endIndex);

  const uniqueActions = ["All Actions", ...new Set(transactions.map(t => t.event_Type))];

  const stats = {
    total: transactions.length,
    payrollReleases: transactions.filter(t => t.event_Type === "PAYROLL_RELEASE").length,
    batchRuns: transactions.filter(t => t.event_Type === "BATCH_PAYROLL_GEN").length,
    unauthorizedScans: transactions.filter(t => ["UNAUTHORIZED_SCAN", "UNRECOGNIZED_SCAN", "IRREGULAR_LOG", "2FA_FAILURE", "SUSPICIOUS_SCAN", "ATTENDANCE_LOG_SUSPICIOUS"].includes(t.event_Type)).length,
  };

  const handleExportPDF = () => {
    const headers = ["Timestamp", "User No.", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      t.initiated_By ? formatUserId(t.initiated_By) : t.user_Id ? formatUserId(t.user_Id) : "SYS",
      t.admin_FirstName 
        ? `${t.admin_FirstName} ${t.admin_LastName}`
        : t.emp_FirstName 
          ? `${t.emp_FirstName} ${t.emp_LastName}`
          : "System",
      getEventLabel(t.event_Type),
      t.description,
      t.ip_Address || t.metadata?.deviceIp || "127.0.0.1"
    ]);
    exportToPDF("Detailed System Transaction Logs", headers, data, `Transaction_Logs_${new Date().toISOString().split('T')[0]}.pdf`, { orientation: "l" });
  };

  const handleExportCSV = () => {
    const headers = ["Timestamp", "User No.", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      t.initiated_By ? formatUserId(t.initiated_By) : t.user_Id ? formatUserId(t.user_Id) : "SYS",
      t.admin_FirstName 
        ? `${t.admin_FirstName} ${t.admin_LastName}`
        : t.emp_FirstName 
          ? `${t.emp_FirstName} ${t.emp_LastName}`
          : "System",
      getEventLabel(t.event_Type),
      t.description,
      t.ip_Address || t.metadata?.deviceIp || "127.0.0.1"
    ]);
    exportToCSV(headers, data, `Transaction_Logs_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const MetadataTable = ({ data }) => {
    if (!data) return <p className="text-slate-400 italic text-xs py-4 text-center">No additional metadata properties recorded.</p>;
    
    const sensitiveFields = ["user_Password", "password", "adminPassword", "admin_Password"];
    const allKeys = Object.keys(data)
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key))
      .sort();

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[50vh]">
        <Table className="min-w-full text-xs">
          <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-xs border-b border-slate-200">
            <TableRow>
              <TableHead className="font-bold text-slate-700 w-1/3 py-3">Property Name</TableHead>
              <TableHead className="font-bold text-slate-700 w-2/3 py-3">Property Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allKeys.map(key => {
              const val = data[key];
              const isSensitive = sensitiveFields.includes(key);
              return (
                <TableRow key={key} className="hover:bg-slate-50/50">
                  <TableCell className="font-bold text-slate-800 capitalize py-3">{key.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-800 py-3">
                    {isSensitive ? (
                      <span className="text-red-500 bg-red-50 border border-dashed border-red-200 px-2 py-0.5 rounded font-bold">[REDACTED]</span>
                    ) : key === "result" ? (
                      <Badge variant="outline" className={String(val).toLowerCase() === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{val}</Badge>
                    ) : (
                      <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">System Transaction Log</h1>
                <span className="text-sm text-slate-500 mt-1 block">
                  Track system events, financial disbursements, hardware access logs, IP addresses, and user numbers.
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {/* Dual-Mode Toggle Switch */}
                <div className="inline-flex items-center bg-slate-200/70 p-1 rounded-lg border border-slate-300/70 h-9 sm:h-10 shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleViewMode("friendly")}
                    className={cn(
                      "h-full flex items-center gap-2 px-3.5 sm:px-4 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                      viewMode === "friendly"
                        ? "bg-white text-brand-primary shadow-xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <UserCheck className="w-4 h-4 text-brand-primary" /> Friendly View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleViewMode("technical")}
                    className={cn(
                      "h-full flex items-center gap-2 px-3.5 sm:px-4 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                      viewMode === "technical"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Terminal className="w-4 h-4 text-amber-400" /> Technical View
                  </button>
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="w-full sm:w-auto h-9 sm:h-10 px-4 bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                      <FileDownloadIcon className="mr-1.5 h-4 w-4" /> Export PDF Log
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Export complete transaction log with IP addresses and user numbers
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 w-full">
              {/* Card 1: Total Events */}
              <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-brand-primary uppercase tracking-wider">Total Events</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Total count of transactional logs, access warnings, and batch operations recorded.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-brand-primary">{stats.total}</p>
                    </div>
                    <p className="text-xs text-brand-primary/70 italic mt-4">All recorded transactions</p>
                  </div>
                  <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <FormatListBulletedIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Payroll Releases */}
              <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-accent-green uppercase tracking-wider">Payroll Releases</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Total count of processed and released payroll disbursements.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-accent-green">{stats.payrollReleases}</p>
                    </div>
                    <p className="text-xs text-accent-green/70 italic mt-4">Successful disbursements</p>
                  </div>
                  <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <PaymentsIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Batch Runs */}
              <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-accent-gold uppercase tracking-wider">Batch Runs</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Count of bulk operations (such as batch payroll generation) initiated by administrators.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-accent-gold">{stats.batchRuns}</p>
                    </div>
                    <p className="text-xs text-accent-gold/70 italic mt-4">Automated bulk generations</p>
                  </div>
                  <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <SyncIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Anomalies */}
              <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-status-danger uppercase tracking-wider">Anomalies</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Unrecognized scans, unauthorized access attempts, and system logging irregularities.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-status-danger">{stats.unauthorizedScans}</p>
                    </div>
                    <p className="text-xs text-status-danger/70 italic mt-4">Unauthorized or failed scans</p>
                  </div>
                  <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <GppBadIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Card */}
            <Card className="shadow-sm border-0 bg-white py-0">
              <CardContent className="p-4 sm:p-5 flex flex-col xl:flex-row gap-4 items-center justify-between">
                <div className="relative w-full xl:max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search User, User Number (MACJ-001), IP Address, Event..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full text-xs"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger className="w-full sm:w-[220px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs">
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueActions.map(a => <SelectItem key={a} value={a} className="text-xs">{a.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {isFiltering && (
                    <Button 
                      variant="ghost" 
                      onClick={handleClearFilters}
                      className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold text-xs"
                    >
                      <CloseIcon className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Table Card */}
            <Card className="shadow-sm border-0 bg-white py-0">
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="p-12 text-center text-slate-400 text-xs">Loading transaction records...</div>
                ) : viewMode === "friendly" ? (
                  /* FRIENDLY VIEW (Human-Readable Narrative) */
                  <Table className="min-w-[950px] md:min-w-full">
                    <TableHeader className="bg-brand-primary">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider w-[180px]">Date & Time</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider w-[220px]">Actor / Initiator</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider w-[180px]">Event Category</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Operational Summary</TableHead>
                        <TableHead className="font-semibold text-white py-4 text-right pr-6 uppercase text-xs tracking-wider w-[80px]">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLogs.length > 0 ? (
                        currentLogs.map((t) => {
                          const ev = getFriendlyEvent(t);
                          return (
                            <TableRow key={t.transId} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                              {/* Date & Time */}
                              <TableCell className="text-slate-600 text-xs py-4 px-6 font-medium whitespace-nowrap">
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

                              {/* Actor / Initiator */}
                              <TableCell className="py-4">
                                <div className="font-bold text-slate-900 text-xs">
                                  {ev.actor}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                    {ev.actorId}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Event Category Badge */}
                              <TableCell className="py-4">
                                <Badge variant="outline" className={`${ev.badgeColor} uppercase tracking-wider text-[10px] font-bold py-0.5 px-2`}>
                                  {ev.badge}
                                </Badge>
                              </TableCell>

                              {/* Operational Summary */}
                              <TableCell className="text-xs py-4">
                                <p className="font-semibold text-slate-900 leading-snug">
                                  {ev.headline}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title={ev.narrative}>
                                  {ev.narrative}
                                </p>
                              </TableCell>

                              {/* Details Button */}
                              <TableCell className="text-right pr-6 py-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedLog(t);
                                        setModalTab("summary");
                                      }}
                                      className="border-brand-primary text-brand-primary hover:text-brand-primary-hover hover:bg-brand-primary-light hover:border-brand-primary-hover"
                                    >
                                      <EyeIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                    View human summary & raw metadata
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center h-24 text-slate-400 italic text-xs">
                            No transactions found matching your criteria.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  /* TECHNICAL VIEW (Raw Forensics & Network Columns) */
                  <Table className="min-w-[1000px] md:min-w-full">
                    <TableHeader className="bg-brand-primary">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Timestamp</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Initiated By</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Category</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider w-1/3">Description</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">IP Address</TableHead>
                        <TableHead className="font-semibold text-white py-4 text-right pr-6 uppercase text-xs tracking-wider">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLogs.length > 0 ? (
                        currentLogs.map((t) => {
                          let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                          const eventLower = t.event_Type.toLowerCase();
                          if (eventLower.includes("fail") || eventLower.includes("reject") || eventLower.includes("unauth")) badgeColor = "bg-red-100 text-red-800 border-red-200";
                          else if (eventLower.includes("success") || eventLower.includes("release") || eventLower.includes("complete")) badgeColor = "bg-green-100 text-green-800 border-green-200";
                          else if (eventLower.includes("batch") || eventLower.includes("gen")) badgeColor = "bg-amber-100 text-amber-800 border-amber-200";

                          const initiatorName = t.admin_FirstName 
                            ? `${t.admin_FirstName} ${t.admin_LastName}`
                            : t.emp_FirstName
                              ? `${t.emp_FirstName} ${t.emp_LastName}`
                              : t.event_Type === "UNAUTHORIZED_SCAN" ? "Unknown Device" : "System Automated";

                          const userNum = t.initiated_By 
                            ? formatUserId(t.initiated_By) 
                            : t.user_Id 
                              ? formatUserId(t.user_Id) 
                              : "SYS";

                          return (
                            <TableRow key={t.transId} className="hover:bg-slate-50/50 border-b-slate-100 transition-colors">
                              {/* Timestamp */}
                              <TableCell className="text-slate-600 text-xs py-4 px-6 font-medium whitespace-nowrap">
                                {new Date(t.createdAt).toLocaleString("en-US", {
                                  timeZone: "Asia/Manila",
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </TableCell>

                              {/* Initiated By & User Number */}
                              <TableCell className="py-4">
                                <p className="font-bold text-brand-primary text-xs">
                                  {initiatorName}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono font-semibold block mt-0.5">
                                  {userNum}
                                </span>
                              </TableCell>

                              {/* Category */}
                              <TableCell className="py-4">
                                <Badge variant="outline" className={`${badgeColor} uppercase tracking-wider text-[10px] font-bold`}>
                                  {getEventLabel(t.event_Type)}
                                </Badge>
                              </TableCell>

                              {/* Description */}
                              <TableCell className="text-slate-600 text-xs py-4 max-w-[320px] truncate" title={t.description}>
                                {t.description}
                              </TableCell>

                              {/* IP Address */}
                              <TableCell className="py-4 whitespace-nowrap">
                                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80 font-bold inline-block">
                                  {t.ip_Address || t.metadata?.deviceIp || "127.0.0.1"}
                                </span>
                              </TableCell>

                              {/* Details View */}
                              <TableCell className="text-right pr-6 py-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedLog(t);
                                        setModalTab("metadata");
                                      }}
                                      className="border-brand-primary text-brand-primary hover:text-brand-primary-hover hover:bg-brand-primary-light hover:border-brand-primary-hover"
                                    >
                                      <EyeIcon className="h-4 w-4"/>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                    Inspect transaction details, IP address, and metadata
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-slate-400 italic text-xs">No transactions found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Pagination Controls */}
                {!loading && (
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    setCurrentPage={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    itemLabel="transactions"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Transaction Dialog Modal */}
          <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
            <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden rounded-xl bg-white shadow-2xl border-0">
              {selectedLog && (() => {
                const ev = getFriendlyEvent(selectedLog);
                return (
                  <div className="space-y-0">
                    {/* Modal Header */}
                    <div className="bg-brand-primary text-white p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-400 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
                            TRANSACTION #{selectedLog.transId}
                          </Badge>
                          <Badge variant="outline" className={`${ev.badgeColor} text-[10px] uppercase font-bold`}>
                            {ev.badge}
                          </Badge>
                        </div>
                        <span className="text-xs text-purple-200 font-mono">
                          RAW EVENT: {selectedLog.event_Type}
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold tracking-tight text-white">
                        {ev.headline}
                      </h3>
                      <p className="text-purple-100 text-xs mt-1 leading-relaxed">
                        {ev.narrative}
                      </p>
                      {/* Mode Indicator Bar */}
                      <div className="flex items-center justify-between mt-4 border-t border-purple-400/20 pt-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white/10 text-white border border-white/10">
                          {viewMode === "friendly" ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Operational Summary View
                            </>
                          ) : (
                            <>
                              <Layers className="w-3.5 h-3.5 text-amber-400" /> Raw Metadata & Diagnostics
                            </>
                          )}
                        </span>
                        <span className="text-xs text-purple-200">
                          {viewMode === "friendly" 
                            ? "Recorded Attendance & Hardware Event" 
                            : `${selectedLog.metadata ? Object.keys(selectedLog.metadata).length : 0} payload attributes`}
                        </span>
                      </div>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      {viewMode === "friendly" ? (
                        <div className="space-y-5">
                          {/* Plain-English Overview Card */}
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary shrink-0 mt-0.5">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                                Operational Event Summary
                              </h4>
                              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                {ev.narrative}
                              </p>
                              <p className="text-[11px] text-slate-500 italic mt-1 pt-1 border-t border-slate-200">
                                <span className="font-bold text-slate-600 not-italic">System Rationale:</span> {ev.explanation}
                              </p>
                            </div>
                          </div>

                          {/* 4 Key Highlight Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: Initiator */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <PersonIcon sx={{ fontSize: 14 }} className="text-brand-primary" /> Initiator
                              </div>
                              <p className="font-bold text-slate-900 text-xs truncate">
                                {ev.actor}
                              </p>
                              <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 bg-purple-50 text-brand-primary border border-purple-200 rounded">
                                {ev.actorId}
                              </span>
                            </div>

                            {/* Card 2: Affected Target */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <Cpu className="w-3.5 h-3.5 text-blue-600" /> Target Subject
                              </div>
                              <p className="font-bold text-slate-900 text-xs truncate">
                                {ev.target}
                              </p>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {selectedLog.user_Id ? `User ID #${selectedLog.user_Id}` : "Infrastructure Target"}
                              </span>
                            </div>

                            {/* Card 3: Network & Origin */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <LanguageIcon sx={{ fontSize: 14 }} className="text-teal-600" /> Source Origin
                              </div>
                              <p className="font-mono font-bold text-slate-900 text-xs truncate">
                                {selectedLog.ip_Address || selectedLog.metadata?.deviceIp || "127.0.0.1"}
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {selectedLog.ip_Address?.startsWith("192.168") ? "Internal LAN Node" : "Terminal / Network Host"}
                              </span>
                            </div>

                            {/* Card 4: Manila Timestamp */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <AccessTimeIcon sx={{ fontSize: 14 }} className="text-amber-600" /> Recorded Time
                              </div>
                              <p className="font-semibold text-slate-900 text-xs">
                                {new Date(selectedLog.createdAt).toLocaleTimeString("en-US", {
                                  timeZone: "Asia/Manila",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit"
                                })}
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {new Date(selectedLog.createdAt).toLocaleDateString("en-US", {
                                  timeZone: "Asia/Manila",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric"
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Quick Summary of Notable Properties if available */}
                          {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Key Transaction Attributes
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                {Object.entries(selectedLog.metadata)
                                  .filter(([k]) => !["createdAt", "updatedAt", "deletedAt", "user_Password", "password"].includes(k))
                                  .slice(0, 9)
                                  .map(([key, value]) => (
                                    <div key={key} className="bg-white p-2 rounded-lg border border-slate-200">
                                      <p className="text-[10px] font-bold text-slate-500 capitalize">{key.replace(/_/g, " ")}</p>
                                      <p className="font-mono text-[11px] text-slate-800 font-semibold truncate mt-0.5">
                                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Raw Metadata Diagnostics Tab */
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Full Transaction Payload Properties
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              {selectedLog.metadata ? Object.keys(selectedLog.metadata).length : 0} properties
                            </span>
                          </div>
                          <MetadataTable data={selectedLog.metadata} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default TransactionLog;