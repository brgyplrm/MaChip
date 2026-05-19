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
import { Clock, Coffee, ShieldAlert, CheckCircle, Info, Edit3, Save } from 'lucide-react';

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
  const [hardwareBufferWindow, setHardwareBufferWindow] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // --- Dynamic States: Payroll Formulas & Variables ---
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
        setUseMockTime(data.useMockTime ?? false);
        setMockDate(data.mockDate ?? "");
        setMockTime(data.mockTime ?? "");
        setStorageRootPath(data.storageRootPath ?? "");
        setHardwareBufferWindow(data.hardwareBufferWindow ?? 5);
        
        // Dynamically pull payroll constants if present in response records
        if (data.payroll) {
          setSssRate(data.payroll.sssRate ?? 14);
          setPhilhealthRate(data.payroll.philhealthRate ?? 5);
          setPagibigEmployee(data.payroll.pagibigEmployee ?? 100);
          setPagibigEmployer(data.payroll.pagibigEmployer ?? 100);
          setThirteenthMonthBasis(data.payroll.thirteenthMonthBasis ?? "basic");
          setOvertimeMultiplier(data.payroll.overtimeMultiplier ?? 1.25);
          setNightDiffMultiplier(data.payroll.nightDiffMultiplier ?? 1.10);
        }
      }
    } catch (error) {
      console.error("Error loading system configurations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useMockTime,
          mockDate,
          mockTime,
          storageRootPath,
          hardwareBufferWindow,
          payroll: {
            sssRate,
            philhealthRate,
            pagibigEmployee,
            pagibigEmployer,
            thirteenthMonthBasis,
            overtimeMultiplier,
            nightDiffMultiplier
          }
        }),
      });

      if (response.ok) {
        showNotification("Global configurations updated successfully!");
        refreshSystemTime();
      } else {
        showNotification("Failed to apply updated variables.", "error");
      }
    } catch (err) {
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
            <div className="flex justify-between">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-3xl h-[55px]! bg-slate-200/60 p-1 rounded-lg mb-6">
              <TabsTrigger value="simulation" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2.5">
                <SettingsSuggestIcon className="mr-2 h-4 w-4" /> System Variables
              </TabsTrigger>
              <TabsTrigger value="payroll" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2.5">
                <CurrencyExchangeIcon className="mr-2 h-4 w-4" /> Payroll Formulas
              </TabsTrigger>
              <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2.5">
                  <AccessTimeIcon className="mr-2 h-4 w-4" /> Attendance
              </TabsTrigger>
              <TabsTrigger value="notification" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2.5">
                  <AccessTimeIcon className="mr-2 h-4 w-4" /> Notification
              </TabsTrigger>
            </TabsList>
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
                      <button className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition"
                              onClick={() => {
                      // Implement your save logic here, e.g.:
                      // saveConfiguration({ mockDate, mockTime, storageRootPath, hardwareBufferWindow });
                              console.log("Saving configuration...");
                            }}
                            disabled={!isAdmin}>
                        <Save className="w-4 h-4" /> <span>Save Configuration</span>
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
                        <MemoryIcon className="text-[#2A174E]" /> Core Infrastructure Backups
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-2">
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

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                          Biometric Attendance Synchronization Window Buffer (Minutes)
                        </Label>
                        <Input 
                          type="number" 
                          value={hardwareBufferWindow}
                          onChange={(e) => setHardwareBufferWindow(parseInt(e.target.value))}
                          disabled={!isAdmin}
                          className="bg-white border-slate-200 w-full sm:w-[120px] font-mono"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                </TabsContent>

                {/* Tab 2: Payroll Formulas Layout Configuration */}
                <TabsContent value="payroll" className=" mt-0 animate-in fade-in-50 duration-200">
                  <div className="gap-2">
                    <PayrollConfiguration/>
                  </div>
                </TabsContent>

                {/* Tab 3: Attendance Configuration Layout (Your Retained Storage Paths) */}
                <TabsContent value="attendance" className=" mt-0 animate-in fade-in-50 duration-200">
                  <AttendanceConfiguration/>
                </TabsContent>

                {/* Tab 4: Notification Configuration Layout (Your Retained Storage Paths) */}
                <TabsContent value="notification" className=" mt-0 animate-in fade-in-50 duration-200">
                  <NotificationConfiguration/>
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