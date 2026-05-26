import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import Navbar from "../../../components/navbar/Navbar";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";
import { formatDateLocal, isInSamePeriod } from "../../../utils/formatTime";
import HmoCalculatorModal from "../../../components/HmoCalculatorModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import PieChartIcon from '@mui/icons-material/PieChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventIcon from '@mui/icons-material/Event';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import HistoryIcon from "@mui/icons-material/History";
import { Link, useSearchParams } from "react-router-dom";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Maxicare = () => {
  const { systemToday } = useSystemTime();
  const [searchParams] = useSearchParams();
  const queryYear = searchParams.get("year");
  
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 4 || 1;

  const [toast, setToast] = useState({ message: "", type: "success" });
  const [isEditing, setIsEditing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(queryYear ? parseInt(queryYear) : new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employerShare, setEmployerShare] = useState(50);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [excludedDates, setExcludedDates] = useState([]);
  
  const [config, setConfig] = useState({
    totalGross: 0,
    monthsToPay: 12,
    cycleStartDate: "",
  });

  const [cycleConfigs, setCycleConfigs] = useState({}); // Map of year -> { totalGross, monthsToPay }

  const [batchForm, setBatchForm] = useState({
    dates: [],
    amount: "",
    selectedEmployees: []
  });

  const setPremium = (val) => setConfig(prev => ({ ...prev, totalGross: val }));
  const setCutoffs = (val) => setConfig(prev => ({ ...prev, monthsToPay: val / 2 }));

  const [employeeList, setEmployeeList] = useState([]);
  const [data, setData] = useState([]);
  const [expectedDates, setExpectedDates] = useState([]);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [editingCell, setEditingCell] = useState(null); 
  const [editValue, setEditValue] = useState("");
  const [syncingCell, setSyncingCell] = useState(null); 

  const emptyColumn = async (empKey) => {
    const emp = employeeList.find(e => e.key === empKey);
    if (!emp) return;

    const updates = displayDates.map(dateStr => ({
      date: dateStr,
      user_Id: emp.user_Id,
      amount: 0,
      status: 'removed'
    }));

    setData(prevData => {
      let newData = [...prevData];
      displayDates.forEach(dateStr => {
        let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, dateStr));
        if (recordIndex !== -1) {
          newData[recordIndex] = {
            ...newData[recordIndex],
            values: {
              ...newData[recordIndex].values,
              [empKey]: { amount: 0, status: 'removed' }
            }
          };
        }
      });
      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      await fetchWithAuth("/api/payroll/maxicare/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      setToast({ message: `All deductions for ${emp.name} have been cleared.`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to sync cleared column", type: "error" });
      fetchData();
    }
  };

  const deleteColumn = async (empKey) => {
    const emp = employeeList.find(e => e.key === empKey);
    if (!emp) return;

    if (!window.confirm(`Are you sure you want to remove ${emp.name} from the Maxicare list? This will clear their history and set their expected deduction to 0.`)) return;

    await emptyColumn(empKey);

    try {
      await fetchWithAuth("/api/users/bulk-maxicare", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ user_Id: emp.user_Id, healthCard_Amnt: 0 }]
        })
      });
      setEmployeeList(prev => prev.filter(e => e.key !== empKey));
      setToast({ message: `${emp.name} has been removed from Maxicare.`, type: "success" });
    } catch (err) {
      setToast({ message: "Error updating user status", type: "error" });
    }
  };

  // Helper to check if a date's period has any contribution data within a specific cycle
  const hasContributionInCycle = (dateStr, cycleRange) => {
    if (!cycleRange) return false;
    const record = data.find(item => {
      const itemDate = new Date(item.date);
      return isInSamePeriod(item.date, dateStr) && 
             itemDate >= cycleRange.start && 
             itemDate <= cycleRange.deductionEnd;
    });
    return record && Object.values(record.values).some(v => v.amount > 0);
  };

  const generateExpectedDates = (startDateStr, months) => {
    if (!startDateStr || !months) return [];
    const dates = [];
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return [];
    
    // Calculate the logical end of the deduction cycle (end of the final calendar month of the term)
    const end = new Date(start);
    end.setMonth(start.getMonth() + (parseInt(months) || 12));
    const deductionEnd = new Date(end);
    deductionEnd.setMonth(deductionEnd.getMonth() + 1, 0); // Last day of the anniversary month
    deductionEnd.setHours(23, 59, 59, 999);

    // Snap to the first payroll cutoff on or after the start date (15th or Last Day)
    let current = new Date(start);
    if (current.getDate() <= 15) {
      current.setDate(15);
    } else {
      current.setMonth(current.getMonth() + 1, 0); // Last day of month
    }

    while (current <= deductionEnd) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = current.getDate();
      
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dates.push(dStr);
      
      // Move to next cutoff
      if (day === 15) {
        current = new Date(year, month + 1, 0); // Last day of current month
      } else {
        current = new Date(year, month + 1, 15); // 15th of next month
      }
    }
    return dates;
  };

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentCutoffDate = systemToday 
    ? expectedDates.find(d => d >= formatDateLocal(systemToday))
    : null;

  // ── Unified Date Logic for Table (Renewal Period Based) ────────────────────
  const getCycleRange = (year = selectedYear) => {
    // Use cycle-specific start date if available, fallback to global config
    const startDate = cycleConfigs[year]?.cycleStartDate || config.cycleStartDate;
    if (!startDate) return null;
    
    const baseStart = new Date(startDate);
    
    // Extract month/day using UTC to avoid timezone shifts from YYYY-MM-DD strings
    const startMonth = baseStart.getUTCMonth();
    const startDay = baseStart.getUTCDate();
    
    // Create range anchored to the requested year
    const start = new Date(year, startMonth, startDay, 0, 0, 0);
    const end = new Date(start);
    
    // Use cycle-specific monthsToPay if available, otherwise fallback to current config
    const months = cycleConfigs[year]?.monthsToPay || config.monthsToPay || 12;
    end.setMonth(start.getMonth() + (parseInt(months) || 12));
    
    // deductionEnd: The last millisecond of the final month of the cycle
    const deductionEnd = new Date(end);
    deductionEnd.setMonth(deductionEnd.getMonth() + 1, 0); 
    deductionEnd.setHours(23, 59, 59, 999);
    
    return { start, end, deductionEnd };
  };

  const cycle = getCycleRange();
  const isUnconfigured = !cycleConfigs[selectedYear];

  const cycleData = data.filter(item => {
    if (!cycle) return false;
    const itemDate = new Date(item.date);
    return itemDate >= cycle.start && itemDate <= cycle.deductionEnd;
  });

  const cycleHasAnyData = cycleData.some(item => Object.values(item.values).some(v => v.amount > 0));

  // Generate a virtual template for the currently selected year to help with historical initialization
  const virtualExpectedDates = () => {
    // ONLY generate virtual dates if the cycle is ALREADY configured 
    // OR if the user is in an active setup/edit state.
    if (!cycle || (isUnconfigured && !isEditing && !showCalculator)) return [];

    const startDate = cycleConfigs[selectedYear]?.cycleStartDate || config.cycleStartDate;
    const months = cycleConfigs[selectedYear]?.monthsToPay || config.monthsToPay || 12;
    
    if (!startDate || !months) return [];
    
    const baseDate = new Date(startDate);
    const virtualStart = `${selectedYear}-${String(baseDate.getUTCMonth() + 1).padStart(2, '0')}-${String(baseDate.getUTCDate()).padStart(2, '0')}`;
    
    return generateExpectedDates(virtualStart, months);
  };

  const currentVirtualDates = virtualExpectedDates();

  const displayDates = [...new Set([
    ...expectedDates,
    ...currentVirtualDates,
    ...data.map(d => d.date)
  ])].filter(d => {
    // 0. Filter out dates manually removed in this session
    if (excludedDates.includes(d)) return false;

    if (!cycle) return new Date(d).getFullYear() === selectedYear;
    
    // Normalize dDate for comparison
    const dDate = new Date(d);
    dDate.setHours(0, 0, 0, 0);
    
    // 1. Strict Boundary Check
    const isInBroadRange = dDate >= cycle.start && dDate <= cycle.deductionEnd;
    if (!isInBroadRange) return false;

    // 2. Prevent "Start Date of Next Cycle" from appearing at the end of this cycle
    const nextCycleStart = new Date(cycle.start);
    const months = cycleConfigs[selectedYear]?.monthsToPay || config.monthsToPay || 12;
    nextCycleStart.setMonth(nextCycleStart.getMonth() + parseInt(months));
    nextCycleStart.setHours(0, 0, 0, 0);
    
    if (dDate.getTime() === nextCycleStart.getTime()) return false;

    // 3. Smart Overlap Protection:
    // If this date's period was already used/paid in the previous cycle, 
    // hide it from this cycle to avoid double-listing.
    const prevCycle = getCycleRange(selectedYear - 1);
    if (prevCycle && hasContributionInCycle(d, prevCycle)) return false;

    // 4. Logic: Show strict 12-month body, but only show extra tail-end dates if they have data
    const isInStrictTerm = dDate >= cycle.start && dDate <= cycle.end;
    const isInExtraZone = dDate > cycle.end && dDate <= cycle.deductionEnd;

    if (isInStrictTerm) {
      // If unconfigured and NO historical data, only show if user is editing
      if (isUnconfigured && !cycleHasAnyData && !isEditing && !isEditingTable) return false;
      return true;
    }

    if (isInExtraZone) {
      // In the "Overtime" zone (e.g. Aug 15/31):
      // Show if: 
      // 1. There is historical data
      // 2. We are in Edit Mode (to allow manual entry)
      // 3. It is part of the PROJECTED/EXPECTED dates for the cycle (to show the full plan)
      const isProjected = currentVirtualDates.includes(d) || expectedDates.includes(d);
      return isEditingTable || hasContributionInCycle(d, cycle) || isProjected;
    }
    
    return false;
  }).sort();

  const getCycleLabel = () => {
    const months = cycleConfigs[selectedYear]?.monthsToPay || config.monthsToPay || 12;
    const endYear = selectedYear + Math.max(1, Math.ceil(months / 12));
    return `Cycle ${selectedYear}-${endYear}`;
  };

  const getRenewalPeriod = () => {
    if (!cycle) return "Not Set";
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${cycle.start.toLocaleDateString('en-PH', options)} TO ${cycle.end.toLocaleDateString('en-PH', options)}`.toUpperCase();
  };
  // ──────────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData) {
        // Parse dates and configs from maxicareDates (which might be an array or an object)
        let savedDates = [];
        let configs = {};
        
        if (Array.isArray(settingsData.maxicareDates)) {
          savedDates = settingsData.maxicareDates;
        } else if (settingsData.maxicareDates && typeof settingsData.maxicareDates === 'object') {
          savedDates = settingsData.maxicareDates.dates || [];
          configs = settingsData.maxicareDates.configs || {};
        }

        setCycleConfigs(configs);

        // Current config for the selected year
        const currentYearConfig = configs[selectedYear] || {
          totalGross: 0,
          monthsToPay: 12,
          cycleStartDate: settingsData.maxicareCycleStartDate || ""
        };

        setConfig({
          totalGross: currentYearConfig.totalGross,
          monthsToPay: currentYearConfig.monthsToPay,
          cycleStartDate: currentYearConfig.cycleStartDate || settingsData.maxicareCycleStartDate || "",
        });

        // Sync selectedYear with the loaded configuration's start year ONLY on first load and if NO query year is present
        const initialDate = currentYearConfig.cycleStartDate || settingsData.maxicareCycleStartDate;
        if (!initialSyncDone && !queryYear && initialDate) {
          const startDate = new Date(initialDate);
          if (!isNaN(startDate.getFullYear())) {
            setSelectedYear(startDate.getFullYear());
          }
          setInitialSyncDone(true);
        } else if (!initialSyncDone && queryYear) {
          setInitialSyncDone(true);
        }

        if (savedDates.length > 0) {
          const validSavedDates = savedDates.filter(d => {
            if (!d) return false;
            const parts = d.split('-');
            return parts.length === 3 && parts[0].length === 4 && !isNaN(new Date(d).getTime());
          });
          setExpectedDates(validSavedDates);
        } else if (initialDate && initialDate.length >= 10) {
          setExpectedDates(generateExpectedDates(initialDate, currentYearConfig.monthsToPay || settingsData.maxicareMonthsToPay));
        }
      }

      let historyMap = {}; 
      let rawHistory = [];
      let employees = [];
      const historyRes = await fetchWithAuth("/api/payroll/maxicare/history");
      if (historyRes.ok) {
        const json = await historyRes.json();
        rawHistory = json.history || [];
        employees = json.employees || [];

        if (Array.isArray(rawHistory)) {
          rawHistory.forEach(item => {
            const uid = item.user_Id.toString();
            if (!historyMap[uid] || item.date > historyMap[uid].date) {
              historyMap[uid] = {
                amount: parseFloat(item.amount),
                date: item.date,
                status: item.status
              };
            }
          });
        }
      }

      if (!Array.isArray(employees)) throw new Error("Could not retrieve employee list.");

      const activeParticipants = employees;

      const activeEmps = activeParticipants.map(emp => {
        const hist = historyMap[emp.user_Id.toString()];
        let rate = parseFloat(emp.healthCard_Amnt) || 0;
        if (rate === 0 && hist && hist.amount > 0) {
          rate = hist.amount;
        }

        return {
          id: `MACJ-${String(emp.user_Id).padStart(3, "0")}`,
          name: `${emp.user_LastName || "Unknown"}, ${emp.user_FirstName || "User"}`,
          key: emp.user_Id.toString(),
          user_Id: emp.user_Id,
          expectedDeduction: rate
        };
      });
      setEmployeeList(activeEmps);

      const dateMap = {};
      rawHistory.forEach(item => {
        if (item.date && item.user_Id) {
          const dateKey = formatDateLocal(item.date);
          if (!dateMap[dateKey]) dateMap[dateKey] = {};
          dateMap[dateKey][item.user_Id.toString()] = {
            amount: parseFloat(item.amount),
            status: item.status
          };
        }
      });

      const matrix = Object.keys(dateMap).sort().map(date => ({
        date,
        values: dateMap[date]
      }));
      setData(matrix);

    } catch (err) {
      console.error("[MAXICARE] Fatal fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderChange = (index, newDate) => {
    const updated = [...expectedDates];
    updated[index] = newDate;
    setExpectedDates(updated);
  };

  const removePeriod = (dateStr) => {
    setExcludedDates(prev => [...prev, dateStr]);
    setToast({ message: "Period removed from table. Save to persist changes.", type: "success" });
  };

  const clearYearTemplate = () => {
    if (!cycle) {
      const updated = expectedDates.filter(d => new Date(d).getFullYear() !== selectedYear);
      setExpectedDates(updated);
      setToast({ message: `Cleared template dates for ${selectedYear}.`, type: "success" });
      return;
    }
    const updated = expectedDates.filter(d => {
      const dDate = new Date(d);
      return dDate < cycle.start || dDate > cycle.end;
    });
    setExpectedDates(updated);
    setToast({ message: `Cleared template dates for cycle starting ${selectedYear}. History remains intact.`, type: "success" });
  };

  const addPeriod = () => {
    const lastDate = displayDates.length > 0 
      ? displayDates[displayDates.length - 1] 
      : (cycle ? formatDateLocal(cycle.start) : `${selectedYear}-01-01`);
    
    const next = new Date(lastDate);

    if (displayDates.length === 0) {
      if (next.getDate() <= 15) {
        next.setDate(15);
      } else {
        next.setMonth(next.getMonth() + 1, 0);
      }
    } else {
      if (next.getDate() <= 15) {
        next.setMonth(next.getMonth() + 1, 0); 
      } else {
        next.setMonth(next.getMonth() + 1, 15);
      }
    }
    
    const nextStr = formatDateLocal(next);

    if (cycle && new Date(nextStr) > cycle.deductionEnd) {
      setToast({ message: "Cannot add period outside of renewal cycle month.", type: "error" });
      return;
    }

    if (!expectedDates.includes(nextStr)) {
      setExpectedDates(prev => [...prev, nextStr].sort());
      setToast({ message: `Successfully added period: ${nextStr}`, type: "success" });
    } else {
      setToast({ message: `Period ${nextStr} already exists in configuration`, type: "info" });
    }
  };

  const handleCellDoubleClick = (date, empKey, currentVal) => {
    if (!isAdmin) return;
    setEditingCell({ date, empKey });
    setEditValue(currentVal > 0 ? currentVal.toString() : "");
  };

  const handleCellSave = async (date, empKey, manualVal = null) => {
    if (!editingCell && manualVal === null) return;
    
    let val;
    if (manualVal !== null) {
      val = manualVal;
    } else {
      const sanitizedValue = editValue.replace(/,/g, "").trim();
      val = sanitizedValue === "" ? 0 : parseFloat(sanitizedValue);
    }
    
    setEditingCell(null);

    if (isNaN(val)) {
      setToast({ message: "Invalid amount entered", type: "error" });
      return;
    }

    const todayStr = systemToday ? formatDateLocal(systemToday) : "";
    setSyncingCell({ date, empKey });
    const updates = [];
    
    setData(prevData => {
      let newData = [...prevData];

      const targetDateIndex = expectedDates.indexOf(date);
      const currentCutoffIndex = currentCutoffDate ? expectedDates.indexOf(currentCutoffDate) : expectedDates.length;

      // Only auto-fill forward if it's NOT a manual "clear" action (val > 0)
      const shouldFill = val > 0 && val >= (deductionCutoff - 0.01); 

      const datesToProcess = shouldFill 
        ? expectedDates.slice(targetDateIndex, currentCutoffIndex)
        : [date];

      datesToProcess.forEach(dStr => {
        let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, dStr));
        const emp = employeeList.find(e => e.key === empKey);

        if (recordIndex === -1) {
          newData.push({
            date: dStr,
            values: { [empKey]: { amount: val, status: dStr < todayStr ? 'paid' : 'estimated' } }
          });
        } else {
          const currentRecord = newData[recordIndex].values[empKey];
          const currentVal = currentRecord ? currentRecord.amount : 0;

          // If filling forward, only overwrite 0s. If it's the target date, always overwrite.
          if (currentVal === 0 || dStr === date) {
            newData[recordIndex] = {
              ...newData[recordIndex],
              values: {
                ...newData[recordIndex].values,
                [empKey]: { amount: val, status: dStr < todayStr ? 'paid' : 'estimated' }
              }
            };
          }
        }
        if (emp) {
          updates.push({ date: dStr, user_Id: emp.user_Id, amount: val });
        }
      });

      if (val > 0) {
        setEmployeeList(prev => prev.map(e => 
          e.key === empKey ? { ...e, expectedDeduction: val } : e
        ));
      }

      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    if (updates.length > 0) {
      try {
        const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });
        
        if (res.ok) {
          setToast({ 
            message: updates.length > 1 
              ? "Employee history updated!" 
              : "Cell updated successfully!", 
            type: "success" 
          });
        } else {
          const errData = await res.json();
          setToast({ message: "Sync failed: " + (errData.error || "Unknown error"), type: "error" });
          fetchData(); 
        }
      } catch (err) {
        setToast({ message: "Failed to save to database", type: "error" });
        fetchData(); 
      } finally {
        setTimeout(() => setSyncingCell(null), 800); 
      }
    } else {
      setSyncingCell(null);
    }
  };

  const getSummaryStats = () => {
    const subscribers = new Set();
    let totalPaid = 0;

    data.forEach(item => {
      const dDate = new Date(item.date);
      // Use deductionEnd to capture tail-end payments in stats
      const isInScope = cycle 
        ? (dDate >= cycle.start && dDate <= cycle.deductionEnd)
        : (dDate.getFullYear() === parseInt(selectedYear));

      if (isInScope) {
        Object.keys(item.values).forEach(empKey => {
          const amt = item.values[empKey].amount;
          if (amt > 0) {
            subscribers.add(empKey);
            totalPaid += amt;
          }
        });
      }
    });

    return {
      subscribers: subscribers.size,
      totalPaid: totalPaid
    };
  };

  const stats = getSummaryStats();
  const dismissToast = () => setToast({ message: "", type: "success" });

  const saveSettings = async () => {
    try {
      setLoading(true);

      // finalDates now simply uses expectedDates (which contains all years thanks to the corrected useEffect)
      // minus any excluded dates from the current session.
      const finalDates = expectedDates
        .filter(d => !excludedDates.includes(d))
        .sort();

      // Update cycleConfigs for the selected year
      const updatedConfigs = {
        ...cycleConfigs,
        [selectedYear]: {
          totalGross: config.totalGross,
          monthsToPay: config.monthsToPay,
          cycleStartDate: config.cycleStartDate
        }
      };

      const settingsRes = await fetchWithAuth("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ONLY update global fallback if no configs exist yet (initial setup)
          ...(Object.keys(cycleConfigs).length === 0 && {
            maxicareTotalGross: config.totalGross, 
            maxicareMonthsToPay: config.monthsToPay, 
            maxicareCycleStartDate: config.cycleStartDate, 
          }),
          maxicareDates: {
            dates: finalDates,
            configs: updatedConfigs
          }
        })
      });

      const userRes = await fetchWithAuth("/api/users/bulk-maxicare", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: employeeList.map(emp => ({
            user_Id: emp.user_Id,
            healthCard_Amnt: emp.expectedDeduction
          }))
        })
      });

      if (settingsRes.ok && userRes.ok) {
        setIsEditing(false);
        setIsEditingTable(false);
        setExcludedDates([]); 
        await fetchData();
        setToast({ message: "Maxicare configuration and employee deductions saved successfully!", type: "success" });
      } else {
        setToast({ message: "Failed to save some settings. Please check your connection.", type: "error" });
      }
    } catch (err) {
      console.error("[MAXICARE SAVE ERROR]:", err);
      setToast({ message: "Error saving settings: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const syncHistory = async () => {
    try {
      setLoading(true);
      const updates = [];
      data.forEach(item => {
        Object.keys(item.values).forEach(empKey => {
          const emp = employeeList.find(e => e.key === empKey);
          const record = item.values[empKey];
          if (emp && record) {
            updates.push({
              date: item.date,
              user_Id: emp.user_Id,
              amount: record.amount
            });
          }
        });
      });

      const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: "Payroll records updated successfully!", type: "success" });
        fetchData();
      } else {
        const err = await res.json();
        setToast({ message: "Error syncing: " + (err.error || "Unknown error"), type: "error" });
      }
    } catch (err) {
      setToast({ message: "Failed to sync with server", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync local config when selectedYear changes (user switching cycles)
  useEffect(() => {
    if (initialSyncDone) {
      if (cycleConfigs[selectedYear]) {
        const c = cycleConfigs[selectedYear];
        setConfig(prev => ({
          ...prev,
          totalGross: c.totalGross,
          monthsToPay: c.monthsToPay,
          cycleStartDate: c.cycleStartDate || prev.cycleStartDate
        }));
        // If there's a saved config, we should have already loaded the dates in fetchData
        // But if they aren't there, we'll let the virtual template handle it
      } else {
        // Reset only the Premium (Total Gross) to 0 for unconfigured cycle
        // Preserve Renewal Term (monthsToPay) and Employer Share (separate state)
        setConfig(prev => ({
          ...prev,
          totalGross: 0,
          // monthsToPay is kept as is (e.g. 12)
          // cycleStartDate is kept as baseline
        }));
        
        // Clear manual expected dates so the Virtual Template takes over for the new year
        setExpectedDates([]);
        setExcludedDates([]);
      }
    }
  }, [selectedYear, initialSyncDone, cycleConfigs]);

  const activeSubscribers = stats.subscribers;
  const annualPremiumTotal = config.totalGross * activeSubscribers;
  const employerShareAmount = config.totalGross * (employerShare / 100);
  const employeeShareAmount = config.totalGross * ((100 - employerShare) / 100);
  const deductionCutoff = config.monthsToPay > 0 ? employeeShareAmount / (config.monthsToPay * 2) : 0;

  // ── Auto-generate expected dates when config changes ──────────────────────
  useEffect(() => {
    // Only generate if the start date is fully typed (e.g., YYYY-MM-DD)
    if (config.cycleStartDate && config.cycleStartDate.length >= 10 && config.monthsToPay) {
      const newDates = generateExpectedDates(config.cycleStartDate, config.monthsToPay);
      
      setExpectedDates(prev => {
        // We want to merge the new template dates with whatever is already there.
        // We don't want to strictly overwrite because the user might have added 
        // manual periods (like Aug 15/31 at the end of a cycle).
        
        // Remove old generated dates for this cycle to avoid duplicate/invalid keystroke dates
        const year = new Date(config.cycleStartDate).getFullYear();
        const prevWithoutCurrentCycle = prev.filter(d => {
           const dYear = new Date(d).getFullYear();
           return isNaN(dYear) || (dYear !== year && dYear !== year + 1);
        });

        const merged = [...new Set([...prevWithoutCurrentCycle, ...newDates])].sort();
        
        if (JSON.stringify(merged) !== JSON.stringify(prev)) {
          return merged;
        }
        return prev;
      });
    }
  }, [config.cycleStartDate, config.monthsToPay]);
  // ──────────────────────────────────────────────────────────────────────────

  const handleConfigChange = (e) => {
    const { name, value, type } = e.target;
    
    let sanitizedValue = value;
    if (name === 'totalGross') {
      sanitizedValue = value.replace(/,/g, '');
      if (isNaN(sanitizedValue) && sanitizedValue !== '') return;
      sanitizedValue = sanitizedValue === '' ? 0 : parseFloat(sanitizedValue);
    } else if (type === 'number') {
      sanitizedValue = parseFloat(value) || 0;
    }

    setConfig(prev => ({ 
      ...prev, 
      [name]: sanitizedValue
    }));
    
    // Sync selectedYear if the cycle start date is changed
    if (name === 'cycleStartDate' && value) {
      const year = new Date(value).getFullYear();
      if (!isNaN(year)) setSelectedYear(year);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleRenewalChange = (months) => {
  setConfig(prev => ({
    ...prev,
    monthsToPay: parseInt(months)
  }));
};

  const downloadTemplate = () => {
    const templateId = "MAXICARE_HMO_TEMPLATE";
    const headers = [templateId, ...employeeList.map(emp => `${emp.name} #${emp.id}`)];
    const headerLine = headers.join(",");

    const rows = displayDates.map(date => {
      const emptyValues = employeeList.map(() => "").join(",");
      return `${date},${emptyValues}`;
    });

    const csvContent = "\uFEFF" + [headerLine, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = cycle 
      ? `maxicare_hmo_matrix_${cycle.start.getFullYear()}-${cycle.end.getFullYear()}.csv`
      : `maxicare_hmo_matrix_${selectedYear}.csv`;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    if (!file) return setToast({ message: "Please select a file first", type: "error" });
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawText = e.target.result;
        const text = rawText.replace(/^\uFEFF/, '');
        const lines = text.split("\n").filter(line => line.trim() !== "");
        if (lines.length < 2) throw new Error("File is empty or missing data.");

        const headers = lines[0].split(",");
        const templateId = headers[0]?.trim();

        if (templateId !== "MAXICARE_HMO_TEMPLATE") {
          setToast({ 
            message: `Invalid template. You are trying to upload a file for "${templateId.replace(/_/g, ' ')}" into the Maxicare HMO section. Please download the latest template.`, 
            type: "error" 
          });
          setLoading(false);
          return;
        }

        const empMappings = []; 

        for (let i = 1; i < headers.length; i++) {
          const header = headers[i];
          const match = header.match(/#MACJ-(\d+)/i);
          if (match) {
            empMappings.push({ colIndex: i, user_Id: parseInt(match[1]) });
          }
        }

        const updates = [];
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(",");
          const date = columns[0]?.trim();
          if (!date) continue;

          empMappings.forEach(mapping => {
            const amount = parseFloat(columns[mapping.colIndex]?.trim() || 0);
            const isValidDate = !isNaN(new Date(date).getTime());

            if (amount > 0 && isValidDate) {
              updates.push({
                date,
                user_Id: mapping.user_Id,
                amount
              });
            }
          });
        }

        if (updates.length === 0) {
          setToast({ message: "No non-zero amounts found in CSV", type: "error" });
          setLoading(false);
          return;
        }

        const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        });

        if (res.ok) {
          setToast({ message: `Successfully synced ${updates.length} records!`, type: "success" });
          setShowBatchModal(false);
          fetchData();
          setFile(null);
        } else {
          const err = await res.json();
          setToast({ message: "Sync error: " + (err.error || "Unknown"), type: "error" });
        }
      } catch (err) {
        setToast({ message: "Error parsing CSV. Please ensure it follows the template.", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBatchSave = async () => {
    if (batchForm.dates.length === 0 || !batchForm.amount || batchForm.selectedEmployees.length === 0) {
      setToast({ message: "Please select at least one period, one employee, and an amount", type: "error" });
      return;
    }

    const amount = parseFloat(batchForm.amount);
    if (isNaN(amount)) {
      setToast({ message: "Invalid amount", type: "error" });
      return;
    }

    setLoading(true);
    const todayStr = systemToday ? formatDateLocal(systemToday) : "";
    const updates = [];

    // Populate updates array for each date and each employee
    batchForm.dates.forEach(dStr => {
      batchForm.selectedEmployees.forEach(empId => {
        const emp = employeeList.find(e => e.user_Id === empId);
        if (emp) {
          updates.push({ date: dStr, user_Id: emp.user_Id, amount: amount });
        }
      });
    });

    if (updates.length === 0) {
      setToast({ message: "No valid employees selected", type: "error" });
      setLoading(false);
      return;
    }

    setData(prevData => {
      let newData = [...prevData];
      
      updates.forEach(update => {
        const emp = employeeList.find(e => e.user_Id === update.user_Id);
        let recordIndex = newData.findIndex(d => isInSamePeriod(d.date, update.date));
        
        if (recordIndex === -1) {
          newData.push({
            date: update.date,
            values: { [emp.key]: { amount: amount, status: update.date < todayStr ? 'paid' : 'estimated' } }
          });
        } else {
          newData[recordIndex] = {
            ...newData[recordIndex],
            values: {
              ...newData[recordIndex].values,
              [emp.key]: { amount: amount, status: update.date < todayStr ? 'paid' : 'estimated' }
            }
          };
        }
      });

      return newData.sort((a, b) => a.date.localeCompare(b.date));
    });

    try {
      const res = await fetchWithAuth("/api/payroll/maxicare/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        setToast({ message: `Successfully updated ${updates.length} records!`, type: "success" });
        setShowBatchModal(false);
        setBatchForm({ dates: [], amount: "", selectedEmployees: [] });
        fetchData();
      } else {
        const errData = await res.json();
        setToast({ message: "Batch update failed: " + (errData.error || "Unknown error"), type: "error" });
        fetchData();
      }
    } catch (err) {
      setToast({ message: "Failed to sync batch update", type: "error" });
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeSelection = (userId) => {
    setBatchForm(prev => {
      const isSelected = prev.selectedEmployees.includes(userId);
      return {
        ...prev,
        selectedEmployees: isSelected 
          ? prev.selectedEmployees.filter(id => id !== userId)
          : [...prev.selectedEmployees, userId]
      };
    });
  };

  const toggleDateSelection = (dateStr) => {
    setBatchForm(prev => {
      const isSelected = prev.dates.includes(dateStr);
      return {
        ...prev,
        dates: isSelected 
          ? prev.dates.filter(d => d !== dateStr)
          : [...prev.dates, dateStr]
      };
    });
  };

  const selectAllEmployees = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedEmployees: employeeList.map(e => e.user_Id)
    }));
  };

  const deselectAllEmployees = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedEmployees: []
    }));
  };

  const selectAllDates = () => {
    setBatchForm(prev => ({
      ...prev,
      dates: [...expectedDates]
    }));
  };

  const deselectAllDates = () => {
    setBatchForm(prev => ({
      ...prev,
      dates: []
    }));
  };

  const currentCycleYear = useMemo(() => {
    const today = systemToday ? new Date(systemToday) : new Date();
    for (const yearStr of Object.keys(cycleConfigs)) {
      const year = parseInt(yearStr);
      const range = getCycleRange(year);
      if (range && today >= range.start && today <= range.deductionEnd) {
        return year;
      }
    }
    return today.getFullYear();
  }, [cycleConfigs, systemToday]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-4xl! p-0 overflow-hidden border-none bg-transparent shadow-none">
          <HmoCalculatorModal 
            premium={config.totalGross}
            setPremium={setPremium}
            cutoffs={config.monthsToPay * 2}
            setCutoffs={setCutoffs}
            employerShare={employerShare}
            setEmployerShare={setEmployerShare}
            cycleStartDate={config.cycleStartDate}
            setCycleStartDate={(date) => {
              setConfig(prev => ({ ...prev, cycleStartDate: date }));
              if (date) {
                const year = new Date(date).getFullYear();
                if (!isNaN(year)) setSelectedYear(year);
              }
            }}
          />
          <div className="flex justify-center pb-6">
            <button 
              onClick={async () => {
                await saveSettings();
                setShowCalculator(false);
              }}
              className="bg-[#2A174E] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#1a0e30] transition-colors shadow-lg"
            >
              Continue to Maxicare Management
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#2A174E]">Batch Details Upload</DialogTitle>
            <DialogDescription>
              Select a method to upload multiple employee Maxicare records at once.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="form" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="form">Manual Entry Form</TabsTrigger>
              <TabsTrigger value="csv">CSV File Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Target Month / Period</label>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="xs" onClick={selectAllDates} className="text-[10px] h-6 px-2 text-blue-600">All</Button>
                      <Button variant="ghost" size="xs" onClick={deselectAllDates} className="text-[10px] h-6 px-2 text-slate-400">Clear</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                    {expectedDates.length > 0 ? expectedDates.map( dStr => {
                      const isSelected = batchForm.dates.includes(dStr);
                      const dObj = new Date(dStr);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => toggleDateSelection(dStr)}
                          className={`text-[11px] py-2 px-3 rounded-lg border transition-all text-left flex flex-col ${
                            isSelected 
                              ? "bg-[#2A174E] border-[#2A174E] text-white shadow-md font-bold" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-[#2A174E] hover:text-[#2A174E]"
                          }`}
                        >
                          <span className={isSelected ? "text-yellow-400" : "text-slate-400"}>
                            {dObj.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                          </span>
                          <span>{dObj.toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })}</span>
                        </button>
                      );
                    }) : (
                      <div className="col-span-2 text-center py-4 text-slate-400 text-xs italic">
                        No periods configured. Please set the cycle first.
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount (₱)</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={batchForm.amount}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Employees</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="xs" onClick={selectAllEmployees} className="text-[10px] h-6 px-2 text-blue-600">Select All</Button>
                    <Button variant="ghost" size="xs" onClick={deselectAllEmployees} className="text-[10px] h-6 px-2 text-slate-400">Clear</Button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                  {employeeList.map(emp => (
                    <div 
                      key={emp.user_Id} 
                      onClick={() => toggleEmployeeSelection(emp.user_Id)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${batchForm.selectedEmployees.includes(emp.user_Id) ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${batchForm.selectedEmployees.includes(emp.user_Id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                        {batchForm.selectedEmployees.includes(emp.user_Id) && <CheckIcon className="text-white !text-[10px]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-700">{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleBatchSave} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white" disabled={loading}>
                {loading ? "Processing..." : "Apply Batch Update"}
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col items-center text-center">
                <p className="text-sm text-blue-800 mb-4">Download our CSV template, fill it out with employee data, and upload it here.</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-600 text-blue-600 hover:bg-blue-100">
                  <DownloadIcon className="mr-2 h-4 w-4" /> Download CSV Template
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-[#2A174E] transition-colors cursor-pointer relative">
                  <Input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <CloudUploadIcon className="text-slate-400 h-12 w-12 mb-2" />
                  <p className="text-sm font-medium text-slate-600">{file ? file.name : "Click or drag CSV file here"}</p>
                </div>
                <Button onClick={handleUpload} className="w-full bg-[#2A174E] hover:bg-[#1a0e30] text-white" disabled={!file || loading}>
                  {loading ? "Uploading..." : "Upload and Process CSV"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {toast.message && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">HMO Management</h1>
            <span className="text-sm text-slate-500 mt-1 block">
              Manage employee health insurance deductions, track employer/employee shares, and configure the billing cycle.
            </span>
          </div>
          <Button variant="outline" asChild className="border-[#2A174E] text-[#2A174E]">
            <Link to="/maxicare/history">
              <HistoryIcon className="mr-2 h-4 w-4" /> View Deduction History
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Policy Cycle</span>
            {queryYear && parseInt(queryYear) !== currentCycleYear ? (
              <div className="flex items-center gap-2 bg-[#2A174E] text-white px-4 py-1.5 rounded-lg font-bold shadow-sm">
                <HistoryIcon className="h-4 w-4 text-yellow-400" />
                <span>Cycle {selectedYear} - {selectedYear + Math.max(1, Math.ceil((config.monthsToPay || 12) / 12))}</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1 uppercase">Historical View</span>
              </div>
            ) : (
              <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                <SelectTrigger className="w-[200px] h-9 bg-white font-bold text-slate-700">
                  <SelectValue placeholder="Select Cycle" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => Math.min(new Date().getFullYear(), currentCycleYear) + i).map(year => {
                    const isCurrent = year === currentCycleYear;
                    const endYear = year + Math.max(1, Math.ceil((config.monthsToPay || 12) / 12));
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        Cycle {year} - {endYear} {isCurrent ? "(Current)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Main Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 w-full text-left font-sans">
          
          {/* Domain A: Policy Overview */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden border-t-5 border-[#2A174E] border-x border-x-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div className="w-full max-w-xs">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Total Gross Premium</p>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{peso(config.totalGross)}</p>
              </div>
              <div className={`text-right px-3 py-1.5 rounded-md border flex items-center gap-1 ${isUnconfigured ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                <SecurityIcon className={isUnconfigured ? 'text-amber-600 !text-sm' : 'text-blue-600 !text-sm'} />
                <p className={`text-sm font-semibold ${isUnconfigured ? 'text-amber-700' : 'text-blue-700'}`}>
                  {isUnconfigured ? 'Plan Preview' : 'Active Policy'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                <EventIcon className="text-slate-400 !text-base" />
                <span>Cycle Start: 
                  <span className="text-slate-900 font-semibold ml-1">
                    {config.cycleStartDate ? new Date(config.cycleStartDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Set'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 w-fit">
                <span>Renewal Period: <span className="text-slate-900 font-semibold">{getRenewalPeriod()}</span></span>
              </div>
            </div>
          </div>

          {/* Domain A.2: Active Subscribers */}
          <div className="border-t-5 border-[#2A174E] border-x border-x-slate-200 bg-white p-6 rounded-xl shadow-sm flex flex-col justify-center items-center text-center">
            <div className="h-12 w-12 bg-[#2A174E]/5 rounded-full flex items-center justify-center mb-4 border border-[#2A174E]/50">
              <GroupIcon className="text-[#2A174E]" />
            </div>
            <p className="text-5xl font-extrabold text-slate-900">{activeSubscribers}</p>
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mt-2">Active Subscribers</p>
            <p className="text-xs text-slate-400 mt-1">({getCycleLabel()})</p>
          </div>

          {/* Domain C: Amortization Details */}
          <div className="border border-slate-200 bg-[#2A174E] text-white p-6 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AccountBalanceWalletIcon style={{ fontSize: '100px' }} />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Cut-off Deduction</p>
                <p className="text-3xl font-bold text-white tracking-tight">{peso(deductionCutoff)}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <div className="text-sm text-slate-300 flex items-center gap-2">
                  Amortized over: 
                  <span className="text-white font-semibold">{config.monthsToPay}</span>
                  Months
                </div>
              </div>
            </div>
          </div>

          {/* Domain B: Financial Split */}
          <div className="md:col-span-2 border-t-5 border-[#2A174E] border-x border-x-slate-200 bg-white rounded-xl shadow-sm flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 h-full">
            <div className="flex-1 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="text-emerald-500 !text-base" />
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Employer Share ({employerShare}%)</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{peso(employerShareAmount)}</p>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="text-orange-500 !text-base" />
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Employee Share ({100 - employerShare}%)</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{peso(employeeShareAmount)}</p>
            </div>
          </div>

          {/* Domain D: YTD Tracking */}
         <div className="md:col-span-2 border-t-5 border-[#2A174E] border-x border-x-slate-200 bg-white p-6 rounded-xl shadow-sm h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="text-slate-400 !text-lg" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cycle Tracking ({getCycleLabel()})</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Annual Premium Billed</p>
                <p className="text-2xl font-bold text-slate-800">{peso(annualPremiumTotal)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Collected via Payroll</p>
                <p className="text-2xl font-bold text-slate-800">{peso(stats.totalPaid)}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Matrix Table Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4 mt-8">
          <h3 className="text-xl font-bold text-[#2A174E]">Employee Deduction History ({getCycleLabel()})</h3>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setShowCalculator(true);
                  }}
                  className="border-[#2A174E] text-[#2A174E] hover:bg-slate-50"
                  disabled={loading}
                >
                  <EditIcon className="mr-1 h-4 w-4" /> Edit Config
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setBatchForm(prev => ({ 
                      ...prev, 
                      dates: [],
                      amount: deductionCutoff > 0 ? deductionCutoff.toFixed(2) : "" 
                    }));
                    setShowBatchModal(true);
                  }}
                  className="border-[#2A174E] text-[#2A174E] hover:bg-slate-50"
                  disabled={loading || displayDates.length === 0}
                >
                  <GroupAddOutlinedIcon className="mr-1 h-4 w-4" /> Batch Upload
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (isEditingTable) {
                      saveSettings();
                    } else {
                      setIsEditingTable(true);
                    }
                  }}
                  className={`${isEditingTable ? 'bg-green-500 text-white hover:bg-green-600 border-transparent' : 'border-[#2A174E] text-[#2A174E] hover:bg-slate-50'}`}
                >
                  {isEditingTable ? <><CheckIcon className="mr-1 h-4 w-4" /> Save Table</> : <><EditIcon className="mr-1 h-4 w-4" /> Edit Table</>}
                </Button>

                {isEditingTable && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={addPeriod}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Add Period
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={clearYearTemplate}
                      className="border-rose-600 text-rose-600 hover:bg-rose-50"
                    >
                      Empty Months
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0">
          <div className="relative max-h-[65vh] overflow-auto w-full bg-white rounded-xl">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-[50] shadow-sm">
                <tr>
                  <th className="sticky left-0 top-0 z-[60] bg-[#1e1136] text-yellow-400 border-r-2 border-b-2 border-[#2A174E] p-3 min-w-[120px] align-middle text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    <div className="flex flex-col leading-tight">
                      <span className="text-[9px] font-black uppercase opacity-90">{getCycleLabel()}</span>
                      <span className="text-xs text-white font-bold">MONTHS / DATE</span>
                    </div>
                  </th>
                  {employeeList.map((emp) => (
                    <th key={emp.key} className="sticky top-0 z-[50] bg-[#2A174E] text-white border-x border-b-2 border-[#3d2270] min-w-[140px] p-3 text-center align-middle">
                      <div className="flex flex-col leading-tight items-center relative group">
                        <span className="text-[11px] font-bold uppercase">{emp.name.split(',')[0]}</span>
                        <span className="text-[9px] text-white/70 font-mono">{emp.id}</span>
                        
                        {isEditingTable && (
                          <div className="flex gap-1 mt-2">
                            <button 
                              onClick={() => emptyColumn(emp.key)}
                              className="bg-amber-500 hover:bg-amber-600 text-white p-1 rounded-sm transition-colors"
                              title="Empty this column"
                            >
                              <FilterListIcon className="!text-[10px]" />
                            </button>
                            <button 
                              onClick={() => deleteColumn(emp.key)}
                              className="bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-sm transition-colors"
                              title="Delete this column"
                            >
                              <DeleteIcon className="!text-[10px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-32 text-center text-slate-500 italic p-6">
                      Loading Maxicare data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-32 text-center text-red-500 p-6">
                      <p>Error: {error}</p>
                      <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">Retry Fetching Data</Button>
                    </td>
                  </tr>
                ) : displayDates.length > 0 ? (
                  <>
                    {displayDates.map((dateStr, i) => {
                      const dateObj = new Date(dateStr);
                      const monthLabel = dateObj.toLocaleDateString('en-PH', { month: 'short' });
                      const dayLabel = dateObj.getDate();
                      const isCurrentRow = dateStr === currentCutoffDate;
                      
                      return (
                        <tr key={dateStr} className={`hover:bg-slate-50 transition-colors ${isCurrentRow ? "bg-blue-50/30" : ""}`}>
                          <td className="sticky left-0 z-[40] bg-white border-r-2 border-b border-[#2A174E] p-3 align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {isEditingTable && expectedDates.includes(dateStr) ? (
                              <Input 
                                type="date" 
                                value={dateStr}
                                onChange={(e) => handleHeaderChange(expectedDates.indexOf(dateStr), e.target.value)}
                                className="h-8 text-xs font-bold text-[#2A174E] focus-visible:ring-blue-500"
                              />
                            ) : (
                              <div className="flex flex-col">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-[13px] text-[#2A174E]">{monthLabel} ({dateObj.getFullYear()})</span>
                                  {isEditingTable && (
                                    <button 
                                      onClick={() => removePeriod(dateStr)}
                                      className="text-rose-500 hover:text-rose-700 p-0.5 -mt-1"
                                      title="Remove this row"
                                    >
                                      <DeleteIcon className="!text-sm" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">{dayLabel}</span>
                                {isCurrentRow && <span className="bg-yellow-400 text-[#2A174E] text-[9px] font-black px-1 py-0.5 rounded w-fit mt-1">CURR</span>}
                              </div>
                            )}
                          </td>
                          {employeeList.map((emp) => {
                            const actualRecord = data.find(d => isInSamePeriod(d.date, dateStr));
                            let amount = 0;
                            let status = "unpaid";
                            let isProjection = false;

                            const userRate = parseFloat(emp.expectedDeduction) || 0;
                            const todayStr = systemToday ? formatDateLocal(systemToday) : "";

                            if (actualRecord && actualRecord.values[emp.key]) {
                              const record = actualRecord.values[emp.key];
                              if (record.status === 'paid' && record.amount > 0) {
                                amount = record.amount;
                                status = 'paid';
                              } else if (record.amount === 0) {
                                amount = 0;
                                status = 'removed';
                              } else if (!isUnconfigured) {
                                amount = userRate;
                                status = 'estimated';
                                isProjection = true;
                              }
                            } else {
                              if (!isUnconfigured && dateStr >= todayStr) {
                                amount = userRate;
                                status = 'estimated';
                                isProjection = true;
                              } else {
                                amount = 0;
                                status = 'unpaid';
                              }
                            }

                            const isEditing = editingCell?.date === dateStr && editingCell?.empKey === emp.key;
                            const isSyncing = syncingCell?.date === dateStr && syncingCell?.empKey === emp.key;

                            let cellClass = "border-r border-b border-slate-100 p-2 text-center align-middle font-mono text-[13px] relative select-none cursor-pointer group ";
                            if (isEditing) cellClass += "bg-white p-0 ";
                            else if (isSyncing) cellClass += "bg-yellow-50 ";
                            else if (status === 'paid') cellClass += "text-green-800 font-bold ";
                            else if (status === 'estimated') cellClass += "text-slate-400 italic ";
                            else if (status === 'removed') cellClass += "text-red-600 font-semibold opacity-80 ";
                            else cellClass += "text-slate-300 ";

                            return (
                              <td 
                                key={emp.key} 
                                className={cellClass}
                                onDoubleClick={() => handleCellDoubleClick(dateStr, emp.key, amount)}
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleCellSave(dateStr, emp.key)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleCellSave(dateStr, emp.key);
                                      }
                                    }}
                                    autoFocus
                                    className="w-full h-10 border-2 border-[#2A174E] bg-white text-center font-mono text-[13px] text-black font-bold outline-none"
                                  />
                                ) : isSyncing ? (
                                  <span className="text-[8px] font-black text-yellow-600 animate-pulse">SAVING...</span>
                                ) : (
                                  <>
                                    {isEditingTable && amount > 0 && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellSave(dateStr, emp.key, 0);
                                        }}
                                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-rose-700"
                                        title="Clear this cell"
                                      >
                                        <DeleteIcon className="!text-[10px]" />
                                      </button>
                                    )}
                                    {amount > 0 ? parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                    {isProjection && amount > 0 && <span className="absolute top-[2px] right-[2px] text-[8px] font-black bg-slate-200 text-slate-500 px-0.5 rounded leading-none not-italic">EST</span>}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                ) : (
                  <tr>
                    <td colSpan={employeeList.length + 1} className="h-64 text-center p-12">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="bg-slate-100 p-4 rounded-full">
                           <EventIcon className="h-8 w-8 text-slate-400" />
                        </div>
                        <div className="max-w-md">
                          <p className="text-slate-800 font-bold text-lg">No configuration found for {getCycleLabel()}</p>
                          <p className="text-slate-500 text-sm mt-1">
                            This renewal cycle has no planned periods or deduction history. You can initialize it using the 
                            <span className="font-bold text-[#2A174E]"> Edit Config</span> button above, or manually add periods by clicking 
                            <span className="font-bold text-[#2A174E]"> Edit Table</span>.
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowCalculator(true)}
                          className="bg-[#2A174E] text-white hover:bg-[#1a0e30]"
                        >
                          Initialize Cycle
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Footer Rows */}
              {displayDates.length > 0 && !loading && !error && (
                <tfoot className="sticky bottom-0 z-[50] shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                  {/* Subtotal Row */}
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <td className="sticky left-0 z-[60] bg-slate-100 border-r-2 border-t-2 border-[#2A174E] p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                      <span className="text-[11px] font-black tracking-wider text-[#2A174E]">CYCLE TOTAL</span>
                    </td>
                    {employeeList.map((emp) => {
                      const historicalDates = displayDates.filter(d => !currentCutoffDate || d < currentCutoffDate);
                      const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                        const period = data.find(d => isInSamePeriod(d.date, dateStr));
                        const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                        return acc + val;
                      }, 0);
                      return (
                        <td key={emp.key} className="border-r border-t-2 border-[#2A174E] border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-bold text-slate-900">
                          {parseFloat(empSubtotal).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Balance Row */}
                  <tr className="bg-slate-50">
                    <td className="sticky left-0 z-[60] bg-slate-50 border-r-2 border-t border-slate-300 p-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                      <span className="text-[11px] font-black tracking-wider text-[#2A174E]">BALANCE</span>
                    </td>
                    {employeeList.map((emp) => {
                      const historicalDates = displayDates.filter(d => !currentCutoffDate || d < currentCutoffDate);
                      const empSubtotal = historicalDates.reduce((acc, dateStr) => {
                        const period = data.find(d => isInSamePeriod(d.date, dateStr));
                        const val = (period && period.values[emp.key]) ? period.values[emp.key].amount : 0;
                        return acc + val;
                      }, 0);
                      
                      const isSubscriber = (parseFloat(emp.expectedDeduction) || 0) > 0 || empSubtotal > 0;
                      // Balance is usually against the whole cycle, but here we show it per year view.
                      // For simplicity, we'll keep the logic consistent with current view.
                      const balance = isSubscriber ? (employeeShareAmount - empSubtotal) : 0;

                      return (
                        <td key={emp.key} className={`border-r border-t border-slate-200 p-3 text-center align-middle font-mono text-[13px] font-black ${balance < 0 ? 'text-rose-600' : 'text-green-600'}`}>
                          {parseFloat(balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}

            </table>
          </div>
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default Maxicare;