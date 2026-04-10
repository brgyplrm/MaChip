import "./navbar.scss";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NavigateNextIcon from '@mui/icons-material/NavigateNext'; // New Icon
import { Link, useLocation } from "react-router-dom"; // Added useLocation
import { useState, useEffect } from "react";
import Breadcrumbs from "../../components/breadcrumbs/Breadcrumbs";
import { fetchWithAuth } from "../../utils/api";


const Navbar = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [unreadCount, setUnreadCount] = useState(0);
  let currentLink = "";

  const fetchUnreadCount = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/notifications/unread-count/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userData?.user_Id]);

  return (
    <div className="navbar">
      <div className="wrapper">
        {/* REPLACED SEARCH WITH BREADCRUMBS */}
        <Breadcrumbs />

        <div className="items">
          <Link to="/notifications">
            <div className="item">
              <NotificationsNoneOutlinedIcon className="icon" />
              {unreadCount > 0 && <div className="counter">{unreadCount}</div>}
            </div>
          </Link>
          <Link to="/profile">
            <div className="item">
              <img 
                src={userData?.user_ProfilePic ? `http://localhost:4000/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
                alt="Profile" 
                className="avatar" 
              />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;