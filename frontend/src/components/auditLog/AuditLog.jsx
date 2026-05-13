import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import UpdateIcon from "@mui/icons-material/Update";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
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

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterAction, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterAction("All Actions");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || filterAction !== "All Actions";

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(log.target_Id).includes(searchQuery);
    const matchesAction = filterAction === "All Actions" || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  // Pagination Logic
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

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
            <span className="text-sm text-slate-500 mt-1 block">Monitor administrative activities, changes, and system access.</span>
          </div>
          <Button className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm" onClick={""}>
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
                  <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Actions</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{stats.totalActions}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">All recorded system changes</p>
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
                  <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">User Updates</p>
                  <p className="text-4xl font-bold text-[#3B4E17]">{stats.userUpdates}</p>
                </div>
                <p className="text-xs text-[#3B4E17]/70 italic mt-4">Profile and rate modifications</p>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <UpdateIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Admins & Supervisors */}
          <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Active Admins</p>
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
                  <p className="text-[13px] font-bold text-[#991b1b] uppercase tracking-wider mb-2">Security Alerts</p>
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
                    <SelectValue placeholder="All Actions" />
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
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Action</TableHead>
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
                        <TableCell className="py-4"><Badge variant="outline" className="border-slate-200">{log.action}</Badge></TableCell>
                        <TableCell className="font-semibold text-slate-700 py-4">{log.target_Table} #{log.target_Id}</TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="text-[#2A174E] hover:bg-slate-100 border border-transparent hover:border-slate-200">
                            <VisibilityIcon className="mr-1 h-4 w-4"/>
                          </Button>
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