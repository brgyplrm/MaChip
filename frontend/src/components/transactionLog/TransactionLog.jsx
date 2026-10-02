import React, { useState, useEffect } from "react";
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
import { EyeIcon } from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";

const TransactionLog = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetchWithAuth("/api/system/transaction-logs");
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setTransactions(data);
        } else {
          console.warn("[TransactionLog] Non-ok or non-array response:", response.status, data);
        }
      } catch (error) {
        console.error("Error fetching transaction logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
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

  const filteredData = transactions.filter(t => {
    const userNumber = t.user_Id ? formatUserId(t.user_Id) : "";
    const adminNumber = t.initiated_By ? formatUserId(t.initiated_By) : "";
    const rawUserId = String(t.user_Id || "");
    const ipAddr = t.ip_Address || t.metadata?.deviceIp || "";
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchLower) || 
                          (t.admin_FirstName + " " + t.admin_LastName).toLowerCase().includes(searchLower) ||
                          t.event_Type.toLowerCase().includes(searchLower) ||
                          t.description.toLowerCase().includes(searchLower) ||
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

  const getEventLabel = (type) => {
    const labels = {
      "UNAUTHORIZED_SCAN": "Unauthorized scan",
      "UNRECOGNIZED_SCAN": "Unrecognized card or scan",
      "IRREGULAR_LOG": "Irregular logs",
      "ATTENDANCE_LOG_SUSPICIOUS": "Suspicious Activity",
      "2FA_FAILURE": "Biometric Mismatch"
    };
    return labels[type] || type.replace(/_/g, " ");
  };

  const handleExportPDF = () => {
    const headers = ["Timestamp", "User No.", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString(),
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
      new Date(t.createdAt).toLocaleString(),
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
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* <Button variant="outline" className="w-full md:w-auto border-slate-200 text-slate-700 hover:bg-slate-100 text-xs" onClick={handleExportCSV}>
                  CSV
                </Button> */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="w-full md:w-auto bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm text-xs" onClick={handleExportPDF}>
                      <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF
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
                {loading ? <div className="p-12 text-center text-slate-400 text-xs">Loading transaction records...</div> : (
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
                                {new Date(t.createdAt).toLocaleString(undefined, {
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
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(t)} className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-brand-primary-light hover:border-[#9c7de0]">
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
            <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden rounded-xl bg-white shadow-2xl">
              {selectedLog && (
                <div className="space-y-0">
                  {/* Modal Header */}
                  <div className="bg-brand-primary text-white p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-amber-400 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
                        TRANSACTION RECORD #{selectedLog.transId}
                      </Badge>
                      <span className="text-xs text-purple-200 font-mono">
                        EVENT: {selectedLog.event_Type}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                      {getEventLabel(selectedLog.event_Type)}
                    </h3>
                    <p className="text-purple-100 text-xs mt-1 leading-relaxed">
                      "{selectedLog.description}"
                    </p>
                  </div>

                  {/* Metadata & Audit Body */}
                  <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Key Attributes Header Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      
                      {/* Initiated By / User Number */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <PersonIcon fontSize="small" className="text-brand-primary" /> Initiator / User
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {selectedLog.admin_FirstName 
                            ? `${selectedLog.admin_FirstName} ${selectedLog.admin_LastName}`
                            : selectedLog.emp_FirstName
                              ? `${selectedLog.emp_FirstName} ${selectedLog.emp_LastName}`
                              : "System Process"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-brand-primary font-mono font-bold text-[11px]">
                            {selectedLog.initiated_By 
                              ? formatUserId(selectedLog.initiated_By) 
                              : selectedLog.user_Id 
                                ? formatUserId(selectedLog.user_Id) 
                                : "SYS-000"}
                          </span>
                        </div>
                      </div>

                      {/* IP Address */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <LanguageIcon fontSize="small" className="text-blue-600" /> Network IP
                        </div>
                        <p className="font-mono font-bold text-slate-900 text-sm">
                          {selectedLog.ip_Address || selectedLog.metadata?.deviceIp || "127.0.0.1"}
                        </p>
                        <span className="text-[10px] text-slate-400 italic block">
                          Source Client IP
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
                        {selectedLog.user_Id && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Target Employee: {formatUserId(selectedLog.user_Id)}
                          </span>
                        )}
                      </div>

                    </div>

                    {/* Metadata Table */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Recorded Event Metadata Properties
                      </h4>
                      <MetadataTable data={selectedLog.metadata} />
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

export default TransactionLog;