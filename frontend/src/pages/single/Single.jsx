import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PaymentsIcon from "@mui/icons-material/Payments";
import WorkIcon from "@mui/icons-material/Work";
import { formatUserId } from "../../utils/formatUserId";
import { Link, useParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Single = () => {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminOrAccountant = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="border-0 shadow-sm bg-white lg:col-span-1 p-6">
               <div className="flex items-center gap-6 mb-6">
                 <Skeleton className="w-24 h-24 rounded-full shrink-0" />
                 <div className="space-y-3 flex-1">
                   <Skeleton className="h-6 w-3/4" />
                   <Skeleton className="h-4 w-1/2" />
                 </div>
               </div>
               <div className="space-y-4">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-full" />
               </div>
            </Card>
            <Card className="border-0 shadow-sm bg-white lg:col-span-2 p-6 flex justify-center items-center h-[500px] lg:h-[450px]">
              <Skeleton className="w-full h-full" />
            </Card>
          </div>
        </div>
        </Sidebar>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
        <div className="flex-1 flex justify-center items-center p-4">
          <p className="text-slate-500 italic">No user data found.</p>
        </div>
        </Sidebar>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0 space-y-6">

        {/* Top Section: Info Card & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User Info Card */}
          <div className="lg:col-span-1 flex flex-col items-center justify-start">
            <div className="w-full max-w-[320px] h-[450px] bg-white rounded-2xl shadow-xl relative overflow-hidden flex flex-col border border-gray-200">
              {isAdminOrAccountant && (
                <Button 
                  asChild 
                  variant="ghost" 
                  className="absolute top-4 right-4 z-20 text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0 rounded-full"
                >
                  <Link to={`/users/edit/${userId}`}>
                    <EditOutlinedIcon className="h-4 w-4" />
                  </Link>
                </Button>
              )}

              {/* Background Layers */}
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 z-0 bg-white">
                  {/* Layer 1: Green Wave (Thick Base) */}
                  <div className="absolute inset-0 bg-[#fea501] [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,70%20C40,60%2060,80%20100,70%20C140,60%20160,50%20200,50%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>

                  {/* Layer 2: White Wave (Ultra-thin middle layer) */}
                  <div className="absolute inset-0 bg-white [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,76%20C40,66%2060,86%20100,76%20C140,66%20160,56%20200,56%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>

                  {/* Layer 3: Blue Wave (The top-most wave) */}
                  <div className="absolute inset-0 bg-[#2A174E] [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,80%20C40,70%2060,90%20100,80%20C140,70%20160,60%20200,60%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>
                </div>
              </div>

              {/* Content Section */}
              <div className="relative z-10 flex flex-col h-full pt-8">
                <div className="px-6 text-center">
                  <div className="w-16 h-16 bg-white mx-auto mb-2 flex items-center justify-center font-bold text-[8px] text-gray-400 overflow-hidden">
                    <img src="/images.png" alt="Logo" />
                  </div>
                  <h1 className="text-[10px] font-bold text-[#2A174E] uppercase tracking-wider">MAC-J Int'l. Forwarding Ltd., Co.</h1>
                  <h2 className="text-[9px] font-bold text-[#2A174E] uppercase">JCG CUSTOMS BROKERAGE</h2>
                </div>

                {/* Profile Image */}
                <div className="flex-grow flex justify-center items-center">
                  <div className="w-32 h-32 rounded-full border-[6px] border-[#fea501] shadow-xl bg-gray-200 overflow-hidden relative">
                    <img
                      src={user.user_ProfilePic ? `/api/uploads/${user.user_ProfilePic}` : "/avatar.webp"}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "/avatar.webp"; }}
                    />
                  </div>
                </div>

                {/* Info Section */}
                <div className="pb-8 px-6 text-white text-center">
                  <h2 className="text-xl font-black uppercase leading-tight tracking-tight">
                    {user.user_FirstName} {user.user_LastName}
                  </h2>
                  <p className="text-[12px] font-semibold opacity-90">{user.user_Role || "Employee"}</p>
                  <p className="text-[11px] font-bold mt-2 tracking-widest">ID NO: {formatUserId(user.user_Id)}</p>
                  <div className="h-6"/>
                </div>
              </div>
            </div>

            {/* Additional Contact Info Items Below the ID Card */}
            <div className="w-full max-w-[320px] mt-4 space-y-2">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-tighter">Email Address</span>
                <span className="font-medium text-slate-700 truncate ml-4" title={user.user_Email}>{user.user_Email || "N/A"}</span>
              </div>
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-tighter">MaChip ID</span>
                <span className="font-mono font-bold text-[#2A174E]">{user.user_MachipId || "NONE"}</span>
              </div>
            </div>
          </div>

          {/* Chart Card */}
          <Card className="border-0 shadow-sm bg-white lg:col-span-2 overflow-hidden flex flex-col">
            <CardContent className="p-0 flex-1 relative min-h-[500px] lg:min-h-[450px]">
               <div className="absolute inset-0 w-full h-full overflow-x-auto overflow-y-hidden">
                 <div className="min-w-[500px] h-full p-4">
                    <Chart title="User Attendance (Last 6 Months)" userId={userId} />
                 </div>
               </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Middle Section: Gov't Breakdown & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Government Contributions Table */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden py-0">
            <div className="bg-[#2A174E] p-4">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <PaymentsIcon className="h-4 w-4 text-blue-200" /> Government Contributions (Monthly)
              </h2>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                      <th className="p-4 text-left">Deduction Name</th>
                      <th className="p-4 text-right">Employee</th>
                      <th className="p-4 text-right">Employer</th>
                      <th className="p-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const rate = parseFloat(user.dailyRate || 0);
                      const monthly = rate * 26;
                      
                      // SSS
                      const sss_msc = Math.min(Math.max(Math.round(monthly / 500) * 500, 5000), 35000);
                      const sss_ee = parseFloat(user.sss_Share || 0);
                      const sss_er = Math.round((sss_msc * 0.10 + (sss_msc >= 15000 ? 30 : 10)) * 100) / 100;
                      
                      // PhilHealth
                      const ph_clamped = Math.min(Math.max(monthly, 10000), 100000);
                      const ph_total = Math.round((ph_clamped * 0.05) * 100) / 100;
                      const ph_ee = ph_total / 2;
                      const ph_er = ph_total / 2;
                      
                      // HDMF
                      const hdmf_mfs = Math.min(monthly, 10000);
                      const hdmf_ee = parseFloat(user.hdmf_Share || 0);
                      const hdmf_er = Math.round(hdmf_mfs * 0.02);

                      const format = (v) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

                      return (
                        <>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-700">SSS Contribution</td>
                            <td className="p-4 text-right text-slate-600">{format(sss_ee)}</td>
                            <td className="p-4 text-right text-slate-600">{format(sss_er)}</td>
                            <td className="p-4 text-right font-bold text-[#2A174E]">{format(sss_ee + sss_er)}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-700">PhilHealth</td>
                            <td className="p-4 text-right text-slate-600">{format(ph_ee)}</td>
                            <td className="p-4 text-right text-slate-600">{format(ph_er)}</td>
                            <td className="p-4 text-right font-bold text-[#2A174E]">{format(ph_ee + ph_er)}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-700">HDMF (Pag-IBIG)</td>
                            <td className="p-4 text-right text-slate-600">{format(hdmf_ee)}</td>
                            <td className="p-4 text-right text-slate-600">{format(hdmf_er)}</td>
                            <td className="p-4 text-right font-bold text-[#2A174E]">{format(hdmf_ee + hdmf_er)}</td>
                          </tr>
                          <tr className="bg-slate-50 font-bold border-t-2 border-slate-100">
                            <td className="p-4 text-slate-800">Total Government</td>
                            <td className="p-4 text-right text-slate-800">{format(sss_ee + ph_ee + hdmf_ee)}</td>
                            <td className="p-4 text-right text-slate-800">{format(sss_er + ph_er + hdmf_er)}</td>
                            <td className="p-4 text-right text-blue-700">{format(sss_ee + ph_ee + hdmf_ee + sss_er + ph_er + hdmf_er)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Additional Professional Details Card */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden py-0">
            <div className="bg-[#2A174E] p-4">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <WorkIcon className="h-4 w-4 text-blue-200" /> Professional Details
              </h2>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-y-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Daily Rate</span>
                  <span className="text-lg font-bold text-slate-800">₱{parseFloat(user.dailyRate || 0).toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</span>
                  <span className="font-semibold text-slate-700">{user.department || "General"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Position</span>
                  <span className="font-semibold text-slate-700">{user.position || "Employee"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Hired</span>
                  <span className="font-semibold text-slate-700">{user.hireDate || "N/A"}</span>
                </div>

                {/* Bank Details Section */}
                <div className="col-span-2 pt-4 mt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Institution</span>
                    <span className="font-semibold text-slate-700 text-xs">{user.bank_Company || "N/A"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Name</span>
                    <span className="font-semibold text-slate-700 text-xs">{user.bank_AccountName || "N/A"}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Number</span>
                    <span className="font-mono font-bold text-[#2A174E] tracking-widest">
                      {user.account_Number || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Activity Log Table */}
        <Card className="border-0 shadow-sm bg-white py-0">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-[#2A174E] mb-6">Last Activity Log</h2>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <Table userId={userId} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      </Sidebar>
    </div>
  );
};

export default Single;
