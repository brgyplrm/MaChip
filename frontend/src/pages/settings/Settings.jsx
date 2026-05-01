import Sidebar from "../../components/Sidebar";
import { useState, useEffect } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SaveIcon from "@mui/icons-material/Save";
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
  const isAdmin = userData?.user_RoleId === 1;

  const { refreshSystemTime } = useSystemTime();
  const [realTime, setRealTime] = useState(new Date());
  const [mockEnabled, setMockEnabled] = useState(false);
  const [mockTime, setMockTime] = useState("");
  const [loading, setLoading] = useState(true);

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
    try {
      const response = await fetchWithAuth("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockTimeEnabled: mockEnabled,
          mockTimeValue: mockEnabled ? mockTime : null, 
        }),
      });
      if (response.ok) {
        await refreshSystemTime();
        alert("System settings updated successfully!");
      } else {
        alert("Failed to update settings.");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error connecting to server.");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-4 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">System Settings</h1>
          <span className="text-sm text-slate-500 mt-1 block">Manage system configurations and environments</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* System Preferences Card */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="border-b border-slate-100 pb-4 mb-4">
              <CardTitle className="text-lg text-[#2A174E]">MaChip Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Authentication Mode</span>
                <span className="font-semibold text-[#2A174E]">Biometrics + Microchip</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">System Status</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 w-fit">
                  Online
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Time Settings Card */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="border-b border-slate-100 pb-4 mb-4">
              <CardTitle className="text-lg text-[#2A174E]">System Time & Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Real-Time</span>
                <div className="flex items-center gap-4 text-[#2A174E] font-semibold">
                  <span className="flex items-center gap-1.5"><AccessTimeIcon className="text-slate-400 h-4 w-4" /> {realTime.toLocaleTimeString()}</span>
                  <span className="flex items-center gap-1.5"><CalendarTodayIcon className="text-slate-400 h-4 w-4" /> {realTime.toLocaleDateString()}</span>
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mock-mode" className="text-sm font-bold text-slate-500 uppercase tracking-wider cursor-pointer">Mock Time Enabled</Label>
                    <Switch 
                      id="mock-mode"
                      checked={mockEnabled} 
                      onCheckedChange={setMockEnabled}
                      className="data-[state=checked]:bg-[#2A174E]"
                    />
                  </div>

                  {mockEnabled && (
                    <div className="space-y-3 pt-2">
                      <Label htmlFor="mock-time" className="text-sm font-bold text-[#2A174E]">Set Mock Date & Time</Label>
                      <Input 
                        id="mock-time"
                        type="datetime-local" 
                        value={mockTime}
                        onChange={(e) => setMockTime(e.target.value)}
                        className="bg-white focus-visible:ring-[#2A174E]"
                      />
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 mt-2">
                    <Button onClick={handleSaveSettings} className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]">
                      <SaveIcon className="mr-2 h-4 w-4" /> Save Time Settings
                    </Button>
                  </div>
                </>
              )}

            </CardContent>
          </Card>

        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default Settings;