import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useSystemTime } from "../../context/SystemTimeContext";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import HistoryIcon from '@mui/icons-material/History';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import Toast from "../../components/toast/Toast";
import { Link, Navigate } from "react-router-dom";
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { fetchWithAuth } from "../../utils/api";
import CreditCardIcon from '@mui/icons-material/CreditCard';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

// Lucide Icons
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  History, 
  FileText,
  UserCheck,
  Receipt,
  Download
} from "lucide-react";

// Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EmployeeHome = () => {
  const { systemToday, isMockTime } = useSystemTime();
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "employee");
  
  const formattedTime = systemToday.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const [dashboardStats, setDashboardStats] = useState({
    todayIn: "--:--",
    attendance: { absent: 0, onTime: 0, late: 0, halfDay: 0, leave: 0, monthName: "" },
    leaveBalance: { VL_total: 7, VL_used: 0, VL_balance: 7, SL_total: 7, SL_used: 0, SL_balance: 7 },
    recentLogs: [],
    monthlyRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      const storedUser = JSON.parse(localStorage.getItem("userData"));
      if (!storedUser?.user_Id) {
        setLoading(false);
        return;
      }
      
      setUserData(storedUser);
      const currentId = storedUser.user_Id;
      
      setLoading(true);
      try {
        const [statsRes, notifRes, payrollRes] = await Promise.all([
          fetchWithAuth(`/api/attendance/employee-dashboard/${currentId}`),
          fetchWithAuth(`/api/notifications/unread-count/${currentId}?viewMode=employee`),
          fetchWithAuth(`/api/payroll/my-history`)
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setDashboardStats(data);
        } else {
          setToast({ message: "Failed to load dashboard statistics.", type: "error" });
        }
        
        if (payrollRes.ok) {
          const payrollData = await payrollRes.json();
          setPayrolls(payrollData.slice(0, 3));
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (notifData.count > 0) {
            const isSwitchable = [1, 2, 4].includes(Number(storedUser.user_RoleId));
            setToast({ 
              message: isSwitchable 
                ? `You have ${notifData.count} unread employee notification(s).` 
                : `You have ${notifData.count} unread notification(s).`, 
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

    const handleStorageChange = () => {
      const stored = JSON.parse(localStorage.getItem("userData"));
      const storedMode = localStorage.getItem("viewMode") || "employee";
      setUserData(stored);
      setViewMode(storedMode);
      fetchDashboardData();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("dataRefresh", fetchDashboardData);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("dataRefresh", fetchDashboardData);
    };
  }, []);

  const isSwitchableRole = [1, 2, 4].includes(Number(userData?.user_RoleId));
  if (isSwitchableRole && viewMode === "management") {
    return <Navigate to="/" replace />;
  }

  if (!userData) return null;

  const att = dashboardStats.attendance;
  const balance = dashboardStats.leaveBalance;
  const isSoloParent = Boolean(
    userData?.is_solo_parent === true ||
    userData?.is_solo_parent === "true" ||
    userData?.is_solo_parent === 1 ||
    userData?.is_solo_parent === "1"
  );
  const recentRequests = dashboardStats.monthlyRequests || [];
  const displayedRequests = recentRequests.slice(0, 4);
  const totalDays = (att.absent || 0) + (att.onTime || 0) + (att.late || 0) + (att.halfDay || 0) + (att.leave || 0);
  const totalTrackedDays = totalDays || 1;

  const onTimePct = totalDays > 0 ? Math.round(((att.onTime || 0) / totalTrackedDays) * 100) : 0;
  const latePct = totalDays > 0 ? Math.round(((att.late || 0) / totalTrackedDays) * 100) : 0;
  const absentPct = totalDays > 0 ? Math.round(((att.absent || 0) / totalTrackedDays) * 100) : 0;
  const halfDayPct = totalDays > 0 ? Math.round(((att.halfDay || 0) / totalTrackedDays) * 100) : 0;
  const leavePct = totalDays > 0 ? Math.round(((att.leave || 0) / totalTrackedDays) * 100) : 0;
  const attendanceRate = totalDays > 0 ? Math.round((((att.onTime || 0) + (att.late || 0) + (att.halfDay || 0) + (att.leave || 0)) / totalTrackedDays) * 100) : 100;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  const getRequestStatusConfig = (status, statusId) => {
    const s = (status || "").toLowerCase();
    const id = Number(statusId);

    if (id === 2 || s.includes("approve")) {
      return {
        label: "APPROVED",
        borderClass: "border-emerald-500",
        badgeClass: "bg-emerald-500 text-white",
      };
    }
    if (id === 5 || s.includes("return")) {
      return {
        label: "RETURNED",
        borderClass: "border-purple-600",
        badgeClass: "bg-purple-600 text-white",
      };
    }
    if (id === 3 || s.includes("reject") || s.includes("decline")) {
      return {
        label: "REJECTED",
        borderClass: "border-rose-500",
        badgeClass: "bg-rose-500 text-white",
      };
    }
    // Default: Pending (1, 4 or other)
    return {
      label: status ? status.toUpperCase() : "PENDING",
      borderClass: "border-amber-500",
      badgeClass: "bg-amber-500 text-white",
    };
  };

  // Dynamic Greeting Logic (Match Admin)
  const getGreeting = () => {
    const hour = (systemToday || new Date()).getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const currentDate = (systemToday || new Date()).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast({ ...toast, message: "" })} 
            />
          
          {loading ? (
            <div className="space-y-6">
              {/* Greeting Banner Skeleton */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full mb-6">
                <div>
                  <Skeleton className="h-9 w-64 md:w-80 mb-2" />
                  <Skeleton className="h-5 w-48 md:w-60" />
                </div>
                <Skeleton className="h-16 w-[200px] rounded-xl" />
              </div>

              {/* Top 3 Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-[140px] border-none shadow-sm bg-white">
                    <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                      <div>
                        <Skeleton className="h-4 w-28 mb-3" />
                        <Skeleton className="h-10 w-36" />
                      </div>
                      <Skeleton className="h-3 w-44 mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 3-column Breakdown Section Skeleton */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
                {/* Column 1: Arrival Breakdown Skeleton */}
                <Card className="p-6 shadow-sm border-none bg-white h-[420px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="flex justify-around w-full">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                          <Skeleton className="h-16 w-16 rounded-full" />
                          <Skeleton className="h-3 w-10" />
                        </div>
                      ))}
                    </div>
                    <div className="w-full space-y-3 mt-auto">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-3 w-full rounded-full" />
                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Column 2: Recent Requests Skeleton */}
                <Card className="p-6 shadow-sm border-none bg-white h-[420px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="flex-1 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                        <div className="space-y-2 flex-1 mr-4">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Column 3: Recent Payslips Skeleton */}
                <Card className="p-6 shadow-sm border-none bg-white h-[420px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="flex-1 space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="space-y-2 text-right">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-12 ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <Skeleton className="h-3 w-20" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-8 w-full rounded" />
                      <Skeleton className="h-8 w-full rounded" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Bottom Section: Timeline & Leave Balances Skeletons */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full mb-8">
                {/* Timeline Skeleton */}
                <Card className="xl:col-span-2 shadow-sm border-none bg-white h-[420px] flex flex-col">
                  <div className="p-6 pb-4 border-b border-slate-50 flex items-center">
                    <Skeleton className="h-5 w-44" />
                  </div>
                  <div className="p-6 flex-1 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between items-center p-4 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20 rounded" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Leave Balances Skeleton */}
                <Card className="shadow-sm border-none bg-white flex flex-col h-[420px]">
                  <div className="p-6 pb-4 border-b border-slate-50 flex items-center">
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-center gap-6">
                    {[1, 2].map((i) => (
                      <div key={i} className="p-5 border border-slate-100 rounded-xl bg-slate-50/50">
                        <div className="flex justify-between items-end mb-4">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <Skeleton className="h-3 w-full rounded-full" />
                        <Skeleton className="h-3 w-16 mt-2 ml-auto" />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <>
              <div className="h-2"></div>

              {/* Greeting Banner */}
              <div className="rounded-xl p-0 md:p-0 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white w-full">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight text-brand-primary">
                    {getGreeting()}, {userData?.user_FirstName || "User"}!
                  </h1>
                  <p className="text-brand-primary/80 text-sm md:text-base font-medium">
                    Here is your personal overview for {currentDate}.
                  </p>
                </div>
                
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shadow-sm flex bg-white border border-slate-200 px-5 py-3 rounded-xl flex-col gap-1 items-start min-w-[200px] transition-all duration-200 hover:shadow-md cursor-help">
                      <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                        <Clock size={12} className="text-brand-primary/60" />
                        <span>System Time</span>
                        <span className={`w-2 h-2 rounded-full ${isMockTime ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"}`}></span>
                      </p>
                      <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tight text-brand-primary font-mono leading-none">
                          {formattedTime}
                        </span>
                        {isMockTime && (
                          <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-1 animate-pulse">
                            ⚠️ Mock Mode Active
                          </span>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                    {isMockTime 
                      ? "System time is running in Mock Mode (for demonstration/testing purposes)." 
                      : "System time is synchronized with the company attendance server."}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Border Top Widget Cards (Match Admin Style) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                <Link to="/logs" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="bg-gradient-to-t from-brand-primary to-[#4A2C7D] shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none cursor-help">
                      <div className="absolute right-1 top-4 opacity-10">
                        <Clock size={160} className="text-white absolute -right-2 -top-2" strokeWidth={1} />
                      </div>
                      <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Today's Log-In</p>
                          <p className="text-4xl font-bold text-white">{dashboardStats.todayIn || "--:-- AM"}</p>
                        </div>
                        <p className="text-xs font-semibold text-white/70 italic mt-4">Your first recorded punch today</p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                    Your first clock-in recorded by the RFID and biometric terminal today.
                  </TooltipContent>
                </Tooltip>
                </Link>
                
                <Link to="/requests" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="bg-gradient-to-t from-[#5A6F2A] to-accent-green shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none cursor-help">
                      <div className="absolute right-1 top-4 opacity-10">
                        <FileText size={160} className="text-white absolute -right-2 -top-2" strokeWidth={1} />
                      </div>
                      <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Available Leaves</p>
                          <p className="text-4xl font-bold text-white">
                            {(balance.VL_balance || 0) + (balance.SL_balance || 0) + (isSoloParent ? (balance.SoloParent_balance || 0) : 0)} <span className="text-xl opacity-80 font-medium">Days</span>
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-white/70 italic mt-4">
                          VL: {balance.VL_balance} &nbsp;|&nbsp; SL: {balance.SL_balance}
                          {isSoloParent && balance.SoloParent_balance !== undefined ? ` \u00A0|\u00A0 SP: ${balance.SoloParent_balance}` : ""} Remaining Leaves
                        </p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                    Sum of remaining Vacation Leave (VL), Sick Leave (SL), and statutory leave credits.
                  </TooltipContent>
                </Tooltip>
                </Link>

                <Link to="/employee/payroll" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="bg-gradient-to-t from-accent-gold to-[#6e6adc] shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none cursor-help">
                      <div className="absolute right-1 top-4 opacity-10">
                        <CreditCardIcon sx={{ fontSize: 160 }} className="text-white absolute -right-2 -top-2" />
                      </div>
                      <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Latest Net Pay</p>
                          <p className="text-4xl font-bold text-white">
                            {payrolls.length > 0 ? formatCurrency(payrolls[0].netPay) : "₱0.00"}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-white/70 italic mt-4">From your most recent released payslip</p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                    Take-home pay for the most recent cutoff period (excluding government deductions).
                  </TooltipContent>
                </Tooltip>
                </Link>

              </div>

              <div className="h-4"></div>

              {/* Small Summary Section (Match Admin 3-column Layout) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-2 w-full">
                
                {/* Column 1: Attendance Breakdown */}
                <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col border-t-4 border-brand-primary h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-gray-500 font-medium flex items-center gap-1.5">
                      <span>Arrival Breakdown</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlinedIcon className="text-slate-400 hover:text-slate-600 cursor-pointer !text-[14px] transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Summary of your attendance punches (Absences, Latenesses, and On-Time arrivals) for this {att.monthName || "Month"}.
                        </TooltipContent>
                      </Tooltip>
                    </h2>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-between gap-4 mt-2">
                    <div className="flex justify-around w-full px-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-20 md:w-24 text-center space-y-3 cursor-pointer group">
                            <div className="transition-transform duration-200 group-hover:scale-105">
                              <CircularProgressbar 
                                value={att.absent || 0} 
                                maxValue={totalTrackedDays} 
                                text={`${att.absent || 0}`} 
                                styles={buildStyles({ pathColor: `#ef4444`, textColor: 'var(--color-brand-primary)', trailColor: '#e2e8f0', textSize: '24px' })} 
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Absent</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          {att.absent || 0} out of {totalDays} {totalDays === 1 ? "day" : "days"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-20 md:w-24 text-center space-y-3 cursor-pointer group">
                            <div className="transition-transform duration-200 group-hover:scale-105">
                              <CircularProgressbar 
                                value={att.late || 0} 
                                maxValue={totalTrackedDays} 
                                text={`${att.late || 0}`} 
                                styles={buildStyles({ pathColor: `#f59e0b`, textColor: 'var(--color-brand-primary)', trailColor: '#e2e8f0', textSize: '24px' })} 
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Late</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          {att.late || 0} out of {totalDays} {totalDays === 1 ? "day" : "days"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-20 md:w-24 text-center space-y-3 cursor-pointer group">
                            <div className="transition-transform duration-200 group-hover:scale-105">
                              <CircularProgressbar 
                                value={att.onTime || 0} 
                                maxValue={totalTrackedDays} 
                                text={`${att.onTime || 0}`} 
                                styles={buildStyles({ pathColor: `#22c55e`, textColor: 'var(--color-brand-primary)', trailColor: '#e2e8f0', textSize: '24px' })} 
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">On-Time</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          {att.onTime || 0} out of {totalDays} {totalDays === 1 ? "day" : "days"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="w-full space-y-3 mt-auto">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                          Period Attendance Ratio
                        </span>
                        <span className="text-slate-400 font-medium text-[11px]">
                          {totalDays} {totalDays === 1 ? "day" : "days"} tracked
                        </span>
                      </div>

                      {/* 100% Continuous Multi-Segment Bar */}
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        {att.onTime > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className="bg-green-500 h-full transition-all duration-700 hover:opacity-90 cursor-help" 
                                style={{ width: `${(att.onTime / totalTrackedDays) * 100}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              On-Time: {onTimePct}% ({att.onTime} {att.onTime === 1 ? "day" : "days"})
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {att.late > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className="bg-amber-500 h-full transition-all duration-700 hover:opacity-90 cursor-help" 
                                style={{ width: `${(att.late / totalTrackedDays) * 100}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Late: {latePct}% ({att.late} {att.late === 1 ? "day" : "days"})
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {att.halfDay > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className="bg-blue-500 h-full transition-all duration-700 hover:opacity-90 cursor-help" 
                                style={{ width: `${(att.halfDay / totalTrackedDays) * 100}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Half-Day: {halfDayPct}% ({att.halfDay} {att.halfDay === 1 ? "day" : "days"})
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {att.leave > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className="bg-purple-500 h-full transition-all duration-700 hover:opacity-90 cursor-help" 
                                style={{ width: `${(att.leave / totalTrackedDays) * 100}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              On Leave: {leavePct}% ({att.leave} {att.leave === 1 ? "day" : "days"})
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {att.absent > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className="bg-red-500 h-full transition-all duration-700 hover:opacity-90 cursor-help" 
                                style={{ width: `${(att.absent / totalTrackedDays) * 100}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                              Absent: {absentPct}% ({att.absent} {att.absent === 1 ? "day" : "days"})
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {totalDays === 0 && (
                          <div className="w-full h-full bg-slate-200" />
                        )}
                      </div>

                      {/* Ratio Metric Legend Cards */}
                      <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                        <div className="bg-green-50/70 p-2 rounded-lg border border-green-100">
                          <span className="text-[10px] font-bold text-green-700 block uppercase tracking-wider">On-Time</span>
                          <span className="text-sm font-black text-green-800">{onTimePct}%</span>
                        </div>
                        <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                          <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Late</span>
                          <span className="text-sm font-black text-amber-800">{latePct}%</span>
                        </div>
                        <div className="bg-red-50/70 p-2 rounded-lg border border-red-100">
                          <span className="text-[10px] font-bold text-red-700 block uppercase tracking-wider">Absent</span>
                          <span className="text-sm font-black text-red-800">{absentPct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Recent Requests */}
                <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col border-t-4 border-accent-green h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-gray-500 font-medium flex items-center gap-1.5">
                      <span>Recent Requests</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlinedIcon className="text-slate-400 hover:text-slate-600 cursor-pointer !text-[14px] transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Your most recently filed leave, overtime, or schedule adjustment requests and their approval statuses.
                        </TooltipContent>
                      </Tooltip>
                    </h2>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    {displayedRequests.length > 0 ? (
                      <>
                        <div className="space-y-2.5">
                          {displayedRequests.map((req) => {
                            const config = getRequestStatusConfig(req.status, req.emp_reqStatusId);
                            const formattedDate = req.date_Filed || req.createdAt
                              ? new Date(req.date_Filed || req.createdAt).toLocaleDateString()
                              : "";

                            return (
                              <div
                                key={req.emp_reqId}
                                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-[#F8FFF2] transition-colors border-l-4 ${config.borderClass} bg-slate-50/70 min-w-0`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-brand-primary truncate">{req.reqTypeName}</p>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {req.remarks ? `${req.remarks}${formattedDate ? ` • ${formattedDate}` : ""}` : (formattedDate || "No description provided")}
                                  </p>
                                </div>
                                <Badge className={`shrink-0 text-[9px] uppercase px-2 py-0 border-0 ${config.badgeClass}`}>
                                  {config.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                        <div className="pt-2 flex items-center justify-center">
                          <Link 
                            to="/requests" 
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green hover:text-brand-primary hover:underline transition-colors py-1 px-3 rounded-md hover:bg-[#F8FFF2]"
                          >
                            <MoreHorizIcon sx={{ fontSize: 18 }} className="text-accent-green/70" />
                            <span>See more</span>
                            {recentRequests.length > 4 && (
                              <span className="text-[11px] text-gray-500 font-normal">
                                (+{recentRequests.length - 4} more)
                              </span>
                            )}
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <FileText className="h-10 w-10 mb-3" />
                        <p className="text-xs font-medium">No recent requests found.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Recent Payslips & Actions */}
                <div className="bg-white p-6 rounded-xl shadow-sm text-accent-gold flex flex-col border-t-4 border-accent-gold h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[#033A55]/80 font-medium flex items-center gap-1.5">
                      <span>Recent Payslips</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlinedIcon className="text-slate-400 hover:text-slate-600 cursor-pointer !text-[14px] transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                          Your released payslips for the recent cutoff periods. Click "VIEW SLIP" to open a detailed breakdown.
                        </TooltipContent>
                      </Tooltip>
                    </h2>
                    <Link to="/employee/payroll" className="text-xs text-accent-gold/60 font-semibold hover:underline hover:text-accent-gold/80">View All</Link>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                    {payrolls.length > 0 ? (
                      payrolls.map((p) => (
                        <div key={p.payrollId} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-brand-primary/30 transition-all">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Period End</p>
                            <p className="text-xs font-bold text-slate-800">{new Date(p.period_End).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="text-sm font-black text-brand-primary">{formatCurrency(p.netPay)}</p>
                            <Link to={`/employee/payslip/${p.payrollId}`} className="text-[9px] font-bold text-blue-500 hover:underline mt-0.5">VIEW SLIP</Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                         <Receipt className="h-10 w-10 mb-3" />
                         <p className="text-xs font-medium">No released payslips.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="w-full text-xs hover:bg-accent-green hover:text-white hover:border-accent-green transition-colors" asChild>
                        <Link to="/requests">File Leave</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-colors" asChild>
                        <Link to="/profile">My Profile</Link>
                      </Button>
                    </div>
                  </div>
                </div>

              </div>

              <div className="h-6"></div>

              {/* Bottom Section: Timeline & Leave Balances */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full mb-8">
                
                {/* Attendance Timeline */}
                <Card className="xl:col-span-2 shadow-sm border-0 border-t-4 border-brand-primary bg-white h-[420px] flex flex-col">
                  <CardHeader className="pb-0 border-b border-slate-50 shrink-0">
                    <CardTitle className="text-brand-primary text-base font-bold uppercase tracking-wider flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <HistoryIcon className="h-5 w-5" />
                        <span>Attendance Timeline</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlinedIcon className="text-slate-400 hover:text-brand-primary cursor-pointer !text-[16px] transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Timeline of your daily RFID/biometric logs showing Time In, Time Out, and recorded attendance status.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 flex-1 overflow-hidden flex flex-col">
                    <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                      {dashboardStats.recentLogs.map((log, idx) => {
                        const isGood = log.status?.toLowerCase().includes('time') || log.status?.toLowerCase().includes('field');
                        return (
                          <div key={idx} className={`flex justify-between items-center p-4 border rounded-lg transition-all ${isGood ? "bg-green-50/50 border-green-100" : "bg-amber-50/50 border-amber-100"}`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-2.5 rounded-full ${isGood ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                                <History className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{log.timeIn} &nbsp;—&nbsp; {log.timeOut}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[10px] uppercase border-0 font-bold px-2 py-1 ${isGood ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {log.status}
                            </Badge>
                          </div>
                        );
                      })}
                      {dashboardStats.recentLogs.length === 0 && (
                        <div className="text-center py-12 text-slate-400 italic text-sm h-full flex items-center justify-center">No recent logs found.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Leave Balances */}
                <Card className="shadow-sm border-0 border-t-4 border-accent-green bg-white flex flex-col h-[420px]">
                  <CardHeader className="pb-0 border-b border-slate-50 shrink-0">
                    <CardTitle className="text-accent-green text-base font-bold uppercase tracking-wider flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <span>Leave Balances</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlinedIcon className="text-slate-400 hover:text-accent-green cursor-pointer !text-[16px] transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                            Your remaining and used Vacation Leave (VL) and Sick Leave (SL) credits for the calendar year.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 flex-1 flex flex-col justify-center gap-6">
                    {[
                      { label: "Vacation Leave (VL)", bal: balance.VL_balance, total: balance.VL_total, color: "bg-[#8DB552]", light: "bg-[#8DB552]/20" },
                      { label: "Sick Leave (SL)", bal: balance.SL_balance, total: balance.SL_total, color: "bg-[#C0E990]", light: "bg-[#C0E990]/30" },
                      ...(isSoloParent && balance.SoloParent_balance !== undefined ? [{
                        label: "Solo Parent Leave (SP)",
                        bal: balance.SoloParent_balance,
                        total: balance.SoloParent_total || ((parseFloat(balance.SoloParent_used || 0) + parseFloat(balance.SoloParent_balance || 0)) || 7),
                        color: "bg-amber-500",
                        light: "bg-amber-100"
                      }] : [])
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{item.label}</span>
                          <span className="text-2xl font-black text-slate-800">{item.bal} <span className="text-sm font-semibold text-slate-400">/ {item.total}</span></span>
                        </div>
                        <div className={`h-3 ${item.light} rounded-full overflow-hidden`}>
                          <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${(item.bal / (item.total || 1)) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-medium">
                          <span>{item.bal} days remaining</span>
                          <span>{item.total - item.bal} used</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

            </>
          )}

          <style dangerouslySetInnerHTML={{__html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
          `}} />
        </div>
      </TooltipProvider>
    </Sidebar>
  </div>
  );
};

export default EmployeeHome;
