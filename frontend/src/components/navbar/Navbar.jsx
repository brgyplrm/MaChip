import "./navbar.scss";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NavigateNextIcon from '@mui/icons-material/NavigateNext'; 
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import { Link, useLocation, useNavigate } from "react-router-dom"; 
import { useState, useEffect } from "react";
import Breadcrumbs from "../../components/breadcrumbs/Breadcrumbs";
import { fetchWithAuth } from "../../utils/api";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";


const Navbar = () => {
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewMode, setViewMode] = useState(localStorage.getItem("viewMode") || "management");
  const navigate = useNavigate();

  const isManagement = userData?.user_RoleId === 1 || userData?.user_RoleId === 2;

  const toggleViewMode = () => {
    const newMode = viewMode === "management" ? "employee" : "management";
    localStorage.setItem("viewMode", newMode);
    setViewMode(newMode);
    
    // Redirect based on the new mode
    if (newMode === "employee") {
      navigate("/employeeHome");
    } else {
      navigate("/");
    }
    // Force a re-render of components listening to this
    window.dispatchEvent(new Event("storage"));
  };
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
      const currentViewMode = localStorage.getItem("viewMode") || "management";
      const response = await fetchWithAuth(`/api/notifications/unread-count/${userData.user_Id}?viewMode=${currentViewMode}`);
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

    // Listen for storage changes (updates from other tabs/pages/toggles)
    const handleStorageChange = () => {
      const updatedUserData = JSON.parse(localStorage.getItem("userData"));
      setUserData(updatedUserData);
      const updatedViewMode = localStorage.getItem("viewMode") || "management";
      setViewMode(updatedViewMode);
      
      // Force refresh of unread count when mode/user changes
      fetchUnreadCount();
    };

    const handleRefresh = () => {
      fetchUnreadCount();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userUpdate", handleStorageChange);
    window.addEventListener("notificationRefresh", handleRefresh);
    window.addEventListener("dataRefresh", handleRefresh);

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userUpdate", handleStorageChange);
      window.removeEventListener("notificationRefresh", handleRefresh);
      window.removeEventListener("dataRefresh", handleRefresh);
    };
  }, [userData?.user_Id]);

  return (
  <div className="navbar">
      <div className="wrapper">
        <Breadcrumbs />
        <div className="items">
          {/* 1. Notifications */}
          <Link to="/notifications" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="item">
              <NotificationsNoneOutlinedIcon className="icon" />
              {unreadCount > 0 && <div className="counter">{unreadCount}</div>}
            </div>
          </Link>

          {/* 2. Profile Dropdown Wrapper */}
          <div className="item profileWrapper">
            <img 
              src={userData?.user_ProfilePic ? `/api/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
              alt="Profile" 
              className="avatar" 
            />
            
            {/* The Dropdown Menu */}
            <div className="dropdownMenu">
              <Link to="/profile" className="dropdownItem">
                <AccountCircleOutlinedIcon className="icon" />
                <span>Profile</span>
              </Link>
              
              {isManagement && (
                <div className="dropdownItem" onClick={toggleViewMode}>
                  <SwitchAccountIcon className="icon" />
                  <span>
                    {viewMode === "management" 
                      ? "Switch to Employee" 
                      : (userData?.user_RoleId === 1 ? "Return to Admin" : "Return to Supervisor")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;