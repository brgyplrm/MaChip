import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Universal hook for intercepting navigation and window closes when a form has unsaved changes.
 * @param {boolean} isDirty - Whether the form or page currently has unsaved modifications
 * @param {string} customMessage - Warning message to present
 * @param {function} onReset - Optional callback to run when user confirms discarding changes
 */
export function useUnsavedChanges(
  isDirty,
  customMessage = "You have unsaved changes. If you leave this page, all modifications will be discarded.",
  onReset = null
) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const navigate = useNavigate();
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  // 1. Native browser refresh or window/tab close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = customMessage;
        return customMessage;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, customMessage]);

  // 2. Intercept in-app navigation clicks (Links in sidebar, headers, breadcrumbs, etc.)
  useEffect(() => {
    if (!isDirty) return;

    const handleAnchorClick = (e) => {
      const anchor = e.target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Intercept navigation
      e.preventDefault();
      e.stopPropagation();

      setPendingNavigation(href);
      setShowPrompt(true);
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, [isDirty]);

  // 3. Intercept browser back/forward buttons (popstate)
  useEffect(() => {
    if (!isDirty) return;

    const handlePopState = (e) => {
      // Re-push current state to trap immediate back navigation
      window.history.pushState(null, "", window.location.href);
      setShowPrompt(true);
      setPendingNavigation(-1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  // 4. Register global bridge for programmatic navigation (e.g., Sidebar notification items or role switch)
  useEffect(() => {
    if (isDirty) {
      window.__machip_unsaved = {
        isDirty: true,
        promptFn: () => setShowPrompt(true),
        setPending: (dest) => setPendingNavigation(dest),
      };
    } else {
      if (window.__machip_unsaved) {
        window.__machip_unsaved = null;
      }
    }
    return () => {
      if (window.__machip_unsaved) {
        window.__machip_unsaved = null;
      }
    };
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    setShowPrompt(false);
    if (typeof onResetRef.current === "function") {
      try {
        onResetRef.current();
      } catch (err) {
        console.error("Error executing onReset in useUnsavedChanges:", err);
      }
    }
    if (pendingNavigation !== null && pendingNavigation !== undefined) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [navigate, pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setShowPrompt(false);
    setPendingNavigation(null);
  }, []);

  return {
    showPrompt,
    confirmNavigation,
    cancelNavigation,
  };
}
