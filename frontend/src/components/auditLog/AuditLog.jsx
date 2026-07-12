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
import { fetchWithAuth } from "../../utils/api";
import { exportToPDF } from "../../utils/pdfExport";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EyeIcon } from "lucide-react";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const DIFF_ITEMS_PER_PAGE = 5;

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

    // Common API Routes (Explicit Mapping)
    "PUT /notifications/mark-all-read": "Notifications Marked as Read",
    "PUT /notifications/mark-read": "Notification Read",
    "POST /auth/login": "System Login Attempt",
    "POST /auth/logout": "System Logout"
  };

  const formatAction = (action) => {
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
        if (response.ok) {
          setLogs(data);
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
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
                          actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(log.target_Id).includes(searchQuery);
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
    securityAlerts: logs.filter(l => l.action.includes("DELETE") || l.action.includes("PERMANENT")).length,
    userUpdates: logs.filter(l => l.action.includes("USER") || l.action.includes("RATE")).length,
    activeAdmins: new Set(logs.map(l => l.user_Id)).size,
  };

  const handleExportPDF = () => {
    const headers = ["Timestamp", "Module", "Administrator", "Event Category", "Target", "ID"];
    const data = filteredLogs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.module || "System",
      `${log.user_FirstName} ${log.user_LastName}`,
      formatAction(log.action),
      log.target_Table,
      log.target_Id
    ]);
    exportToPDF("System Audit Logs", headers, data, `Audit_Logs_${new Date().toISOString().split('T')[0]}.pdf`);
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

  const totalDiffPages = Math.ceil(diffData.allKeys.length / DIFF_ITEMS_PER_PAGE);
  const paginatedKeys = diffData.allKeys.slice((diffPage - 1) * DIFF_ITEMS_PER_PAGE, diffPage * DIFF_ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">System Audit Logs</h1>
                <span className="text-sm text-slate-500 mt-1 block">Monitor administrative activities, changes, and system access.</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm" onClick={handleExportPDF}>
                    <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                  Export audit log records to PDF format
                </TooltipContent>
              </Tooltip>
            </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Activities */}
            <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider">Total Activities</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Total count of administrative events and system updates recorded.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#2A174E]">{stats.totalActions}</p>
                  </div>
                  <p className="text-xs text-[#2A174E]/70 italic mt-4">All recorded system changes</p>
                </div>
                <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <FormatListBulletedIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: User Updates */}
            <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider">User Updates</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Count of employee profile updates, rate modifications, or state changes.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#3B4E17]">{stats.userUpdates}</p>
                  </div>
                  <p className="text-xs text-[#3B4E17]/70 italic mt-4">Profile and rate modifications</p>
                </div>
                <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <UpdateIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Active Admins */}
            <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider">Active Admins</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Total count of unique system administrators and managers who have logged changes.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#BB8B26]">{stats.activeAdmins}</p>
                  </div>
                  <p className="text-xs text-[#BB8B26]/70 italic mt-4">Unique administrators logged</p>
                </div>
                <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <AdminPanelSettingsIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Security Alerts */}
            <Card className="border-t-5 border-[#991b1b] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-[13px] font-bold text-[#991b1b] uppercase tracking-wider">Security Alerts</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Sensitive system events including deletions, purges, and security adjustments.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-[#991b1b]">{stats.securityAlerts}</p>
                  </div>
                  <p className="text-xs text-[#991b1b]/70 italic mt-4">Deletions and sensitive updates</p>
                </div>
                <div className="bg-[#991b1b]/10 text-[#991b1b] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <WarningAmberIcon className="h-6 w-6" />
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
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {isFiltering && (
                  <Button 
                    variant="ghost" 
                    onClick={handleClearFilters}
                    className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
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
              {loading ? <div className="p-12 text-center text-slate-400">Loading records...</div> : (
                <Table className="min-w-[900px] md:min-w-full">
                  <TableHeader className="bg-[#2B174F]">
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Timestamp</TableHead>
                      <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Module</TableHead>
                      <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Administrator</TableHead>
                      <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Category</TableHead>
                      <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Target</TableHead>
                      <TableHead className="font-semibold text-white py-4 text-right pr-6 uppercase text-xs tracking-wider">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLogs.length > 0 ? (
                      currentLogs.map((log) => (
                        <TableRow key={log.auditId} className="hover:bg-slate-50/50 border-b-slate-100 transition-colors">
                          <TableCell className="text-slate-500 text-xs py-4 px-6">{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="py-4">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">{log.module || "System"}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-[#2A174E] py-4">{log.user_FirstName} {log.user_LastName}</TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50/50 text-[10px] uppercase font-bold tracking-tight">
                              {formatAction(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700 py-4">{log.target_Table} #{log.target_Id}</TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]">
                                  <EyeIcon className=" h-4 w-4"/>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                View log details and change breakdown
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-slate-400 italic">No logs found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Pagination Controls */}
              {totalItems > 0 && !loading && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
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

        <Dialog open={!!selectedLog} onOpenChange={(open) => { 
            if (!open) { 
              setSelectedLog(null); 
              setDiffPage(1);
            }
          }}>
          <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden rounded-xl">
            <div className="p-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Change Breakdown</h4>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <Table className="min-w-full">
                  <TableBody>
                    {diffData.allKeys.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400 italic text-xs">No changes detected.</TableCell></TableRow>
                    ) : (
                      paginatedKeys.map(key => (
                        <TableRow key={key}>
                          <TableCell className="font-bold text-xs">{key.replace(/_/g, " ")}</TableCell>
                          <TableCell className="font-mono text-[11px] bg-rose-50/30 text-slate-600">{JSON.stringify(diffData.oldObj[key])}</TableCell>
                          <TableCell className="font-mono text-[11px] bg-emerald-50/30 text-slate-600">{JSON.stringify(diffData.newObj[key])}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {diffData.allKeys.length > DIFF_ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200">
                    <Button 
                      variant="ghost" size="sm" className="text-[10px]"
                      disabled={diffPage === 1}
                      onClick={() => setDiffPage(p => p - 1)}
                    >Previous</Button>
                    <span className="text-[10px] text-slate-400">Page {diffPage} of {totalDiffPages}</span>
                    <Button 
                      variant="ghost" size="sm" className="text-[10px]"
                      disabled={diffPage === totalDiffPages}
                      onClick={() => setDiffPage(p => p + 1)}
                    >Next</Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default AuditLogs;