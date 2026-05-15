import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import OccupancyList from "../../components/occupancy/OccupancyList";
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

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Home = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const viewMode = localStorage.getItem("viewMode") || "management";
  const [toast, setToast] = useState({ message: "", type: "success" });
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
      const response = await fetchWithAuth("/api/attendance/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
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
        const pending = data.filter(r => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4).slice(0, 3);
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
    const fetchPendingCount = async () => {
      if (!(userData?.user_RoleId === 1 || userData?.user_RoleId === 2)) return;
      try {
        const response = await fetchWithAuth("/api/request/pending-count");
        if (response.ok) {
          const data = await response.json();
          if (data.count > 0) {
            setToast({
              message: `Attention: There are ${data.count} pending request(s) awaiting your approval.`,
              type: "error" 
            });
          }
        }
      } catch (error) {
        console.error("Error fetching pending count:", error);
      }
    };

    fetchPendingCount();
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
      fetchPendingCount();
      fetchDashboardStats();
      fetchPayrollPeriods();
      fetchPendingRequests();
      fetchOverallStats();
    };

    window.addEventListener("dataRefresh", handleRefresh);
    return () => {
      window.removeEventListener("dataRefresh", handleRefresh);
      clearInterval(interval);
    };
  }, [userData?.user_RoleId]);

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
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ ...toast, message: "" })} 
        duration={5000}
      />
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-[1400px] mx-auto">
        <div className="h-2"></div>

        {/* Greeting Banner */}
        <div className="rounded-xl p-0 md:p-0 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white w-full">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight text-[#2A174E]">
              {getGreeting()}, {userData?.user_FirstName || "User"}!
            </h1>
            <p className="text-[#2A174E]/80 text-sm md:text-base font-medium">
              Here is what's happening today, {currentDate}.
            </p>
          </div>
          
          <div className="shadow-sm hidden md:flex bg-white/10 px-5 py-3 rounded-lg backdrop-blur-sm border border-white/10 flex-col gap-1 items-start">
             <p className="text-[10px] font-bold text-[#2A174E]/60 uppercase tracking-widest mb-0.5">System Status</p>
             <div className="flex items-center gap-2">
               <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse"></span>
               <span className="text-sm font-semibold tracking-wide text-[#2A174E]">All systems operational</span>
             </div>
          </div>
        </div>

        {/* Solid Color Widget Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          <Link to="/logs" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <Card className="shadow-sm border-0 bg-[#2A174E] py-0 h-full">
              <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Office Occupancy</p>
                  <p className="text-4xl font-bold text-white">{statsLoading ? "..." : stats.officeOccupancy}</p>
                </div>
                <p className="text-xs text-white/70 italic mt-4">{statsLoading ? "Loading logs..." : `${stats.enteredCount || 0} entered, and ${stats.exitedCount || 0} exited`}</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/adminRequests" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <Card className="shadow-sm border-0 bg-[#3B4E17] py-0 h-full">
              <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Pending Approvals</p>
                  <p className="text-4xl font-bold text-white">{statsLoading ? "..." : stats.pendingCount}</p>
                </div>
                <p className="text-xs text-white/70 italic mt-4">Pending requests awaiting action</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/payroll" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <Card className="shadow-sm border-0 bg-[#ECC04B] py-0 h-full">
              <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Projected Monthly (Net)</p>
                  <p className="text-4xl font-bold text-white">{statsLoading ? "..." : `₱${(stats.projectedPayroll || 0).toLocaleString()}`}</p>
                </div>
                <p className="text-xs text-white/70 italic mt-4">Estimated net payout after deductions</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/transaction-logs" className="block outline-none hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <Card className="shadow-sm border-0 bg-[#991b1b] py-0 h-full">
              <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Anomalies</p>
                  <p className="text-4xl font-bold text-white">{statsLoading ? "..." : stats.anomaliesCount || 0}</p>
                </div>
                <p className="text-xs text-white/70 italic mt-4">Unauthorized or failed scans</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="h-4"></div>

        {/* Small Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2 w-full">
          {/* Donut Chart Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col border-t-4 border-[#2A174E] min-w-0">
            <h2 className="text-gray-500 font-medium mb-1">Arrival Breakdown</h2>
            {isEmptyDonut ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <EmptyState 
                  className="h-full flex-1 min-h-[220px] border-0 bg-transparent hover:bg-transparent shadow-none p-2" 
                  icon={<AccessTimeIcon className="w-8 h-8 text-slate-300" />}
                  title="No Arrivals Yet"
                  description="Attendance logs for today haven't been recorded."
                />
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
          <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col border-t-4 border-[#3B4E17] min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-500 font-medium">Pending Requests</h2>
              <Link to="/adminRequests" className="text-xs text-[#3B4E17]/60 font-semibold hover:underline hover:text-[#3B4E17]/80">View All</Link>
            </div>
            <div className="flex-1 space-y-4">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((req) => {
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
                        <p className="text-sm font-bold text-[#2A174E] truncate">{req.userName}</p>
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
                })
              ) : (
                <EmptyState 
                  className="h-full flex-1 min-h-[220px] border-slate-100 bg-white hover:bg-slate-50/50" 
                  icon={<TaskAltIcon className="w-7 h-7 text-slate-300" />}
                  title="All Caught Up!"
                  description="You have reviewed all pending requests."
                />
              )}
            </div>
          </div>

          {/* Next Payroll Run Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm text-[#D4AF37] flex flex-col justify-between border-t-4 border-[#D4AF37] min-w-0">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#033A55]/80 font-medium">Next Payroll Run</h2>
                <Link to="/adminRequests" className="text-xs text-[#D4AF37]/60 font-semibold hover:underline hover:text-[#D4AF37]/80">View All</Link>
              </div>
              <div className="text-5xl font-bold mb-3 truncate h-13">
                {daysRemaining > 0 ? `${daysRemaining} Days Left` : "Processing..."}
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

        <div className="h-8"></div>

        {/* Multi-Tab Chart Section */}
        <Card className="shadow-sm border-gray-200">
          <Tabs defaultValue="weekly" className="w-full">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
              <div>
                <CardTitle className="text-xl font-bold text-[#2A174E]">Overall Attendance</CardTitle>
                <CardDescription>Comparison of attendance rates over time</CardDescription>
              </div>
              
              {/* shadcn Tabs Switcher */}
              <TabsList className="bg-slate-100 p-1">
                <TabsTrigger value="weekly" className="text-xs px-4">Weekly</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs px-4">Quarterly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs px-4">Yearly</TabsTrigger>
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
                            <stop offset="5%" stopColor="#3B4E17" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3B4E17" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
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
                          stroke="#3B4E17" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorPct)" 
                          dot={{ r: 4, fill: "#3B4E17", strokeWidth: 2, stroke: "#fff" }}
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

        {/* Occupancy List Section */}
        <div className="w-full overflow-x-auto min-w-0 mt-3 shadow-sm rounded-xl">
          <OccupancyList />
        </div>
        <div className="h-6"></div>
      </div>
    </Sidebar>
  );
};

export default Home;