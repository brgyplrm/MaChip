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

const Home = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    // Only show for admins
    if (userData?.user_RoleId === 1) {
      const fetchPendingCount = async () => {
        try {
          const response = await fetchWithAuth("/api/request/pending-count");
          if (response.ok) {
            const data = await response.json();
            if (data.count > 0) {
              setToast({
                message: `Attention: There are ${data.count} pending request(s) awaiting your approval.`,
                type: "error" // Use error type for attention-grabbing red
              });
            }
          }
        } catch (error) {
          console.error("Error fetching pending count:", error);
        }
      };
      fetchPendingCount();
    }
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
