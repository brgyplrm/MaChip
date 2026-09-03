import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

// Using relative paths to ensure compatibility with the build environment
import Breadcrumbs from "../Breadcrumbs";
import { fetchWithAuth } from "../../utils/api";

const Navbar = () => {
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [unreadCount, setUnreadCount] = useState(0);
  
  const isManagement = userData?.user_RoleId === 1 || userData?.user_RoleId === 2 || userData?.user_RoleId === 4;
  
  // Default to "employee" if user is not management, otherwise use stored mode or "management"
  const getInitialViewMode = () => {
    if (!isManagement) return "employee";
    return localStorage.getItem("viewMode") || "management";
  };
  
  const [viewMode, setViewMode] = useState(getInitialViewMode());
  const navigate = useNavigate();

  const toggleViewMode = () => {
    if (!isManagement) return; // Non-management cannot toggle
    const newMode = viewMode === "management" ? "employee" : "management";
    localStorage.setItem("viewMode", newMode);
    setViewMode(newMode);
    
    if (newMode === "employee") {
      navigate("/employeeHome");
    } else {
      navigate("/");
    }
    window.dispatchEvent(new Event("storage"));
  };

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
      // Logic: If user is an employee, always fetch employee-mode notifications.
      // If user is management, respect the current toggle.
      const currentViewMode = isManagement ? (localStorage.getItem("viewMode") || "management") : "employee";
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

    const handleStorageChange = () => {
      const updatedUserData = JSON.parse(localStorage.getItem("userData"));
      setUserData(updatedUserData);
      const updatedViewMode = localStorage.getItem("viewMode") || "management";
      setViewMode(updatedViewMode);
      fetchUnreadCount();
    };

    const handleRefresh = () => fetchUnreadCount();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userUpdate", handleStorageChange);
    window.addEventListener("notificationRefresh", handleRefresh);
    window.addEventListener("dataRefresh", handleRefresh);

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
    <div className="h-[70px] border-b border-[#e7e4e4] flex items-center text-sm text-[#555] bg-white sticky top-0 z-[50]">
      <div className="w-full h-full px-5 flex items-center justify-between">
        
        {/* Left Side: Breadcrumbs - pl only on mobile (<768px) */}
        <div className="flex items-center text-sm max-md:text-xs max-md:pl-[60px]">
          <Breadcrumbs />
        </div>

        {/* Right Side: Items perfectly aligned */}
        <div className="flex items-center gap-4 h-full">
          
          {/* 1. Notifications - "group" handles the hover trigger */}
          <Link to="/notifications" className="no-underline text-inherit group flex items-center h-full">
            <div className="relative cursor-pointer transition-all duration-200 flex items-center">
              {/* "group-hover:animate-bell-shake" triggers the animation defined in config */}
              <NotificationsNoneOutlinedIcon 
                className="!text-[28px] text-[#555] transition-all duration-200 group-hover:scale-110 group-hover:text-[#2A174E] group-hover:animate-bell-shake" 
              />
              {unreadCount > 0 && (
                <div className="min-w-[16px] h-4 bg-red-600 rounded-full text-white flex items-center justify-center text-[10px] font-bold absolute -top-1 -right-1 px-1">
                  {unreadCount}
                </div>
              )}
            </div>
          </Link>

          {/* 2. Profile Dropdown */}
          <div className="relative group flex items-center h-full cursor-pointer">
            <img 
              src={userData?.user_ProfilePic ? `/api/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover shrink-0 block transition-transform duration-200 group-hover:scale-105 border-2 border-transparent group-hover:border-[#2A174E]" 
            />
            
            {/* Dropdown Menu alignment fixed to trigger correctly */}
            <div className="absolute top-[80%] right-0 bg-white rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.12)] min-w-[200px] flex flex-col overflow-hidden z-[100]
              invisible opacity-0 translate-y-2 transition-all duration-200 ease-in-out pointer-events-none 
              group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
              
              <Link to="/profile" className="flex items-center gap-3 px-5 py-3.5 no-underline text-[#4a5568] border-b border-[#f1f3f5] transition-colors hover:bg-[#f0ebfa] hover:text-[#2A174E] group/item">
                <AccountCircleOutlinedIcon className="!text-[20px] text-[#2A174E] transition-transform duration-200 group-hover/item:scale-110" />
                <span className="text-sm font-semibold">Profile</span>
              </Link>
              
              {isManagement && (
                <div 
                  className="flex items-center gap-3 px-5 py-3.5 no-underline text-[#4a5568] transition-colors hover:bg-[#f0ebfa] hover:text-[#2A174E] group/item" 
                  onClick={toggleViewMode}
                >
                  <SwitchAccountIcon className="!text-[20px] text-[#2A174E] transition-transform duration-200 group-hover/item:scale-110" />
                  <span className="text-sm font-semibold">
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