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
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeHome = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
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
      if (!userData?.user_Id) return;
      try {
        const [statsRes, notifRes] = await Promise.all([
          fetchWithAuth(`/api/attendance/employee-dashboard/${userData.user_Id}`),
          fetchWithAuth(`/api/notifications/unread-count/${userData.user_Id}`)
        ]);

        if (statsRes.ok) {
          setDashboardStats(await statsRes.json());
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

    window.addEventListener("dataRefresh", fetchDashboardData);
    return () => window.removeEventListener("dataRefresh", fetchDashboardData);
  }, [userData?.user_Id]);

  const att = dashboardStats.attendance;
  const balance = dashboardStats.leaveBalance;
  const recentRequests = dashboardStats.monthlyRequests;
  const totalTrackedDays = att.absent + att.onTime + att.late || 1;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>

      <div className="flex-1 p-4 md:p-4 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
        
        {/* Top Section: Attendance Overview */}
        <Card className="mb-6 shadow-sm border-0 bg-white py-0">
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              
              {/* Circular Progress Section */}
              <div className="lg:col-span-2 flex justify-around sm:justify-center sm:gap-8 flex-wrap items-center">
                <div className="w-24 md:w-28 text-center space-y-3">
                  <CircularProgressbar 
                    value={att.absent} maxValue={20} text={`${att.absent}`} 
                    styles={buildStyles({ pathColor: `#ef4444`, textColor: '#2A174E', trailColor: '#f1f5f9' })}
                  />
                  <span className="text-sm font-semibold text-slate-600 block">Days Absent</span>
                </div>
                <div className="w-24 md:w-28 text-center space-y-3">
                  <CircularProgressbar 
                    value={att.late} maxValue={20} text={`${att.late}`} 
                    styles={buildStyles({ pathColor: `#f59e0b`, textColor: '#2A174E', trailColor: '#f1f5f9' })}
                  />
                  <span className="text-sm font-semibold text-slate-600 block">Late Arrivals</span>
                </div>
                <div className="w-24 md:w-28 text-center space-y-3 mt-4 sm:mt-0">
                  <CircularProgressbar 
                    value={att.onTime} maxValue={20} text={`${att.onTime}`} 
                    styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E', trailColor: '#f1f5f9' })}
                  />
                  <span className="text-sm font-semibold text-slate-600 block">On-Time</span>
                </div>
              </div>

              {/* Linear Progress Bars Section */}
              <div className="lg:col-span-3 flex flex-col justify-center space-y-6">
                <h3 className="text-xl font-bold text-[#2A174E]">Attendance Overview ({att.monthName})</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span>Absent</span>
                    <span className="text-slate-500">{att.absent} day(s)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{width: `${(att.absent/totalTrackedDays)*100}%`}}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span>Late</span>
                    <span className="text-slate-500">{att.late} day(s)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{width: `${(att.late/totalTrackedDays)*100}%`}}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span>On-Time / On-Field</span>
                    <span className="text-slate-500">{att.onTime} day(s)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{width: `${(att.onTime/totalTrackedDays)*100}%`}}></div>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Middle Section: Recent Activity & Leave Consumption */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Recent Activity Card */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-0 border-b border-slate-50 mb-0">
              <div className="flex items-center gap-2">
                <HistoryIcon className="text-[#2A174E]" />
                <CardTitle className="text-lg text-[#2A174E]">Recent Attendance</CardTitle>
              </div>
              <Link to="/accessLogs" className="text-sm font-semibold text-[#2A174E] hover:text-[#7451f8] transition-colors">
                See History
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {dashboardStats.recentLogs.length > 0 ? (
                  dashboardStats.recentLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md hover:border-[#2A174E]/30 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-[#2A174E] text-white flex items-center justify-center font-bold text-lg shrink-0 mr-4">
                        {userData.user_FirstName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">
                          {new Date(log.date).toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{log.timeIn} to {log.timeOut}</p>
                      </div>
                      <div className="shrink-0 ml-2">
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${log.status.toLowerCase().includes('time') || log.status.toLowerCase().includes('field') ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                        >
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic p-2">No recent logs found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leave Consumption Card */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-2 border-b border-slate-50 mb-0">
              <CardTitle className="text-lg text-[#2A174E]">Consumed Leave Types</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Track your Vacation (VL) and Sick (SL) leave balance.</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-6 justify-center h-full mt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium text-slate-700">
                      <span>Vacation Leave (VL)</span>
                      <span className="text-slate-500">
                        {Math.min(balance.VL_used || 0, balance.VL_total || 7)} / {balance.VL_total || 7}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2A174E] rounded-full transition-all duration-500" style={{width: `${Math.min(((balance.VL_used || 0) / (balance.VL_total || 7)) * 100, 100)}%`}}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium text-slate-700">
                      <span>Sick Leave (SL)</span>
                      <span className="text-slate-500">
                        {Math.min(balance.SL_used || 0, balance.SL_total || 7)} / {balance.SL_total || 7}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7451f8] rounded-full transition-all duration-500" style={{width: `${Math.min(((balance.SL_used || 0) / (balance.SL_total || 7)) * 100, 100)}%`}}></div>
                    </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Bottom Leaves Section */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-50 mb-0 gap-4">
            <CardTitle className="text-xl text-[#2A174E]">My Requests</CardTitle>
            <Button asChild className="bg-[#2A174E] hover:bg-[#1a0e30] w-full sm:w-auto">
              <Link to="/requests">
                Apply for a leave <ChevronRightOutlinedIcon className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : recentRequests.length > 0 ? (
              <div className="space-y-4">
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

                  const badgeStyle = isApproved ? "bg-green-500 hover:bg-green-600" 
                                   : isRejected ? "bg-red-500 hover:bg-red-600" 
                                   : "bg-amber-500 hover:bg-amber-600";

                  return (
                    <div key={req.emp_reqId} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-xl border ${boxStyle}`}>
                      <div className={`hidden sm:flex shrink-0 ${iconColor}`}>
                        {isApproved ? <CheckCircleIcon className="h-8 w-8" /> : 
                         isRejected ? <CancelIcon className="h-8 w-8" /> : 
                         <HourglassEmptyIcon className="h-8 w-8" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate mb-1">{dateDisplay}</p>
                        <p className="text-sm text-slate-600 truncate">{req.reqTypeName}: {req.remarks || "No description"}</p>
                      </div>
                      <Badge className={`shrink-0 w-fit ${badgeStyle} text-white shadow-none`}>
                        {req.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 italic">
                No recent leave requests.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      </Sidebar>
    </div>
  );
};

export default EmployeeHome;