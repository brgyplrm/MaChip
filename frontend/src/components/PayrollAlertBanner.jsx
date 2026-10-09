import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { useSystemTime } from "../context/SystemTimeContext";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import FactCheckIcon from "@mui/icons-material/FactCheck";

const PayrollAlertBanner = ({ className = "" }) => {
  const { systemToday } = useSystemTime();
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const stored = sessionStorage.getItem("machip_dismissed_payroll_alerts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fetchAlerts = async () => {
    try {
      const res = await fetchWithAuth("/api/payroll/status-alerts");
      if (res.ok) {
        const data = await res.json();
        if (data.enabled && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
        } else {
          setAlerts([]);
        }
      }
    } catch (err) {
      console.warn("[PayrollAlertBanner] Failed to fetch alerts:", err.message);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [systemToday]);

  const handleDismiss = (alertKey) => {
    const nextDismissed = [...dismissedAlerts, alertKey];
    setDismissedAlerts(nextDismissed);
    try {
      sessionStorage.setItem("machip_dismissed_payroll_alerts", JSON.stringify(nextDismissed));
    } catch (e) {
      // Ignore storage error
    }
  };

  const visibleAlerts = alerts.filter(
    (a) => !dismissedAlerts.includes(`${a.type}_${a.periodId || a.periodText}`)
  );

  if (visibleAlerts.length === 0) return null;

  return (
    <div className={`space-y-3 mb-6 ${className}`}>
      {visibleAlerts.map((alert, idx) => {
        const alertKey = `${alert.type}_${alert.periodId || alert.periodText}`;

        // 1. Audit & Manual Batch Verification Day (T-1 Business Day)
        if (alert.type === "audit_day" || alert.type === "pre_payroll") {
          return (
            <div
              key={alertKey || idx}
              className="flex items-start justify-between gap-4 p-4 rounded-xl bg-blue-50/95 border border-blue-200 text-blue-900 shadow-sm animate-in fade-in-50 duration-200"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                  <FactCheckIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2 flex-wrap">
                    {alert.title}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                      Audit Day
                    </span>
                  </h4>
                  <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
                    {alert.message}
                  </p>
                  
                  {/* Weekend Notice Indicator: Icon instead of emoji */}
                  {alert.adjustmentNotice && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100/70 border border-blue-200 text-blue-900 text-xs font-medium">
                      <EventRepeatIcon className="h-4 w-4 text-blue-700 shrink-0" />
                      <span>{alert.adjustmentNotice}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={alert.periodId ? `/payroll/payrollPeriod?periodId=${alert.periodId}` : "/payroll/payrollPeriod"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                >
                  Review Batch <ArrowForwardIcon className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDismiss(alertKey)}
                  className="text-blue-400 hover:text-blue-700 p-1 rounded-md transition-colors"
                  title="Dismiss reminder"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        }

        // 2. Payday (T-0 Day)
        if (alert.type === "payroll_day") {
          return (
            <div
              key={alertKey || idx}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-brand-primary to-[#7A52B5] text-white shadow-md animate-in fade-in-50 duration-200"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2.5 bg-white/15 text-white rounded-xl shrink-0">
                  <CalendarMonthIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm flex items-center gap-2 flex-wrap">
                    {alert.title}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                      Payday Release
                    </span>
                  </h4>
                  <p className="text-xs text-white/90 mt-0.5">
                    {alert.message}
                  </p>

                  {/* Weekend Notice Indicator */}
                  {alert.adjustmentNotice && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/15 text-white text-xs font-medium">
                      <EventRepeatIcon className="h-3.5 w-3.5 text-white shrink-0" />
                      <span>{alert.adjustmentNotice}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Link
                  to={alert.periodId ? `/payroll/payrollPeriod?periodId=${alert.periodId}` : "/payroll/payrollPeriod"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-brand-primary font-bold text-xs rounded-lg shadow-sm hover:bg-slate-100 transition-all"
                >
                  Review & Process <ArrowForwardIcon className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDismiss(alertKey)}
                  className="text-white/60 hover:text-white p-1 rounded-md transition-colors"
                  title="Dismiss notification"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        }



        // 5. Auto-Released or Payday Released Notice
        if (alert.type === "auto_released" || alert.type === "payday_released") {
          return (
            <div
              key={alertKey || idx}
              className="flex items-start justify-between gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-sm animate-in fade-in-50 duration-200"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                  <CheckCircleOutlineIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-emerald-900/90 mt-1 leading-relaxed">
                    {alert.message}
                  </p>
                  {alert.adjustmentNotice && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs font-medium">
                      <EventRepeatIcon className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
                      <span>{alert.adjustmentNotice}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(alertKey)}
                className="text-emerald-500 hover:text-emerald-800 p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default PayrollAlertBanner;
