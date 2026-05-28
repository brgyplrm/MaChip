import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PaymentsIcon from "@mui/icons-material/Payments";
import SyncIcon from "@mui/icons-material/Sync";
import GppBadIcon from "@mui/icons-material/GppBad";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
        if (response.ok) {
          setTransactions(data);
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
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.event_Type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
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

  const maskDescription = (desc, type) => {
    return desc; 
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
    const headers = ["Timestamp", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString(),
      t.emp_FirstName 
        ? `${t.emp_FirstName} ${t.emp_LastName}` 
        : ["UNAUTHORIZED_SCAN", "UNRECOGNIZED_SCAN"].includes(t.event_Type)
          ? `Unknown Device`
          : "System",
      getEventLabel(t.event_Type),
      maskDescription(t.description, t.event_Type),
      t.ip_Address || t.metadata?.deviceIp || "Local"
    ]);
    exportToPDF("System Transaction Logs", headers, data, `Transaction_Logs_${new Date().toISOString().split('T')[0]}.pdf`, { orientation: "l" });
  };

  const handleExport = () => {
    const headers = ["Timestamp", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString(),
      t.emp_FirstName 
        ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
        : ["UNAUTHORIZED_SCAN", "UNRECOGNIZED_SCAN"].includes(t.event_Type)
          ? `Unknown Device`
          : "System",
      getEventLabel(t.event_Type),
      maskDescription(t.description, t.event_Type),
      t.ip_Address || t.metadata?.deviceIp || "Local"
    ]);
    exportToCSV(headers, data, `Transaction_Logs_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const MetadataTable = ({ data }) => {
    if (!data) return <p className="text-slate-400 italic text-sm py-4">No metadata available</p>;
    
    const sensitiveFields = ["user_Password", "password", "user_MachipId", "rfid", "uid", "adminPassword", "admin_Password"];
    const allKeys = Object.keys(data)
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key))
      .sort();

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[60vh]">
        <Table className="min-w-full text-sm">
          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="font-semibold w-1/3">Property</TableHead>
              <TableHead className="font-semibold w-2/3">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allKeys.map(key => {
              const val = data[key];
              const isSensitive = sensitiveFields.includes(key);
              return (
                <TableRow key={key} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium capitalize text-slate-700">{key.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-800">
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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Transaction Log</h1>
            <span className="text-sm text-slate-500 mt-1 block">View and track all financial events, batch runs, and system anomalies.</span>
          </div>
          <Button className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm" onClick={handleExportPDF}>
            <FileDownloadIcon className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>

         {/* Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Total Active Users */}
          <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Events</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{stats.total}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">All recorded transactions</p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <FormatListBulletedIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Employees */}
          <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Payroll Releases</p>
                  <p className="text-4xl font-bold text-[#3B4E17]">{stats.payrollReleases}</p>
                </div>
                <p className="text-xs text-[#3B4E17]/70 italic mt-4">Successful fund disbursements</p>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <PaymentsIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Admins & Supervisors */}
          <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Batch Runs</p>
                  <p className="text-4xl font-bold text-[#BB8B26]">{stats.batchRuns}</p>
                </div>
                <p className="text-xs text-[#BB8B26]/70 italic mt-4">Automated bulk generations</p>
              </div>
              <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <SyncIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Security Alerts */}
          <Card className="border-t-5 border-[#991b1b] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#991b1b] uppercase tracking-wider mb-2">Anomalies</p>
                  <p className="text-4xl font-bold text-[#991b1b]">{stats.unauthorizedScans}</p>
                </div>
                <p className="text-xs text-[#991b1b]/70 italic mt-4">Unauthorized or failed scans</p>
              </div>
              <div className="bg-[#991b1b]/10 text-[#991b1b] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <GppBadIcon className="h-6 w-6" />
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
                placeholder="Search by user, action, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueActions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
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
              <Table className="min-w-[1000px] md:min-w-full">
                <TableHeader className="bg-[#2B174F]">
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Timestamp</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Initiated By</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Category</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider w-1/4">Description</TableHead>
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

                      return (
                        <TableRow key={t.transId} className="hover:bg-slate-50/50 border-b-slate-100 transition-colors">
                          <TableCell className="text-slate-500 text-xs py-4 px-6">{new Date(t.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-[#2A174E] py-4">
                            {t.emp_FirstName 
                              ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
                              : t.event_Type === "UNAUTHORIZED_SCAN" ? `Unknown Device` : "System"
                            }
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className={`${badgeColor} uppercase tracking-wider text-[10px]`}>{getEventLabel(t.event_Type)}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm max-w-[300px] truncate py-4" title={t.description}>{maskDescription(t.description, t.event_Type)}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-xs py-4">{t.ip_Address || t.metadata?.deviceIp || "Local"}</TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(t)} className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]">
                              <EyeIcon className=" h-4 w-4"/>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-slate-400 italic">No transactions found.</TableCell>
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

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Transaction Details</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Event Metadata</h4>
            <MetadataTable data={selectedLog?.metadata} />
          </div>
          <DialogFooter className="flex-col sm:flex-col items-start border-t border-slate-100 pt-4 mt-2 gap-2 text-xs text-slate-500">
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
              <span><strong className="text-slate-700">Event:</strong> {selectedLog?.event_Type}</span>
              {selectedLog?.user_Id && <span><strong className="text-slate-700">User ID:</strong> {formatUserId(selectedLog?.user_Id)}</span>}
              <span><strong className="text-slate-700">IP Address:</strong> {selectedLog?.ip_Address || selectedLog?.metadata?.deviceIp || "Local"}</span>
            </div>
            <p className="italic text-slate-600">"{selectedLog?.description}"</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Sidebar>
    </div>
  );
};

export default TransactionLog;