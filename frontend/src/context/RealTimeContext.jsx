import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import Toast from "../components/toast/Toast";
import { getStoredUser } from "../utils/authStorage";

const RealTimeContext = createContext();

export const useRealTime = () => useContext(RealTimeContext);

export const RealTimeProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [toastNotification, setToastNotification] = useState({ message: "", type: "info", targetId: null });
  
  const [currentUserId, setCurrentUserId] = useState(() => {
    try {
      const u = getStoredUser();
      return u?.user_Id || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        const u = getStoredUser();
        setCurrentUserId(u?.user_Id || null);
      } catch {
        setCurrentUserId(null);
      }
    };
    window.addEventListener("storage", syncUser);
    window.addEventListener("userUpdate", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("userUpdate", syncUser);
    };
  }, []);

  const refreshData = useCallback(() => {
    setLastUpdate(Date.now());
    // This event will be listened to by various pages to trigger their own re-fetches
    window.dispatchEvent(new Event("dataRefresh"));
  }, []);

  // Ensure current socket joins personal room whenever user changes
  useEffect(() => {
    if (socket && socket.connected && currentUserId) {
      socket.emit("join", currentUserId);
    }
  }, [socket, currentUserId]);

  useEffect(() => {
    // Determine backend URL (fallback if running on same host)
    const backendUrl = window.location.origin.includes(":5173") 
      ? window.location.origin.replace(":5173", ":4000") 
      : window.location.origin;

    const newSocket = io(backendUrl, {
      withCredentials: true,
      transports: ["polling", "websocket"], // Use polling first, then upgrade
    });

    setSocket(newSocket);

    const joinPersonalRoom = () => {
      const stored = getStoredUser();
      const uid = stored?.user_Id || currentUserId;
      if (uid) {
        newSocket.emit("join", uid);
      }
    };

    // Join room when connected and on every reconnect/transport upgrade
    newSocket.on("connect", () => {
      joinPersonalRoom();
    });

    if (newSocket.connected) {
      joinPersonalRoom();
    }

    newSocket.on("NEW_ATTENDANCE_LOG", () => {
      refreshData();
    });

    newSocket.on("NEW_REQUEST", () => {
      refreshData();
    });

    newSocket.on("REQUEST_STATUS_UPDATED", () => {
      refreshData();
    });

    newSocket.on("NOTIFICATION_UPDATE", () => {
      // Specific event for notification counts/lists
      window.dispatchEvent(new Event("notificationRefresh"));
    });

    const triggerNotificationToast = (data) => {
      window.dispatchEvent(new Event("notificationRefresh"));
      window.dispatchEvent(new Event("dataRefresh"));
      const text = data?.message || data?.title || "New notification received";
      const targetId = data?.requestId || data?.targetId || text.match(/#(\d+)/)?.[1] || null;
      setToastNotification({
        message: text,
        type: "info",
        targetId
      });
    };

    // 1. Room-scoped notification event
    newSocket.on("new_notification", (data) => {
      triggerNotificationToast(data);
    });

    // 2. Global broadcast notification with targetUserId filter
    newSocket.on("NEW_NOTIFICATION", (data) => {
      const stored = getStoredUser();
      const activeId = stored?.user_Id ? Number(stored.user_Id) : (currentUserId ? Number(currentUserId) : null);
      if (data?.targetUserId && activeId && Number(data.targetUserId) === activeId) {
        triggerNotificationToast(data);
      }
    });

    return () => newSocket.close();
  }, [currentUserId, refreshData]);

  // Global Toast event listener for in-app broadcasts
  useEffect(() => {
    const handleGlobalToast = (e) => {
      if (e.detail?.message) {
        setToastNotification({
          message: e.detail.message,
          type: e.detail.type || "info",
          targetId: e.detail.targetId || e.detail.requestId || e.detail.message?.match(/#(\d+)/)?.[1] || null
        });
      }
    };
    window.addEventListener("appToast", handleGlobalToast);
    return () => window.removeEventListener("appToast", handleGlobalToast);
  }, []);

  // Visibility / Focus Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshData();
        window.dispatchEvent(new Event("notificationRefresh"));
      }
    };

    const handleFocus = () => {
      refreshData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshData]);

  return (
    <RealTimeContext.Provider value={{ socket, lastUpdate, refreshData }}>
      {children}
      {toastNotification.message && (
        <Toast
          message={toastNotification.message}
          type={toastNotification.type}
          onClose={() => setToastNotification({ message: "", type: "info", targetId: null })}
          onClick={() => {
            const reqId = toastNotification.targetId || toastNotification.message?.match(/#(\d+)/)?.[1];
            if (reqId) {
              const u = getStoredUser();
              const isMgmt = [1, 2, 4].includes(Number(u?.user_RoleId));
              const targetUrl = isMgmt ? `/adminRequests?requestId=${reqId}` : `/requests/${reqId}`;
              window.location.assign(targetUrl);
              setToastNotification({ message: "", type: "info", targetId: null });
            }
          }}
        />
      )}
    </RealTimeContext.Provider>
  );
};

