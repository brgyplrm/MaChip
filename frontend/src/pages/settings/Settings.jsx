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
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Settings = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const isAdmin = userData?.user_RoleId === 1 || userData?.user_RoleId === 4;

  const { refreshSystemTime } = useSystemTime();
  const [realTime, setRealTime] = useState(new Date());
  const [mockEnabled, setMockEnabled] = useState(false);
  const [mockTime, setMockTime] = useState("");
  const [vlRate, setVlRate] = useState(1.0);
  const [slRate, setSlRate] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setRealTime(new Date());
    }, 1000);

    const fetchSettings = async () => {
      try {
        const response = await fetchWithAuth("/api/system/settings");
        const data = await response.json();
        if (response.ok && data) {
          setMockEnabled(data.mockTimeEnabled);
          setVlRate(data.vlRate ?? 1.0);
          setSlRate(data.slRate ?? 1.0);
          if (data.mockTimeValue) {
            const date = new Date(data.mockTimeValue);
            const formatted = date.toISOString().slice(0, 16);
            setMockTime(formatted);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    return () => clearInterval(timer);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetchWithAuth("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockTimeEnabled: mockEnabled,
          mockTimeValue: mockEnabled ? mockTime : null,
          vlRate: parseFloat(vlRate),
          slRate: parseFloat(slRate),
        }),
      });
      if (response.ok) {
        await refreshSystemTime();
        showToast("System settings updated successfully!");
      } else {
        showToast("Failed to update settings.", "error");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast("Error connecting to server.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full max-w-[1200px] mx-auto overflow-x-hidden min-w-0">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">System Settings</h1>
            <span className="text-sm text-slate-500 mt-1 block">Manage core system configurations and operational environments.</span>
          </div>
          {isAdmin && (
            <Button 
              onClick={handleSaveSettings} 
              disabled={loading || saving}
              className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-11 px-6"
            >
              <SaveIcon className="mr-2 h-4 w-4" /> 
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center p-12 text-slate-400 animate-pulse">Loading configurations...</div>
        ) : (
          <div className="space-y-6">
            
            {/* Top Row: Conversion & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Leave Conversion Settings */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="border-b border-slate-100 pb-4 mb-4 bg-slate-50/50 rounded-t-xl">
                  <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2">
                    <CurrencyExchangeIcon className="h-5 w-5 text-slate-400" />
                    Leave Conversion Config
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vacation Leave (VL) Reward Rate</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={vlRate}
                      onChange={(e) => setVlRate(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="e.g. 1.0"
                      className="border-slate-200 focus-visible:ring-[#2A174E]"
                    />
                    <p className="text-xs text-slate-400">Multiplier applied to unused VL days during year-end conversion.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sick Leave (SL) Reward Rate</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={slRate}
                      onChange={(e) => setSlRate(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="e.g. 1.0"
                      className="border-slate-200 focus-visible:ring-[#2A174E]"
                    />
                    <p className="text-xs text-slate-400">Multiplier applied to unused SL days during year-end conversion.</p>
                  </div>
                </CardContent>
              </Card>

              {/* MaChip / System Status */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="border-b border-slate-100 pb-4 mb-4 bg-slate-50/50 rounded-t-xl">
                  <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2">
                    <MemoryIcon className="h-5 w-5 text-slate-400" />
                    MaChip Hardware Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authentication Mode</Label>
                      <p className="text-sm font-semibold text-slate-800">Biometrics + Microchip</p>
                    </div>
                    <MemoryIcon className="text-slate-300 h-8 w-8" />
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connection Status</Label>
                      <p className="text-sm font-semibold text-slate-800">Main Terminal Gateway</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 shadow-sm px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span> Online
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row: Time Environment */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b border-slate-100 pb-4 mb-4 bg-slate-50/50 rounded-t-xl">
                <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2">
                  <SettingsSuggestIcon className="h-5 w-5 text-slate-400" />
                  System Time Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Real Time Display */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Current Real-Time Engine</Label>
                    <p className="text-sm text-indigo-900/70">The absolute server time, regardless of mock settings.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[#2A174E] font-bold text-lg bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
                    <span className="flex items-center gap-1.5"><CalendarTodayIcon className="text-indigo-400 h-5 w-5" /> {realTime.toLocaleDateString()}</span>
                    <span className="text-indigo-200">|</span>
                    <span className="flex items-center gap-1.5"><AccessTimeIcon className="text-indigo-400 h-5 w-5" /> {realTime.toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Mock Time Controls */}
                <div className={`p-5 rounded-xl border transition-colors ${mockEnabled ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                      <Label htmlFor="mock-mode" className="text-sm font-bold text-slate-700 cursor-pointer">Enable Mock Time (Testing Mode)</Label>
                      <p className="text-xs text-slate-500 max-w-md">Overrides the global system time for all attendance and payroll calculations. Use strictly for testing future/past scenarios.</p>
                    </div>
                    <Switch 
                      id="mock-mode"
                      checked={mockEnabled} 
                      onCheckedChange={setMockEnabled}
                      disabled={!isAdmin}
                      className="data-[state=checked]:bg-[#2A174E]"
                    />
                  </div>

                  {mockEnabled && (
                    <div className="space-y-3 pt-4 border-t border-amber-200/50 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="mock-time" className="text-xs font-bold text-amber-700 uppercase tracking-wider">Set Simulated Date & Time</Label>
                      <Input 
                        id="mock-time"
                        type="datetime-local" 
                        value={mockTime}
                        onChange={(e) => setMockTime(e.target.value)}
                        disabled={!isAdmin}
                        className="bg-white border-amber-200 focus-visible:ring-amber-500 max-w-md"
                      />
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>
        )}

      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"} animate-in slide-in-from-bottom-5`}>
          {toast.type === "success" ? <CheckIcon fontSize="small" /> : <CloseIcon fontSize="small" /> }
          {toast.message}
        </div>
      )}
      </Sidebar>
    </div>
  );
};

export default Settings;