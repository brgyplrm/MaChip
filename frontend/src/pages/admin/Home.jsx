import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
// import "./home.scss"; // Removed in favor of Tailwind CSS
import Widget from "../../components/Widget";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import OccupancyList from "../../components/occupancy/OccupancyList";
import Toast from "../../components/toast/Toast";
import { fetchWithAuth } from "../../utils/api";
import { Navigate, Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BottomNav from "../../components/BottomNav";

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

  // If management role is in employee mode, redirect them to the employee dashboard
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
        // Filter for Pending (1) or Recommended (4)
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

  useEffect(() => {
    // Show for both Admins (1) and Supervisors (2)
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

    // Poll every 60 seconds as a fallback
    const interval = setInterval(() => {
      fetchDashboardStats();
      fetchPendingRequests();
    }, 60000);

    const handleRefresh = () => {
      fetchPendingCount();
      fetchDashboardStats();
      fetchPayrollPeriods();
      fetchPendingRequests();
    };

    window.addEventListener("dataRefresh", handleRefresh);
    return () => {
      window.removeEventListener("dataRefresh", handleRefresh);
      clearInterval(interval);
    };
  }, [userData?.user_RoleId]);

  const donutData = [
    { name: "On Time", value: stats.onTimeCount },
    { name: "Late Arrivals", value: stats.lateArrivalsCount },
  ];
  const COLORS = ["#4DE189", "#ECC04B"];

  const nextPayroll = payrollPeriods.length > 0 ? payrollPeriods[0] : null;
  const daysRemaining = nextPayroll ? Math.ceil((new Date(nextPayroll.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="flex bg-[#fdfaf5] min-h-screen">
      {/* 1. THE NAVIGATION (Contains the fixed Sidebar and Navbar) */}
      <Sidebar />

      {/* 2. SPACER FOR FIXED SIDEBAR (Desktop only) */}
      <div className="hidden sm:block w-64 flex-shrink-0"></div>

      {/* 3. THE CONTENT WRAPPER */}
      {/* pt-20: Pushes content down to clear the fixed 
      top navbar. */}
      <div className="flex-1 min-w-0 pt-20">
        <main className="p-5 md:p-[15px]">
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast({ ...toast, message: "" })} 
            duration={5000}
          />

          {/* Widgets Grid */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
            <Widget 
              type="officeOccupancy" 
              amount={stats.officeOccupancy} 
              loading={statsLoading} 
              description={`${stats.enteredCount || 0} entered, and ${stats.exitedCount || 0} exited`}
            />
            <Widget
              type="pendingApprovals" 
              amount={stats.pendingCount} 
              loading={statsLoading} 
              description="Pending requests awaiting action"
            />
            <Widget
              type="payrollPreview" 
              amount={`₱${(stats.projectedPayroll || 0).toLocaleString()}`} 
              loading={statsLoading} 
              description="Projected monthly payroll"
            />
          </div>

          <div className="h-6"></div>

          {/* New Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
            {/* Donut Chart Card */}
            <div className="bg-white p-5 rounded-xl shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] flex flex-col border-t-4 border-[#2A174E]">
              <h2 className="text-gray-500 font-medium mb-4">Arrival Breakdown</h2>
              <div className="flex-1 min-h-[200px]">
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
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }}></div>
                  <span>On Time</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[1] }}></div>
                  <span>Late Arrivals</span>
                </div>
              </div>
            </div>

            {/* Recent Pending Requests Card */}
            <div className="bg-white p-5 rounded-xl shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] flex flex-col border-t-4 border-[#FF6B6B]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-gray-500 font-medium">Pending Requests</h2>
                <Link to="/adminRequests" className="text-xs text-[#FF6B6B]/60 font-semibold hover:underline hover:text-[#FF6B6B]/80">View All</Link>
              </div>
              <div className="flex-1 space-y-4">
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((req) => (
                    <div key={req.emp_reqId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#fdfaf5] transition-colors border-l-4 border-[#BA90E9]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#2A174E] truncate">{req.userName}</p>
                        <p className="text-[11px] text-gray-500">{req.reqTypeName} • {new Date(req.date_Filed).toLocaleDateString()}</p>
                      </div>
                      <Link 
                        to={`/adminRequests`} 
                        className="p-1.5 bg-[#BA90E9]/10 text-[#BA90E9] rounded-md hover:bg-[#BA90E9] hover:text-white transition-all"
                      >
                        <RateReviewIcon sx={{ fontSize: 16 }} />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                    <RateReviewIcon sx={{ fontSize: 40 }} className="text-[#5C1515] mb-2" />
                    <p className="text-l text-[#5C1515]">No pending requests at the moment.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Payroll Run Card */}
            <div className="bg-[#F2F6FF] p-5 rounded-xl shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] text-[#033A55] flex flex-col justify-between border-t-4 border-[#4DABF7]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[#033A55]/80 font-medium">Next Payroll Run</h2>
                  <CalendarMonthIcon className="text-[#033A55]/40" />
                </div>
                <div className="text-5xl font-bold mb-2">
                  {daysRemaining > 0 ? `${daysRemaining} Days Left` : "Processing..."}
                </div>
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
                  <span className="bg-green-500 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Explicit Vertical Spacer */}
          <div className="h-6"></div>

          {/* Charts Section */}  

          {/* Occupancy List Section */}
          <div className="w-full">
            <OccupancyList />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

export default Home;
