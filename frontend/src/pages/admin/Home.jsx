import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useSystemTime } from "../../context/SystemTimeContext";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import OccupancyList from "../../components/occupancy/OccupancyList";
import AssignmentIcon from '@mui/icons-material/Assignment';
import SyncIcon from '@mui/icons-material/Sync';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import Toast from "../../components/toast/Toast";
import { fetchWithAuth } from "../../utils/api";
import { Navigate, Link } from "react-router-dom";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend, 
  AreaChart, 
  Area
} from "recharts";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BottomNav from "../../components/BottomNav";
import SearchOffIcon from '@mui/icons-material/SearchOff';
import EmptyState from "../../components/EmptyState";
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Home = () => {
  const { systemToday, isMockTime } = useSystemTime();
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "management");
  const [loading, setLoading] = useState(false);

  const formattedTime = systemToday.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isResettingTft, setIsResettingTft] = useState(false);

  const handleResetTftScreen = async () => {
    if (isResettingTft) return;
    setIsResettingTft(true);
    try {
      const response = await fetchWithAuth("/api/esp/reset-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setToast({
          message: "TFT screen successfully reset to default state (Scan RFID to Clock In).",
          type: "success"
        });
      } else {
        setToast({
          message: data?.message || "Failed to reset TFT screen.",
          type: "error"
        });
      }
    } catch (error) {
      console.error("Error resetting TFT screen:", error);
      setToast({
        message: "Network error occurred while resetting TFT screen.",
        type: "error"
      });
    } finally {
      setIsResettingTft(false);
    }
  };
  const [stats, setStats] = useState({
    totalEmployees: 0,
    officeOccupancy: 0,
    onTimeCount: 0,
    lateArrivalsCount: 0,
    absentCount: 0,
    onLeaveCount: 0,
    enteredCount: 0,
    exitedCount: 0,
    onTimeChange: 0,
    lateArrivalsChange: 0,
    pendingCount: 0,
    projectedPayroll: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chartData, setChartData] = useState({
    weekly: [],
    quarterly: [],
    yearly: []
  });

  // Dynamic Greeting Logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Date Formatter
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  if (viewMode === "employee") {
    return <Navigate to="/employeeHome" replace />;
  }

  const fetchDashboardStats = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetchWithAuth("/api/attendance/stats"),
        fetchWithAuth("/api/request/pending-count")
      ]);

      let pendingCount = null;
      if (pendingRes && pendingRes.ok) {
        const pendingData = await pendingRes.json();
        pendingCount = Number(pendingData.count);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          ...data,
          pendingCount: pendingCount !== null && !isNaN(pendingCount) ? pendingCount : (data.pendingCount || 0)
        });
      } else if (pendingCount !== null && !isNaN(pendingCount)) {
        setStats(prev => ({
          ...prev,
          pendingCount
        }));
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetchWithAuth("/api/request/all");
      if (response.ok) {
        const data = await response.json();
        const currentUserId = Number(userData?.user_Id || JSON.parse(localStorage.getItem("userData") || "{}")?.user_Id);
        const userRole = Number(userData?.user_RoleId || JSON.parse(localStorage.getItem("userData") || "{}")?.user_RoleId);

        const pending = data
          .filter((r) => {
            const isPendingOrRecommended = r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4;
            const isNotSelf = Number(r.user_Id) !== currentUserId;
            
            if (userRole === 2) {
              // Supervisors only process standard staff requests
              return r.emp_reqStatusId === 1 && isNotSelf && Number(r.user_RoleId) === 3;
            }
            // Admins (Role 1) and Accountants (Role 4) process requests from other accounts
            return isPendingOrRecommended && isNotSelf;
          })
          .slice(0, 3);

        setPendingRequests(pending);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

  const fetchPayrollPeriods = async () => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      if (response.ok) {
        const data = await response.json();
        setPayrollPeriods(data);
      }
    } catch (error) {
      console.error("Error fetching payroll periods:", error);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const response = await fetchWithAuth("/api/attendance/overall-stats");
      if (response.ok) {
        const data = await response.json();
        setChartData(data);
      }
    } catch (error) {
      console.error("Error fetching overall stats:", error);
    }
  };

  useEffect(() => {
    const fetchAdminNotificationUpdates = async () => {
      const storedUser = JSON.parse(localStorage.getItem("userData") || "{}");
      const currentRole = Number(storedUser?.user_RoleId);
      const currentId = Number(storedUser?.user_Id);

      // Only management roles (Admin: 1, Supervisor: 2, Accountant: 4) can receive management updates
      if (![1, 2, 4].includes(currentRole)) return;

      try {
        const [pendingRes, notifRes] = await Promise.all([
          fetchWithAuth("/api/request/pending-count"),
          currentId 
            ? fetchWithAuth(`/api/notifications/unread-count/${currentId}?viewMode=management`)
            : Promise.resolve(null)
        ]);

        let pendingCount = 0;
        if (pendingRes && pendingRes.ok) {
          const data = await pendingRes.json();
          pendingCount = Number(data.count) || 0;
        }

        let unreadManagementCount = 0;
        if (notifRes && notifRes.ok) {
          const notifData = await notifRes.json();
          unreadManagementCount = Number(notifData.count) || 0;
        }

        // Distinct separated Admin Dashboard toast messages
        if (pendingCount > 0 && unreadManagementCount > 0) {
          setToast({
            message: `Attention: There are ${pendingCount} pending request(s) awaiting your action, and ${unreadManagementCount} unread administrative notification(s).`,
            type: "error"
          });
        } else if (pendingCount > 0) {
          setToast({
            message: `Attention: There are ${pendingCount} pending request(s) awaiting your approval.`,
            type: "error"
          });
        } else if (unreadManagementCount > 0) {
          setToast({
            message: `You have ${unreadManagementCount} unread administrative notification(s).`,
            type: "info"
          });
        }
      } catch (error) {
        console.error("Error fetching admin notification updates:", error);
      }
    };

    fetchAdminNotificationUpdates();
    fetchDashboardStats();
    fetchPayrollPeriods();
    fetchPendingRequests();
    fetchOverallStats();

    const interval = setInterval(() => {
      fetchDashboardStats();
      fetchPendingRequests();
      fetchOverallStats();
    }, 60000);

    const handleRefresh = () => {
      fetchAdminNotificationUpdates();
      fetchDashboardStats();
      fetchPayrollPeriods();
      fetchPendingRequests();
      fetchOverallStats();
    };

    const handleStorageChange = () => {
      const stored = JSON.parse(localStorage.getItem("userData"));
      const storedMode = localStorage.getItem("viewMode") || "management";
      setUserData(stored);
      setViewMode(storedMode);
      handleRefresh();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("dataRefresh", handleRefresh);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("dataRefresh", handleRefresh);
      clearInterval(interval);
    };
  }, []);

  const isEmptyDonut = stats.onTimeCount === 0 && stats.lateArrivalsCount === 0;
  const donutData = isEmptyDonut
    ? [{ name: "No Data", value: 1 }]
    : [
        { name: "On Time", value: stats.onTimeCount },
        { name: "Late Arrivals", value: stats.lateArrivalsCount },
      ];
  const COLORS = ["#4DE189", "#ECC04B"];

  // Bar chart data for detailed breakdown
  const barData = [
    { name: "On Time", value: stats.onTimeCount, color: "#4DE189" },
    { name: "Late", value: stats.lateArrivalsCount, color: "#ECC04B" },
    { name: "Absent", value: stats.absentCount, color: "#F44336" },
    { name: "On Leave", value: stats.onLeaveCount, color: "#2196F3" },
  ];

  const nextPayroll = payrollPeriods.length > 0 ? payrollPeriods[0] : null;
  const daysRemaining = nextPayroll ? Math.ceil((new Date(nextPayroll.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Sidebar>
      <TooltipProvider>
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
          duration={5000}
        />
      {/* Dashboard Skeleton Loading UI */}
      {loading ? (
        <div className="p-2 md:p-4 w-full max-w-6xl mx-auto space-y-6">
          {/* Greeting Skeleton */}
          <div className="mb-6">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-48" />
          </div>

          {/* Widget Cards Skeleton Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[140px] border-none shadow-sm">
                <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-4 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Section Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2 w-full">
            {/* Donut Chart Skeleton */}
            <Card className="h-[300px] shadow-sm flex flex-col p-5">
              <Skeleton className="h-6 w-32 mb-6" />
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Skeleton className="h-32 w-32 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </Card>

            {/* Requests/Payroll Skeletons */}
            {[1, 2].map((i) => (
              <Card key={i} className="h-[300px] shadow-sm p-5">
                <Skeleton className="h-6 w-32 mb-6" />
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </Card>
            ))}
          </div>

          {/* Chart Section Skeleton */}
          <Card className="h-[450px] shadow-sm p-6">
            <Skeleton className="h-8 w-48 mb-6" />
            <Skeleton className="h-[350px] w-full" />
          </Card>
        </div>
      ) : (
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
          <div className="h-2"></div>

          {/* Greeting Banner */}
          <div className="rounded-xl p-0 md:p-0 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white w-full">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight text-brand-primary">
                {getGreeting()}, {userData?.user_FirstName || "User"}!
              </h1>
              <p className="text-brand-primary/80 text-sm md:text-base font-medium">
                Here is what's happening today, {currentDate}.
              </p>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-3">
              {/* System Time Card */}
              <div className="shadow-sm flex bg-white border border-slate-200 px-5 py-3 rounded-xl flex-col justify-between gap-1 items-start min-w-[190px] transition-all duration-200 ">
                <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                  <AccessTimeIcon sx={{ fontSize: 12 }} />
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

              {/* Reset TFT Screen to Default State Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* <button
                    onClick={handleResetTftScreen}
                    disabled={isResettingTft}
                    type="button"
                    className="shadow-sm flex bg-white border border-slate-200 px-4 py-3 rounded-xl flex-col justify-between items-start min-w-[140px] transition-all duration-200 hover:shadow-md hover:border-brand-primary/40 hover:bg-slate-50/80 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer text-left"
                    aria-label="Reset TFT Screen to Default State"
                  >
                    <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest mb-0.5 flex items-center gap-1.5 w-full">
                      <RestartAltIcon 
                        sx={{ fontSize: 13 }} 
                        className={`text-brand-primary transition-transform duration-500 ${isResettingTft ? "animate-spin" : "group-hover:rotate-180"}`} 
                      />
                      <span>TFT Screen</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-auto">
                      <span className="text-xs sm:text-sm font-extrabold tracking-tight text-brand-primary group-hover:text-brand-primary/90 transition-colors">
                        {isResettingTft ? "Resetting..." : "Reset Screen"}
                      </span>
                    </div>
                  </button> */}
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                  Reset the TFT screen into the default state (Scan RFID to Clock In).
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Border Top Widget Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            <Link to="/logs" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
              <Card className="bg-gradient-to-t from-brand-primary to-[#4A2C7D] shadow-sm py-0 h-full relative overflow-hidden">
                {/* Absolute Icon Container */}
                <div className="absolute right-1 top-4 opacity-10">
                  <AssignmentIcon sx={{ fontSize: 200 }} className="text-white" />
                </div>

                <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Employees Present</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/70 hover:text-white cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800">
                          Number of employees currently inside the office, based on active RFID or biometric logs.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-white">{statsLoading ? "..." : stats.officeOccupancy}</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs font-semibold text-white/70 italic mt-4 cursor-help inline-block">
                        {statsLoading ? "Loading logs..." : `${stats.enteredCount || 0} entered, and ${stats.exitedCount || 0} exited`}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800">
                      Daily cumulative count of successful physical entries and exits recorded at the gate reader.
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            </Link>

            <Link to="/adminRequests" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
              <Card className="bg-gradient-to-t from-[#5A6F2A] to-accent-green shadow-sm py-0 h-full relative overflow-hidden">
                <div className="absolute right-1 top-4 opacity-10">
                  <SyncIcon sx={{ fontSize: 200 }} className="text-white" />
                </div>
                <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Pending Requests</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/70 hover:text-white cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800">
                          Total number of employee submissions (leaves, overtime, field-work logs) currently awaiting review or action by management.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-white">{statsLoading ? "..." : stats.pendingCount}</p>
                  </div>
                  <p className="text-xs font-semibold text-white/70 italic mt-4">Pending requests awaiting action</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/payroll" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
              <Card className="bg-gradient-to-t from-accent-gold to-[#6e6adc] shadow-sm py-0 h-full relative overflow-hidden">
                <div className="absolute right-1 top-4 opacity-10">
                  <CreditCardIcon sx={{ fontSize: 200 }} className="text-white" />
                </div>
                <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Projected Monthly Payroll</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-white/70 hover:text-white cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800">
                          Estimated net payout for the current month. Excludes government deductions (SSS, PhilHealth, Pag-IBIG) and tax withholdings.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-white">{statsLoading ? "..." : `₱${(stats.projectedPayroll || 0).toLocaleString()}`}</p>
                  </div>
                  <p className="text-xs font-semibold text-white/70 italic mt-4">Estimated net payout before deductions</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="h-4"></div>

          {/* Small Summary Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2 w-full">
            {/* Donut Chart Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col border-t-4 border-brand-primary min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <h2 className="text-gray-500 font-medium">Arrival Breakdown</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-gray-400 hover:text-gray-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Visual distribution of daily attendance records, showing on-time versus late employee arrivals.
                  </TooltipContent>
                </Tooltip>
              </div>
              {isEmptyDonut ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-2">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Ring Skeleton */}
                    <div className="w-full h-full rounded-full border-[14px] border-muted/80 animate-pulse"></div>
                    {/* Inner Text Placeholder */}
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-wider">No Data</span>
                      <span className="text-xl font-extrabold text-brand-primary/30">0%</span>
                    </div>
                  </div>
                  {/* Legend Skeleton */}
                  <div className="flex justify-center gap-4 text-xs font-medium mt-2 w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#4DE189]/30 animate-pulse"></div>
                      <div className="w-12 h-3 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#ECC04B]/30 animate-pulse"></div>
                      <div className="w-16 h-3 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-[180px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {donutData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 text-xs font-medium mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }}></div>
                      <span>On Time</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[1] }}></div>
                      <span>Late Arrivals</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Recent Pending Requests Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col border-t-4 border-accent-green min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-gray-500 font-medium">Pending Requests</h2>
              </div>
              <div className="flex-1 space-y-3">
                {pendingRequests.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {pendingRequests.map((req) => {
                        const isLeave = req.reqTypeName?.includes("Leave");
                        const isField = req.reqTypeName?.includes("Onfield");
                        const isOvertime = req.reqTypeName?.includes("Overtime");

                        let borderClass = "border-[#D4AF37]";
                        let iconClass = "bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]";
                        
                        if (isLeave) {
                          borderClass = "border-green-500";
                          iconClass = "bg-green-100 text-green-600 hover:bg-green-500";
                        } else if (isField) {
                          borderClass = "border-orange-500";
                          iconClass = "bg-orange-100 text-orange-600 hover:bg-orange-500";
                        } else if (isOvertime) {
                          borderClass = "border-blue-500";
                          iconClass = "bg-blue-100 text-blue-600 hover:bg-blue-500";
                        }

                        return (
                          <div key={req.emp_reqId} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-[#F8FFF2] transition-colors border-l-4 ${borderClass} min-w-0`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-brand-primary truncate">{req.userName}</p>
                              <p className="text-[11px] text-gray-500">{req.reqTypeName} • {new Date(req.date_Filed).toLocaleDateString()}</p>
                            </div>
                            <Link 
                              to={`/adminRequests`} 
                              className={`p-1.5 ${iconClass} rounded-md hover:text-white transition-all shrink-0`}
                            >
                              <RateReviewIcon sx={{ fontSize: 16 }} />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                    {Number(stats.pendingCount) > 3 && (
                      <div className="pt-7 flex items-center justify-center">
                        <Link 
                          to="/adminRequests" 
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green hover:text-brand-primary hover:underline transition-colors py-1 px-3 rounded-md hover:bg-[#F8FFF2]"
                        >
                          <MoreHorizIcon sx={{ fontSize: 18 }} className="text-accent-green/70" />
                          <span>See more</span>
                          {Number(stats.pendingCount) > pendingRequests.length && (
                            <span className="text-[11px] text-gray-500 font-normal">
                              (+{Number(stats.pendingCount) - pendingRequests.length} more)
                            </span>
                          )}
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg border-l-4 border-muted/60 min-w-0">
                        <div className="flex-1 min-w-0 space-y-2">
                          <Skeleton className="h-4 w-[60%]" />
                          <Skeleton className="h-3 w-[40%]" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                      </div>
                    ))}
                    <div className="text-center text-xs text-slate-400/80 font-medium pt-2">
                      All caught up! No pending requests.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Next Payroll Run Card */}
            <div className="bg-white p-5 rounded-xl shadow-sm text-accent-gold flex flex-col justify-between border-t-4 border-accent-gold min-w-0">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[#033A55]/80 font-medium">Next Payroll Run</h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#033A55]/60 hover:text-[#033A55]/80 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800">
                        Countdown and details for the upcoming payroll payout.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Link to="/payroll" className="text-xs text-accent-gold font-semibold hover:underline hover:text-accent-gold/80">View All</Link> 
                </div>
                <div className="text-5xl font-bold mb-3 truncate h-13">
                  {daysRemaining > 0 ? `${daysRemaining} Day${daysRemaining === 1 ? "" : "s"} Left` : "Processing..."}
                </div>
                <div className="h-3"></div>
                <p className="text-[#033A55]/60 text-xs italic">Period: {nextPayroll?.label || "Calculating..."}</p>
                <div className="h-4"></div>
              </div>
              
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-sm border-[#033A55]/10 pb-2">
                  <span className="text-[#033A55]/60">Processing Date</span>
                  <span className="">{nextPayroll ? new Date(nextPayroll.endDate).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-[#033A55]/10 pb-2">
                  <span className="text-[#033A55]/60">Estimated Payees</span>
                  <span className="">{nextPayroll?.employeeCount || 0} Employees</span>
                </div>
                <div className="h-1"></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#033A55]/60">Status</span>
                  <span className="bg-[#11D646] text-[10px] text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-6"></div>

          {/* Multi-Tab Chart Section */}
          <Card className="bg-white shadow-sm border border-slate-200/80">
            <Tabs defaultValue="weekly" className="w-full">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                  <CardTitle className="text-xl font-bold text-brand-primary flex items-center gap-1.5">
                    Overall Attendance
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpOutlineIcon sx={{ fontSize: 16 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                        Comparison of average attendance percentages over the selected interval (weekly, quarterly, or yearly).
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription>Comparison of attendance rates over time</CardDescription>
                </div>
                
                {/* shadcn Tabs Switcher */}
                <TabsList className="shadow-sm bg-[#1D0C45] p-1 gap-1">
                  <TabsTrigger value="weekly" className=" text-xs px-4 text-white hover:text-[#1D0C45] hover:bg-[#E2C6FC]">Weekly</TabsTrigger>
                  <TabsTrigger value="quarterly" className="text-xs px-4 text-white hover:text-[#1D0C45] hover:bg-[#E2C6FC]">Quarterly</TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs px-4 text-white hover:text-[#1D0C45] hover:bg-[#E2C6FC]">Yearly</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                {Object.keys(chartData).map((key) => (
                  <TabsContent key={key} value={key} className="mt-0">
                    <div className="h-[350px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData[key]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7A52B5" stopOpacity={0.1}/>
                              <stop offset="100%" stopColor="#CFFC9C" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '', fontSize: 12, fontWeight: 500 }}
                            dy={10}
                          />
                          <YAxis 
                            domain={[60, 100]} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                          />
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            formatter={(value) => [`${value}%`, "Attendance"]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="#1D0C45" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorPct)" 
                            dot={{ r: 4, fill: "#1D0C45", strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                ))}
              </CardContent>
            </Tabs>
          </Card>
          <div className="h-2"></div>

          {/* Occupancy List Section */}
          <div className="w-full mt-3">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              {/* <h2 className="text-gray-500 font-medium">Today's Office Presence</h2> */}
              {/* <Tooltip>
                <TooltipTrigger asChild>
                  <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-gray-400 hover:text-gray-600 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800">
                  Real-time list of employees who have scanned their RFID/fingerprint today, with their check-in and check-out timestamps.
                </TooltipContent>
              </Tooltip> */}
            </div>
            <div className="w-full overflow-x-auto min-w-0 shadow-sm rounded-xl">
              <OccupancyList />
            </div>
          </div>
          <div className="h-6"></div>
        </div>
      )}
      </TooltipProvider>
    </Sidebar>
  );
};

export default Home;