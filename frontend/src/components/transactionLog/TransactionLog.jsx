import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";

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

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [goToValue, setGoToValue] = useState("");

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

  const filteredData = transactions.filter(t => {
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.event_Type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "All Actions" || t.event_Type === actionFilter;
    return matchesSearch && matchesAction;
  });

  const indexOfLastLog = currentPage * rowsPerPage;
  const indexOfFirstLog = indexOfLastLog - rowsPerPage;
  const currentLogs = filteredData.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter]);

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(goToValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setGoToValue("");
    }
  };

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const uniqueActions = ["All Actions", ...new Set(transactions.map(t => t.event_Type))];

  const stats = {
    total: transactions.length,
    payrollReleases: transactions.filter(t => t.event_Type === "PAYROLL_RELEASE").length,
    batchRuns: transactions.filter(t => t.event_Type === "BATCH_PAYROLL_GEN").length,
    unauthorizedScans: transactions.filter(t => t.event_Type === "UNAUTHORIZED_SCAN").length,
  };

  const maskDescription = (desc, type) => {
    if (type !== "UNAUTHORIZED_SCAN") return desc;
    return desc; 
  };

  const handleExport = () => {
    const headers = ["Timestamp", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString(),
      t.emp_FirstName 
        ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
        : t.event_Type === "UNAUTHORIZED_SCAN" 
          ? `Unknown Device`
          : "System",
      t.event_Type.replace(/_/g, " "),
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
      <div className="flex-1 p-4 md:p-4 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Transaction Log</h1>
            <span className="text-sm text-slate-500 mt-1 block">View and track all financial and system transactions</span>
          </div>
          <Button variant="outline" className="w-full md:w-auto bg-white border-slate-300 text-slate-700" onClick={handleExport}>
            <FileDownloadIcon className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-sm border-0 py-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Transactions</label><p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p></CardContent></Card>
          <Card className="shadow-sm border-0 py-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payroll Releases</label><p className="text-2xl font-bold text-green-500 mt-1">{stats.payrollReleases}</p></CardContent></Card>
          <Card className="shadow-sm border-0 py-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Runs</label><p className="text-2xl font-bold text-amber-500 mt-1">{stats.batchRuns}</p></CardContent></Card>
          <Card className="shadow-sm border-0 py-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unauthorized Scans</label><p className="text-2xl font-bold text-red-600 mt-1">{stats.unauthorizedScans}</p></CardContent></Card>
        </div>

        <Card className="mb-6 shadow-sm border-0 py-0">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Search by user, action, or details..." onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-slate-50/50" />
            </div>
            <div className="w-full md:w-64">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="bg-slate-50/50">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueActions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-white py-2 px-4">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-12 text-center text-slate-400">Loading...</div> : (
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Event Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right pr-6">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLogs.map((t) => {
                    let badgeColor = "bg-slate-100 text-slate-700";
                    const eventLower = t.event_Type.toLowerCase();
                    if (eventLower.includes("fail") || eventLower.includes("reject") || eventLower.includes("unauth")) badgeColor = "bg-red-100 text-red-800";
                    else if (eventLower.includes("success") || eventLower.includes("release") || eventLower.includes("complete")) badgeColor = "bg-green-100 text-green-800";
                    else if (eventLower.includes("batch") || eventLower.includes("gen")) badgeColor = "bg-amber-100 text-amber-800";

                    return (
                      <TableRow key={t.transId} className="hover:bg-slate-50/50">
                        <TableCell className="text-slate-500 text-xs">{new Date(t.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-[#2A174E]">
                          {t.emp_FirstName 
                            ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
                            : t.event_Type === "UNAUTHORIZED_SCAN" ? `Unknown Device` : "System"
                          }
                        </TableCell>
                        <TableCell><Badge variant="secondary" className={`${badgeColor} uppercase tracking-wider text-[10px]`}>{t.event_Type.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-[300px] truncate" title={t.description}>{maskDescription(t.description, t.event_Type)}</TableCell>
                        <TableCell className="text-slate-400 font-mono text-xs">{t.ip_Address || t.metadata?.deviceIp || "Local"}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(t)} className="text-[#6439ff] hover:bg-indigo-50">
                            <VisibilityIcon className="mr-1 h-4 w-4"/>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {currentLogs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24 text-slate-400">No transactions found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/30">
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Previous</Button>
                <div className="hidden md:flex gap-1">
                  {pageNumbers.map(n => (
                    <Button key={n} variant={currentPage === n ? "default" : "outline"} size="sm" className={currentPage === n ? "bg-[#2A174E] text-white" : ""} onClick={() => setCurrentPage(n)}>{n}</Button>
                  ))}
                </div>
                <span className="md:hidden text-sm text-slate-500 mx-2">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</Button>
              </div>
              <form onSubmit={handleGoToPage} className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Go to:</span>
                <Input type="number" value={goToValue} onChange={(e) => setGoToValue(e.target.value)} placeholder={totalPages} className="w-16 h-8 text-center" />
              </form>
            </div>

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