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

const Home = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const viewMode = localStorage.getItem("viewMode") || "management";
  const [toast, setToast] = useState({ message: "", type: "success" });

  // If management role is in employee mode, redirect them to the employee dashboard
  if (viewMode === "employee") {
    return <Navigate to="/employeeHome" replace />;
  }

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

    window.addEventListener("dataRefresh", fetchPendingCount);
    return () => window.removeEventListener("dataRefresh", fetchPendingCount);
  }, [userData?.user_RoleId]);

  return (
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
          duration={5000}
        />
        <div className="widgets">
          <Widget type="officeOccupancy" />
          <Widget type="onTime" />
          <Widget type="lateArrivals" />
        </div>
        <div className="charts">
          <Featured />
          <Chart title="Attendance Comparison Chart" aspect={2 / 1} />
        </div>
        <div className="listContainer">
          <OccupancyList />
        </div>
      </div>
    </div>
  );
};

export default Home;
