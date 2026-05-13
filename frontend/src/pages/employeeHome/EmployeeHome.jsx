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

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

      <div className="flex-1 p-4 md:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0">
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
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) : recentRequests.length > 0 ? (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {recentRequests.map(req => {
                    let dateDisplay = "";
                    if (req.emp_reqTypeId === 1) {
                      dateDisplay = req.OT_DateOf;
                    } else if (req.emp_reqTypeId === 2) {
                      dateDisplay = req.DateonField;
                    } else if (req.emp_reqTypeId === 5) {
                      dateDisplay = req.LC_logDate;
                    } else if (req.emp_reqTypeId === 6) {
                      dateDisplay = req.EL_DateOfLeave;
                    } else if (req.emp_reqTypeId === 7) {
                      dateDisplay = req.HD_DateOfLeave;
                    } else {
                      const start = req.VL_StartDate || req.SL_StartDate;
                      const end = req.VL_EndDate || req.SL_EndDate;
                      dateDisplay = start === end ? start : `${start} to ${end}`;
                    }

                    // Dynamic Styles based on status
                    const isApproved = req.status?.toLowerCase().includes("approve");
                    const isRejected = req.status?.toLowerCase().includes("reject");
                    
                    const boxStyle = isApproved ? "bg-green-50 border-green-200" 
                                   : isRejected ? "bg-red-50 border-red-200" 
                                   : "bg-amber-50 border-amber-200";
                    
                    const iconColor = isApproved ? "text-green-600" 
                                    : isRejected ? "text-red-600" 
                                    : "text-amber-500";

                    const badgeStyle = isApproved ? "bg-green-500 text-white hover:bg-green-600" 
                                     : isRejected ? "bg-red-500 text-white hover:bg-red-600" 
                                     : "bg-amber-500 text-white hover:bg-amber-600";

                    return (
                      <div key={req.emp_reqId} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-xl border ${boxStyle} transition-all shadow-sm`}>
                        <div className={`hidden sm:flex shrink-0 ${iconColor} bg-white p-2 rounded-full shadow-sm`}>
                          {isApproved ? <CheckCircleIcon className="h-6 w-6" /> : 
                           isRejected ? <CancelIcon className="h-6 w-6" /> : 
                           <HourglassEmptyIcon className="h-6 w-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#2A174E] truncate mb-1 text-sm md:text-base">{dateDisplay}</p>
                          <p className="text-xs md:text-sm font-semibold text-slate-600 truncate uppercase tracking-wider">{req.reqTypeName} <span className="text-slate-400 normal-case tracking-normal font-normal ml-1">— {req.remarks || "No description"}</span></p>
                        </div>
                        <Badge className={`shrink-0 w-fit ${badgeStyle} shadow-sm font-bold uppercase tracking-wider text-[10px] px-3 py-1`}>
                          {req.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No recent leave requests.
                </div>
              )}
            </CardContent>
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