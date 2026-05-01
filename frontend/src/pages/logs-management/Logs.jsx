import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";
import SearchIcon from "@mui/icons-material/Search";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const formatDateStr = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

const Logs = () => {
  const { systemToday } = useSystemTime();
  const [viewMode, setViewMode] = useState("raw"); // "raw" or "day"
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all"); // Changed default to "all" for shadcn select
  const rowsPerPage = 10;

  const getCurrentPeriod = useCallback((baseDate) => {
    const today = baseDate || new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let startDate, endDate;
    if (date <= 15) {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month, 15);
    } else {
      startDate = new Date(year, month, 16);
      endDate = new Date(year, month + 1, 0);
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return {
      startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
      endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
    };
  }, []);

  const [logData, setLogData] = useState([]);
  const [dayLogsData, setDayLogsData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'log_Date', direction: 'desc' });
  
  const period = useMemo(() => getCurrentPeriod(systemToday), [systemToday, getCurrentPeriod]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const handleExport = () => {
    let headers = [];
    let data = [];
    let filename = "";

    if (viewMode === "raw") {
      headers = ["User ID", "Full Name", "Type", "MaChip ID", "Date", "Time", "Action"];
      data = filteredData.map(row => [
        row.user_Id_formatted,
        row.fullName,
        row.log_type,
        row.machip_id,
        row.log_Date,
        row.time,
        row.action
      ]);
      filename = `Raw_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      headers = ["User ID", "Name", "Date", "AM In", "AM Out", "PM In", "PM Out", "OT In", "OT Out", "Status", "Hours Worked"];
      data = sortedDayLogs.map(row => [
        formatUserId(row.user_Id),
        row.userName,
        row.log_Date.split('T')[0],
        row.morning_In || "",
        row.morning_Out || "",
        row.afternoon_In || "",
        row.afternoon_Out || "",
        row.ot_In || "",
        row.ot_Out || "",
        row.status || "",
        row.hoursWorked || "0"
      ]);
      filename = `Day_Logs_${period.startDate}_to_${period.endDate}.csv`;
    }

    exportToCSV(headers, data, filename);
  };

  // Filter raw data
  const filteredData = logData.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.user_Id_formatted?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.fullName?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.log_type?.toLowerCase().includes(query) ||
      item.machip_id?.toLowerCase().includes(query);

    const matchesUser =
      selectedUser === "all" || item.user_Id?.toString() === selectedUser;

    return matchesSearch && matchesUser;
  });

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;

  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  // Fetch all logs from the backend (raw)
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/attendance/all");
      if (response.ok) {
        const logs = await response.json();
        const mapped = logs.map((log) => {
          const u_Id = log.user_Id ?? log.user_id;
          const firstName = log.user_FirstName ?? "";
          const lastName = log.user_LastName ?? "";
          const fullName = `${firstName} ${lastName}`.trim();

          return {
            user_loggingId: log.user_loggingId,
            user_Id: u_Id,
            user_Id_formatted: formatUserId(u_Id),
            first_name: firstName || "—",
            last_name: lastName || "—",
            fullName: fullName || "—",
            machip_id: log.user_MachipId || "—",
            log_Date: log.log_Date
              ? new Date(log.log_Date).toLocaleDateString()
              : "—",
            time: formatTime12h(log.time_Logged),
            log_type: log.loggedStatusName ?? "—",
            action: log.attendanceStatusName ?? "—",
          };
        });
        setLogData(mapped);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, []);

  // Fetch day logs
  const fetchDayLogs = useCallback(async () => {
    try {
      let url = `/api/attendance/report?startDate=${period.startDate}&endDate=${period.endDate}`;
      if (selectedUser !== "all") url += `&user_Id=${selectedUser}`;
      else url += `&user_Id=All Employees`;

    const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setDayLogsData(data);
      }
    } catch (error) {
      console.error("Error fetching day logs:", error);
    }
  }, [period.startDate, period.endDate, selectedUser]);

  // Load logs on mount and start polling/listening
  useEffect(() => {
    fetchUsers();
    
    const handleRefresh = () => {
      if (viewMode === "raw") fetchLogs();
      else fetchDayLogs();
    };

    if (viewMode === "raw") {
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    } else {
      fetchDayLogs();
      const interval = setInterval(fetchDayLogs, 30000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    }
  }, [fetchLogs, fetchUsers, fetchDayLogs, viewMode]);

  const handleGenerateLogs = async (forcedStatus) => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        "/api/attendance/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcedStatus }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setToast({
          message: data.message || "Attendance marked successfully!",
          type: "success",
        });
        await fetchLogs();
      } else {
        setToast({
          message: data.error || "Failed to mark attendance. Please try again.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error marking attendance:", err);
      setToast({
        message: "Could not connect to the server. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedDayLogs = useMemo(() => {
    let sortableItems = [...dayLogsData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Handle dates
        if (sortConfig.key === 'log_Date') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    const query = searchQuery.toLowerCase();
    return sortableItems.filter((item) => 
      item.userName?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  }, [dayLogsData, sortConfig, searchQuery]);

  const currentDayLogs = sortedDayLogs.slice(indexOfFirstRow, indexOfLastRow);
  const dayLogsTotalPages = Math.ceil(sortedDayLogs.length / rowsPerPage) || 1;
  const currentTotalPages = viewMode === "raw" ? totalPages : dayLogsTotalPages;

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        
        <div className="flex-1 p-4 md:p-8 w-full">
          
          {/* Header & Filters */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
            <div className="w-full xl:w-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Logging Activity</h1>
              <span className="text-sm text-muted-foreground mt-1 block">
                {viewMode === "raw" ? "Track user logins in real-time" : `Day Logs (${period.startDate} to ${period.endDate})`}
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#2A174E]" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 border-[#2A174E]/10  bg-white w-full"
                />
              </div>

              {/* User Filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="w-full md:w-48">
                  <Select
                    value={selectedUser}
                    onValueChange={(val) => {
                      setSelectedUser(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="border-[#2A174E]/30 focus:ring-[#2A174E] bg-white w-full">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.user_Id} value={user.user_Id.toString()}>
                          {user.user_LastName}, {user.user_FirstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(searchQuery !== "" || selectedUser !== "all") && (
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedUser("all");
                      setCurrentPage(1);
                    }}
                    className="text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-row items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                <Button
                  variant="outline"
                  // CHANGED: Removed w-full, added flex-1 so it shares space equally with other buttons on mobile
                  className="flex-1 md:flex-none border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors"
                  onClick={() => {
                    setViewMode(viewMode === "raw" ? "day" : "raw");
                    setCurrentPage(1);
                  }}
                >
                  {viewMode === "raw" ? "View Day Logs" : "View Raw Logs"}
                </Button>
                
                {viewMode === "raw" && (
                  <>
                    <Button
                      // CHANGED: Removed w-full, added flex-1
                      className="flex-1 md:flex-none bg-[#2A174E] text-white hover:bg-[#1a0e30]"
                      onClick={() => handleGenerateLogs(1)}
                      disabled={loading}
                    >
                      {loading ? "..." : "Clock In"} 
                    </Button>
                    <Button
                      // CHANGED: Removed w-full, added flex-1
                      className="flex-1 md:flex-none bg-[#2A174E] text-white hover:bg-[#1a0e30]"
                      onClick={() => handleGenerateLogs(2)}
                      disabled={loading}
                    >
                      {loading ? "..." : "Clock Out"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="h-4"></div>

          {/* Table Card */}
          <Card className="shadow-sm border-0 bg-white p-5">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  {viewMode === "raw" ? (
                    <>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-b-slate-200">
                          <TableHead className="font-semibold text-slate-700">User ID</TableHead>
                          <TableHead className="font-semibold text-slate-700">Full Name</TableHead>
                          <TableHead className="font-semibold text-slate-700">Type</TableHead>
                          <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">MaChip ID</TableHead>
                          <TableHead className="font-semibold text-slate-700">Date</TableHead>
                          <TableHead className="font-semibold text-slate-700">Time</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentRows.length > 0 ? (
                          currentRows.map((row) => (
                            <TableRow key={row.user_loggingId} className="border-b-slate-100 hover:bg-slate-50/50">
                              <TableCell className="font-semibold text-[#2A174E]">{row.user_Id_formatted}</TableCell>
                              <TableCell className="font-medium text-slate-800">{row.fullName}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant="secondary" 
                                  className={`font-semibold ${row.log_type.toLowerCase().includes("in") ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-red-100 text-red-800 hover:bg-red-100"}`}
                                >
                                  {row.log_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 hidden sm:table-cell">{row.machip_id}</TableCell>
                              <TableCell className="text-slate-600">{row.log_Date}</TableCell>
                              <TableCell className="text-slate-600">{row.time}</TableCell>
                              <TableCell className="text-right pr-6">
                                <Button variant="outline" size="sm" asChild className="border-blue-200 text-blue-800 hover:bg-blue-50">
                                  <Link to={`/users/${row.user_Id}`}>View</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                              No logs found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </>
                  ) : (
                    <>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-b-slate-200">
                          <TableHead className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('user_Id')}>
                            # {sortConfig.key === 'user_Id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('userName')}>
                            Name {sortConfig.key === 'userName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('log_Date')}>
                            Date {sortConfig.key === 'log_Date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700">AM In</TableHead>
                          <TableHead className="font-semibold text-slate-700">AM Out</TableHead>
                          <TableHead className="font-semibold text-slate-700">PM In</TableHead>
                          <TableHead className="font-semibold text-slate-700">PM Out</TableHead>
                          <TableHead className="font-semibold text-slate-700">OT In</TableHead>
                          <TableHead className="font-semibold text-slate-700">OT Out</TableHead>
                          <TableHead className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                            Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentDayLogs.length > 0 ? (
                          currentDayLogs.map((row, index) => {
                            let badgeStyle = "bg-slate-100 text-slate-800 hover:bg-slate-100";
                            if (row.status === "On Time") badgeStyle = "bg-green-100 text-green-800 hover:bg-green-100";
                            else if (row.status?.toLowerCase().includes("absent")) badgeStyle = "bg-red-100 text-red-800 hover:bg-red-100";

                            return (
                              <TableRow key={`${row.user_Id}-${row.log_Date}-${index}`} className="border-b-slate-100 hover:bg-slate-50/50">
                                <TableCell className="font-semibold text-[#2A174E]">{formatUserId(row.user_Id)}</TableCell>
                                <TableCell className="font-medium text-slate-800">{row.userName}</TableCell>
                                <TableCell className="text-slate-600">{formatDateStr(row.log_Date)}</TableCell>
                                <TableCell className="text-slate-600">{row.morning_In || "—"}</TableCell>
                                <TableCell className="text-slate-600">{row.morning_Out || "—"}</TableCell>
                                <TableCell className="text-slate-600">{row.afternoon_In || "—"}</TableCell>
                                <TableCell className="text-slate-600">{row.afternoon_Out || "—"}</TableCell>
                                <TableCell className="text-slate-600">{row.ot_In || "—"}</TableCell>
                                <TableCell className="text-slate-600">{row.ot_Out || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`font-semibold ${badgeStyle}`}>
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button variant="outline" size="sm" asChild className="border-blue-200 text-blue-800 hover:bg-blue-50">
                                    <Link to={`/logs/edit/${row.user_Id}/${row.log_Date.split('T')[0]}?from=logs`}>Edit</Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center text-muted-foreground italic">
                              No logs found for this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </>
                  )}
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-center sm:justify-end gap-4 p-4 border-t border-slate-100 bg-slate-50/30">
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="text-slate-600"
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-slate-600">
                  Page {currentPage} of {currentTotalPages}
                </span>
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= currentTotalPages} 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="text-slate-600"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
};

export default Logs;