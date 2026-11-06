import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../utils/api";
import { getStoredUser } from "../utils/authStorage";

const DataCacheContext = createContext();

export const useDataCache = () => useContext(DataCacheContext);

export const DataCacheProvider = ({ children }) => {
  // Read initial cache from sessionStorage for instant frame-1 rendering (0ms delay)
  const [cache, setCacheState] = useState(() => {
    try {
      const stored = sessionStorage.getItem("machip_global_cache");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const updateCache = useCallback((key, data) => {
    setCacheState((prev) => {
      const updated = { ...prev, [key]: data };
      try {
        sessionStorage.setItem("machip_global_cache", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const getCachedData = useCallback((key, fallback = null) => {
    return cache[key] !== undefined ? cache[key] : fallback;
  }, [cache]);

  // Pre-load common critical dashboard and navigation stats in the background
  const preloadAllStats = useCallback(async () => {
    const user = getStoredUser();
    if (!user?.user_Id) return;

    const roleId = Number(user.user_RoleId);
    const isManagement = [1, 2, 4].includes(roleId);

    try {
      const promises = [
        fetchWithAuth(`/api/notifications/unread-count/${user.user_Id}?viewMode=${isManagement ? "management" : "employee"}`)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              updateCache("unread_notifications_count", data.count || 0);
            }
          })
          .catch(() => {})
      ];

      if (isManagement) {
        promises.push(
          fetchWithAuth("/api/attendance/stats")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                updateCache("admin_dashboard_stats", data);
                try { sessionStorage.setItem("machip_dashboard_stats", JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/request/pending-count")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                updateCache("admin_pending_count", Number(data.count) || 0);
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/users/all")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                try { sessionStorage.setItem("machip_cached_users", JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/request/all")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                  try { sessionStorage.setItem("machip_cached_admin_requests", JSON.stringify(data)); } catch {}
                }
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/system/audit-logs?page=1&limit=10")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data.stats) {
                  try { sessionStorage.setItem("machip_cached_audit_stats", JSON.stringify(data.stats)); } catch {}
                }
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/system/transaction-logs?page=1&limit=10")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data.stats) {
                  try { sessionStorage.setItem("machip_cached_trans_stats", JSON.stringify(data.stats)); } catch {}
                }
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/payroll/loans/active")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                try { sessionStorage.setItem("machip_cached_gov_loans", JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/payroll/my-loans")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data.loans) {
                  try { sessionStorage.setItem("machip_cached_my_loans", JSON.stringify(data.loans)); } catch {}
                }
                if (data.summary) {
                  try { sessionStorage.setItem("machip_cached_my_loans_summary", JSON.stringify(data.summary)); } catch {}
                }
              }
            })
            .catch(() => {})
        );
      } else {
        promises.push(
          fetchWithAuth(`/api/attendance/employee-dashboard/${user.user_Id}`)
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                updateCache(`employee_dashboard_${user.user_Id}`, data);
                try { sessionStorage.setItem(`machip_emp_stats_${user.user_Id}`, JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth(`/api/request/balance/${user.user_Id}`)
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                updateCache(`user_balance_${user.user_Id}`, data);
                try { sessionStorage.setItem("machip_user_balance", JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth(`/api/request/${user.user_Id}`)
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                try { sessionStorage.setItem("machip_cached_user_history_requests", JSON.stringify(data)); } catch {}
              }
            })
            .catch(() => {}),
          fetchWithAuth("/api/payroll/my-loans")
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data.loans) {
                  try { sessionStorage.setItem("machip_cached_my_loans", JSON.stringify(data.loans)); } catch {}
                }
                if (data.summary) {
                  try { sessionStorage.setItem("machip_cached_my_loans_summary", JSON.stringify(data.summary)); } catch {}
                }
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);
    } catch (err) {
      console.warn("[DataCache] Background preload failed:", err);
    }
  }, [updateCache]);

  useEffect(() => {
    preloadAllStats();

    // Listen to real-time events to update the pre-loaded cache silently
    const handleDataRefresh = () => {
      preloadAllStats();
    };

    window.addEventListener("dataRefresh", handleDataRefresh);
    window.addEventListener("notificationRefresh", handleDataRefresh);

    return () => {
      window.removeEventListener("dataRefresh", handleDataRefresh);
      window.removeEventListener("notificationRefresh", handleDataRefresh);
    };
  }, [preloadAllStats]);

  return (
    <DataCacheContext.Provider value={{ getCachedData, updateCache, preloadAllStats, cache }}>
      {children}
    </DataCacheContext.Provider>
  );
};
