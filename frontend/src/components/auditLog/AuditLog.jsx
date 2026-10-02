import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import UpdateIcon from "@mui/icons-material/Update";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LanguageIcon from "@mui/icons-material/Language";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import { fetchWithAuth } from "../../utils/api";
import { exportToPDF } from "../../utils/pdfExport";
import { formatUserId } from "../../utils/formatUserId";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EyeIcon } from "lucide-react";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("All Categories");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Diff Pagination States
  const [diffPage, setDiffPage] = useState(1);
  const DIFF_ITEMS_PER_PAGE = 6;

  const ACTION_LABELS = {
    // Authentication
    "LOGIN": "Admin Login",
    "LOGOUT": "Admin Logout",
    
    // User Management
    "CREATE_USER": "User Created",
    "UPDATE_USER": "User Details Updated",
    "SOFT_DELETE_USER": "User Deactivated",
    "RESTORE_USER": "User Restored",
    "PERMANENT_DELETE_USER": "User Permanently Deleted",
    "UPDATE_DAILY_RATE": "Rate Adjustment",
    
    // Attendance
    "UPDATE_LOGS": "Attendance Logs Modified",
    "DELETE_ALL_ATTENDANCE": "Attendance Data Purged",
    
    // Payroll
    "UPDATE_PAYROLL_FULL": "Payroll Record Updated",
    
    // System Settings
    "CREATE_POSITION": "New Position Added",
    "UPDATE_POSITION": "Position Updated",
    "DELETE_POSITION": "Position Removed",
    "CREATE_HOLIDAY": "Holiday Added",
    "UPDATE_HOLIDAY": "Holiday Updated",
    "DELETE_HOLIDAY": "Holiday Removed",
    "UPDATE_MANDATED_WAGE": "Minimum Wage Updated",
    "UPDATE_SETTINGS": "System Settings Updated",
    "CREATE_PAYROLL_PERIOD": "Payroll Period Created",
    "CREATE_DUE_DATE": "New Due Date Set",
    "DELETE_DUE_DATE": "Due Date Removed",

    // Requests
    "UPDATE_REQUEST_STATUS": "Request Status Changed",

    // Common API Routes
    "PUT /notifications/mark-all-read": "Notifications Marked as Read",
    "PUT /notifications/mark-read": "Notification Read",
    "POST /auth/login": "System Login Attempt",
    "POST /auth/logout": "System Logout"
  };

  const formatAction = (action) => {
    if (!action) return "System Action";
    const upperAction = action.toUpperCase();
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    if (ACTION_LABELS[upperAction]) return ACTION_LABELS[upperAction];
    
    const routeRegex = /^(GET|POST|PUT|DELETE|PATCH)\s+(\/.*)$/i;
    const match = action.match(routeRegex);
    
    if (match) {
      const method = match[1].toUpperCase();
      const path = match[2];
      
      if (ACTION_LABELS[path]) return ACTION_LABELS[path];

      const pathParts = path.split("/").filter(p => p && p !== "api" && p !== "v1");
      
      if (pathParts.length > 0) {
        const secondary = pathParts[1] ? pathParts[1].replace(/-/g, " ") : "";
        
        if (secondary.includes("mark all read")) return "Clear All Notifications";
        if (secondary.includes("mark read")) return "Read Notification";
        
        return `${method} ${pathParts[0].toUpperCase()} ${secondary}`.trim();
      }
      
      return `${method} SYSTEM REQUEST`;
    }

    return action.replace(/_/g, " ").split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(" ");
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetchWithAuth("/api/system/audit-logs");
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setLogs(data);
        } else {
          console.warn("[AuditLogs] Non-ok or non-array response:", response.status, data);
        }
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterAction, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterAction("All Categories");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || filterAction !== "All Categories";

  const filteredLogs = logs.filter(log => {
    const actionLabel = formatAction(log.action);
    const userNumber = log.user_Id ? formatUserId(log.user_Id) : "";
    const rawUserId = String(log.user_Id || "");
    const ipAddr = log.ip_Address || "";
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchLower) || 
                          actionLabel.toLowerCase().includes(searchLower) ||
                          log.action.toLowerCase().includes(searchLower) ||
                          String(log.target_Id || "").toLowerCase().includes(searchLower) ||
                          userNumber.toLowerCase().includes(searchLower) ||
                          rawUserId.includes(searchLower) ||
                          ipAddr.includes(searchLower);

    const matchesAction = filterAction === "All Categories" || actionLabel === filterAction;
    return matchesSearch && matchesAction;
  });

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const uniqueActions = ["All Categories", ...new Set(logs.map(l => formatAction(l.action)))];

  const stats = {
    totalActions: logs.length,
    securityAlerts: logs.filter(l => l.action?.includes("DELETE") || l.action?.includes("PERMANENT")).length,
    userUpdates: logs.filter(l => l.action?.includes("USER") || l.action?.includes("RATE")).length,
    activeAdmins: new Set(logs.map(l => l.user_Id)).size,
  };

  const handleExportPDF = () => {
    const headers = ["Timestamp", "User No.", "Administrator", "Module", "Event Category", "Target", "IP Address"];
    const data = filteredLogs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.user_Id ? formatUserId(log.user_Id) : "SYS",
      log.user_FirstName ? `${log.user_FirstName} ${log.user_LastName}` : "System",
      log.module || "System",
      formatAction(log.action),
      `${log.target_Table || "N/A"} #${log.target_Id || "N/A"}`,
      log.ip_Address || "127.0.0.1"
    ]);
    exportToPDF("Detailed System Audit Logs", headers, data, `Audit_Logs_${new Date().toISOString().split('T')[0]}.pdf`, { orientation: "l" });
  };

  const diffData = useMemo(() => {
    if (!selectedLog) return { allKeys: [], oldObj: {}, newObj: {} };
    
    const parse = (val) => {
      try { 
        if (typeof val === 'object' && val !== null) return val;
        return typeof val === 'string' ? JSON.parse(val || '{}') : (val || {}); 
      }
      catch { return {}; }
    };
    const oldObj = parse(selectedLog.old_Value);
    const newObj = parse(selectedLog.new_Value);
    
    const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))
      .filter(key => !["createdAt", "updatedAt", "deletedAt", "password"].includes(key))
      .filter(key => JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]))
      .sort();
      
    return { allKeys: keys, oldObj, newObj };
  }, [selectedLog]);

  const totalDiffPages = Math.ceil(diffData.allKeys.length / DIFF_ITEMS_PER_PAGE) || 1;
  const paginatedKeys = diffData.allKeys.slice((diffPage - 1) * DIFF_ITEMS_PER_PAGE, diffPage * DIFF_ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">System Audit Logs</h1>
                <span className="text-sm text-slate-500 mt-1 block">
                  Detailed history of administrative changes, user numbers, IP addresses, and system modifications.
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="w-full md:w-auto bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm" onClick={handleExportPDF}>
                    <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF Log
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                  Export complete audit trail with IP addresses and user numbers
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 w-full">
              {/* Card 1: Total Activities */}
              <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-brand-primary uppercase tracking-wider">Total Activities</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Total count of administrative events and system updates recorded.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-brand-primary">{stats.totalActions}</p>
                    </div>
                    <p className="text-xs text-brand-primary/70 italic mt-4">All recorded system changes</p>
                  </div>
                  <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <FormatListBulletedIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: User Updates */}
              <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-accent-green uppercase tracking-wider">User Updates</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Count of employee profile updates, rate modifications, or state changes.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-accent-green">{stats.userUpdates}</p>
                    </div>
                    <p className="text-xs text-accent-green/70 italic mt-4">Profile and rate modifications</p>
                  </div>
                  <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <UpdateIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Active Admins */}
              <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-accent-gold uppercase tracking-wider">Active Admins</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Total count of unique system administrators and managers who have logged changes.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-accent-gold">{stats.activeAdmins}</p>
                    </div>
                    <p className="text-xs text-accent-gold/70 italic mt-4">Unique administrators logged</p>
                  </div>
                  <div className="bg-accent-gold/20 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <AdminPanelSettingsIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Security Alerts */}
              <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-[13px] font-bold text-status-danger uppercase tracking-wider">Security Alerts</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Sensitive system events including deletions, purges, and security adjustments.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-status-danger">{stats.securityAlerts}</p>
                    </div>
                    <p className="text-xs text-status-danger/70 italic mt-4">Sensitive updates</p>
                  </div>
                  <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <WarningAmberIcon className="h-6 w-6" />
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
                    placeholder="Search Admin, User Number (MACJ-001), IP Address, Event..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full text-xs"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      <SelectTrigger className="w-full sm:w-[220px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueActions.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
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
                {loading ? <div className="p-12 text-center text-slate-400 text-xs">Loading audit records...</div> : (
                  <Table className="min-w-[1000px] md:min-w-full">
                    <TableHeader className="bg-brand-primary">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Timestamp</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Administrator</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Module</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Category</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Target</TableHead>
                        <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">IP Address</TableHead>
                        <TableHead className="font-semibold text-white py-4 text-right pr-6 uppercase text-xs tracking-wider">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLogs.length > 0 ? (
                        currentLogs.map((log) => (
                          <TableRow key={log.auditId} className="hover:bg-slate-50/50 border-b-slate-100 transition-colors">
                            {/* Timestamp */}
                            <TableCell className="text-slate-600 text-xs py-4 px-6 font-medium whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </TableCell>

                            {/* Administrator & User Number */}
                            <TableCell className="py-4">
                              <p className="font-bold text-brand-primary text-xs">
                                {log.user_FirstName ? `${log.user_FirstName} ${log.user_LastName}` : "System Automated"}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono font-semibold block mt-0.5">
                                {log.user_Id ? formatUserId(log.user_Id) : "SYS"}
                              </span>
                            </TableCell>

                            {/* Module */}
                            <TableCell className="py-4">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                {log.module || "System"}
                              </Badge>
                            </TableCell>

                            {/* Action */}
                            <TableCell className="py-4">
                              <Badge variant="outline" className="border-slate-200 bg-slate-50/80 text-[10px] uppercase font-bold text-slate-800 tracking-tight">
                                {formatAction(log.action)}
                              </Badge>
                            </TableCell>

                            {/* Target */}
                            <TableCell className="font-semibold text-slate-700 text-xs py-4">
                              {log.target_Table || "N/A"} {log.target_Id ? `#${log.target_Id}` : ""}
                            </TableCell>

                            {/* IP Address */}
                            <TableCell className="py-4 whitespace-nowrap">
                              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80 font-bold inline-block">
                                {log.ip_Address || "127.0.0.1"}
                              </span>
                            </TableCell>

                            {/* View Action */}
                            <TableCell className="text-right pr-6 py-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-brand-primary-light hover:border-[#9c7de0]">
                                    <EyeIcon className="h-4 w-4"/>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                  Inspect full details, IP address, and change breakdown
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center h-24 text-slate-400 italic text-xs">No audit logs found.</TableCell>
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
                    itemLabel="audit logs"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Inspection Modal Dialog */}
          <Dialog open={!!selectedLog} onOpenChange={(open) => { 
              if (!open) { 
                setSelectedLog(null); 
                setDiffPage(1);
              }
            }}>
            <DialogContent className="max-w-5xl! w-[200vw] p-0 overflow-hidden rounded-xl bg-white shadow-2xl">
              {selectedLog && (
                <div className="space-y-0">
                  {/* Modal Header */}
                  <div className="bg-brand-primary text-white p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-amber-400 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
                        {selectedLog.module || "SYSTEM"} AUDIT TRAIL
                      </Badge>
                      <span className="text-xs text-purple-200 font-mono">
                        LOG-ID #{selectedLog.auditId}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                      {formatAction(selectedLog.action)}
                    </h3>
                    <p className="text-purple-200 text-xs mt-1 font-mono">
                      Action Key: {selectedLog.action}
                    </p>
                  </div>

                  {/* Metadata Cards Grid */}
                  <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Key Attributes Header Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      
                      {/* Initiator / User Number */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <PersonIcon fontSize="small" className="text-brand-primary" /> Administrator / User
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {selectedLog.user_FirstName ? `${selectedLog.user_FirstName} ${selectedLog.user_LastName}` : "System Process"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-brand-primary font-mono font-bold text-[11px]">
                            {selectedLog.user_Id ? formatUserId(selectedLog.user_Id) : "SYS-000"}
                          </span>
                          {selectedLog.user_Id && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              (ID: {selectedLog.user_Id})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* IP Address */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <LanguageIcon fontSize="small" className="text-blue-600" /> Client IP Address
                        </div>
                        <p className="font-mono font-bold text-slate-900 text-sm">
                          {selectedLog.ip_Address || "127.0.0.1"}
                        </p>
                        <span className="text-[10px] text-slate-400 italic block">
                          Network Origin IP
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <AccessTimeIcon fontSize="small" className="text-amber-600" /> Timestamp
                        </div>
                        <p className="font-semibold text-slate-900 text-xs">
                          {new Date(selectedLog.createdAt).toLocaleString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Target: {selectedLog.target_Table || "General"} #{selectedLog.target_Id || "N/A"}
                        </span>
                      </div>

                    </div>

                    {/* Detailed Change Breakdown Table */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Detailed Property Change Breakdown
                        </h4>
                        <span className="text-xs font-semibold text-slate-400">
                          {diffData.allKeys.length} properties modified
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <Table className="min-w-full text-xs">
                          <TableHeader className="bg-slate-100 border-b border-slate-200">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700 w-1/3 py-3">Property Name</TableHead>
                              <TableHead className="font-bold text-slate-700 w-1/3 py-3 bg-rose-50/50">Previous Value (Old)</TableHead>
                              <TableHead className="font-bold text-slate-700 w-1/3 py-3 bg-emerald-50/50">New Value (Updated)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diffData.allKeys.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-slate-400 italic text-xs">
                                  No property modification differences recorded for this event.
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginatedKeys.map(key => (
                                <TableRow key={key} className="hover:bg-slate-50/50">
                                  <TableCell className="font-bold text-slate-800 capitalize py-3">
                                    {key.replace(/_/g, " ")}
                                  </TableCell>
                                  <TableCell className="font-mono text-[11px] bg-rose-50/30 text-rose-900 py-3 break-all">
                                    {typeof diffData.oldObj[key] === 'object' ? JSON.stringify(diffData.oldObj[key]) : String(diffData.oldObj[key] ?? "—")}
                                  </TableCell>
                                  <TableCell className="font-mono text-[11px] bg-emerald-50/30 text-emerald-900 py-3 font-semibold break-all">
                                    {typeof diffData.newObj[key] === 'object' ? JSON.stringify(diffData.newObj[key]) : String(diffData.newObj[key] ?? "—")}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>

                        {diffData.allKeys.length > DIFF_ITEMS_PER_PAGE && (
                          <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs font-semibold text-slate-600"
                              disabled={diffPage === 1}
                              onClick={() => setDiffPage(p => p - 1)}
                            >
                              Previous Properties
                            </Button>
                            <span className="text-xs text-slate-500 font-semibold">
                              Page {diffPage} of {totalDiffPages}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs font-semibold text-slate-600"
                              disabled={diffPage === totalDiffPages}
                              onClick={() => setDiffPage(p => p + 1)}
                            >
                              Next Properties
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default AuditLogs;