import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import StoreIcon from "@mui/icons-material/Store";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HistoryIcon from '@mui/icons-material/History';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';

// Using relative paths to ensure resolution in the current build environment
import Breadcrumbs from "./Breadcrumbs";
import { fetchWithAuth } from "../utils/api";

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  
  // Dropdown states
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isPayrollOpen, setIsPayrollOpen] = useState(false);
  
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewMode, setViewMode] = useState(localStorage.getItem("viewMode") || "management");
  
  const navigate = useNavigate();
  const location = useLocation();

  const isManagement = (userData?.user_RoleId === 1 || userData?.user_RoleId === 2) && viewMode === "management";
  const isAdmin = userData?.user_RoleId === 1 && viewMode === "management";
  const homePath = isManagement ? "/" : "/employeeHome";
  const isActive = (path) => location.pathname === path;

  // --- Auth & User Logic ---
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    localStorage.removeItem("viewMode");
    navigate("/login");
  };

  const toggleViewMode = () => {
    const newMode = viewMode === "management" ? "employee" : "management";
    localStorage.setItem("viewMode", newMode);
    setViewMode(newMode);
    navigate(newMode === "employee" ? "/employeeHome" : "/");
    window.dispatchEvent(new Event("storage"));
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
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userData?.user_Id, viewMode]);

  return (
    <>
      {/* 1. TOP NAVBAR */}
      <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200">
        <div className="px-3 py-3 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start">
              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <span className="sr-only">Open sidebar</span>
                <svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"></path>
                </svg>
              </button>
              
              <Link to={homePath} className="flex ms-2 md:me-24 no-underline items-center">
                <span className="self-center text-xl font-black sm:text-2xl whitespace-nowrap text-[#2A174E] tracking-tight">
                   <img 
                  src="/logo2.png" 
                  alt="MAC-J Logo" 
                  className="w-[100px] max-[480px]:w-[150px] object-contain"/>
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications Icon (Unified from Navbar) */}
              <Link to="/notifications" className="relative p-2 text-gray-500 hover:text-[#2A174E] transition-colors group">
                <NotificationsNoneIcon className="!text-[26px] group-hover:animate-bell-shake" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex text-sm bg-gray-800 rounded-full focus:ring-4 focus:ring-gray-300 transition-transform active:scale-95"
                >
                  <img 
                    className="w-8 h-8 rounded-full object-cover" 
                    src={userData?.user_ProfilePic ? `/api/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
                    alt="user" 
                  />
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userData?.user_FirstName} {userData?.user_LastName}</p>
                      <p className="text-xs text-gray-500 truncate font-medium">{userData?.user_Email}</p>
                    </div>
                    <ul className="py-1 text-sm text-gray-700 list-none m-0 p-0">
                      <li>
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-2 hover:bg-[#f0ebfa] hover:text-[#2A174E] no-underline">
                          <AccountCircleOutlinedIcon className="!text-[18px]" /> Profile
                        </Link>
                      </li>
                      {(userData?.user_RoleId === 1 || userData?.user_RoleId === 2) && (
                        <li>
                          <button onClick={toggleViewMode} className="flex items-center w-full gap-3 px-4 py-2 text-left hover:bg-[#f0ebfa] hover:text-[#2A174E]">
                            <SwitchAccountIcon className="!text-[18px]" /> {viewMode === "management" ? "Switch to Employee View" : "Switch to Management View"}
                          </button>
                        </li>
                      )}
                      <li>
                        <button onClick={handleLogout} className="flex items-center w-full gap-3 px-4 py-2 text-left text-red-600 hover:bg-red-50">
                          <ExitToAppIcon className="!text-[18px]" /> Sign out
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. SIDEBAR ASIDE */}
      <aside 
        className={`fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform bg-white border-r border-gray-200 sm:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full px-3 pb-4 overflow-y-auto no-scrollbar">
          <ul className="space-y-1 font-medium list-none p-0 m-0">
            {/* Dashboard */}
            <li>
              <Link 
                to={homePath} 
                className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                  isActive(homePath) ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                }`}
              >
                <DashboardIcon className={`!text-[22px] ${isActive(homePath) ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                <span className="ms-3 text-[14px] pl-2">Dashboard</span>
              </Link>
            </li>

            {/* Calendar */}
            <li>
              <Link 
                to={isManagement ? "/calendar" : "/employeeCalendar"} 
                className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                  isActive("/calendar") || isActive("/employeeCalendar") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                }`}
              >
                <EditCalendarIcon className={`!text-[22px] ${isActive("/calendar") || isActive("/employeeCalendar") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                <span className="ms-3 text-[14px] pl-2">Calendar</span>
              </Link>
            </li>

            {/* Users (Dropdown) - Management Only */}
            {isManagement && (
              <li>
                <button 
                  onClick={() => setIsUsersOpen(!isUsersOpen)}
                  className="flex items-center w-full p-2.5 text-gray-500 rounded-xl group hover:bg-gray-50 transition-all"
                >
                  <PersonOutlineIcon className="!text-[22px] text-gray-400 group-hover:text-[#2A174E]" />
                  <span className="flex-1 ms-3 text-left text-[14px] pl-2">Users</span>
                  <KeyboardArrowDownIcon className={`!text-[18px] transition-transform duration-300 ${isUsersOpen ? "rotate-180" : ""}`} />
                </button>
                <ul className={`list-none p-0 mt-1 space-y-1 overflow-hidden transition-all duration-300 ${isUsersOpen ? "max-h-40" : "max-h-0"}`}>
                  <SidebarLink to="/users/newUser" label="Add New User" active={isActive("/users/newUser")} />
                  <SidebarLink to="/users/archived" label="View Archived" active={isActive("/users/archived")} />
                </ul>
              </li>
            )}

            {/* Access Logs */}
            <li>
              <Link 
                to={isManagement ? "/logs" : "/accessLogs"} 
                className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                  isActive("/logs") || isActive("/accessLogs") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                }`}
              >
                <HistoryIcon className={`!text-[22px] ${isActive("/logs") || isActive("/accessLogs") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                <span className="ms-3 text-[14px] pl-2">Access Logs</span>
              </Link>
            </li>

            {/* Requests (Dropdown) */}
            <li>
              <button 
                onClick={() => setIsRequestsOpen(!isRequestsOpen)}
                className="flex items-center w-full p-2.5 text-gray-500 rounded-xl group hover:bg-gray-50 transition-all"
              >
                <DescriptionIcon className="!text-[22px] text-gray-400 group-hover:text-[#2A174E]" />
                <span className="flex-1 ms-3 text-left text-[14px] pl-2">Requests</span>
                <KeyboardArrowDownIcon className={`!text-[18px] transition-transform duration-300 ${isRequestsOpen ? "rotate-180" : ""}`} />
              </button>
              <ul className={`list-none p-0 mt-1 space-y-1 overflow-hidden transition-all duration-300 ${isRequestsOpen ? "max-h-40" : "max-h-0"}`}>
                <SidebarLink 
                  to={isManagement ? "/adminRequests" : "/requests"} 
                  label="History" 
                  active={isActive("/adminRequests") || isActive("/requests")} 
                />
              </ul>
            </li>

            {/* Payroll (Dropdown) - Admin Only */}
            {isAdmin && (
              <li>
                <button 
                  onClick={() => setIsPayrollOpen(!isPayrollOpen)}
                  className="flex items-center w-full p-2.5 text-gray-500 rounded-xl group hover:bg-gray-50 transition-all"
                >
                  <CreditCardIcon className="!text-[22px] text-gray-400 group-hover:text-[#2A174E]" />
                  <span className="flex-1 ms-3 text-left text-[14px] pl-2">Payroll</span>
                  <KeyboardArrowDownIcon className={`!text-[18px] transition-transform duration-300 ${isPayrollOpen ? "rotate-180" : ""}`} />
                </button>
                <ul className={`list-none p-0 mt-1 space-y-1 overflow-hidden transition-all duration-300 ${isPayrollOpen ? "max-h-40" : "max-h-0"}`}>
                  <SidebarLink to="/payroll/employeeList" label="Employee List" active={isActive("/payroll/employeeList")} />
                  <SidebarLink to="/payroll/payrollPeriod" label="Payroll Details" active={isActive("/payroll/payrollPeriod")} />
                </ul>
              </li>
            )}

            {/* Reports - Admin Only */}
            {isAdmin && (
              <li>
                <Link 
                  to="/adminReports" 
                  className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                    isActive("/adminReports") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                  }`}
                >
                  <AssessmentIcon className={`!text-[22px] ${isActive("/adminReports") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                  <span className="ms-3 text-[14px] pl-2">Reports</span>
                </Link>
              </li>
            )}

            {/* Audit - Admin Only */}
            {isAdmin && (
              <li>
                <Link 
                  to="/auditLogs" 
                  className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                    isActive("/auditLogs") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                  }`}
                >
                  <ListAltIcon className={`!text-[22px] ${isActive("/auditLogs") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                  <span className="ms-3 text-[14px] pl-2">Audit</span>
                </Link>
              </li>
            )}

            {/* Transaction - Management Only */}
            {isManagement && (
              <li>
                <Link 
                  to="/transactionLog" 
                  className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                    isActive("/transactionLog") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                  }`}
                >
                  <ReceiptLongIcon className={`!text-[22px] ${isActive("/transactionLog") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                  <span className="ms-3 text-[14px] pl-2">Transaction</span>
                </Link>
              </li>
            )}

            {/* Settings - Management Only */}
            {isManagement && (
              <li>
                <Link 
                  to="/settings" 
                  className={`flex items-center p-2.5 rounded-xl group transition-all no-underline ${
                    isActive("/settings") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#2A174E]"
                  }`}
                >
                  <SettingsIcon className={`!text-[22px] ${isActive("/settings") ? "text-[#2A174E]" : "text-gray-400 group-hover:text-[#2A174E]"}`} />
                  <span className="ms-3 text-[14px] pl-2">Settings</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </aside>
    </>
  );
};

// Helper Sub-Link
const SidebarLink = ({ to, label, active }) => (
  <li>
    <Link 
      to={to} 
      className={`flex items-center p-2 ps-11 rounded-xl group text-[13px] no-underline transition-colors ${
        active ? "text-[#2A174E] font-bold" : "text-gray-500 hover:text-[#2A174E] hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  </li>
);

export default Sidebar;