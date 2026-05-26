import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import HistoryIcon from '@mui/icons-material/History';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import { useSystemTime } from "../context/SystemTimeContext";
import { Badge } from "./ui/badge";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarProvider,
  SidebarFooter,
  SidebarGroupLabel
} from "./ui/sidebar";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";

import { fetchWithAuth } from "../utils/api";

const Sidebar = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Dropdown states for submenus - initialized based on the current URL
  const [isUsersOpen, setIsUsersOpen] = useState(() => location.pathname.startsWith("/users"));
  const [isRequestsOpen, setIsRequestsOpen] = useState(() => 
    location.pathname.startsWith("/requests") || location.pathname.startsWith("/adminRequests")
  );
  const [isPayrollOpen, setIsPayrollOpen] = useState(() => 
    location.pathname.startsWith("/payroll") || 
    location.pathname.startsWith("/maxicare") || 
    location.pathname.startsWith("/eastwestloan") || 
    location.pathname.startsWith("/govloans") || 
    location.pathname.startsWith("/cashadvances") ||
    location.pathname.startsWith("/laborBenefits") 
  );
  
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));

  // Refresh user data if updated elsewhere (e.g. Profile Edit)
  useEffect(() => {
    const refreshUserData = () => {
      setUserData(JSON.parse(localStorage.getItem("userData")));
    };
    window.addEventListener("userUpdate", refreshUserData);
    return () => window.removeEventListener("userUpdate", refreshUserData);
  }, []);

  const { isMockTime } = useSystemTime();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [viewMode, setViewMode] = useState(localStorage.getItem("viewMode") || "management");
  
  // New Role Check Logic
  // Admin = 1, Supervisor = 2, Employee = 3, Accountant = 4
  const roleId = userData?.user_RoleId;
  const isManagement = (roleId === 1 || roleId === 4) && viewMode === "management";
  const isSupervisor = (roleId === 2) && viewMode === "management";
  const isAdmin = (roleId === 1) && viewMode === "management";
  const isMaster = (roleId === 1 || roleId === 4) && viewMode === "management";
  const isAccountant = roleId === 4;

  const homePath = isManagement || isSupervisor ? "/" : "/employeeHome";
  const isActive = (path) => location.pathname === path;

  // Hybrid State for Profile Dropdown (Hover + Lock-on-click)
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const profileDropdownRef = useRef(null);

  // Hybrid State for Notifications Dropdown (Hover + Lock-on-click)
  const [isNotifHovered, setIsNotifHovered] = useState(false);
  const [isNotifLocked, setIsNotifLocked] = useState(false);
  const notifDropdownRef = useRef(null);

  // Auto-expand the correct menu if the route changes dynamically
  useEffect(() => {
    if (location.pathname.startsWith("/users")) setIsUsersOpen(true);
    if (location.pathname.startsWith("/requests") || location.pathname.startsWith("/adminRequests")) setIsRequestsOpen(true);
    if (
      location.pathname.startsWith("/payroll") || 
      location.pathname.startsWith("/maxicare") || 
      location.pathname.startsWith("/eastwestloan") || 
      location.pathname.startsWith("/govloans") || 
      location.pathname.startsWith("/cashadvances")
    ) {
      setIsPayrollOpen(true);
    }
  }, [location.pathname]);

  // Click-outside listener to unlock the dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check Profile Dropdown
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileLocked(false);
      }
      // Check Notifications Dropdown
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsNotifLocked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const fetchLatestNotifications = async () => {
    if (!userData?.user_Id) return;
    try {
      const currentViewMode = localStorage.getItem("viewMode") || "management";
      const response = await fetchWithAuth(`/api/notifications/${userData.user_Id}?viewMode=${currentViewMode}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.slice(0, 5));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchLatestNotifications();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchLatestNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [userData?.user_Id, viewMode]);

  // Generate Breadcrumbs based on location
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Dropdown visibility logic
  const showProfileMenu = isProfileHovered || isProfileLocked;
  const showNotifMenu = isNotifHovered || isNotifLocked;

  return (
    <SidebarProvider>
      <ShadcnSidebar className="bg-white border-r border-gray-200">
        <SidebarHeader className="p-4 border-b border-gray-100 relative">
          <Link to={homePath} className="flex no-underline items-center pl-5 md:pl-8">
            <img 
              src="/logo2.png" 
              alt="MAC-J Logo" 
              className="w-[150px] md:w-[150px] object-contain"
            />
          </Link>
          {isMockTime && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 h-4 border-none shadow-sm animate-pulse">
                MOCK
              </Badge>
            </div>
          )}
        </SidebarHeader>
        <div className="h-1" />
        <SidebarContent className="no-scrollbar px-3 flex flex-col">
          <SidebarGroup><SidebarGroupLabel>MAIN</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(homePath)}
                    className={isActive(homePath) ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                  >
                    <Link to={homePath}>
                      <DashboardOutlinedIcon 
                          className="!text-[22px]" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px]">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Calendar */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/calendar") || isActive("/employeeCalendar")}
                    className={isActive("/calendar") || isActive("/employeeCalendar") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                  >
                    <Link to={isManagement || isSupervisor ? "/calendar" : "/employeeCalendar"}>
                      <EditCalendarIcon className="!text-[22px]" />
                      <span className="ms-3 text-[14px]">Calendar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Users (Dropdown) - Management Only */}
                {isManagement && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setIsUsersOpen(!isUsersOpen)}
                      className={isActive("/users") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                    >
                      <PersonOutlineIcon className="!text-[22px]" />
                      <span className="flex-1 ms-3 text-left text-[14px]">
                        Users
                      </span>
                      <KeyboardArrowDownIcon className={`!text-[18px] transition-transform duration-300 ${isUsersOpen ? "rotate-180" : ""}`} />
                    </SidebarMenuButton>
                    {isUsersOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/users")}>
                            <Link to="/users" className={isActive("/users") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              View All Users
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {isManagement && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={isActive("/users/newUser")}>
                                <Link to="/users/newUser" className={isActive("/users/newUser") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                                  Add New User
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={isActive("/users/archived")}>
                                <Link to="/users/archived" className={isActive("/users/archived") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                                  View Archived
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}
                {isSupervisor && (
                  <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/users")}
                    className={isActive("/users") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                  >
                    <Link to="/users" className={isActive("/users") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                      <PersonOutlineIcon 
                          className="!text-[22px]" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px]">Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}

                {/* Access Logs */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/logs") || isActive("/accessLogs")}
                    className={isActive("/logs") || isActive("/accessLogs") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                  >
                    <Link to={isManagement || isSupervisor ? "/logs" : "/accessLogs"}>
                      <HistoryIcon className="!text-[22px]" />
                      <span className="ms-3 text-[14px]">Access Logs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Requests Link */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/requests") || isActive("/adminRequests") || isActive("/adminoversight")}
                    className={(isActive("/requests") || isActive("/adminRequests") || isActive("/adminoversight")) ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                  >
                    <Link 
                      to={
                        viewMode === "employee" 
                          ? "/requests" 
                          : (isAccountant ? "/adminoversight" : (isAdmin || isSupervisor ? "/adminRequests" : "/requests"))
                      } 
                      className={(isActive("/requests") || isActive("/adminRequests") || isActive("/adminoversight")) ? "text-[#2A174E] font-bold" : "text-gray-500"}
                    >
                      <DescriptionIcon 
                          className="!text-[22px]" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px]">Requests</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Payroll (Dropdown) - Admin Only */}
                {isManagement && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setIsPayrollOpen(!isPayrollOpen)}
                      className="text-gray-500"
                    >
                      <CreditCardIcon className="!text-[22px]" />
                      <span className="flex-1 ms-3 text-left text-[14px]">Payroll</span>
                      <KeyboardArrowDownIcon className={`!text-[18px] transition-transform duration-300 ${isPayrollOpen ? "rotate-180" : ""}`} />
                    </SidebarMenuButton>
                    {isPayrollOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/payroll")}>
                            <Link to="/payroll" className={isActive("/payroll") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Payroll Management
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/payroll/employeeList")}>
                            <Link to="/payroll/employeeList" className={isActive("/payroll/employeeList") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Employee List
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/laborBenefits")}>
                            <Link to="/laborBenefits" className={isActive("/laborBenefits") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Labor Benefits
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem> 
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/payroll/leave-summary")}>
                            <Link to="/payroll/leave-summary" className={isActive("/payroll/leave-summary") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Leave Summary
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/maxicare")}>
                            <Link to="/maxicare" className={isActive("/maxicare") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Maxicare
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/loanMan2")}>
                            <Link to="/loanMan2" className={isActive("/loanMan2") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Loan Man 2
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/loanManagementHub")}>
                            <Link to="/loanManagementHub" className={isActive("/loanManagementHub") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Loan Man Hub
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/loanManagement")}>
                            <Link to="/loanManagement" className={isActive("/loanManagement") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Loan Management
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/eastwestloan")}>
                            <Link to="/eastwestloan" className={isActive("/eastwestloan") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Eastwest Loan
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/govloans")}>
                            <Link to="/govloans" className={isActive("/govloans") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Government Loans
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/cashadvances")}>
                            <Link to="/cashadvances" className={isActive("/cashadvances") ? "text-[#2A174E] font-bold" : "text-gray-500"}>
                              Cash Advances
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}

                {/* Reports - Admin Only */}
                {isManagement && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive("/adminReports")}
                      className={isActive("/adminReports") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}
                    >
                      <Link to="/adminReports">
                        <AssessmentIcon className="!text-[22px]" />
                        <span className="ms-3 text-[14px]">Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

               
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
          {/* --- BOTTOM SECTION (ANCHORED) --- */}
        <SidebarFooter className="border-t border-gray-100 p-3 mt-auto">
          <SidebarGroupLabel>SYSTEM</SidebarGroupLabel>
          <SidebarMenu>
            {isMaster && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/auditLogs")} className={isActive("/auditLogs") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}>
                  <Link to="/auditLogs">
                    <ListAltIcon className="!text-[22px]" />
                    <span className="ms-3 text-[14px]">Audit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {isMaster && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/transactionLog")} className={isActive("/transactionLog") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}>
                  <Link to="/transactionLog">
                    <ReceiptLongIcon className="!text-[22px]" />
                    <span className="ms-3 text-[14px]">Transaction</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {isManagement && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")} className={isActive("/settings") ? "bg-[#f0ebfa] text-[#2A174E] font-bold" : "text-gray-500"}>
                  <Link to="/settings">
                    <SettingsIcon className="!text-[22px]" />
                    <span className="ms-3 text-[14px]">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-gray-500 hover:bg-[#f0ebfa] hover:text-[#2A174E]">
                <Link to="/faq" className="flex items-center">
                  <HelpOutlinedIcon className="!text-[20px]" />
                  <span className="ms-3 text-[14px]">Help & Support</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>

      {children && (
        <SidebarInset className="flex-1 min-w-0">
          <header className="flex h-16 items-center justify-between gap-2 border-b border-gray-100 bg-white transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sticky top-0 z-50 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-10" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link to={homePath}>Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {pathnames.map((name, index) => {
                    const routeTo = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;
                    return (
                      <React.Fragment key={name}>
                        <BreadcrumbSeparator className="hidden md:block" />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage className="capitalize">{name.replace(/-/g, " ")}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild className="capitalize">
                              <Link to={routeTo}>{name.replace(/-/g, " ")}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div 
                className="relative"
                ref={notifDropdownRef}
                onMouseEnter={() => setIsNotifHovered(true)}
                onMouseLeave={() => setIsNotifHovered(false)}
              >
                <button 
                  onClick={() => setIsNotifLocked(!isNotifLocked)}
                  className="relative p-2 text-gray-500 hover:text-[#2A174E] transition-colors block focus:outline-none"
                >
                  <NotificationsNoneIcon className="!text-[26px] hover:animate-bell-shake" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Preview Popup */}
                {showNotifMenu && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <span className="text-sm font-bold text-[#2A174E]">Recent Notifications</span>
                      <Link 
                        to="/notifications" 
                        onClick={() => { setIsNotifLocked(false); setIsNotifHovered(false); }}
                        className="text-[11px] text-[#2A174E]/60 hover:underline font-semibold"
                      >
                        View All
                      </Link>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div 
                            key={notif.notifId} 
                            className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-[#f0ebfa]/30' : ''}`}
                            onClick={() => {
                              setIsNotifLocked(false); 
                              setIsNotifHovered(false);
                              if (notif.title === "Password Reset Request" && notif.targetId) {
                                navigate(`/users/edit/${notif.targetId}`);
                              } else if (notif.title === "New Request for Review") {
                                navigate("/adminRequests");
                              } else if (notif.targetId) {
                                navigate(`/requests/${notif.targetId}`);
                              }
                            }}
                          >
                            <div className="flex gap-3">
                              {!notif.isRead && (
                                <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-[#2A174E]" />
                              )}
                              <div className="flex-1">
                                <p className="text-[12px] text-gray-800 leading-snug line-clamp-2 font-medium">{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <NotificationsNoneIcon className="text-gray-200 !text-[40px] mb-2" />
                          <p className="text-xs text-gray-400">No new notifications</p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <Link 
                        to="/notifications" 
                        onClick={() => { setIsNotifLocked(false); setIsNotifHovered(false); }}
                        className="block py-2.5 text-center text-[11px] font-bold text-[#2A174E] hover:bg-gray-50 border-t border-gray-100"
                      >
                        SEE ALL NOTIFICATIONS
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile Dropdown */}
              <div 
                className="relative" 
                ref={profileDropdownRef}
                onMouseEnter={() => setIsProfileHovered(true)}
                onMouseLeave={() => setIsProfileHovered(false)}
              >
                <button 
                  onClick={() => setIsProfileLocked(!isProfileLocked)}
                  className="flex text-sm bg-gray-800 rounded-full focus:ring-2 focus:ring-gray-300 transition-transform active:scale-95"
                >
                  <img 
                    className="w-8 h-8 rounded-full object-cover" 
                    src={userData?.user_ProfilePic ? `/api/uploads/${userData.user_ProfilePic}` : "/avatar.webp"} 
                    alt="user" 
                  />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userData?.user_FirstName} {userData?.user_LastName}</p>
                      <p className="text-xs text-gray-500 truncate font-medium">{userData?.user_Email}</p>
                    </div>
                    <ul className="py-1 text-sm text-gray-700 list-none m-0 p-0">
                      <li>
                        <Link 
                          to="/profile" 
                          className="flex items-center gap-3 px-4 py-2 hover:bg-[#f0ebfa] hover:text-[#2A174E] no-underline"
                          onClick={() => { setIsProfileLocked(false); setIsProfileHovered(false); }}
                        >
                          <AccountCircleOutlinedIcon className="!text-[18px]" /> Profile
                        </Link>
                      </li>
                      {(Number(roleId) === 1 || Number(roleId) === 2 || Number(roleId) === 4) && (
                        <li>
                          <button 
                            onClick={() => { toggleViewMode(); setIsProfileLocked(false); setIsProfileHovered(false); }} 
                            className="flex items-center w-full gap-3 px-4 py-2 text-left hover:bg-[#f0ebfa] hover:text-[#2A174E]"
                          >
                            <SwitchAccountIcon className="!text-[18px]" /> {viewMode === "management" ? "Switch to Employee View" : "Switch to Management View"}
                          </button>
                        </li>
                      )}
                      <li>
                        <button 
                          onClick={() => { handleLogout(); setIsProfileLocked(false); setIsProfileHovered(false); }} 
                          className="flex items-center w-full gap-3 px-4 py-2 text-left text-red-600 hover:bg-red-50"
                        >
                          <ExitToAppIcon className="!text-[18px]" /> Sign out
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-x-hidden max-w-[100vw]">
            {children}
          </div>
        </SidebarInset>
      )}
    </SidebarProvider>
  );
};

export default Sidebar;