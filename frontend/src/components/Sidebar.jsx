import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import NotificationsIcon from "@mui/icons-material/Notifications";
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useSystemTime } from "../context/SystemTimeContext";
import { Badge } from "./ui/badge";
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { cn } from "../lib/utils";
import { getStoredUser, getStoredViewMode, setStoredViewMode, clearStoredAuth } from "../utils/authStorage";

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

const routeLabels = {
  "loanManagement": "Government Loans",
  "hardware" : "Hardware Registry",
  "newUser" : "New User",
  "adminRequests" : "Requests",
  "adminLoanEnrollment" : "Loan Enrollment",
  "payroll" : "Payroll Management",
  "payrollPeriod" : "Payroll Period",
  "laborBenefits" : "Labor Benefits",
  "employeeList" : "Employee List",
  "govloans" : "Summary",
  "eastwestloan" : "Employee Loans",
  "maxicare" : "HMOs",
  "adminReports" : "Admin Reports",
  "auditLogs" : "Audit Logs",
  "transactionLog" : "Transaction Logs",
  "settings" : "Configurations",
  "faq" : "Help & Support",
  "employeeHome" : "Home",
  "employeeCalendar" : "Calendar",
  "accessLogs" : "Access Logs",
  "visitorLogs" : "Visitor Access",
  "logs/edit/:userId/:date" : "Edit Attendance",
  "employee": "My Payroll",
  "payslip": "Payslip Details",
  "13th-month": "13th Month Details",
  "payroll-details": "Computation Details",
  "requests": "Requests Hub",
  "profile": "My Profile",
  "notifications": "Notifications",
  "transitions": "UI Animations Lab"
};

const Sidebar = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => 
    location.pathname.startsWith("/auditLogs") || 
    location.pathname.startsWith("/transactionLog") || 
    location.pathname.startsWith("/settings") || 
    location.pathname.startsWith("/faq")
  );

  // Dropdown states for submenus - initialized based on the current URL
  const [isUsersOpen, setIsUsersOpen] = useState(() => location.pathname.startsWith("/users"));
  const [isAccessLogsOpen, setIsAccessLogsOpen] = useState(() => 
    location.pathname.startsWith("/logs") || 
    location.pathname.startsWith("/accessLogs") || 
    location.pathname.startsWith("/visitorLogs")
  );
  const [isRequestsOpen, setIsRequestsOpen] = useState(() => 
    location.pathname.startsWith("/requests") || location.pathname.startsWith("/adminRequests")
  );
  const [isPayrollOpen, setIsPayrollOpen] = useState(() => 
    location.pathname.startsWith("/payroll") || 
    location.pathname.startsWith("/payrollDetails") ||
    location.pathname.startsWith("/maxicare") || 
    location.pathname.startsWith("/eastwestloan") || 
    location.pathname.startsWith("/govloans") || 
    location.pathname.startsWith("/cashadvances") ||
    location.pathname.startsWith("/laborBenefits") ||
    location.pathname.startsWith("/thirteenth-month") ||
    location.pathname.startsWith("/separation-pay") ||
    location.pathname.startsWith("/retirement-pay") ||
    location.pathname.startsWith("/loanManagement") ||
    location.pathname.startsWith("/loanmod") ||
    location.pathname.startsWith("/loanDetails") ||
    location.pathname.startsWith("/loanManagementHub")
  );
  
  const [userData, setUserData] = useState(() => getStoredUser());

  // Refresh user data if updated elsewhere (e.g. Profile Edit)
  useEffect(() => {
    const refreshUserData = () => {
      setUserData(getStoredUser());
    };
    window.addEventListener("userUpdate", refreshUserData);
    return () => window.removeEventListener("userUpdate", refreshUserData);
  }, []);

  const { isMockTime } = useSystemTime();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [viewMode, setViewMode] = useState(() => getStoredViewMode("management"));
  
  // New Role Check Logic
  // Admin = 1, Supervisor = 2, Employee = 3, Accountant = 4
  const roleId = userData?.user_RoleId;
  const isManagement = (roleId === 1 || roleId === 4) && viewMode === "management";
  const isSupervisor = (roleId === 2) && viewMode === "management";
  const isAdmin = (roleId === 1) && viewMode === "management";
  const isMaster = (roleId === 1 || roleId === 4) && viewMode === "management";
  const isAccountant = roleId === 4;

  const getRoleBadge = () => {
    const rawRole = userData?.user_Role;
    const numericRoleId = Number(userData?.user_RoleId);

    if (numericRoleId === 1 || rawRole === "Admin Manager" || rawRole === "Administrator" || rawRole === "Admin") {
      return {
        label: "Admin Manager",
        className: "bg-[#2A174E]/10 text-[#2A174E] border-[#2A174E]/25"
      };
    }
    if (numericRoleId === 4 || rawRole === "Admin Accountant" || rawRole === "Accountant") {
      return {
        label: "Admin Accountant",
        className: "bg-[#B06E16]/10 text-[#8C550E] border-[#B06E16]/25"
      };
    }
    if (numericRoleId === 2 || rawRole === "Supervisor") {
      return {
        label: "Supervisor",
        className: "bg-[#3B4E17]/10 text-[#3B4E17] border-[#3B4E17]/25"
      };
    }
    return {
      label: rawRole || "Employee",
      className: "bg-slate-100 text-slate-700 border-slate-200"
    };
  };

  const roleBadge = getRoleBadge();

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
      location.pathname.startsWith("/cashadvances") ||
      location.pathname.startsWith("/laborBenefits") ||
      location.pathname.startsWith("/loanMan2")
    ) {
      setIsPayrollOpen(true);
    }

    if (
      location.pathname.startsWith("/auditLogs") || 
      location.pathname.startsWith("/transactionLog") || 
      location.pathname.startsWith("/settings") || 
      location.pathname.startsWith("/faq")
    ) {
      setIsSettingsOpen(true);
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
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: userData?.user_Id }),
        credentials: "include",
      }).catch(() => {});
    } finally {
      clearStoredAuth();
      navigate("/login");
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === "management" ? "employee" : "management";
    setStoredViewMode(newMode);
    setViewMode(newMode);
    navigate(newMode === "employee" ? "/employeeHome" : "/");
    window.dispatchEvent(new Event("storage"));
  };

  const fetchUnreadCount = async () => {
    if (!userData?.user_Id) return;
    try {
      const currentViewMode = userData?.user_RoleId === 3 ? "employee" : (localStorage.getItem("viewMode") || "management");
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
      const currentViewMode = userData?.user_RoleId === 3 ? "employee" : (localStorage.getItem("viewMode") || "management");
      const response = await fetchWithAuth(`/api/notifications/${userData.user_Id}?viewMode=${currentViewMode}`);
      if (response.ok) {
        const data = await response.json();
        // Only keep unread/unclicked notifications in the dropdown so clicked ones disappear
        const unreadOnly = data.filter((n) => !n.isRead);
        setNotifications(unreadOnly.slice(0, 5));
      }
    } catch (err) { console.error(err); }
  };

  const handleNotifClick = async (notif) => {
    setIsNotifLocked(false); 
    setIsNotifHovered(false);

    // Immediately remove this clicked notification so remaining unclicked notifications are easily accessible at the top
    setNotifications((prev) => prev.filter((n) => n.notifId !== notif.notifId));

    if (!notif.isRead) {
      // 1. Instantly decrement unread count on bell badge
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // 2. Persist to backend and notify any listeners
      try {
        await fetchWithAuth(`/api/notifications/mark-read/${notif.notifId}`, {
          method: "PUT",
        });
        window.dispatchEvent(new Event("notificationRefresh"));
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }

    // 3. Navigate to relevant destination
    const titleLower = (notif.title || "").toLowerCase();
    const msg = notif.message || "";
    const targetReqId = notif.targetId || msg.match(/#(\d+)/)?.[1] || notif.title?.match(/#(\d+)/)?.[1];

    if (
      titleLower.includes("irregular log") ||
      titleLower.includes("unrecognized") ||
      titleLower.includes("unauthorized") ||
      titleLower.includes("suspicious")
    ) {
      navigate("/transactionLog");
    } else if (notif.title === "Password Reset Request" && notif.targetId) {
      navigate(`/users/edit/${notif.targetId}`);
    } else if (targetReqId) {
      const userRole = Number(userData?.user_RoleId);
      if (userRole === 1 || userRole === 2 || userRole === 4) {
        navigate(`/adminRequests?requestId=${targetReqId}`, {
          state: { selectedReqId: parseInt(targetReqId, 10) }
        });
      } else {
        navigate(`/requests/${targetReqId}`);
      }
    } else if (notif.title === "New Request for Review") {
      navigate("/adminRequests");
    } else if (userData?.user_RoleId === 3) {
      navigate("/userRequests");
    }
  };

  const handleDismissNotif = async (e, notif) => {
    e.stopPropagation();

    // Immediately remove from dropdown
    setNotifications((prev) => prev.filter((n) => n.notifId !== notif.notifId));

    if (!notif.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await fetchWithAuth(`/api/notifications/mark-read/${notif.notifId}`, {
          method: "PUT",
        });
        window.dispatchEvent(new Event("notificationRefresh"));
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchLatestNotifications();

    const handleRefresh = () => {
      fetchUnreadCount();
      fetchLatestNotifications();
    };

    window.addEventListener("notificationRefresh", handleRefresh);

    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchLatestNotifications();
    }, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notificationRefresh", handleRefresh);
    };
  }, [userData?.user_Id, viewMode]);

  // Generate Breadcrumbs based on location
  const getBreadcrumbs = () => {
    // If on home/dashboard
    if (location.pathname === "/" || location.pathname === "/employeeHome") {
      return [{ label: "Home", path: null }];
    }

    const items = [{ label: "Home", path: homePath }];

    // Employee Payroll sub-routes
    if (location.pathname === "/employee/payroll") {
      items.push({ label: "My Payroll", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/payslip/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "Payslip Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/payroll-details/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "Computation Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/employee/13th-month/")) {
      items.push({ label: "My Payroll", path: "/employee/payroll" });
      items.push({ label: "13th Month Details", path: null });
      return items;
    }

    // Users sub-routes
    if (location.pathname === "/users") {
      items.push({ label: "User List", path: null });
      return items;
    }
    if (location.pathname === "/users/newUser") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Add New User", path: null });
      return items;
    }
    if (location.pathname === "/users/archived") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Archived Users", path: null });
      return items;
    }
    if (location.pathname === "/users/hardware") {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Hardware Registry", path: null });
      return items;
    }
    if (location.pathname.startsWith("/users/edit/")) {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "Edit User Profile", path: null });
      return items;
    }
    if (location.pathname.startsWith("/users/")) {
      items.push({ label: "Users", path: "/users" });
      items.push({ label: "User Profile", path: null });
      return items;
    }

    // Admin Payroll sub-routes
    if (location.pathname === "/payroll") {
      items.push({ label: "Payroll Management", path: null });
      return items;
    }
    if (location.pathname.startsWith("/payrollDetails/")) {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Payroll Details", path: null });
      return items;
    }
    if (location.pathname === "/payroll/payrollPeriod") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Payroll Period", path: null });
      return items;
    }
    if (location.pathname === "/payroll/employeeList") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Employee List", path: null });
      return items;
    }
    if (location.pathname === "/payroll/leave-summary") {
      items.push({ label: "Payroll Management", path: "/payroll" });
      items.push({ label: "Leave Summary", path: null });
      return items;
    }

    // Labor Benefits
    if (location.pathname === "/laborBenefits") {
      items.push({ label: "Labor Benefits", path: null });
      return items;
    }
    if (location.pathname === "/thirteenth-month") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "13th Month Pay", path: null });
      return items;
    }
    if (location.pathname === "/separation-pay") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "Separation Pay", path: null });
      return items;
    }
    if (location.pathname === "/retirement-pay") {
      items.push({ label: "Labor Benefits", path: "/laborBenefits" });
      items.push({ label: "Retirement Pay", path: null });
      return items;
    }

    // Loans
    if (location.pathname === "/loanManagement" || location.pathname === "/loanmod" || location.pathname === "/loanManagementHub" || location.pathname === "/govloans") {
      items.push({ label: "Government Loans", path: null });
      return items;
    }
    if (location.pathname.startsWith("/loanDetails/")) {
      items.push({ label: "Government Loans", path: "/loanManagement" });
      items.push({ label: "Loan Details", path: null });
      return items;
    }
    if (location.pathname.startsWith("/govloans/history")) {
      items.push({ label: "Government Loans", path: "/loanManagement" });
      items.push({ label: "Loan History", path: null });
      return items;
    }
    if (location.pathname === "/eastwestloan") {
      items.push({ label: "Employee Loans", path: null });
      return items;
    }
    if (location.pathname.startsWith("/eastwestloan/history")) {
      items.push({ label: "Employee Loans", path: "/eastwestloan" });
      items.push({ label: "Loan History", path: null });
      return items;
    }
    if (location.pathname === "/cashadvances") {
      items.push({ label: "Cash Advances", path: null });
      return items;
    }
    if (location.pathname.startsWith("/cashadvances/history")) {
      items.push({ label: "Cash Advances", path: "/cashadvances" });
      items.push({ label: "Cash Advance History", path: null });
      return items;
    }
    if (location.pathname === "/maxicare") {
      items.push({ label: "HMOs", path: null });
      return items;
    }
    if (location.pathname.startsWith("/maxicare/history")) {
      items.push({ label: "HMOs", path: "/maxicare" });
      items.push({ label: "HMO History", path: null });
      return items;
    }

    // Reports
    if (location.pathname === "/adminReports") {
      items.push({ label: "Admin Reports", path: null });
      return items;
    }
    if (location.pathname.startsWith("/adminReports/payslip/")) {
      items.push({ label: "Admin Reports", path: "/adminReports" });
      items.push({ label: "Payslip Details", path: null });
      return items;
    }

    // Access Logs
    if (location.pathname === "/logs" || location.pathname === "/accessLogs") {
      items.push({ label: "Access Logs", path: null });
      return items;
    }
    if (location.pathname === "/visitorLogs") {
      items.push({ label: "Visitor Access", path: null });
      return items;
    }
    if (location.pathname.startsWith("/logs/edit/")) {
      items.push({ label: "Access Logs", path: "/logs" });
      items.push({ label: "Edit Attendance", path: null });
      return items;
    }

    // Requests
    if (location.pathname === "/adminRequests") {
      items.push({ label: "Requests", path: null });
      return items;
    }
    if (location.pathname === "/adminoversight") {
      items.push({ label: "Requests Oversight", path: null });
      return items;
    }
    if (location.pathname === "/adminLoanEnrollment") {
      items.push({ label: "Loan Enrollment", path: null });
      return items;
    }
    if (location.pathname === "/requestSum") {
      items.push({ label: "Request Summary", path: null });
      return items;
    }
    if (location.pathname === "/requests" || location.pathname === "/userRequests") {
      items.push({ label: "My Requests", path: null });
      return items;
    }
    if (location.pathname.startsWith("/requests/")) {
      items.push({ label: "My Requests", path: "/requests" });
      items.push({ label: "Request Details", path: null });
      return items;
    }

    // Calendar
    if (location.pathname === "/calendar" || location.pathname === "/employeeCalendar") {
      items.push({ label: "Calendar", path: null });
      return items;
    }

    // Settings / Misc
    if (location.pathname === "/settings") {
      items.push({ label: "Configurations", path: null });
      return items;
    }
    if (location.pathname === "/auditLogs") {
      items.push({ label: "Audit Logs", path: null });
      return items;
    }
    if (location.pathname === "/transactionLog") {
      items.push({ label: "Transaction Logs", path: null });
      return items;
    }
    if (location.pathname === "/faq") {
      items.push({ label: "Help & Support", path: null });
      return items;
    }
    if (location.pathname === "/profile") {
      items.push({ label: "My Profile", path: null });
      return items;
    }
    if (location.pathname === "/notifications") {
      items.push({ label: "Notifications", path: null });
      return items;
    }
    if (location.pathname === "/transitions") {
      items.push({ label: "UI Animations Lab", path: null });
      return items;
    }

    // Generic fallback for any other single-level paths
    const segments = location.pathname.split("/").filter(Boolean);
    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const label = routeLabels[seg] || seg.replace(/-/g, " ");
      items.push({
        label,
        path: isLast ? null : `/${segments.slice(0, idx + 1).join("/")}`
      });
    });

    return items;
  };

  const breadcrumbsList = getBreadcrumbs();

  // Dropdown visibility logic
  const showProfileMenu = isProfileHovered || isProfileLocked;
  const showNotifMenu = isNotifHovered || isNotifLocked;

  const menuButtonClass = (active) => cn(
    "flex items-center w-full transition-all duration-200 text-gray-500",
    "group-data-[collapsible=icon]:!flex group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0"
  );

  const subMenuButtonClass = (active) => cn(
    "transition-all duration-200 !h-8 px-3 rounded-md flex items-center w-full text-gray-500 hover:bg-[#f7f2fe] hover:text-[#2A174E]",
    active ? "bg-[#f0ebfa] text-[#2A174E]" : ""
  );

  // Users active state variables
  const isViewAllUsersActive = location.pathname === "/users" || (location.pathname.startsWith("/users/") && !location.pathname.includes("newUser") && !location.pathname.includes("archived") && !location.pathname.includes("hardware"));
  const isNewUserActive = location.pathname === "/users/newUser";
  const isArchivedUsersActive = location.pathname === "/users/archived";

  // Access Logs active state variables
  const isEmployeeLogsActive = location.pathname === "/logs" || location.pathname.startsWith("/logs/edit/") || location.pathname === "/accessLogs";
  const isVisitorLogsActive = location.pathname === "/visitorLogs";

  // Payroll active state variables
  const isPayrollMgmtActive = location.pathname === "/payroll" || location.pathname.startsWith("/payrollDetails") || location.pathname === "/payroll/payrollPeriod";
  const isEmployeeListActive = location.pathname === "/payroll/employeeList";
  const isGovLoansActive = location.pathname === "/loanManagement" || location.pathname.startsWith("/loanDetails/") || location.pathname === "/loanmod" || location.pathname === "/loanManagementHub" || location.pathname.startsWith("/govloans");
  const isEmpLoansActive = location.pathname.startsWith("/eastwestloan") || location.pathname.startsWith("/cashadvances");
  const isHmoActive = location.pathname.startsWith("/maxicare");
  const isLaborBenefitsActive = location.pathname === "/laborBenefits" || location.pathname === "/thirteenth-month" || location.pathname === "/separation-pay" || location.pathname === "/retirement-pay";
  const isLeaveSummaryActive = location.pathname === "/payroll/leave-summary";

  // Employee active state variables
  const isMyPayrollActive = 
    location.pathname.startsWith("/employee/payroll") ||
    location.pathname.startsWith("/employee/payslip") ||
    location.pathname.startsWith("/employee/13th-month") ||
    location.pathname.startsWith("/employee/payroll-details");

  const isAccessLogsLinkActive = 
    location.pathname === "/accessLogs" || 
    location.pathname.startsWith("/accessLogs") || 
    location.pathname === "/logs";

  // Settings active state variables
  const isAuditLogActive = location.pathname === "/auditLogs";
  const isTransactionLogActive = location.pathname === "/transactionLog";
  const isConfigActive = location.pathname === "/settings";
  const isFaqActive = location.pathname === "/faq";

  return (
    <SidebarProvider>
      <ShadcnSidebar collapsible="icon" className="bg-white border-r border-gray-200">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center border-b border-gray-100 relative overflow-hidden transition-all duration-200">
          <div className="flex flex-col items-center justify-center gap-1.5 w-full group-data-[collapsible=icon]:gap-0">
            <Link to={homePath} className="flex no-underline items-center justify-center">
              <img 
                src="/logo2.png" 
                alt="MAC-J Logo" 
                className="w-[150px] group-data-[collapsible=icon]:w-8 object-contain transition-all duration-200"
              />
            </Link>
            <div className="group-data-[collapsible=icon]:hidden flex items-center justify-center">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 h-auto rounded-full border shadow-none select-none",
                  roleBadge.className
                )}
              >
                {roleBadge.label}
              </Badge>
            </div>
          </div>
          {isMockTime && (
            <div className="absolute top-2 right-2 group-data-[collapsible=icon]:hidden">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 h-4 border-none shadow-sm animate-pulse">
                MOCK
              </Badge>
            </div>
          )}
        </SidebarHeader>
        <div className="h-1" />
        <SidebarContent className="no-scrollbar px-3 group-data-[collapsible=icon]:px-0 flex flex-col">
          <SidebarGroup className="group-data-[collapsible=icon]:p-0">
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">MAIN</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(homePath)}
                    className={menuButtonClass(isActive(homePath))}
                  >
                    <Link to={homePath}>
                      <DashboardOutlinedIcon 
                          className="!text-[22px] shrink-0" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">
                        Dashboard
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Calendar */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/calendar") || isActive("/employeeCalendar")}
                    className={menuButtonClass(isActive("/calendar") || isActive("/employeeCalendar"))}
                  >
                    <Link to={isManagement || isSupervisor ? "/calendar" : "/employeeCalendar"}>
                      <EditCalendarIcon className="!text-[22px] shrink-0" />
                      <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Calendar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Users (Dropdown) - Management Only */}
                {isManagement && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setIsUsersOpen(!isUsersOpen)}
                      isActive={location.pathname.startsWith("/users")}
                      className={menuButtonClass(location.pathname.startsWith("/users"))}
                    >
                      <PersonOutlineIcon className="!text-[22px] shrink-0" />
                      <span className="flex-1 ms-3 text-left text-[14px] group-data-[collapsible=icon]:hidden">
                        Users
                      </span>
                      <KeyboardArrowDownIcon className={cn(
                        "!text-[18px] transition-transform duration-300 group-data-[collapsible=icon]:!hidden",
                        isUsersOpen ? "rotate-180" : ""
                      )} />
                    </SidebarMenuButton>
                    {isUsersOpen && (
                      <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isViewAllUsersActive} className={subMenuButtonClass(isViewAllUsersActive)}>
                            <Link to="/users" className={cn("text-inherit font-medium", isViewAllUsersActive ? "font-bold" : "")}>
                              View All Users
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {isManagement && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={isNewUserActive} className={subMenuButtonClass(isNewUserActive)}>
                                <Link to="/users/newUser" className={cn("text-inherit font-medium", isNewUserActive ? "font-bold" : "")}>
                                  Add New User
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={isArchivedUsersActive} className={subMenuButtonClass(isArchivedUsersActive)}>
                                <Link to="/users/archived" className={cn("text-inherit font-medium", isArchivedUsersActive ? "font-bold" : "")}>
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
                    isActive={location.pathname.startsWith("/users")}
                    className={menuButtonClass(location.pathname.startsWith("/users"))}
                  >
                    <Link to="/users">
                      <PersonOutlineIcon 
                          className="!text-[22px] shrink-0" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}

                {/* Access Logs (Dropdown for Management/Supervisor, Direct Link for Employee) */}
                {isManagement || isSupervisor ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setIsAccessLogsOpen(!isAccessLogsOpen)}
                      isActive={location.pathname.startsWith("/logs") || location.pathname.startsWith("/accessLogs") || location.pathname.startsWith("/visitorLogs")}
                      className={menuButtonClass(location.pathname.startsWith("/logs") || location.pathname.startsWith("/accessLogs") || location.pathname.startsWith("/visitorLogs"))}
                    >
                      <HistoryIcon className="!text-[22px] shrink-0" />
                      <span className="flex-1 ms-3 text-left text-[14px] group-data-[collapsible=icon]:hidden">
                        Access Logs
                      </span>
                      <KeyboardArrowDownIcon className={cn(
                        "!text-[18px] transition-transform duration-300 group-data-[collapsible=icon]:!hidden",
                        isAccessLogsOpen ? "rotate-180" : ""
                      )} />
                    </SidebarMenuButton>
                    {isAccessLogsOpen && (
                      <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isEmployeeLogsActive} className={subMenuButtonClass(isEmployeeLogsActive)}>
                            <Link to="/logs" className={cn("text-inherit font-medium", isEmployeeLogsActive ? "font-bold" : "")}>
                              Employee Logs
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {isManagement && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={isVisitorLogsActive} className={subMenuButtonClass(isVisitorLogsActive)}>
                              <Link to="/visitorLogs" className={cn("text-inherit font-medium", isVisitorLogsActive ? "font-bold" : "")}>
                                Visitor Access
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isAccessLogsLinkActive}
                      className={menuButtonClass(isAccessLogsLinkActive)}
                    >
                      <Link to="/accessLogs">
                        <HistoryIcon className="!text-[22px] shrink-0" />
                        <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">
                          Access Logs
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* Requests Link */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname.startsWith("/requests") || location.pathname.startsWith("/adminRequests") || location.pathname.startsWith("/requestSum") || location.pathname.startsWith("/adminoversight")}
                    className={menuButtonClass(location.pathname.startsWith("/requests") || location.pathname.startsWith("/adminRequests") || location.pathname.startsWith("/requestSum") || location.pathname.startsWith("/adminoversight"))}
                  >
                    <Link 
                      to={
                        viewMode === "employee" 
                          ? "/requests" 
                          : (isAccountant ? "/adminoversight" : (isAdmin || isSupervisor ? "/adminRequests" : "/requests"))
                      } 
                    >
                      <DescriptionIcon 
                          className="!text-[22px] shrink-0" 
                          sx={{ strokeWidth: 1/2 }}
                      />
                      <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Requests</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Loan Enrollment - Management Only */}
                {/* {(isManagement || isSupervisor) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location.pathname.startsWith("/adminLoanEnrollment")}
                      className={menuButtonClass(location.pathname.startsWith("/adminLoanEnrollment"))}
                    >
                      <Link to="/adminLoanEnrollment">
                        <AccountBalanceIcon className="!text-[22px] shrink-0" />
                        <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Loan Enrollment</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )} */}

                {/* My Payroll - Employee Only */}
                {(viewMode === "employee" || Number(roleId) === 3) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isMyPayrollActive}
                      className={menuButtonClass(isMyPayrollActive)}
                    >
                      <Link to="/employee/payroll">
                        <CreditCardIcon className="!text-[22px] shrink-0" />
                        <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Payroll</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* Payroll (Dropdown) - Admin Only */}
                {isManagement && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setIsPayrollOpen(!isPayrollOpen)}
                      isActive={
                        location.pathname.startsWith("/payroll") || 
                        location.pathname.startsWith("/payrollDetails") ||
                        location.pathname.startsWith("/maxicare") || 
                        location.pathname.startsWith("/eastwestloan") || 
                        location.pathname.startsWith("/govloans") || 
                        location.pathname.startsWith("/cashadvances") ||
                        location.pathname.startsWith("/laborBenefits") ||
                        location.pathname.startsWith("/thirteenth-month") ||
                        location.pathname.startsWith("/separation-pay") ||
                        location.pathname.startsWith("/retirement-pay") ||
                        location.pathname.startsWith("/loanManagement") ||
                        location.pathname.startsWith("/loanmod") ||
                        location.pathname.startsWith("/loanDetails") ||
                        location.pathname.startsWith("/loanManagementHub")
                      }
                      className={menuButtonClass(
                        location.pathname.startsWith("/payroll") || 
                        location.pathname.startsWith("/payrollDetails") ||
                        location.pathname.startsWith("/maxicare") || 
                        location.pathname.startsWith("/eastwestloan") || 
                        location.pathname.startsWith("/govloans") || 
                        location.pathname.startsWith("/cashadvances") ||
                        location.pathname.startsWith("/laborBenefits") ||
                        location.pathname.startsWith("/thirteenth-month") ||
                        location.pathname.startsWith("/separation-pay") ||
                        location.pathname.startsWith("/retirement-pay") ||
                        location.pathname.startsWith("/loanManagement") ||
                        location.pathname.startsWith("/loanmod") ||
                        location.pathname.startsWith("/loanDetails") ||
                        location.pathname.startsWith("/loanManagementHub")
                      )}
                    >
                      <CreditCardIcon className="!text-[22px] shrink-0" />
                      <span className="flex-1 ms-3 text-left text-[14px] group-data-[collapsible=icon]:hidden">Payroll</span>
                      <KeyboardArrowDownIcon className={cn(
                        "!text-[18px] transition-transform duration-300 group-data-[collapsible=icon]:!hidden",
                        isPayrollOpen ? "rotate-180" : ""
                      )} />
                    </SidebarMenuButton>
                    {isPayrollOpen && (
                      <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isPayrollMgmtActive} className={subMenuButtonClass(isPayrollMgmtActive)}>
                            <Link to="/payroll" className={cn("text-inherit font-medium", isPayrollMgmtActive ? "font-bold" : "")}>
                              Payroll Management
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isEmployeeListActive} className={subMenuButtonClass(isEmployeeListActive)}>
                            <Link to="/payroll/employeeList" className={cn("text-inherit font-medium", isEmployeeListActive ? "font-bold" : "")}>
                              Employee List
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isGovLoansActive} className={subMenuButtonClass(isGovLoansActive)}>
                            <Link to="/loanManagement" className={cn("text-inherit font-medium", isGovLoansActive ? "font-bold" : "")}>
                              Government Loans
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isEmpLoansActive} className={subMenuButtonClass(isEmpLoansActive)}>
                            <Link to="/eastwestloan" className={cn("text-inherit font-medium", isEmpLoansActive ? "font-bold" : "")}>
                              Employee Loan
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isHmoActive} className={subMenuButtonClass(isHmoActive)}>
                            <Link to="/maxicare" className={cn("text-inherit font-medium", isHmoActive ? "font-bold" : "")}>
                              HMO Management
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isLaborBenefitsActive} className={subMenuButtonClass(isLaborBenefitsActive)}>
                            <Link to="/laborBenefits" className={cn("text-inherit font-medium", isLaborBenefitsActive ? "font-bold" : "")}>
                              Labor Benefits
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem> 

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isLeaveSummaryActive} className={subMenuButtonClass(isLeaveSummaryActive)}>
                            <Link to="/payroll/leave-summary" className={cn("text-inherit font-medium", isLeaveSummaryActive ? "font-bold" : "")}>
                              Leave Summary
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
                      isActive={location.pathname.startsWith("/adminReports")}
                      className={menuButtonClass(location.pathname.startsWith("/adminReports"))}
                    >
                      <Link to="/adminReports">
                        <AssessmentIcon className="!text-[22px] shrink-0" />
                        <span className="ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {/* --- BOTTOM SECTION (ANCHORED) --- */}
        <SidebarFooter className="border-t border-gray-100 p-3 mt-auto overflow-hidden transition-all duration-200">
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">SYSTEM</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                isActive={
                  location.pathname.startsWith("/auditLogs") || 
                  location.pathname.startsWith("/transactionLog") || 
                  location.pathname.startsWith("/settings") || 
                  location.pathname.startsWith("/faq")
                }
                className={cn(
                  menuButtonClass(
                    location.pathname.startsWith("/auditLogs") || 
                    location.pathname.startsWith("/transactionLog") || 
                    location.pathname.startsWith("/settings") || 
                    location.pathname.startsWith("/faq")
                  ),
                  "justify-start"
                )}
              >
                <SettingsIcon className="!text-[22px] shrink-0" />
                <span className="flex-1 ms-3 text-[14px] group-data-[collapsible=icon]:hidden">Settings</span>
                <KeyboardArrowDownIcon className={cn(
                  "!text-[18px] transition-transform duration-300 group-data-[collapsible=icon]:hidden",
                  isSettingsOpen ? "rotate-180" : ""
                )} />
              </SidebarMenuButton>

              {isSettingsOpen && (
                <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                  {isMaster && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isAuditLogActive} className={subMenuButtonClass(isAuditLogActive)}>
                        <Link 
                          to="/auditLogs" 
                          className={cn("text-inherit font-medium flex items-center", isAuditLogActive ? "font-bold" : "")}
                        >
                          <ListAltIcon className="!text-[18px] mr-2" /> Audit
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  {isMaster && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isTransactionLogActive} className={subMenuButtonClass(isTransactionLogActive)}>
                        <Link 
                          to="/transactionLog" 
                          className={cn("text-inherit font-medium flex items-center", isTransactionLogActive ? "font-bold" : "")}
                        >
                          <ReceiptLongIcon className="!text-[18px] mr-2" /> Transaction
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  {isManagement && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isConfigActive} className={subMenuButtonClass(isConfigActive)}>
                        <Link 
                          to="/settings" 
                          className={cn("text-inherit font-medium flex items-center", isConfigActive ? "font-bold" : "")}
                        >
                          <TuneIcon className="!text-[18px] mr-2" /> Configuration
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}

                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isFaqActive} className={subMenuButtonClass(isFaqActive)}>
                      <Link 
                        to="/faq" 
                        className={cn("text-inherit font-medium flex items-center", isFaqActive ? "font-bold" : "")}
                      >
                        <HelpOutlinedIcon className="!text-[18px] mr-2" /> Help & Support
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  {/* <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={location.pathname === "/transitions"} className={subMenuButtonClass(location.pathname === "/transitions")}>
                      <Link 
                        to="/transitions" 
                        className={cn("text-inherit font-medium flex items-center", location.pathname === "/transitions" ? "font-bold" : "")}
                      >
                        <AutoAwesomeIcon className="!text-[18px] mr-2 text-purple-600" /> UI Animations Lab
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem> */}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>

      {children && (
        <SidebarInset className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 sticky top-0 z-50">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-10" />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbsList.map((item, index) => {
                    const isLast = index === breadcrumbsList.length - 1;
                    return (
                      <React.Fragment key={index}>
                        {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                        <BreadcrumbItem className={index === 0 && !isLast ? "hidden md:block" : ""}>
                          {isLast || !item.path ? (
                            <BreadcrumbPage className="capitalize">{item.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild className="capitalize">
                              <Link to={item.path}>{item.label}</Link>
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
                  {location.pathname === "/notifications" ? (
                    <NotificationsIcon className="!text-[26px] text-[#2A174E]" />
                  ) : (
                    <NotificationsNoneIcon className="!text-[26px] hover:animate-bell-shake" />
                  )}
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
                            className="group/notif relative px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer bg-[#f0ebfa]/30"
                            onClick={() => handleNotifClick(notif)}
                          >
                            <div className="flex gap-3 items-start">
                              <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-[#2A174E]" />
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-[12px] text-gray-800 leading-snug line-clamp-2 font-medium">{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                              </div>
                              <button
                                type="button"
                                title="Dismiss notification"
                                onClick={(e) => handleDismissNotif(e, notif)}
                                className="opacity-0 group-hover/notif:opacity-100 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded transition-all shrink-0"
                              >
                                <CloseIcon sx={{ fontSize: 13 }} />
                              </button>
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
                  className={cn(
                    "flex text-sm rounded-full transition-all duration-300 active:scale-95 relative",
                    location.pathname === "/profile"
                      ? "p-[2.5px] bg-gradient-to-r from-[#2A174E] via-[#7A52B5] to-[#2A174E] shadow-[0_0_15px_rgba(122,82,181,0.75)] animate-pulse"
                      : "bg-gray-800 focus:ring-2 focus:ring-gray-300"
                  )}
                >
                  <img 
                    className="w-8 h-8 rounded-full object-cover border border-white" 
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
          <div className="flex flex-1 flex-col p-4 w-full overflow-x-hidden">
            {children}
          </div>
        </SidebarInset>
      )}
      {/* Absolute centering force for collapsed mode */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Force center alignment for collapsed sidebar icons across the whole hierarchy */
        [data-collapsible=icon] [data-sidebar="content"],
        [data-collapsible=icon] [data-sidebar="group"],
        [data-collapsible=icon] [data-sidebar="group-content"],
        [data-collapsible=icon] [data-sidebar="menu"] {
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          gap: 0 !important;
        }

        [data-collapsible=icon] [data-sidebar="menu-item"] {
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          justify-content: center !important;
          width: 100% !important;
          height: auto !important;
        }

        [data-collapsible=icon] [data-sidebar="menu-button"] {
          width: 40px !important;
          height: 40px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          margin: 4px 0 !important;
          border-radius: 8px !important;
          position: relative !important;
          flex-shrink: 0 !important;
        }

        [data-collapsible=icon] [data-sidebar="menu-button"] > * {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        [data-collapsible=icon] [data-sidebar="menu-button"] svg {
          margin: 0 !important;
          flex-shrink: 0 !important;
          display: block !important;
          font-size: 24px !important;
          width: 24px !important;
          height: 24px !important;
        }

        /* Specifically target and hide any element that is not the primary icon/first child */
        [data-collapsible=icon] [data-sidebar="menu-button"] span:not(.MuiTouchRipple-root),
        [data-collapsible=icon] [data-sidebar="menu-button"] svg:last-child:not(:first-child) {
          display: none !important;
        }
      `}} />
    </SidebarProvider>
  );
};

export default Sidebar;