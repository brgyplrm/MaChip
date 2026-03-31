import "./notifications.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { notificationColumns } from "../../utils/notificationSource";
import { useState, useEffect } from "react";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const userData = JSON.parse(localStorage.getItem("userData"));

  const fetchNotifications = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetch(`/api/notifications/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        // Add id field for DataGrid if not present (DataGrid needs 'id' or a unique key)
        const formattedData = data.map(n => ({ ...n, id: n.notifId }));
        setNotifications(formattedData);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userData?.user_Id]);

  const handleMarkAllRead = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userData.user_Id }),
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      const response = await fetch(`/api/notifications/mark-read/${notifId}`, {
        method: "PUT",
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  return (
    <div className="notifications">
      <Sidebar />
      <div className="notificationsContainer">
        <Navbar />
        <div className="listContainer">
          <div className="datatableTitle">
            System Notifications
            <button className="markReadBtn" onClick={handleMarkAllRead}>Mark all as read</button>
          </div>
          <DataGrid
            className="datagrid"
            rows={notifications}
            columns={notificationColumns}
            pageSize={10}
            rowsPerPageOptions={[10]}
            checkboxSelection
            onRowClick={(params) => handleMarkAsRead(params.row.notifId)}
            getRowHeight={() => "auto"}
          />
        </div>
      </div>
    </div>
  );
};

export default Notifications;