import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { fetchWithAuth } from "../../utils/api";
import { formatTime12h } from "../../utils/formatTime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HistoryIcon from '@mui/icons-material/History';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VisitorLogs = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const fetchVisitorLogs = useCallback(async () => {
    try {
      // Fetch logs specifically for Visitor User (ID 999)
      // The backend attendance controller handles user_Id filtering
      const response = await fetchWithAuth("/api/attendance/all?user_Id=999");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.map(log => ({
          ...log,
          time: formatTime12h(log.time_Logged),
          date: String(log.log_Date).split('T')[0]
        })));
      }
    } catch (err) {
      console.error("Error fetching visitor logs:", err);
    }
  }, []);

  useEffect(() => {
    fetchVisitorLogs();
    // Real-time polling for access events
    const interval = setInterval(fetchVisitorLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchVisitorLogs]);

  const handleOpenDoor = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/esp/visitor-access", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: "Door opening signal sent!", type: "success" });
        // Refresh logs immediately to show the "Opening" event
        await fetchVisitorLogs();
      } else {
        setToast({ message: data.message || "Failed to trigger visitor access", type: "error" });
      }
    } catch (err) {
      console.error("Error triggering visitor access:", err);
      setToast({ message: "Error connecting to server", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const dismissToast = () => setToast({ message: "", type: "success" });

  const today = new Date().toISOString().split('T')[0];
  const todayVisits = logs.filter(l => l.date === today && l.loggedStatusName.includes("Opening")).length;

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="flex flex-col w-full min-h-screen p-4 max-w-6xl mx-auto bg-slate-50/30">
        <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <HistoryIcon className="text-[#2A174E] h-8 w-8" />
              <h1 className="text-3xl font-bold text-[#2A174E]">Visitor Access</h1>
            </div>
            <p className="text-slate-500">Monitor manual entry logs and control hardware solenoid access.</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full md:w-auto">
                <Button 
                  onClick={handleOpenDoor} 
                  disabled={loading}
                  className="w-full bg-[#2A174E] hover:bg-[#3b206d] text-white px-8 py-7 rounded-2xl shadow-xl flex items-center gap-3 transition-all transform active:scale-95 group"
                >
                  <LockOpenIcon className="group-hover:rotate-12 transition-transform" />
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-bold uppercase tracking-wider leading-none">Open Door</span>
                    <span className="text-[10px] opacity-70 font-normal normal-case">Trigger Solenoid Signal</span>
                  </div>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
              Triggers a signal to the physical ESP32 solenoid lock to unlock the visitor entrance.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-t-4 border-[#2A174E] shadow-sm py-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Today's Total Entries</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Count of successful visitor access requests recorded today.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-4xl font-black text-[#2A174E]">{todayVisits}</p>
                <span className="text-slate-400 text-sm font-medium">{todayVisits <= 1 ? "visitor" : "vistors"}</span>
              </div>
              {/* <p className="italic text-[11px] text-slate-400 mt-3 leading-relaxed">
                Displays the total number of entries recorded for the current day.
              </p> */}
            </CardContent>
          </Card>
          
          <Card className="border-t-4 border-green-500 shadow-sm py-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Entry Detected</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Precise time the entry system last authorized visitor entry.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-black text-green-600">
                  {logs.find(l => l.loggedStatusName.includes("Opening"))?.time || "--:--"}
                </p>
                <span className="text-slate-400 text-sm font-medium">local time</span>
              </div>
              {/* <p className="italic text-[11px] text-slate-400 mt-3 leading-relaxed">
                Shows the precise time of the most recent authorized visitor access event.
              </p> */}
            </CardContent>
          </Card>

          <Card className="border-t-4 border-amber-500 shadow-sm hidden md:block py-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">System User</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    The standard virtual employee ID mapped to all guest logs for data integrity.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-black text-amber-600">VISITOR-999</p>
              </div>
              {/* <p className="italic text-[11px] text-slate-400 mt-3 leading-relaxed">
                The dedicated system account used to categorize and store all anonymous visitor logs.
              </p> */}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[#2A174E] font-bold py-5 px-8 uppercase text-xs tracking-widest">Date</TableHead>
                  <TableHead className="text-[#2A174E] font-bold py-5 uppercase text-xs tracking-widest">Time</TableHead>
                  <TableHead className="text-[#2A174E] font-bold py-5 uppercase text-xs tracking-widest">Event Description</TableHead>
                  <TableHead className="text-[#2A174E] font-bold py-5 uppercase text-xs tracking-widest text-right pr-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const isOpening = log.loggedStatusName.includes("Opening");
                    return (
                      <TableRow key={log.user_loggingId} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-5 px-8 font-semibold text-slate-700">{log.date}</TableCell>
                        <TableCell className="py-5 font-mono text-slate-600">{log.time}</TableCell>
                        <TableCell className="py-5">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isOpening ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                              <AccessTimeIcon className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-slate-800">{log.loggedStatusName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 text-right pr-8">
                          <Badge 
                            variant="secondary"
                            className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-tighter ${
                              isOpening 
                                ? "bg-green-100 text-green-700 hover:bg-green-100" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {isOpening ? "Authorized" : "Closed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <HistoryIcon className="h-12 w-12 mb-3 opacity-20" />
                        <p className="font-medium">No visitor logs found</p>
                        <p className="text-xs">Logs will appear here once the door is opened.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default VisitorLogs;
