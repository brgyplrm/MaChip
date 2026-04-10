import "./navbar.scss";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NavigateNextIcon from '@mui/icons-material/NavigateNext'; // New Icon
import { Link, useLocation } from "react-router-dom"; // Added useLocation
import { useState, useEffect } from "react";
import Breadcrumbs from "../../components/breadcrumbs/Breadcrumbs";
import { fetchWithAuth } from "../../utils/api";


const Navbar = () => {
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [unreadCount, setUnreadCount] = useState(0);
  let currentLink = "";

  // 1. Fetch latest user details from server on mount
  // This ensures the profile pic in the navbar syncs immediately after a change
  const fetchUserLatest = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/users/${userData.user_Id}`);
      if (response.ok) {
        const data = await response.json();
        const { user_Password, ...safeData } = data;
        setUserData(safeData);
        localStorage.setItem("userData", JSON.stringify(safeData));
      }
    } catch (err) {
      console.error("Error syncing navbar profile:", err);
    }
  };

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
    fetchUserLatest();
    fetchUnreadCount();

    // Listen for storage changes (updates from other tabs/pages)
    const handleStorageChange = () => {
      setUserData(JSON.parse(localStorage.getItem("userData")));
    };
    window.addEventListener("storage", handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener("userUpdate", handleStorageChange);

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userUpdate", handleStorageChange);
    };
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
                src={userData?.user_ProfilePic ? `/api/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
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