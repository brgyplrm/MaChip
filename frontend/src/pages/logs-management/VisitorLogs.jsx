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
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Visitor Access</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Monitor manual entry logs and control hardware solenoid access.</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full md:w-auto">
                <Button 
                  onClick={handleOpenDoor} 
                  disabled={loading}
                  className="w-full bg-[#2A174E] hover:bg-[#7A52B5] text-white px-6 py-5 rounded-xl shadow-sm flex items-center gap-3 transition-all transform active:scale-95 group"
                >
                  <LockOpenIcon className="group-hover:rotate-12 transition-transform" />
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold uppercase tracking-wider leading-none">Open Door</span>
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

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Today's Total Entries */}
          <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider">Today's Total Entries</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#2A174E]/60 hover:text-[#2A174E] cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Count of successful visitor access requests recorded today.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-4xl font-bold text-[#2A174E]">{todayVisits}</p>
                  <span className="text-slate-400 text-sm font-medium">{todayVisits === 1 ? "visitor" : "visitors"}</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[#2A174E]/70 italic mt-4">Total entries recorded for today</p>
            </CardContent>
          </Card>
          
          {/* Card 2: Last Entry Detected */}
          <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider">Last Entry Detected</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#3B4E17]/60 hover:text-[#3B4E17] cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Precise time the entry system last authorized visitor entry.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-bold text-[#3B4E17]">
                    {logs.find(l => l.loggedStatusName.includes("Opening"))?.time || "—"}
                  </p>
                  <span className="text-slate-400 text-sm font-medium">PHST (UTC+8)</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[#3B4E17]/70 italic mt-4">Most recent authorized guest entry</p>
            </CardContent>
          </Card>

          {/* Card 3: System User */}
          <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider">System User</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#BB8B26]/60 hover:text-[#BB8B26] cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      The standard virtual employee ID mapped to all guest logs for data integrity.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-bold text-[#BB8B26]">VISITOR-999</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-[#BB8B26]/70 italic mt-4">Virtual account mapped to guest logs</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-0 bg-white rounded-2xl overflow-hidden">
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
    </div>
  );
};

export default VisitorLogs;
