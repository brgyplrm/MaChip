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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [goToValue, setGoToValue] = useState("");

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

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(log.target_Id).includes(searchQuery);
    const matchesAction = filterAction === "All Actions" || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const indexOfLastLog = currentPage * rowsPerPage;
  const indexOfFirstLog = indexOfLastLog - rowsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterAction]);

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

  const uniqueActions = ["All Actions", ...new Set(logs.map(l => l.action))];

  const stats = {
    totalActions: logs.length,
    securityAlerts: logs.filter(l => l.action.includes("DELETE")).length,
    userUpdates: logs.filter(l => l.action.includes("USER") || l.action.includes("RATE")).length,
    activeAdmins: new Set(logs.map(l => l.user_Id)).size,
  };

  const handleExport = () => {
    const headers = ["Timestamp", "Module", "Administrator", "Action", "Target Table", "Target ID"];
    const data = filteredLogs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.module || "System",
      `${log.user_FirstName} ${log.user_LastName}`,
      log.action,
      log.target_Table,
      log.target_Id
    ]);
    exportToCSV(headers, data, `Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const DiffViewer = ({ oldVal, newVal }) => {
    const oldObj = oldVal || {};
    const newObj = newVal || {};
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key))
      .sort();

    const formatValue = (key, val) => {
      if (val === undefined || val === null) return <span className="text-slate-300 italic">—</span>;
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    };

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[60vh]">
        <Table className="min-w-[600px] text-sm">
          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="font-semibold w-1/3">Field Name</TableHead>
              <TableHead className="font-semibold w-1/3">Previous</TableHead>
              <TableHead className="font-semibold w-1/3">New</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allKeys.map(key => {
              const isChanged = JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]);
              return (
                <TableRow key={key} className={isChanged ? "bg-amber-50/40 hover:bg-amber-50/60" : "opacity-60 hover:opacity-100"}>
                  <TableCell className="font-medium capitalize">{key.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{formatValue(key, oldObj[key])}</TableCell>
                  <TableCell className="font-mono text-xs">{formatValue(key, newObj[key])}</TableCell>
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
      <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">System Audit Logs</h1>
            <span className="text-sm text-slate-500 mt-1 block">Monitor administrative activities</span>
          </div>
          <Button variant="outline" className="w-full md:w-auto border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white" onClick={handleExport}>
            <FileDownloadIcon className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-sm border-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Actions</label><p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalActions}</p></CardContent></Card>
          <Card className="shadow-sm border-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Alerts</label><p className="text-2xl font-bold text-red-500 mt-1">{stats.securityAlerts}</p></CardContent></Card>
          <Card className="shadow-sm border-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Updates</label><p className="text-2xl font-bold text-slate-800 mt-1">{stats.userUpdates}</p></CardContent></Card>
          <Card className="shadow-sm border-0"><CardContent className="p-6"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admins</label><p className="text-2xl font-bold text-[#2A174E] mt-1">{stats.activeAdmins}</p></CardContent></Card>
        </div>

        {/* Filter Bar */}
        <Card className="mb-6 shadow-sm border-0">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Search..." onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-50/50" />
            </div>
            <div className="w-full md:w-64">
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="bg-slate-50/50">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-12 text-center text-slate-400">Loading...</div> : (
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right pr-6">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLogs.map((log) => (
                    <TableRow key={log.auditId} className="hover:bg-slate-50/50">
                      <TableCell className="text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-600">{log.module || "System"}</Badge></TableCell>
                      <TableCell className="font-semibold text-[#2A174E]">{log.user_FirstName} {log.user_LastName}</TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                      <TableCell className="font-semibold text-slate-700">{log.target_Table} #{log.target_Id}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="text-[#2A174E] hover:bg-slate-100">
                          <VisibilityIcon className="mr-1 h-4 w-4"/> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentLogs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24 text-slate-400">No logs found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E] capitalize">{selectedLog?.action} Details</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DiffViewer oldVal={selectedLog?.old_Value} newVal={selectedLog?.new_Value} />
          </div>
        </DialogContent>
      </Dialog>
      </Sidebar>
    </div>
  );
};

export default AuditLogs;