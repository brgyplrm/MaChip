import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { fetchWithAuth } from "../utils/api";

const SystemTimeContext = createContext();

export const SystemTimeProvider = ({ children }) => {
  const [systemToday, setSystemToday] = useState(new Date());
  const [isMockTime, setIsMockTime] = useState(false);

  const fetchSystemTime = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/system/time");
      if (response.ok) {
        const data = await response.json();
        const sysDate = new Date(data.systemTime);
        setIsMockTime(Boolean(data.isMock));
        setSystemToday(prev => {
          // If the difference is minor (under 2s drift), keep smooth local ticking
          const diff = Math.abs(sysDate.getTime() - prev.getTime());
          if (diff < 2000) {
            return prev;
          }
          return sysDate;
        });
      }
    } catch (err) {
      console.error("Error fetching system time:", err);
    }
  }, []);

  useEffect(() => {
    fetchSystemTime();
    
    // Periodically re-sync with server every 30 seconds to catch mock time changes
    const syncInterval = setInterval(fetchSystemTime, 30000);

    // Locally increment the time every second for UI smoothness
    const clockTimer = setInterval(() => {
      setSystemToday(prev => new Date(prev.getTime() + 1000));
    }, 1000);

    const handleRefresh = () => fetchSystemTime();
    window.addEventListener("systemTimeRefresh", handleRefresh);

    return () => {
      clearInterval(syncInterval);
      clearInterval(clockTimer);
      window.removeEventListener("systemTimeRefresh", handleRefresh);
    };
  }, [fetchSystemTime]);

  return (
    <SystemTimeContext.Provider value={{ systemToday, isMockTime, refreshSystemTime: fetchSystemTime }}>
      {children}
    </SystemTimeContext.Provider>
  );
};

export const useSystemTime = () => useContext(SystemTimeContext);
