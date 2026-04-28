import "./notifications.scss";
import Sidebar from "../../components/Sidebar";
import { DataGrid } from "@mui/x-data-grid";
import { notificationColumns } from "../../utils/notificationSource";
import { useState, useEffect } from "react";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

const Notifications = () => {
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [viewMode, setViewMode] = useState(localStorage.getItem("viewMode") || "management");
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/notifications/${userData.user_Id}?viewMode=${viewMode}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map(n => ({ ...n, id: n.notifId }));
        setNotifications(formattedData);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleStorageChange = () => {
      const updatedUserData = JSON.parse(localStorage.getItem("userData"));
      const updatedViewMode = localStorage.getItem("viewMode") || "management";
      setUserData(updatedUserData);
      setViewMode(updatedViewMode);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("notificationRefresh", fetchNotifications);
    window.addEventListener("dataRefresh", fetchNotifications);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("notificationRefresh", fetchNotifications);
      window.removeEventListener("dataRefresh", fetchNotifications);
    };
  }, [userData?.user_Id, viewMode]);

  const handleMarkAllRead = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth("/api/notifications/mark-all-read", {
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
      const response = await fetchWithAuth(`/api/notifications/mark-read/${notifId}`, {
        method: "PUT",
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleNotifClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.notifId);
    }

    if (notif.title === "Password Reset Request" && notif.targetId) {
      navigate(`/users/edit/${notif.targetId}`);
    } else if (notif.title === "New Request for Review") {
      navigate("/adminRequests");
    } else if (notif.targetId) {
      // General redirection for personal request status updates
      navigate(`/requests/${notif.targetId}`);
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
                    onClick={() => handleNotifClick(notif)}
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