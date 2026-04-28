import React, { useState, useEffect } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import "./home.scss";
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
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <PageTransition>
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
          duration={5000}
        />
        <div className="widgets">
          <Widget type="officeOccupancy" amount={stats.officeOccupancy} loading={statsLoading} />
          <Widget type="onTime" amount={stats.onTimeCount} loading={statsLoading} />
          <Widget type="lateArrivals" amount={stats.lateArrivalsCount} loading={statsLoading} />
        </div>
        <div className="charts">
          <Featured stats={stats} loading={statsLoading} />
          <Chart title="Attendance Comparison Chart" aspect={2 / 1} />
        </div>
        <div className="listContainer">
          <OccupancyList />
        </div>
        </PageTransition>
      </div>
    </div>
  );
};

export default Home;
