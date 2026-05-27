import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import Toast from "../../components/toast/Toast";
import { Link } from "react-router-dom";
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { fetchWithAuth } from "../../utils/api";
import CreditCardIcon from '@mui/icons-material/CreditCard';
// Lucide Icons (More modern aesthetic)
import { 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  History, 
  FileText,
  UserCheck
} from "lucide-react";

// Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeHome = () => {
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const [dashboardStats, setDashboardStats] = useState({
    attendance: { absent: 0, onTime: 0, late: 0, monthName: "" },
    leaveBalance: { VL_total: 7, VL_used: 0, VL_balance: 7, SL_total: 7, SL_used: 0, SL_balance: 7 },
    recentLogs: [],
    monthlyRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      const storedUser = JSON.parse(localStorage.getItem("userData"));
      if (!storedUser?.user_Id) return;
      
      setUserData(storedUser);
      const currentId = storedUser.user_Id;
      console.log("[DEBUG] Fetching dashboard for ID:", currentId);
      
      setLoading(true);
      try {
        const [statsRes, notifRes] = await Promise.all([
          fetchWithAuth(`/api/attendance/employee-dashboard/${currentId}`),
          fetchWithAuth(`/api/notifications/unread-count/${currentId}`)
        ]);

        console.log("[DEBUG] Dashboard response status:", statsRes.status);
        if (statsRes.ok) {
          const data = await statsRes.json();
          console.log("[DEBUG] Dashboard data received:", data);
          setDashboardStats(data);
        } else {
          setToast({
            message: "Failed to load dashboard statistics.",
            type: "error"
          });
        }
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (notifData.count > 0) {
            setToast({
              message: `You have ${notifData.count} unread notification(s).`,
              type: "success"
            });
          }
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Listen for storage changes (viewMode toggling or login/logout)
    window.addEventListener("storage", fetchDashboardData);
    window.addEventListener("dataRefresh", fetchDashboardData);
    
    return () => {
      window.removeEventListener("storage", fetchDashboardData);
      window.removeEventListener("dataRefresh", fetchDashboardData);
    };
  }, []);

  if (!userData) return null;

  const att = dashboardStats.attendance;
  const balance = dashboardStats.leaveBalance;
  const recentRequests = dashboardStats.monthlyRequests;
  const totalTrackedDays = att.absent + att.onTime + att.late || 1;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-4 md:p-4 overflow-x-hidden w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#2A174E]">Welcome back, {userData?.user_FirstName}!</h1>
              <p className="text-slate-500 mt-1">Manage your schedule and track your performance here.</p>
            </div>
            {/* <Button asChild className="bg-[#2A174E] hover:bg-[#1a0e30] shadow-lg shadow-[#2A174E]/20">
              <Link to="/requests">
                <FileText className="mr-2 h-4 w-4" /> New Request
              </Link>
            </Button> */}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* On-Time Card */}
            <Card className="border-none shadow-sm bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className=" flex justify-between items-center">
                <div>
                  <p className="text-green-50 text-xs font-bold uppercase tracking-wider">On-Time</p>
                  <p className="text-4xl font-black mt-1">{att.onTime} / {totalTrackedDays}</p>
                  <p className="text-[11px] text-green-100 font-medium mt-1 italic font-semibold">
                    {((att.onTime / totalTrackedDays) * 100).toFixed(0)}% of tracked days
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 opacity-30" />
              </CardContent>
            </Card>

            {/* Late Card */}
            <Card className="border-none shadow-sm bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className=" flex justify-between items-center">
                <div>
                  <p className="text-amber-50 text-xs font-bold uppercase tracking-wider">Late</p>
                  <p className="text-4xl font-black mt-1">{att.late} / {totalTrackedDays}</p>
                  <p className="text-[11px] text-amber-100 font-medium mt-1 italic font-semibold">
                    {((att.late / totalTrackedDays) * 100).toFixed(0)}% of tracked days
                  </p>
                </div>
                <Clock className="h-10 w-10 opacity-30" />
              </CardContent>
            </Card>

            {/* Absent Card */}
            <Card className="border-none shadow-sm bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardContent className=" flex justify-between items-center">
                <div>
                  <p className="text-red-50 text-xs font-bold uppercase tracking-wider">Absent</p>
                  <p className="text-4xl font-black mt-1">{att.absent} / {totalTrackedDays}</p>
                  <p className="text-[11px] text-red-100 font-medium mt-1 italic font-semibold">
                    {((att.absent / totalTrackedDays) * 100).toFixed(0)}% of tracked days
                  </p>
                </div>
                <XCircle className="h-10 w-10 opacity-30" />
              </CardContent>
            </Card>
          </div>

          {/* Unified Full-Width Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">

            {/* Row 1: Quick Stats & Leave Balances (12 Columns) */}
            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-t-4 border-green-500 shadow-sm bg-green-50/50 p-6 flex flex-col justify-center items-center text-center">
                <Clock className="h-10 w-10 text-green-600 mb-2" />
                <p className="text-sm font-bold text-green-900">Today's Log-In</p>
                {/* Assuming you have a 'tok
                dayIn' property in your dashboardStats */}
                <p className="text-lg font-black text-green-950 mt-1">
                  {dashboardStats.todayIn || "--:-- AM"}
                </p>
              </Card>
              <Card className="shadow-sm border-t-4 border-amber-500 bg-white p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Leave Balances</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1"><span>Vacation (VL)</span><span>{balance.VL_balance} / {balance.VL_total}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#2A174E]" style={{width: `${(balance.VL_used/balance.VL_total)*100}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1"><span>Sick (SL)</span><span>{balance.SL_balance} / {balance.SL_total}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#7451f8]" style={{width: `${(balance.SL_used/balance.SL_total)*100}%`}}></div></div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Row 1: Actions (4 Columns) */}
            <div className="md:col-span-4">
              <Card className="shadow-sm border-t-4 border-red-500 h-full">
                <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" asChild><Link to="/requests"><FileText className="mr-2 h-4 w-4"/> File Requests</Link></Button>
                  <Button className="w-full justify-start" variant="outline" asChild><Link to="/payroll"><CreditCardIcon className="mr-2 h-4 w-4"/> View Payslips</Link></Button>
                  <Button className="w-full justify-start" variant="outline" asChild><Link to="/profile"><UserCheck className="mr-2 h-4 w-4"/> Update Profile</Link></Button>
                </CardContent>
              </Card>
            </div>

            {/* Standardized Attendance & Requests Container */}

              {/* Attendance Timeline (7/12 Width) */}
              <div className="md:col-span-6">
                <Card className="shadow-sm border-0 h-full flex flex-col border-t-4 border-[#2A174E]">
                  <CardHeader className="pb-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[#2A174E] text-base font-bold uppercase tracking-wider">Attendance Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                      {dashboardStats.recentLogs.map((log, idx) => {
                        const isGood = log.status?.toLowerCase().includes('time') || log.status?.toLowerCase().includes('field');
                        return (
                          <div key={idx} className={`flex justify-between items-center p-3 border rounded-lg transition-all ${isGood ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm ${isGood ? "text-green-600" : "text-red-600"}`}>
                                <History className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{new Date(log.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{log.timeIn} - {log.timeOut}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[10px] uppercase border-0 ${isGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {log.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Requests (5/12 Width) */}
              <div className="md:col-span-6">
                <Card className="shadow-sm border-0 h-full flex flex-col border-t-4 border-[#3B4E17]">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-[#3B4E17] text-base font-bold uppercase tracking-wider">Recent Requests</CardTitle>
                    <Button variant="link" size="sm" asChild className="text-[#3B4E17] text-[11px] font-bold uppercase p-0 h-auto">
                      <Link to="/requests">View All <ChevronRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                      {recentRequests.map(req => {
                        const isApproved = req.status?.toLowerCase().includes("approve");
                        const boxStyle = isApproved ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100";
                        return (
                          <div key={req.emp_reqId} className={`flex items-center gap-3 p-3 rounded-lg border ${boxStyle}`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[#2A174E] truncate text-xs">{req.reqTypeName}</p>
                              <p className="text-[10px] font-semibold text-slate-500 truncate">{req.remarks || "No description"}</p>
                            </div>
                            <Badge className={`shrink-0 text-[9px] uppercase px-2 py-0.5 ${isApproved ? "bg-green-500" : "bg-amber-500"}`}>
                              {req.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
      </Sidebar>
    </div>
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>

      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Employee Dashboard</h1>
            <span className="text-sm text-slate-500 mt-1 block">Overview of your attendance, leaves, and recent activity.</span>
          </div>
          <Button asChild className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-10 px-6">
            <Link to="/requests">
              Apply for a leave <ChevronRightOutlinedIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
          
          {/* Top Section: Attendance Overview */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                <DashboardIcon className="h-5 w-5 text-slate-400" />
                Attendance Overview <span className="text-slate-400 font-medium ml-1">({att.monthName || "Current Month"})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-xl" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  
                  {/* Circular Progress Section */}
                  <div className="lg:col-span-2 flex justify-around sm:justify-center sm:gap-8 flex-wrap items-center bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-inner">
                    <div className="w-20 md:w-24 text-center space-y-3">
                      <CircularProgressbar 
                        value={att.absent} maxValue={20} text={`${att.absent}`} 
                        styles={buildStyles({ pathColor: `#ef4444`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px', pathTransitionDuration: 0.5 })}
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Absent</span>
                    </div>
                    <div className="w-20 md:w-24 text-center space-y-3">
                      <CircularProgressbar 
                        value={att.late} maxValue={20} text={`${att.late}`} 
                        styles={buildStyles({ pathColor: `#f59e0b`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px', pathTransitionDuration: 0.5 })}
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Late</span>
                    </div>
                    <div className="w-20 md:w-24 text-center space-y-3 mt-4 sm:mt-0">
                      <CircularProgressbar 
                        value={att.onTime} maxValue={20} text={`${att.onTime}`} 
                        styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px', pathTransitionDuration: 0.5 })}
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">On-Time</span>
                    </div>
                  </div>

                  {/* Linear Progress Bars Section */}
                  <div className="lg:col-span-3 flex flex-col justify-center space-y-6 px-2">
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold text-slate-700">
                        <span className="uppercase tracking-wider text-xs">Absent</span>
                        <span className="text-slate-500">{att.absent} day(s)</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out" style={{width: `${(att.absent/totalTrackedDays)*100}%`}}></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold text-slate-700">
                        <span className="uppercase tracking-wider text-xs">Late Arrivals</span>
                        <span className="text-slate-500">{att.late} day(s)</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out" style={{width: `${(att.late/totalTrackedDays)*100}%`}}></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold text-slate-700">
                        <span className="uppercase tracking-wider text-xs">On-Time / On-Field</span>
                        <span className="text-slate-500">{att.onTime} day(s)</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out" style={{width: `${(att.onTime/totalTrackedDays)*100}%`}}></div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Middle Section: Recent Activity & Leave Consumption */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Recent Activity Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                  <HistoryIcon className="text-slate-400 h-5 w-5" />
                  Recent Attendance
                </CardTitle>
                <Button variant="link" asChild className="text-[#2A174E] p-0 h-auto font-bold uppercase text-[11px] hover:underline">
                  <Link to="/accessLogs">See History</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-6 flex-1">
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  ) : dashboardStats.recentLogs.length > 0 ? (
                    dashboardStats.recentLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md hover:border-[#2A174E]/30 transition-all">
                        <div className="w-10 h-10 rounded-full bg-[#f0ebfa] text-[#2A174E] flex items-center justify-center font-bold text-lg shrink-0 mr-4 uppercase">
                          {userData.user_FirstName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#2A174E] text-sm truncate">
                            {new Date(log.date).toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}
                          </p>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">{log.timeIn} to {log.timeOut}</p>
                        </div>
                        <div className="shrink-0 ml-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 ${log.status.toLowerCase().includes('time') || log.status.toLowerCase().includes('field') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No recent logs found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Leave Consumption Card */}
            <Card className="shadow-sm border-0 bg-white flex flex-col h-full">
              <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                <CardTitle className="text-lg font-bold text-[#2A174E]">Consumed Leave Types</CardTitle>
                <CardDescription className="text-slate-500">Track your Vacation (VL) and Sick (SL) leave balances.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center">
                {loading ? (
                  <div className="space-y-6">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 justify-center h-full">
                    <div className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between text-sm font-bold text-[#2A174E]">
                        <span className="uppercase tracking-wider text-xs">Vacation Leave (VL)</span>
                        <span className="text-slate-500 font-mono">
                          <span className="text-[#2A174E] text-lg">{Math.min(balance.VL_used || 0, balance.VL_total || 7)}</span> / {balance.VL_total || 7}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-[#2A174E] rounded-full transition-all duration-1000 ease-out" style={{width: `${Math.min(((balance.VL_used || 0) / (balance.VL_total || 7)) * 100, 100)}%`}}></div>
                      </div>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between text-sm font-bold text-[#2A174E]">
                        <span className="uppercase tracking-wider text-xs">Sick Leave (SL)</span>
                        <span className="text-slate-500 font-mono">
                           <span className="text-[#7451f8] text-lg">{Math.min(balance.SL_used || 0, balance.SL_total || 7)}</span> / {balance.SL_total || 7}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-[#7451f8] rounded-full transition-all duration-1000 ease-out" style={{width: `${Math.min(((balance.SL_used || 0) / (balance.SL_total || 7)) * 100, 100)}%`}}></div>
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Bottom Leaves Section */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl gap-4">
              <CardTitle className="text-lg font-bold text-[#2A174E]">My Recent Requests</CardTitle>
              <Button variant="link" asChild className="text-[#2A174E] p-0 h-auto font-bold uppercase text-[11px] hover:underline">
                <Link to="/requests">View All Requests</Link>
              </Button>
            </CardHeader>
            
          </Card>
        </div>

        {/* Global styling for custom scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent; 
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
          }
        `}} />
      </div>
      </Sidebar>
    </div>
  );
};

export default EmployeeHome;