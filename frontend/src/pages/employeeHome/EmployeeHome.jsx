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

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast({ ...toast, message: "" })} 
          />
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Employee Dashboard</h1>
              <span className="text-sm text-slate-500 mt-1 block">Overview of your attendance, leaves, and recent activity.</span>
            </div>
            <Button asChild className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-10 px-6">
              <Link to="/requests">
                Apply for a leave <ChevronRightOutlinedIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
            
            {/* Top Section: Attendance Overview */}
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50 rounded-t-xl">
                <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
                  <DashboardIcon className="h-5 w-5 text-slate-400" />
                  Attendance Overview <span className="text-slate-400 font-medium ml-1">({att.monthName || "Current Month"})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                {loading ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2 flex justify-around sm:justify-center sm:gap-8 flex-wrap items-center bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-inner">
                      <div className="w-20 md:w-24 text-center space-y-3">
                        <CircularProgressbar value={att.absent} maxValue={20} text={`${att.absent}`} styles={buildStyles({ pathColor: `#ef4444`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Absent</span>
                      </div>
                      <div className="w-20 md:w-24 text-center space-y-3">
                        <CircularProgressbar value={att.late} maxValue={20} text={`${att.late}`} styles={buildStyles({ pathColor: `#f59e0b`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Late</span>
                      </div>
                      <div className="w-20 md:w-24 text-center space-y-3 mt-4 sm:mt-0">
                        <CircularProgressbar value={att.onTime} maxValue={20} text={`${att.onTime}`} styles={buildStyles({ pathColor: `#22c55e`, textColor: '#2A174E', trailColor: '#e2e8f0', textSize: '24px' })} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">On-Time</span>
                      </div>
                    </div>

                    <div className="lg:col-span-3 flex flex-col justify-center space-y-6 px-2">
                      {[
                        { label: "Absent", val: att.absent, color: "bg-red-500" },
                        { label: "Late Arrivals", val: att.late, color: "bg-amber-500" },
                        { label: "On-Time / On-Field", val: att.onTime, color: "bg-green-500" }
                      ].map((item, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm font-bold text-slate-700">
                            <span className="uppercase tracking-wider text-xs">{item.label}</span>
                            <span className="text-slate-500">{item.val} day(s)</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(item.val / totalTrackedDays) * 100}%`, backgroundColor: item.color.replace('bg-', '') }}></div>
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.val / totalTrackedDays) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Recent Attendance & Leave Balances */}
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Attendance Timeline */}
                  <Card className="shadow-sm border-0 h-full flex flex-col border-t-4 border-[#2A174E]">
                    <CardHeader className="pb-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-[#2A174E] text-base font-bold uppercase tracking-wider">Attendance Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {dashboardStats.recentLogs.map((log, idx) => {
                          const isGood = log.status?.toLowerCase().includes('time') || log.status?.toLowerCase().includes('field');
                          return (
                            <div key={idx} className={`flex justify-between items-center p-3 border rounded-lg transition-all ${isGood ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                              <div className="flex items-center gap-3">
                                <History className={`h-4 w-4 ${isGood ? "text-green-600" : "text-red-600"}`} />
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{new Date(log.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</p>
                                  <p className="text-[10px] text-slate-500 font-medium">{log.timeIn} - {log.timeOut}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[10px] uppercase border-0 ${isGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {log.status}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Leave Balances */}
                  <Card className="shadow-sm border-t-4 border-[#3B4E17] p-6">
                    <h3 className="text-base font-semibold mb-4 text-[#3B4E17]">Leave Balances</h3>
                    <div className="space-y-6">
                      {[
                        { label: "Vacation (VL)", bal: balance.VL_balance, total: balance.VL_total, color: "bg-[#8DB552]" },
                        { label: "Sick (SL)", bal: balance.SL_balance, total: balance.SL_total, color: "bg-[#C0E990]" }
                      ].map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs font-bold mb-1"><span>{item.label}</span><span>{item.bal} / {item.total}</span></div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color}`} style={{ width: `${((item.total - item.bal) / item.total) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Recent Requests */}
                <Card className="shadow-sm border-0 border-t-4 border-[#3B4E17]">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-[#3B4E17] text-base font-bold uppercase tracking-wider">Recent Requests</CardTitle>
                    <Button variant="link" size="sm" asChild className="text-[#3B4E17] text-[11px] font-bold uppercase p-0 h-auto">
                      <Link to="/requests">View All <ChevronRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {recentRequests.map(req => {
                        const isApproved = req.status?.toLowerCase().includes("approve");
                        const boxStyle = isApproved ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100";
                        return (
                          <div key={req.emp_reqId} className={`flex items-center gap-3 p-3 rounded-lg border ${boxStyle}`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[#2A174E] truncate text-xs">{req.reqTypeName}</p>
                              <p className="text-[10px] font-semibold text-slate-500 truncate">{req.remarks || "No description"}</p>
                            </div>
                            <Badge className={`shrink-0 text-[9px] uppercase px-2 py-0.5 ${isApproved ? "bg-green-500" : "bg-amber-500"}`}>
                              {req.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Quick Actions & Recent Payslips */}
              <div className="lg:col-span-4 space-y-6">
                {/* Today's Log-In */}
                <Card className="border-t-4 border-[#2A174E] shadow-sm bg-[#FAF2FF]/30 p-6 flex flex-col justify-center items-center text-center">
                  <Clock className="h-10 w-10 text-[#2A174E] mb-2" />
                  <p className="text-sm font-bold text-[#2A174E]/50">Today's Log-In</p>
                  <p className="text-lg font-black text-[#2A174E]/90 mt-1">{dashboardStats.todayIn || "--:-- AM"}</p>
                </Card>

                {/* Quick Actions */}
                <Card className="shadow-sm border-t-4 border-[#B06E16]">
                  <CardHeader><CardTitle className="text-base text-[#B06E16]">Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full justify-start hover:bg-amber-50" variant="outline" asChild><Link to="/requests"><FileText className="mr-2 h-4 w-4"/> File Requests</Link></Button>
                    <Button className="w-full justify-start hover:bg-amber-50" variant="outline" asChild><Link to="/profile"><UserCheck className="mr-2 h-4 w-4"/> Update Profile</Link></Button>
                  </CardContent>
                </Card>

                {/* Recent Payslips */}
                <Card className="shadow-sm border-t-4 border-[#2A174E]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-[#2A174E]">Recent Payslips</CardTitle>
                    <Receipt className="h-4 w-4 text-slate-400" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? (
                      <Skeleton className="h-20 w-full rounded-xl" />
                    ) : payrolls.length > 0 ? (
                      payrolls.map((p) => (
                        <div key={p.payrollId} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2 group hover:border-[#2A174E]/30 transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Period End</p>
                              <p className="text-xs font-bold text-slate-800">{new Date(p.period_End).toLocaleDateString()}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-700 text-[9px] border-none">Released</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-black text-[#2A174E]">{formatCurrency(p.netPay)}</p>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" asChild>
                              <Link to={`/employee/payslip/${p.payrollId}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-xs italic">No released payslips yet.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>

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
