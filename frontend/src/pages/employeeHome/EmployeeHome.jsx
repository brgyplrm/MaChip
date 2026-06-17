import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import HistoryIcon from '@mui/icons-material/History';
import Toast from "../../components/toast/Toast";
import { Link } from "react-router-dom";
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { fetchWithAuth } from "../../utils/api";
import CreditCardIcon from '@mui/icons-material/CreditCard';

// Lucide Icons
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  History, 
  FileText,
  UserCheck,
  Receipt,
  Download
} from "lucide-react";

// Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeeHome = () => {
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const [dashboardStats, setDashboardStats] = useState({
    todayIn: "--:-- AM",
    attendance: { absent: 0, onTime: 0, late: 0, monthName: "" },
    leaveBalance: { VL_total: 7, VL_used: 0, VL_balance: 7, SL_total: 7, SL_used: 0, SL_balance: 7 },
    recentLogs: [],
    monthlyRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      const storedUser = JSON.parse(localStorage.getItem("userData"));
      if (!storedUser?.user_Id) return;
      
      setUserData(storedUser);
      const currentId = storedUser.user_Id;
      
      setLoading(true);
      try {
        const [statsRes, notifRes, payrollRes] = await Promise.all([
          fetchWithAuth(`/api/attendance/employee-dashboard/${currentId}`),
          fetchWithAuth(`/api/notifications/unread-count/${currentId}`),
          fetchWithAuth(`/api/payroll/my-history`)
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setDashboardStats(data);
        } else {
          setToast({ message: "Failed to load dashboard statistics.", type: "error" });
        }
        
        if (payrollRes.ok) {
          const payrollData = await payrollRes.json();
          setPayrolls(payrollData.slice(0, 3));
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (notifData.count > 0) {
            setToast({ message: `You have ${notifData.count} unread notification(s).`, type: "success" });
          }
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    window.addEventListener("storage", fetchDashboardData);
    window.addEventListener("dataRefresh", fetchDashboardData);
    
    return () => {
      window.removeEventListener("storage", fetchDashboardData);
      window.removeEventListener("dataRefresh", fetchDashboardData);
    };
  }, []);

  if (!userData) return null;

  const att = dashboardStats.attendance;
  const balance = dashboardStats.leaveBalance;
  const recentRequests = dashboardStats.monthlyRequests;
  const totalTrackedDays = (att.absent || 0) + (att.onTime || 0) + (att.late || 0) || 1;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  // Dynamic Greeting Logic (Match Admin)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast({ ...toast, message: "" })} 
          />
          
          {loading ? (
            <div className="space-y-6">
              <div className="mb-6">
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-[140px] border-none shadow-sm">
                    <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-4 w-full mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="h-2"></div>

              {/* Greeting Banner */}
              <div className="rounded-xl p-0 md:p-0 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white w-full">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight text-[#2A174E]">
                    {getGreeting()}, {userData?.user_FirstName || "User"}!
                  </h1>
                  <p className="text-[#2A174E]/80 text-sm md:text-base font-medium">
                    Here is your personal overview for {currentDate}.
                  </p>
                </div>
                
                <div className="shadow-sm hidden md:flex bg-white/10 px-5 py-3 rounded-lg backdrop-blur-sm border border-white/10 flex-col gap-1 items-start">
                  <p className="text-[10px] font-bold text-[#2A174E]/60 uppercase tracking-widest mb-0.5">Employee Portal</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse"></span>
                    <span className="text-sm font-semibold tracking-wide text-[#2A174E]">Active & Synced</span>
                  </div>
                </div>
              </div>

              {/* Border Top Widget Cards (Match Admin Style) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                <Card className="bg-gradient-to-t from-[#2A174E] to-[#4A2C7D] shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none">
                  <div className="absolute right-1 top-4 opacity-10">
                    <Clock size={160} className="text-white absolute -right-2 -top-2" strokeWidth={1} />
                  </div>
                  <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Today's Log-In</p>
                      <p className="text-4xl font-bold text-white">{dashboardStats.todayIn || "--:-- AM"}</p>
                    </div>
                    <p className="text-xs font-semibold text-white/70 italic mt-4">Your first recorded punch today</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-t from-[#3B4E17] to-[#5A6F2A] shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none">
                  <div className="absolute right-1 top-4 opacity-10">
                    <FileText size={160} className="text-white absolute -right-2 -top-2" strokeWidth={1} />
                  </div>
                  <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Available Leaves</p>
                      <p className="text-4xl font-bold text-white">
                        {(balance.VL_balance || 0) + (balance.SL_balance || 0)} <span className="text-xl opacity-80 font-medium">Days</span>
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-white/70 italic mt-4">VL: {balance.VL_balance} &nbsp;|&nbsp; SL: {balance.SL_balance}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-t from-[#B06E16] to-[#D4AF37] shadow-sm py-0 h-[140px] relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block outline-none">
                  <div className="absolute right-1 top-4 opacity-10">
                    <CreditCardIcon sx={{ fontSize: 160 }} className="text-white absolute -right-2 -top-2" />
                  </div>
                  <CardContent className="px-5 py-5 flex flex-col justify-between h-full relative z-10">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Latest Net Pay</p>
                      <p className="text-4xl font-bold text-white">
                        {payrolls.length > 0 ? formatCurrency(payrolls[0].netPay) : "₱0.00"}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-white/70 italic mt-4">From your most recent released payslip</p>
                  </CardContent>
                </Card>
              </div>

              <div className="h-4"></div>

              {/* Small Summary Section (Match Admin 3-column Layout) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-2 w-full">
                
                {/* Column 1: Attendance Breakdown */}
                <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col border-t-4 border-[#2A174E] h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-gray-500 font-medium">Arrival Breakdown <span className="text-xs opacity-70">({att.monthName || "Month"})</span></h2>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-between gap-4 mt-2">
                    <div className="flex justify-around w-full px-2">
                      <div className="w-20 md:w-24 text-center space-y-3">
                        <CircularProgressbar value={att.absent} maxValue={20} text={`${att.absent}`} styles={buildStyles({ pathColor: `#ef4444`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Absent</span>
                      </div>
                      <div className="w-20 md:w-24 text-center space-y-3">
                        <CircularProgressbar value={att.late} maxValue={20} text={`${att.late}`} styles={buildStyles({ pathColor: `#f59e0b`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Late</span>
                      </div>
                      <div className="w-20 md:w-24 text-center space-y-3">
                        <CircularProgressbar value={att.onTime} maxValue={20} text={`${att.onTime}`} styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">On-Time</span>
                      </div>
                    </div>
                    
                    <div className="w-full space-y-3 mt-auto">
                      {[
                        { label: "Absent", val: att.absent, color: "bg-red-500" },
                        { label: "Late Arrivals", val: att.late, color: "bg-amber-500" },
                        { label: "On-Time / On-Field", val: att.onTime, color: "bg-green-500" }
                      ].map((item, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="uppercase tracking-wider text-[10px]">{item.label}</span>
                            <span className="text-slate-500">{item.val} d</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${(item.val / totalTrackedDays) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 2: Recent Requests */}
                <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col border-t-4 border-[#3B4E17] h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-gray-500 font-medium">Recent Requests</h2>
                    <Link to="/requests" className="text-xs text-[#3B4E17]/60 font-semibold hover:underline hover:text-[#3B4E17]/80">View All</Link>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                    {recentRequests.length > 0 ? (
                      recentRequests.map(req => {
                        const isApproved = req.status?.toLowerCase().includes("approve");
                        const boxStyle = isApproved ? "border-green-500" : "border-[#D4AF37]";
                        return (
                          <div key={req.emp_reqId} className={`flex items-center gap-3 p-3.5 rounded-lg hover:bg-slate-100 transition-colors border-l-4 ${boxStyle} bg-slate-50/70 min-w-0`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#2A174E] truncate">{req.reqTypeName}</p>
                              <p className="text-[10px] text-gray-500 font-medium truncate">{req.remarks || "No description provided"}</p>
                            </div>
                            <Badge className={`shrink-0 text-[9px] uppercase px-2 py-0 border-0 ${isApproved ? "bg-green-500 text-white" : "bg-amber-500 text-white"}`}>
                              {req.status}
                            </Badge>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <FileText className="h-10 w-10 mb-3" />
                        <p className="text-xs font-medium">No recent requests found.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Recent Payslips & Actions */}
                <div className="bg-white p-6 rounded-xl shadow-sm text-[#B06E16] flex flex-col border-t-4 border-[#B06E16] h-[420px] min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[#033A55]/80 font-medium">Recent Payslips</h2>
                    <Link to="/employee/payroll" className="text-xs text-[#B06E16]/60 font-semibold hover:underline hover:text-[#B06E16]/80">View All</Link>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                    {payrolls.length > 0 ? (
                      payrolls.map((p) => (
                        <div key={p.payrollId} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-[#2A174E]/30 transition-all">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Period End</p>
                            <p className="text-xs font-bold text-slate-800">{new Date(p.period_End).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="text-sm font-black text-[#2A174E]">{formatCurrency(p.netPay)}</p>
                            <Link to={`/employee/payslip/${p.payrollId}`} className="text-[9px] font-bold text-blue-500 hover:underline mt-0.5">VIEW SLIP</Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                         <Receipt className="h-10 w-10 mb-3" />
                         <p className="text-xs font-medium">No released payslips.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="w-full text-xs hover:bg-[#3B4E17] hover:text-white hover:border-[#3B4E17] transition-colors" asChild>
                        <Link to="/requests">File Leave</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs hover:bg-[#2A174E] hover:text-white hover:border-[#2A174E] transition-colors" asChild>
                        <Link to="/profile">My Profile</Link>
                      </Button>
                    </div>
                  </div>
                </div>

              </div>

              <div className="h-6"></div>

              {/* Bottom Section: Timeline & Leave Balances */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full mb-8">
                
                {/* Attendance Timeline */}
                <Card className="xl:col-span-2 shadow-sm border-0 border-t-4 border-[#2A174E] bg-white h-[420px] flex flex-col">
                  <CardHeader className="pb-4 border-b border-slate-50 shrink-0">
                    <CardTitle className="text-[#2A174E] text-base font-bold uppercase tracking-wider flex items-center gap-2">
                      <HistoryIcon className="h-5 w-5" /> Attendance Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
                    <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                      {dashboardStats.recentLogs.map((log, idx) => {
                        const isGood = log.status?.toLowerCase().includes('time') || log.status?.toLowerCase().includes('field');
                        return (
                          <div key={idx} className={`flex justify-between items-center p-4 border rounded-lg transition-all ${isGood ? "bg-green-50/50 border-green-100" : "bg-amber-50/50 border-amber-100"}`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-2.5 rounded-full ${isGood ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                                <History className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{log.timeIn} &nbsp;—&nbsp; {log.timeOut}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[10px] uppercase border-0 font-bold px-2 py-1 ${isGood ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {log.status}
                            </Badge>
                          </div>
                        );
                      })}
                      {dashboardStats.recentLogs.length === 0 && (
                        <div className="text-center py-12 text-slate-400 italic text-sm h-full flex items-center justify-center">No recent logs found.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Leave Balances */}
                <Card className="shadow-sm border-0 border-t-4 border-[#3B4E17] bg-white flex flex-col h-[420px]">
                  <CardHeader className="pb-4 border-b border-slate-50 shrink-0">
                    <CardTitle className="text-[#3B4E17] text-base font-bold uppercase tracking-wider flex items-center gap-2">
                      <FileText className="h-5 w-5" /> Leave Balances
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex-1 flex flex-col justify-center gap-6">
                    {[
                      { label: "Vacation Leave (VL)", bal: balance.VL_balance, total: balance.VL_total, color: "bg-[#8DB552]", light: "bg-[#8DB552]/20" },
                      { label: "Sick Leave (SL)", bal: balance.SL_balance, total: balance.SL_total, color: "bg-[#C0E990]", light: "bg-[#C0E990]/30" }
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{item.label}</span>
                          <span className="text-2xl font-black text-slate-800">{item.bal} <span className="text-sm font-semibold text-slate-400">/ {item.total}</span></span>
                        </div>
                        <div className={`h-3 ${item.light} rounded-full overflow-hidden`}>
                          <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${((item.total - item.bal) / (item.total || 1)) * 100}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium text-right">{item.total - item.bal} days used</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

            </>
          )}

          <style dangerouslySetInnerHTML={{__html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
          `}} />
        </div>
      </Sidebar>
    </div>
  );
};

export default EmployeeHome;
