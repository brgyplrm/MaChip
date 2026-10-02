import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";

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
  const navigate = useNavigate();

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const effectiveViewMode = isManagement ? (viewMode || "management") : "employee";

  const fetchNotifications = async () => {
    if (!userData?.user_Id) return;
    try {
      const response = await fetchWithAuth(`/api/notifications/${userData.user_Id}?viewMode=${effectiveViewMode}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map(n => ({ ...n, id: n.notifId }));
        setNotifications(formattedData);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  // --- PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifs = notifications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(notifications.length / itemsPerPage) || 1;

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

  // Reset to page 1 when the user switches view modes
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveViewMode]);

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
          state: { selectedReqId: parseInt(targetReqId, 10) }
        });
      } else {
        navigate(`/requests/${targetReqId}`);
      }
    } else if (notif.title === "New Request for Review") {
      navigate("/adminRequests");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">System Notifications</h1>
          <Button 
            variant="outline" 
            onClick={handleMarkAllRead}
            className="w-full sm:w-auto border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors shadow-sm"
          >
            <DoneAllIcon className="mr-2 h-4 w-4" /> Mark all as read
          </Button>
        </div>

        {/* Notifications List Card */}
        <Card className="shadow-sm border-0 bg-white overflow-hidden mb-6 py-0">
          <div className="max-h-[700px] overflow-y-auto">
            {currentNotifs.length > 0 ? (
              currentNotifs.map((notif) => (
                <div 
                  key={notif.notifId} 
                  onClick={() => handleNotifClick(notif)}
                  className={`flex items-start gap-4 p-5 border-b border-slate-100 cursor-pointer transition-colors border-l-4 ${
                    notif.isRead 
                      ? 'border-l-transparent bg-white hover:bg-slate-50' 
                      : 'border-l-accent-gold bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="pt-1 w-4 shrink-0 flex justify-center">
                    {!notif.isRead && <FiberManualRecordIcon className="text-accent-gold h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed mb-1 ${notif.isRead ? 'font-normal text-slate-600' : 'font-bold text-slate-800'}`}>
                      {notif.message}
                    </p>
                    <span className="text-xs text-slate-400">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-500 italic">
                No notifications found.
              </div>
            )}
          </div>
        </Card>

        {/* Pagination Controls */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          totalItems={notifications.length}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          startIndex={indexOfFirstItem}
          endIndex={Math.min(indexOfLastItem, notifications.length)}
          itemLabel="notifications"
          className="rounded-xl border border-slate-100 bg-white shadow-sm"
        />

      </div>
      </Sidebar>
    </div>
  );
};

export default Notifications;