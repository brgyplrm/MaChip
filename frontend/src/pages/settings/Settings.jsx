import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SaveIcon from "@mui/icons-material/Save";
import MemoryIcon from "@mui/icons-material/Memory";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import PercentIcon from '@mui/icons-material/Percent';
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import FolderPicker from "../../components/FolderPicker";
import PayrollConfiguration from "@/components/PayrollConfiguration";
import AttendanceConfiguration from "@/components/AttendanceConfiguration";
import NotificationConfiguration from "@/components/NotificationConfiguration";
import PositionManagement from "@/components/PositionManagement";
import ReferenceDataManagement from "@/components/ReferenceDataManagement";
import { Clock, Coffee, ShieldAlert, CheckCircle, Info, Edit3, Save, Layers } from 'lucide-react';


// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const Settings = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  const { refreshSystemTime } = useSystemTime();
  const [realTime, setRealTime] = useState(new Date());
  const [activeSettingsTab, setActiveSettingsTab] = useState("simulation");

  // --- Retained States: Existing Configurations ---
  const [useMockTime, setUseMockTime] = useState(false);
  const [mockDate, setMockDate] = useState("");
  const [mockTime, setMockTime] = useState("");
  const [storageRootPath, setStorageRootPath] = useState("");
  const [mandatedMinimumWage, setMandatedMinimumWage] = useState(610.0);
  const [mandatedWageEffectiveDate, setMandatedWageEffectiveDate] = useState("2025-07-18");
  const [hardwareBufferWindow, setHardwareBufferWindow] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // --- Attendance Configuration States ---
  const [morningShiftStart, setMorningShiftStart] = useState("08:30");
  const [morningShiftEnd, setMorningShiftEnd] = useState("17:30");
  const [gracePeriod, setGracePeriod] = useState("08:35");
  const [lunchStartThreshold, setLunchStartThreshold] = useState("11:30");
  const [lunchEndThreshold, setLunchEndThreshold] = useState("13:30");
  const [lunchDuration, setLunchDuration] = useState(60);
  const [flexibleBreakThreshold, setFlexibleBreakThreshold] = useState(300);
  const [workHourThreshold, setWorkHourThreshold] = useState(4.0);

  // --- Dynamic States: Payroll Formulas & Variables ---
  const [payrollRates, setPayrollRates] = useState(null);
  const [sssRate, setSssRate] = useState(14);
  const [philhealthRate, setPhilhealthRate] = useState(5);
  const [pagibigEmployee, setPagibigEmployee] = useState(100);
  const [pagibigEmployer, setPagibigEmployer] = useState(100);
  const [thirteenthMonthBasis, setThirteenthMonthBasis] = useState("basic");
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.25);
  const [nightDiffMultiplier, setNightDiffMultiplier] = useState(1.10);

  useEffect(() => {
    const timer = setInterval(() => setRealTime(new Date()), 1000);
    fetchSettings();
    return () => clearInterval(timer);
  }, []);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/system/settings");
      if (response.ok) {
        const data = await response.json();
        
        // Map from Database Model names to Frontend State names
        setUseMockTime(data.mockTimeEnabled ?? false);
        
        if (data.mockTimeValue) {
          const dt = new Date(data.mockTimeValue);
          setMockDate(dt.toISOString().split('T')[0]);
          setMockTime(dt.toTimeString().split(' ')[0].substring(0, 5));
        }

        setStorageRootPath(data.storageRootPath ?? "");
        setMandatedMinimumWage(data.mandatedMinimumWage ?? 610.0);
        setMandatedWageEffectiveDate(data.mandatedWageEffectiveDate ?? "2025-07-18");
        setHardwareBufferWindow(data.hardwareBufferWindow ?? 5);

        // Load Attendance Settings
        if (data.morningShiftStart) setMorningShiftStart(data.morningShiftStart.substring(0, 5));
        if (data.morningShiftEnd) setMorningShiftEnd(data.morningShiftEnd.substring(0, 5));
        if (data.gracePeriod) setGracePeriod(data.gracePeriod.substring(0, 5));
        if (data.lunchStartThreshold) setLunchStartThreshold(data.lunchStartThreshold.substring(0, 5));
        if (data.lunchEndThreshold) setLunchEndThreshold(data.lunchEndThreshold.substring(0, 5));
        setLunchDuration(data.lunchDuration ?? 60);
        setFlexibleBreakThreshold(data.flexibleBreakThreshold ?? 300);
        setWorkHourThreshold(data.workHourThreshold ?? 4.0);
        
        const rates = data.payrollRates ?? null;
        setPayrollRates(rates);
        
        // Dynamically pull payroll constants if present in response records
        // Priority: 1. data.payroll (flat), 2. data.payrollRates.statutoryConstants (nested)
        const statData = data.payroll || rates?.statutoryConstants;
        if (statData) {
          // Handle both flat and nested structures
          if (statData.sss) {
            setSssRate((statData.sss.employee_rate * 100) || 14);
          } else if (statData.sssRate !== undefined) {
            setSssRate(statData.sssRate);
          }

          if (statData.philhealth) {
            setPhilhealthRate((statData.philhealth.rate * 100) || 5);
          } else if (statData.philhealthRate !== undefined) {
            setPhilhealthRate(statData.philhealthRate);
          }

          if (statData.hdmf) {
            // Simplified reverse mapping for the flat display
            setPagibigEmployee((statData.hdmf.ee_rate_high * 5000) || 100);
            setPagibigEmployer((statData.hdmf.er_rate * 5000) || 100);
          } else {
            if (statData.pagibigEmployee !== undefined) setPagibigEmployee(statData.pagibigEmployee);
            if (statData.pagibigEmployer !== undefined) setPagibigEmployer(statData.pagibigEmployer);
          }

          setThirteenthMonthBasis(statData.thirteenthMonthBasis ?? "basic");
          setOvertimeMultiplier(statData.overtimeMultiplier ?? 1.25);
          setNightDiffMultiplier(statData.nightDiffMultiplier ?? 1.10);
        }
      }
    } catch (error) {
      console.error("Error loading system configurations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (overrides = {}) => {
    if (!isAdmin) return;
    
    // [FIX] Prevent React SyntheticEvents from leaking into the payload
    // If the first argument has a nativeEvent or preventDefault, it's an event handler call, not a data override.
    const actualOverrides = (overrides && typeof overrides === 'object' && !overrides.nativeEvent && !overrides.preventDefault) 
      ? overrides 
      : {};

    setSaving(true);
    
    // Merge flat states into the nested structure to preserve extra fields (floor, ceiling, etc.)
    const consolidatedStatutory = (actualOverrides.payroll || payrollRates?.statutoryConstants) ? {
      ...(actualOverrides.payroll || payrollRates?.statutoryConstants),
      sss: { ...(actualOverrides.payroll || payrollRates?.statutoryConstants).sss, employee_rate: sssRate / 100 },
      philhealth: { ...(actualOverrides.payroll || payrollRates?.statutoryConstants).philhealth, rate: philhealthRate / 100 },
      hdmf: { ...(actualOverrides.payroll || payrollRates?.statutoryConstants).hdmf, ee_rate_high: pagibigEmployee / 5000, er_rate: pagibigEmployer / 5000 },
      thirteenthMonthBasis,
      overtimeMultiplier,
      nightDiffMultiplier
    } : {
      sssRate,
      philhealthRate,
      pagibigEmployee,
      pagibigEmployer,
      thirteenthMonthBasis,
      overtimeMultiplier,
      nightDiffMultiplier
    };

    const sanitize = (val) => {
      if (val === null || val === undefined || val === "") return 0;
      const str = val.toString().replace(/,/g, "");
      return parseFloat(str) || 0;
    };

    const payload = {
      useMockTime,
      mockDate,
      mockTime,
      storageRootPath,
      mandatedMinimumWage: sanitize(mandatedMinimumWage),
      mandatedWageEffectiveDate,
      hardwareBufferWindow: sanitize(hardwareBufferWindow),
      morningShiftStart,
      morningShiftEnd,
      gracePeriod,
      lunchStartThreshold,
      lunchEndThreshold,
      lunchDuration: Math.floor(sanitize(lunchDuration)),
      flexibleBreakThreshold: Math.floor(sanitize(flexibleBreakThreshold)),
      workHourThreshold: sanitize(workHourThreshold),
      payrollRates: actualOverrides.payrollRates || {
        ...payrollRates,
        statutoryConstants: consolidatedStatutory
      },
      payroll: actualOverrides.payroll || consolidatedStatutory,
      ...actualOverrides // Allow any other overrides
    };

    console.log("[DEBUG] Sending global configuration update:", payload);

    try {
      const response = await fetchWithAuth("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log("[DEBUG] Configuration update SUCCESSful.");
        showNotification("Global configurations updated successfully!");
        refreshSystemTime();
      } else {
        const errorData = await response.json();
        console.error("[DEBUG] Configuration update FAILED:", errorData);
        showNotification(`Failed to apply updated variables: ${errorData.error || "Unknown Error"}`, "error");
      }
    } catch (err) {
      console.error("[DEBUG] Network failure during configuration update:", err);
      showNotification("Network connection failure.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sidebar>
      <div className="p-2 md:p-0 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        <div className="flex-1 md:p-4 w-full overflow-x-hidden min-w-0">
          
          {/* Header Dashboard Title */}    
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Global Configurations</h1>
            <span className="text-sm text-slate-500 mt-1 block">Adjust platform constraints, system timing rules, variables, and financial formulas.</span>
          </div>

          {/* Integrated Tabbed Navigation controls */}
          <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div className="w-full sm:w-auto">
                <Select value={activeSettingsTab} onValueChange={setActiveSettingsTab}>
                  <SelectTrigger className="w-full sm:w-[320px] h-12 bg-white border-slate-200 shadow-sm text-slate-700 font-bold text-base rounded-xl hover:bg-slate-50/80 transition-all">
                    <SelectValue placeholder="Navigate Configurations" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                    <SelectItem value="simulation" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <SettingsSuggestIcon className="mr-3 h-5 w-5 text-[#2A174E]" /> System Variables
                      </div>
                    </SelectItem>
                    <SelectItem value="payroll" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <CurrencyExchangeIcon className="mr-3 h-5 w-5 text-[#2A174E]" /> Payroll Formulas
                      </div>
                    </SelectItem>
                    <SelectItem value="attendance" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <AccessTimeIcon className="mr-3 h-5 w-5 text-[#2A174E]" /> Attendance
                      </div>
                    </SelectItem>
                    <SelectItem value="notification" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <AccessTimeIcon className="mr-3 h-5 w-5 text-[#2A174E]" /> Notification
                      </div>
                    </SelectItem>
                    <SelectItem value="positions" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <AssuredWorkloadIcon className="mr-3 h-5 w-5 text-[#2A174E]" /> Salary Grades
                      </div>
                    </SelectItem>
                    <SelectItem value="referenceTables" className="py-3 rounded-lg focus:bg-slate-100 cursor-pointer">
                      <div className="flex items-center font-semibold text-slate-700">
                        <Layers className="mr-3 h-5 w-5 text-[#2A174E]" /> Ref Tables
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={saving}
                  className="bg-[#2A174E] hover:bg-[#3d2270] text-white font-bold px-6 h-[45px] shadow-md transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <SaveIcon className="h-4 w-4" /> Save Global Changes
                    </>
                  )}
                </Button>
              )}
            </div>

            
            

            {loading ? (
              <div className="p-12 text-center text-slate-400 italic">Syncing global parameters...</div>
            ) : (
              <>
              <div className="max-w-6xl w-full mx-auto space-y-6">
                {/* Tab 1: Mock Time Simulation (Your Entire Original Layout) */}
                <TabsContent value="simulation" className="space-y-6 mt-0 animate-in fade-in-50 duration-200">
                  <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                        <Clock className="w-6 h-6 text-purple-200" />
                      </div>
                      <div>
                        <h1 className="text-xl font-bold tracking-tight">System Configuration</h1>
                        <p className="text-sm text-purple-200/80 mt-0.5">Manage time, backup, and biometric synchronization</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <button 
                        className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
                        onClick={() => handleSaveSettings()}
                        disabled={!isAdmin || saving}
                      >
                        <Save className="w-4 h-4" /> <span>{saving ? "Saving..." : "Save Configuration"}</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
                    <Card className="xl:col-span-2 sm:col-span-3 border-slate-200/80 shadow-sm bg-white pt-4 pb-0">
                      <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2 font-bold">
                          <AccessTimeIcon className="text-[#2A174E]" /> Time Simulation Engine
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4">
                          <div className="space-y-1">
                            <Label className="text-base text-slate-800 font-bold block">Simulated Testing Engine</Label>
                            <span className="text-xs text-slate-500 block">Override structural platform date tracking using a persistent mock value.</span>
                          </div>
                          <Switch 
                            checked={useMockTime} 
                            onCheckedChange={setUseMockTime}
                            disabled={!isAdmin}
                          />
                        </div>

                        {useMockTime && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-amber-50/50 border border-amber-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <CalendarTodayIcon className="h-3.5 w-3.5" /> Mock Target Date
                              </Label>
                              <Input 
                                type="date"
                                value={mockDate}
                                onChange={(e) => setMockDate(e.target.value)}
                                disabled={!isAdmin}
                                className="bg-white border-slate-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <AccessTimeIcon className="h-3.5 w-3.5" /> Mock Clock Inception
                              </Label>
                              <Input 
                                type="time"
                                value={mockTime}
                                onChange={(e) => setMockTime(e.target.value)}
                                disabled={!isAdmin}
                                className="bg-white border-slate-200"
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="sm:col-span-3 xl:col-span-1 border-slate-200/80 shadow-sm bg-white pt-4 pb-0">
                      <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Environment Clock</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 flex flex-col justify-center items-center text-center h-[220px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Live Engine Standard Time</p>
                        <p className="text-4xl font-black text-[#2A174E] font-mono tracking-tight">
                          {realTime.toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                          {realTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="sm:grid-cols-1 col-span-3 border-slate-200/80 shadow-sm bg-white pt-4 pb-0">
                    <CardHeader className="border-b border-slate-100 pb-4">
                      <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2 font-bold">
                        <LocalAtmIcon className="text-[#2A174E]" /> Regulatory & Infrastructure
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                            Biometric Attendance Sync Buffer (Min)
                          </Label>
                          <Input 
                            type="text"
                            inputMode="decimal"
                            value={(hardwareBufferWindow || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              if (raw === '' || raw === '.' || !isNaN(raw)) {
                                // Keep the raw string state for intermediate typing (like "1.")
                                // But handle the numeric update
                                setHardwareBufferWindow(raw);
                              }
                            }}
                            onBlur={() => {
                              // Ensure it's a valid number on blur
                              setHardwareBufferWindow(parseFloat(hardwareBufferWindow) || 0);
                            }}
                            disabled={!isAdmin}
                            className="bg-white border-slate-200 w-full font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-slate-100">
                        <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Root Backup Storage Directory Path</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="text" 
                            placeholder="/var/data/machip/backups"
                            value={storageRootPath}
                            onChange={(e) => setStorageRootPath(e.target.value)}
                            disabled={!isAdmin}
                            className="bg-white border-slate-200 flex-1 font-mono text-xs"
                          />
                          {isAdmin && (
                            <Button variant="outline" onClick={() => setShowPicker(true)} className="border-slate-200 hover:bg-slate-50">
                              Browse...
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                </TabsContent>

                {/* Tab 2: Payroll Formulas Layout Configuration */}
                <TabsContent value="payroll" className=" mt-0 animate-in fade-in-50 duration-200">
                  <div className="gap-2">
                    <PayrollConfiguration 
                      data={payrollRates} 
                      onUpdate={async (newRates) => {
                        // 1. Update the local payrollRates state
                        setPayrollRates(newRates);
                        
                        // 2. Sync flat states from the nested statutoryConstants if they changed
                        if (newRates.payroll) {
                          const stat = newRates.payroll;
                          if (stat.sss?.employee_rate !== undefined) setSssRate(stat.sss.employee_rate * 100);
                          if (stat.philhealth?.rate !== undefined) setPhilhealthRate(stat.philhealth.rate * 100);
                          if (stat.hdmf?.ee_rate_high !== undefined) setPagibigEmployee(stat.hdmf.ee_rate_high * 5000);
                          if (stat.hdmf?.er_rate !== undefined) setPagibigEmployer(stat.hdmf.er_rate * 5000);
                        }

                        // 3. Call the centralized save function with all new rates
                        await handleSaveSettings(newRates);
                      }} 
                    />
                  </div>
                </TabsContent>

                {/* Tab 3: Attendance Configuration Layout (Your Retained Storage Paths) */}
                <TabsContent value="attendance" className=" mt-0 animate-in fade-in-50 duration-200">
                  <AttendanceConfiguration 
                    workStart={morningShiftStart} setWorkStart={setMorningShiftStart}
                    workEnd={morningShiftEnd} setWorkEnd={setMorningShiftEnd}
                    gracePeriod={gracePeriod} setGracePeriod={setGracePeriod}
                    lunchStart={lunchStartThreshold} setLunchStart={setLunchStartThreshold}
                    lunchEnd={lunchEndThreshold} setLunchEnd={setLunchEndThreshold}
                    lunchDuration={lunchDuration} setLunchDuration={setLunchDuration}
                    flexibleThreshold={flexibleBreakThreshold} setFlexibleThreshold={setFlexibleBreakThreshold}
                    workHourThreshold={workHourThreshold} setWorkHourThreshold={setWorkHourThreshold}
                    onSave={handleSaveSettings}
                    saving={saving}
                    isAdmin={isAdmin}
                  />
                </TabsContent>

                {/* Tab 4: Notification Configuration Layout */}
                <TabsContent value="notification" className=" mt-0 animate-in fade-in-50 duration-200">
                  <NotificationConfiguration/>
                </TabsContent>

                {/* Tab 5: Position Management (Salary Grades) */}
                <TabsContent value="positions" className=" mt-0 animate-in fade-in-50 duration-200">
                  <PositionManagement 
                    mandatedMinimumWage={mandatedMinimumWage} 
                    setMandatedMinimumWage={setMandatedMinimumWage}
                    mandatedWageEffectiveDate={mandatedWageEffectiveDate}
                    setMandatedWageEffectiveDate={setMandatedWageEffectiveDate}
                  />
                </TabsContent>

                {/* Tab 6: Reference Tables Management */}
                <TabsContent value="referenceTables" className=" mt-0 animate-in fade-in-50 duration-200">
                  <ReferenceDataManagement />
                </TabsContent>
                </div>
              </>
            )}
          </Tabs>
        </div>
      </div>

      {/* Directory Folder Picker Modal */}
      <FolderPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        currentPath={storageRootPath}
        onSelect={(path) => {
          setStorageRootPath(path);
          setShowPicker(false);
        }}
      />
    </Sidebar>
  );
};

export default Settings;