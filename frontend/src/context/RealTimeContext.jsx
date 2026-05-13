import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

const RealTimeContext = createContext();

export const useRealTime = () => useContext(RealTimeContext);

export const RealTimeProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const userData = JSON.parse(localStorage.getItem("userData"));
  const userId = userData?.user_Id;

  const refreshData = useCallback(() => {
    setLastUpdate(Date.now());
    // This event will be listened to by various pages to trigger their own re-fetches
    window.dispatchEvent(new Event("dataRefresh"));
  }, []);

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

    if (userId) {
      newSocket.emit("join", userId);
    }

    newSocket.on("NEW_ATTENDANCE_LOG", (data) => {
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

    return () => newSocket.close();
  }, [userId, refreshData]);

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
    </RealTimeContext.Provider>
  );
};
