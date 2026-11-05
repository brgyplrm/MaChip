import { useState, useEffect, useCallback, useRef } from "react";

/**
 * usePrivacyShield
 * Reactive hook for managing the Public Screen Privacy Masking Shield (RA 10173 DPA).
 * Automatically masks personal compensation, daily wage, and banking credentials
 * across Employee and Supervisor dashboards and profiles.
 */
export function usePrivacyShield() {
  const [shieldActive, setShieldActive] = useState(() => {
    try {
      return localStorage.getItem("machip_privacy_shield") === "true";
    } catch {
      return false;
    }
  });

  const [isPeeking, setIsPeeking] = useState(false);
  const peekTimerRef = useRef(null);

  useEffect(() => {
    const handleStorage = () => {
      try {
        setShieldActive(localStorage.getItem("machip_privacy_shield") === "true");
      } catch {}
    };

    const handleCustom = (e) => {
      if (e?.detail?.enabled !== undefined) {
        setShieldActive(Boolean(e.detail.enabled));
      } else if (e?.detail?.privacyShield !== undefined) {
        setShieldActive(Boolean(e.detail.privacyShield));
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("privacyShieldChange", handleCustom);
    window.addEventListener("machip_preferences_updated", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("privacyShieldChange", handleCustom);
      window.removeEventListener("machip_preferences_updated", handleCustom);
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);

  // Temporary peek unmasking for 5 seconds
  const togglePeek = useCallback(() => {
    setIsPeeking((prev) => {
      const next = !prev;
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (next) {
        peekTimerRef.current = setTimeout(() => {
          setIsPeeking(false);
        }, 5000);
      }
      return next;
    });
  }, []);

  const isMasked = shieldActive && !isPeeking;

  const maskAmount = useCallback(
    (amount, formattedStr = null) => {
      if (!isMasked) return formattedStr || (typeof amount === "number" ? `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : amount);
      return "₱••••••••";
    },
    [isMasked]
  );

  const maskAccount = useCallback(
    (account) => {
      if (!account) return "—";
      if (!isMasked) return account;
      const s = String(account);
      return s.length > 4 ? `••••••••${s.slice(-4)}` : "••••••••";
    },
    [isMasked]
  );

  return {
    shieldActive,
    isMasked,
    isPeeking,
    togglePeek,
    maskAmount,
    maskAccount,
  };
}
