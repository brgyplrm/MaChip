import "./notifications.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { notificationColumns } from "../../utils/notificationSource";
import { useState, useEffect } from "react";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

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
        <div className="wrapper">
          <div className="notifHeader">
            <div className="title">
              <h1>System Notifications</h1>
            </div>
            <button className="markAllBtn" onClick={handleMarkAllRead}>
              <DoneAllIcon className="btnIcon" /> Mark all as read
            </button>
          </div>

          <div className="notifCard">
            <div className="notifList">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div 
                    key={notif.notifId} 
                    className={`notifItem ${notif.isRead ? 'read' : 'unread'}`}
                    onClick={() => !notif.isRead && handleMarkAsRead(notif.notifId)}
                  >
                    <div className="statusIndicator">
                      {!notif.isRead && <FiberManualRecordIcon className="dot" />}
                    </div>
                    <div className="content">
                      <p className="message">{notif.message}</p>
                      <span className="timestamp">
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="noNotifs">No notifications found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;