import React, { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getStoredUser, clearStoredAuth } from "../utils/authStorage";

// 15 Minutes Inactivity Threshold in Milliseconds
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)
const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds

export default function InactivityHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);

  const performLogout = useCallback(async () => {
    try {
      const userData = getStoredUser();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: userData?.user_Id }),
        credentials: "include",
      }).catch(() => {});
    } finally {
      clearStoredAuth();

      // Only redirect if not already on the login or reset-password page
      if (
        !location.pathname.includes("/login") &&
        !location.pathname.includes("/reset-password")
      ) {
        navigate("/login?reason=inactivity", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Only track inactivity if user is actually logged in
    const userData = getStoredUser();
    if (!userData) return;

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    // Throttled activity updater
    let throttleTimeout = null;
    const handleUserActivity = () => {
      if (!throttleTimeout) {
        updateActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Throttle to at most once per second
      }
    };

    // Attach listeners
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Check on visibility change (e.g. waking up laptop or switching back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime >= INACTIVITY_TIMEOUT_MS) {
          performLogout();
        } else {
          updateActivity();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Periodic idle checker
    timerRef.current = setInterval(() => {
      const isStillLoggedIn = !!localStorage.getItem("userData");
      if (!isStillLoggedIn) {
        clearInterval(timerRef.current);
        return;
      }

      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(timerRef.current);
        performLogout();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [location.pathname, performLogout, updateActivity]);

  return null; // Headless component
}
