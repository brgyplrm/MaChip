import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
// import "./home.scss"; // Removed in favor of Tailwind CSS
import Widget from "../../components/widget/Widget";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import OccupancyList from "../../components/occupancy/OccupancyList";
import Toast from "../../components/toast/Toast";
import { fetchWithAuth } from "../../utils/api";
import { Navigate } from "react-router-dom";
import PageTransition from "../../components/pageTransition/PageTransition";

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
    onLeaveCount: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

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

    // Poll every 60 seconds as a fallback
    const interval = setInterval(fetchDashboardStats, 60000);

    const handleRefresh = () => {
      fetchPendingCount();
      fetchDashboardStats();
    };

    window.addEventListener("dataRefresh", handleRefresh);
    return () => {
      window.removeEventListener("dataRefresh", handleRefresh);
      clearInterval(interval);
    };
  }, [userData?.user_RoleId]);

  return (
    <div className="flex w-full overflow-x-hidden bg-[#fdfaf5]">
       <Sidebar />
      <div className="flex-[6] w-full min-h-screen">
        <PageTransition>
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
          duration={5000}
        />
        {/* Widgets Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] p-5 md:p-[15px] gap-5 md:gap-[15px]">
          <Widget type="officeOccupancy" amount={stats.officeOccupancy} loading={statsLoading} />
          <Widget type="onTime" amount={stats.onTimeCount} loading={statsLoading} />
          <Widget type="lateArrivals" amount={stats.lateArrivalsCount} loading={statsLoading} />
        </div>

        {/* Charts Flexbox */}
        <div className="flex flex-col lg:flex-row p-5 pt-[5px] md:p-[5px_15px] gap-5 md:gap-[15px]">
          <Featured stats={stats} loading={statsLoading} />
          <Chart title="Attendance Comparison Chart" aspect={2 / 1} />
        </div>

        {/* Occupancy List Container */}
        <div className="m-5 md:m-[15px] p-5 md:p-[15px] bg-[#8f8cdb32] rounded-[10px] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)]">
          <OccupancyList />
        </div>
        </PageTransition>
      </div>
    </div>
  );
};

export default Home;
