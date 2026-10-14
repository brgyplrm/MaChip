import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SecurityIcon from "@mui/icons-material/Security";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper: Categorize notification by title and message
const categorizeNotification = (notif) => {
  const titleLower = (notif.title || "").toLowerCase();
  const msgLower = (notif.message || "").toLowerCase();

  if (
    titleLower.includes("unauthorized") ||
    titleLower.includes("irregular") ||
    titleLower.includes("suspicious") ||
    titleLower.includes("unrecognized") ||
    msgLower.includes("turnstile") ||
    msgLower.includes("rfid scan")
  ) {
    return "security";
  }

  if (
    titleLower.includes("loan") ||
    titleLower.includes("payslip") ||
    titleLower.includes("payroll") ||
    titleLower.includes("remittance") ||
    msgLower.includes("deduction") ||
    msgLower.includes("payslip")
  ) {
    return "payroll";
  }

  if (
    titleLower.includes("request") ||
    titleLower.includes("approval") ||
    titleLower.includes("approver") ||
    titleLower.includes("leave") ||
    titleLower.includes("overtime") ||
    titleLower.includes("offset") ||
    titleLower.includes("password reset")
  ) {
    return "request";
  }

  return "system";
};

// Helper: Visual styling per category
const getCategoryMeta = (category, title) => {
  const t = (title || "").toLowerCase();

  if (category === "security") {
    return {
      label: "Security & Access",
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      iconBg: "bg-red-50 text-red-600 border border-red-100",
      icon: <SecurityIcon className="h-5 w-5" />,
    };
  }

  if (category === "payroll") {
    return {
      label: "Payroll & Finance",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      iconBg: "bg-amber-50 text-amber-700 border border-amber-100",
      icon: <CreditCardIcon className="h-5 w-5" />,
    };
  }

  if (t.includes("password reset")) {
    return {
      label: "User Account",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      iconBg: "bg-purple-50 text-purple-700 border border-purple-100",
      icon: <VpnKeyOutlinedIcon className="h-5 w-5" />,
    };
  }

  if (category === "request") {
    return {
      label: "Requests & Approvals",
      badgeClass: "bg-blue-50 text-brand-primary border-blue-200",
      iconBg: "bg-blue-50 text-brand-primary border border-blue-100",
      icon: <AssignmentIcon className="h-5 w-5" />,
    };
  }

  return {
    label: "System Notice",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    iconBg: "bg-slate-100 text-slate-600 border border-slate-200",
    icon: <CampaignOutlinedIcon className="h-5 w-5" />,
  };
};

// Helper: Human-readable relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return past.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

// Helper: Action label on card footer
const getActionLabel = (notif) => {
  const titleLower = (notif.title || "").toLowerCase();
  if (
    titleLower.includes("irregular log") ||
    titleLower.includes("unrecognized") ||
    titleLower.includes("unauthorized") ||
    titleLower.includes("suspicious")
  ) {
    return "Inspect Log";
  }
  if (titleLower.includes("password reset")) {
    return "Manage User";
  }
  if (titleLower.includes("request") || titleLower.includes("approval") || titleLower.includes("approver")) {
    return "View Request";
  }
  if (titleLower.includes("payslip") || titleLower.includes("payroll")) {
    return "View Payroll";
  }
  return "View Details";
};

const Notifications = () => {
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const roleId = userData?.user_RoleId;
  const isManagement = roleId === 1 || roleId === 2 || roleId === 4;

  const getInitialViewMode = () => {
    if (!isManagement) return "employee";
    return localStorage.getItem("viewMode") || "management";
  };

  const [viewMode, setViewMode] = useState(getInitialViewMode());
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- FILTER & SEARCH STATE ---
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const effectiveViewMode = isManagement ? (viewMode || "management") : "employee";

  const fetchNotifications = async () => {
    if (!userData?.user_Id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/notifications/${userData.user_Id}?viewMode=${effectiveViewMode}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map((n) => ({ ...n, id: n.notifId }));
        setNotifications(formattedData);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleStorageChange = () => {
      const updatedUserData = JSON.parse(localStorage.getItem("userData"));
      const updatedRoleId = updatedUserData?.user_RoleId;
      const updatedIsManagement = updatedRoleId === 1 || updatedRoleId === 2 || updatedRoleId === 4;
      const updatedViewMode = updatedIsManagement ? (localStorage.getItem("viewMode") || "management") : "employee";
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
  }, [userData?.user_Id, effectiveViewMode]);

  // Reset to page 1 when the user switches view modes or changes filters
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveViewMode, activeFilter, searchQuery]);

  const handleMarkAllRead = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth("/api/notifications/mark-all-read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userData.user_Id, viewMode: effectiveViewMode }),
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleMarkAsRead = async (notifId, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetchWithAuth(`/api/notifications/mark-read/${notifId}`, {
        method: "PUT",
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.notifId === notifId ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleNotifClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.notifId);
    }

    const titleLower = (notif.title || "").toLowerCase();
    const msg = notif.message || "";
    const targetReqId = notif.targetId || msg.match(/#(\d+)/)?.[1] || notif.title?.match(/#(\d+)/)?.[1];

    // Reroute irregular logs and unrecognized/unauthorized card scans to the transaction log page
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
          state: { selectedReqId: parseInt(targetReqId, 10) },
        });
      } else {
        navigate(`/requests/${targetReqId}`);
      }
    } else if (notif.title === "New Request for Review") {
      navigate("/adminRequests");
    }
  };

  // --- STATISTICAL COUNTS (Memoized) ---
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;
    const requests = notifications.filter((n) => categorizeNotification(n) === "request").length;
    const security = notifications.filter((n) => categorizeNotification(n) === "security").length;
    const payroll = notifications.filter((n) => categorizeNotification(n) === "payroll").length;
    const system = notifications.filter((n) => categorizeNotification(n) === "system").length;

    return { total, unread, requests, security, payroll, system };
  }, [notifications]);

  // --- FILTERED DATASET ---
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const category = categorizeNotification(notif);

      // Tab filter
      if (activeFilter === "unread" && notif.isRead) return false;
      if (activeFilter === "request" && category !== "request") return false;
      if (activeFilter === "security" && category !== "security") return false;
      if (activeFilter === "payroll" && category !== "payroll") return false;
      if (activeFilter === "system" && category !== "system") return false;

      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = (notif.title || "").toLowerCase().includes(query);
        const matchMsg = (notif.message || "").toLowerCase().includes(query);
        const matchId = String(notif.notifId).includes(query) || (notif.targetId && String(notif.targetId).includes(query));
        if (!matchTitle && !matchMsg && !matchId) return false;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  // --- PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifs = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage) || 1;

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">System Notifications</h1>
                {isManagement && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-brand-primary border border-blue-200">
                    {effectiveViewMode === "management" ? "Management View" : "Employee View"}
                  </span>
                )}
              </div>
              <span className="text-sm text-slate-500 mt-1 block">
                Review operational requests, system dispatches, and access control audit logs.
              </span>
            </div>

            <Button
              variant="outline"
              onClick={handleMarkAllRead}
              className="w-full sm:w-auto border-brand-primary/20 hover:border-brand-primary hover:text-brand-primary text-brand-primary/80 font-semibold shadow-sm transition-all"
            >
              <DoneAllIcon className="mr-2 h-4 w-4" /> Mark all as read
            </Button>
          </div>

          {/* Statistical Cards Grid (Signature border-t-5 Palette) */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            
            {/* Card 1: Total Alerts (brand-primary) */}
            <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Total Alerts</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Total cumulative count of notifications logged for your current account profile.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-brand-primary">{loading ? "..." : stats.total}</p>
                  </div>
                  <p className="text-xs text-brand-primary/70 italic mt-4">All registered notifications</p>
                </div>
                <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <NotificationsNoneIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Unread Alerts (accent-gold) */}
            <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Unread Alerts</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Alerts and tickets awaiting review, acknowledgment, or administrative sign-off.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-accent-gold">{loading ? "..." : stats.unread}</p>
                  </div>
                  <p className="text-xs text-accent-gold/70 italic mt-4">Awaiting review or acknowledgment</p>
                </div>
                <div className="bg-accent-gold/10 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <FiberManualRecordIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Requests & Approvals (accent-green) */}
            <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Requests & Approvals</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Leave filings, overtime applications, and log correction tickets in review pipeline.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-accent-green">{loading ? "..." : stats.requests}</p>
                  </div>
                  <p className="text-xs text-accent-green/70 italic mt-4">Leave, OT, and offset dispatches</p>
                </div>
                <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <AssignmentIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Security Flags (status-danger) / System Notices (brand-secondary) */}
            {effectiveViewMode === "management" ? (
              <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Security & Hardware</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            High-priority flags: unauthorized RFID scans, unrecognized cards, and irregular clock-in alerts.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-status-danger">{loading ? "..." : stats.security}</p>
                    </div>
                    <p className="text-xs text-status-danger/70 italic mt-4">RFID scans & biometric flags</p>
                  </div>
                  <div className="bg-status-danger/10 text-status-danger p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <SecurityIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-t-5 border-brand-secondary bg-white py-0 h-full">
                <CardContent className="px-5 py-5 flex justify-between h-full">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-xs font-bold text-brand-secondary uppercase tracking-wider">System Notices</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-brand-secondary/60 hover:text-brand-secondary cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                            General administrative notices, holiday proclamations, and payroll release dispatches.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-4xl font-bold text-brand-secondary">{loading ? "..." : stats.system + stats.payroll}</p>
                    </div>
                    <p className="text-xs text-brand-secondary/70 italic mt-4">Company advisories & dispatches</p>
                  </div>
                  <div className="bg-brand-secondary/10 text-brand-secondary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                    <CampaignOutlinedIcon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Filter Tabs & Search Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>All</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("unread")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeFilter === "unread"
                    ? "bg-accent-gold text-slate-900 shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-accent-gold"></span>
                <span>Unread</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "unread" ? "bg-slate-900/15 text-slate-900 font-bold" : "bg-amber-100 text-amber-800"}`}>
                  {stats.unread}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("request")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeFilter === "request"
                    ? "bg-accent-green text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Requests</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "request" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {stats.requests}
                </span>
              </button>

              {effectiveViewMode === "management" ? (
                <button
                  type="button"
                  onClick={() => setActiveFilter("security")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeFilter === "security"
                      ? "bg-status-danger text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>Security & Access</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "security" ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
                    {stats.security}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveFilter("system")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeFilter === "system"
                      ? "bg-brand-secondary text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>System</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "system" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                    {stats.system}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveFilter("payroll")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeFilter === "payroll"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Payroll</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === "payroll" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {stats.payroll}
                </span>
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="relative w-full md:w-72 shrink-0">
              <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notification or #REQ..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border-slate-200 text-xs text-slate-700 rounded-xl focus-visible:ring-1 focus-visible:ring-brand-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <ClearIcon sx={{ fontSize: 14 }} />
                </button>
              )}
            </div>

          </div>

          {/* Notifications Command Feed Cards List */}
          <div className="space-y-3 mb-6">
            {currentNotifs.length > 0 ? (
              currentNotifs.map((notif) => {
                const category = categorizeNotification(notif);
                const meta = getCategoryMeta(category, notif.title);
                const relTime = formatRelativeTime(notif.createdAt);
                const fullTime = new Date(notif.createdAt).toLocaleString("en-PH");
                const actionLabel = getActionLabel(notif);

                return (
                  <Card
                    key={notif.notifId}
                    className={`shadow-sm border transition-all duration-200 py-0 overflow-hidden ${
                      notif.isRead
                        ? "border-l-4 border-l-transparent border-slate-200/80 bg-white hover:border-slate-300"
                        : "border-l-4 border-l-accent-gold border-amber-200/90 bg-amber-50/15 hover:bg-amber-50/30 shadow"
                    }`}
                  >
                    <CardContent className="p-4 md:p-5">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        
                        {/* Left Category Icon Avatar */}
                        <div className={`w-10 h-10 rounded-xl ${meta.iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}>
                          {meta.icon}
                        </div>

                        {/* Middle Content */}
                        <div className="flex-1 min-w-0 w-full">
                          
                          {/* Title & Category Badge Row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                onClick={() => handleNotifClick(notif)}
                                className={`text-sm md:text-base font-bold cursor-pointer hover:text-brand-primary transition-colors leading-tight ${
                                  notif.isRead ? "text-slate-700" : "text-slate-900"
                                }`}
                              >
                                {notif.title || "System Notification"}
                              </h3>

                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}>
                                {meta.label}
                              </span>

                              {!notif.isRead && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent-gold"></span>
                                  Unread
                                </span>
                              )}
                            </div>

                            {/* Relative Timestamp with Full Tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-xs text-slate-400 cursor-help shrink-0">
                                  <AccessTimeIcon sx={{ fontSize: 13 }} />
                                  <span>{relTime}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                                {fullTime}
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          {/* Message Body */}
                          <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-3">
                            {notif.message}
                          </p>

                          {/* Actions Bottom Bar */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNotifClick(notif)}
                              className="h-8 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all shadow-2xs gap-1.5"
                            >
                              <span>{actionLabel}</span>
                              <ArrowForwardIcon sx={{ fontSize: 13 }} />
                            </Button>

                            <div className="flex items-center gap-2">
                              {!notif.isRead ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleMarkAsRead(notif.notifId, e)}
                                  className="h-8 text-xs text-slate-500 hover:text-brand-primary hover:bg-slate-100 gap-1"
                                >
                                  <DoneAllIcon className="h-3.5 w-3.5 text-accent-gold" />
                                  <span>Mark as read</span>
                                </Button>
                              ) : (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                  <CheckCircleOutlineIcon sx={{ fontSize: 14 }} className="text-emerald-500" />
                                  Read
                                </span>
                              )}
                            </div>
                          </div>

                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="border border-dashed border-slate-200 bg-white p-12 text-center rounded-2xl shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <NotificationsNoneIcon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-slate-700">All Caught Up!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || activeFilter !== "all"
                    ? "No notifications found matching your active filter criteria."
                    : "No notifications currently recorded in the system."}
                </p>
                {(searchQuery || activeFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveFilter("all");
                      setSearchQuery("");
                    }}
                    className="mt-4 text-xs font-semibold text-brand-primary border-brand-primary/20 hover:bg-brand-primary hover:text-white"
                  >
                    Clear Filter
                  </Button>
                )}
              </Card>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredNotifications.length > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={filteredNotifications.length}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={indexOfFirstItem}
              endIndex={Math.min(indexOfLastItem, filteredNotifications.length)}
              itemLabel="notifications"
              className="rounded-xl border border-slate-100 bg-white shadow-sm"
            />
          )}

        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default Notifications;