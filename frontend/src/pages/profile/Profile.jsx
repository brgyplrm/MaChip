import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// UI Components
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  // Memoized Pagination & Filtering Logic
  const { paginatedLogs, totalItems, totalPages, startIndex, endIndex } = useMemo(() => {
    // 1. Filter
    const filtered = attendanceLogs.filter(log => {
      const dateStr = log.log_Date ? new Date(log.log_Date).toLocaleDateString() : "";
      return (
        (log.logStatus?.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (log.attendanceStatus?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dateStr.includes(searchQuery))
      );
    });

    // 2. Paginate
    const total = filtered.length;
    const pages = Math.ceil(total / itemsPerPage) || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, total);
    
    return {
      paginatedLogs: filtered.slice(start, end),
      totalItems: total,
      totalPages: pages,
      startIndex: start,
      endIndex: end
    };
  }, [attendanceLogs, searchQuery, currentPage, itemsPerPage]);

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  useEffect(() => {
    const fetchProfileData = async () => {
      const userDataString = localStorage.getItem("userData");
      const storedUserData = userDataString ? JSON.parse(userDataString) : null;
      const userId = storedUserData?.user_Id;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const [userRes, logsRes] = await Promise.all([
          fetchWithAuth(`/api/users/${userId}`),
          fetchWithAuth(`/api/attendance/logs/${userId}`)
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          localStorage.setItem("userData", JSON.stringify(userData));
        }
        
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setAttendanceLogs(Array.isArray(logsData) ? logsData : []);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const getLogStatusVariant = (status) => {
    if (status?.includes("In")) return "success";
    if (status?.includes("Out")) return "destructive";
    return "secondary";
  };

  const getAttendanceVariant = (status) => {
    const s = status?.toLowerCase();
    if (s?.includes("present")) return "outline";
    if (s?.includes("absent")) return "destructive";
    if (s?.includes("late")) return "warning";
    return "secondary";
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Profile</h1>
              <span className="text-sm text-slate-500 mt-1 block">View and manage your personal information and activity history.</span>
            </div>
            {user && (
              <Button asChild className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-10">
                <Link to={`/users/edit/${user.user_Id}`}>
                  <EditOutlinedIcon className="mr-2 h-4 w-4" /> Edit Profile
                </Link>
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : !user ? (
            <div className="text-center p-12 text-slate-500 bg-white border border-slate-200 rounded-xl">
              User profile data could not be found.
            </div>
          ) : (
            <>
              {/* Hero Banner Section */}
              <Card className="bg-white border-0 shadow-sm mb-6 relative overflow-hidden py-0">
                <div className="h-28 bg-gradient-to-r from-[#2A174E] to-[#45297e]"></div>
                <CardContent className="px-6 pb-6 pt-0 relative">
                  <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12">
                    <div className="w-28 h-28 rounded-full bg-white p-1.5 shadow-md">
                      <div className="w-full h-full rounded-full bg-[#f0ebfa] text-[#4a2b8c] flex items-center justify-center text-4xl font-black uppercase tracking-widest">
                        {user.user_FirstName?.[0]}{user.user_LastName?.[0]}
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">
                        {user.user_FirstName} {user.user_LastName}
                      </h2>
                      <p className="text-slate-500 flex items-center justify-center md:justify-start gap-2 mt-1.5 font-medium">
                        <EmailOutlinedIcon className="h-4 w-4" /> {user.user_Email || "No Email Provided"}
                      </p>
                    </div>
                    <div className="mb-3">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm">
                        Active Account
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dashboard Identity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full animate-in fade-in zoom-in-95 duration-200">
                <Card className="shadow-sm border-0 bg-[#FAF2FF] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Account Identifier</p>
                        <p className="text-3xl font-bold text-[#2A174E] font-mono">{formatUserId(user.user_Id)}</p>
                      </div>
                      <p className="text-xs text-[#2A174E]/70 italic mt-4">System generated employee ID</p>
                    </div>
                    <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <BadgeOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 bg-[#F8FFF2] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">System Role</p>
                        <p className="text-3xl font-bold text-[#3B4E17]">{user.user_Role}</p>
                      </div>
                      <p className="text-xs text-[#3B4E17]/70 italic mt-4">Current authorization access level</p>
                    </div>
                    <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <AdminPanelSettingsOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 bg-[#FFFFF2] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">MaChip Biometrics</p>
                        <p className="text-2xl font-bold text-[#BB8B26] font-mono leading-tight max-w-[200px] truncate">
                          {user.user_MachipId || "Unlinked"}
                        </p>
                      </div>
                      <p className="text-xs text-[#BB8B26]/70 italic mt-4">Hardware authentication token</p>
                    </div>
                    <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <FingerprintOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart Section */}
              <Card className="bg-gradient-to-r from-[#F8FAFC] to-[#FAF2FF] border border-slate-200/80 shadow-sm mb-6 overflow-hidden">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold text-[#2A174E]">Attendance Consistency (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-4 overflow-x-auto overflow-y-hidden">
                  <div className="w-full h-[260px] min-w-[600px] overflow-hidden">
                    <Chart
                      title=""
                      userId={user.user_Id}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Table Section */}
              <Card className="border border-slate-200/80 shadow-sm bg-white mb-6 overflow-hidden">
                <CardHeader className="border-b border-slate-100 py-4 px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#2A174E]/10 rounded-lg text-[#2A174E] shrink-0">
                      <BadgeOutlinedIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-[#2A174E]">Personal Attendance Logs</CardTitle>
                      <p className="text-xs text-slate-400 font-medium">Historical records of daily time ins, time outs, and attendance status</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search date or status..." 
                        className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-[#2A174E]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} 
                      />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 flex flex-col justify-between min-h-[460px]">
                  <div className="overflow-x-auto flex-1">
                    <Table>
                      <TableHeader className="bg-[#2A174E]">
                        <TableRow className="h-11 hover:bg-transparent border-b-0">
                          <TableHead className="font-bold text-white uppercase text-[10px] tracking-wider py-3.5 px-6">Date</TableHead>
                          <TableHead className="font-bold text-white text-center uppercase text-[10px] tracking-wider py-3.5">Time In</TableHead>
                          <TableHead className="font-bold text-white text-center uppercase text-[10px] tracking-wider py-3.5">Time Out</TableHead>
                          <TableHead className="font-bold text-white text-center uppercase text-[10px] tracking-wider py-3.5">Log Type</TableHead>
                          <TableHead className="font-bold text-white text-center uppercase text-[10px] tracking-wider py-3.5 px-6">Attendance Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLogs.length > 0 ? (
                          paginatedLogs.map((log, index) => {
                            const rawStatus = (log.attendanceStatus || "").toLowerCase();
                            const isPresent = rawStatus.includes("present") || rawStatus.includes("on time");
                            const isLate = rawStatus.includes("late");
                            const isAbsent = rawStatus.includes("absent");

                            return (
                              <TableRow key={log.sessionId || index} className="h-12 border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                                <TableCell className="py-2.5 px-6">
                                  <span className="font-bold text-[#2A174E] text-xs block">
                                    {log.log_Date ? new Date(log.log_Date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1 rounded-md inline-block">
                                    {formatTime12h(log.time_In)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 border border-slate-200/80 px-2.5 py-1 rounded-md inline-block">
                                    {formatTime12h(log.time_Out)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    log.logStatus?.includes("In")
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : log.logStatus?.includes("Out")
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      log.logStatus?.includes("In") ? "bg-emerald-500" : log.logStatus?.includes("Out") ? "bg-indigo-500" : "bg-slate-400"
                                    }`} />
                                    {log.logStatus || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center py-2.5 px-6">
                                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-2xs ${
                                    isPresent
                                      ? "bg-emerald-500 text-white"
                                      : isLate
                                      ? "bg-amber-400 text-slate-950"
                                      : isAbsent
                                      ? "bg-rose-500 text-white"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}>
                                    {log.attendanceStatus !== "—" ? log.attendanceStatus : "—"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow className="h-48">
                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">
                              No attendance records found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalItems > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline">Rows per page:</span>
                          <Select 
                            value={itemsPerPage.toString()} 
                            onValueChange={(val) => setItemsPerPage(Number(val))}
                          >
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

            </>
          )}
        </div>
      </Sidebar>
    </div>
  );
};

export default Profile;