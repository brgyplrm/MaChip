import "./notifications.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { notificationColumns } from "../../notificationSource";
import { useState, useEffect } from "react";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/notifications/all");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <div className="notifications">
      <Sidebar />
      <div className="notificationsContainer">
        <Navbar />
        <div className="listContainer">
          <div className="datatableTitle">
            System Notifications
            <button className="markReadBtn">Mark all as read</button>
          </div>
          <DataGrid
            className="datagrid"
            rows={notifications}
            columns={notificationColumns}
            pageSize={10}
            rowsPerPageOptions={[10]}
            checkboxSelection
            getRowHeight={() => "auto"}
          />
        </div>
      </div>
    </div>
  );
};

export default Notifications;