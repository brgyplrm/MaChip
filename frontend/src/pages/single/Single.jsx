import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PaymentsIcon from "@mui/icons-material/Payments";
import { formatUserId } from "../../utils/formatUserId";
import { Link, useParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";
import PaymentsIcon from "@mui/icons-material/Payment";

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
            <Card className="border-0 shadow-sm bg-white lg:col-span-2 p-6 flex justify-center items-center h-[300px]">
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
          <Card className="border-0 shadow-sm bg-white lg:col-span-1 relative overflow-hidden">
            {isAdminOrAccountant && (
              <Button 
                asChild 
                variant="ghost" 
                className="absolute top-2 right-2 text-[#7451f8] hover:bg-[#7451f8]/10 bg-[#7451f8]/5 h-8 px-3 rounded-bl-xl rounded-tr-xl rounded-tl-sm rounded-br-sm"
              >
                <Link to={`/users/edit/${userId}`}>
                  <EditOutlinedIcon className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Link>
              </Button>
            )}
            
            <CardContent className="p-6 pt-10">
              <div className="flex flex-col sm:flex-row lg:flex-col items-center sm:items-start lg:items-center gap-6 mb-8 text-center sm:text-left lg:text-center">
                <img
                  src={user.user_ProfilePic ? `/api/uploads/${user.user_ProfilePic}` : "/avatar.webp"}
                  alt="Profile"
                  className="w-28 h-28 rounded-full object-cover border-4 border-[#2A174E] shadow-sm shrink-0"
                  onError={(e) => { e.target.src = "/avatar.webp"; }}
                />
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-slate-800 capitalize">
                    {user.user_FirstName} {user.user_LastName}
                  </h1>
                  <Badge variant="secondary" className="bg-[#f0ebfa] text-[#2A174E] hover:bg-[#e0d4f5] font-semibold">
                    {user.user_Role || "Employee"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-500">User ID:</span>
                  <span className="font-mono font-medium text-slate-800 bg-slate-50 px-2 py-0.5 rounded">{formatUserId(user.user_Id)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[180px]" title={user.user_Email}>{user.user_Email || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-500">MaChip:</span>
                  <span className="font-mono font-medium text-slate-800 bg-slate-50 px-2 py-0.5 rounded">{user.user_MachipId || "N/A"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart Card */}
          <Card className="border-0 shadow-sm bg-white lg:col-span-2 overflow-hidden flex flex-col">
            <CardContent className="p-0 flex-1 relative min-h-[300px]">
               <div className="absolute inset-0 w-full h-full overflow-x-auto overflow-y-hidden">
                 <div className="min-w-[500px] h-full">
                    <Chart aspect={3 / 1} title="User Attendance (Last 6 Months)" userId={userId} />
                 </div>
               </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Middle Section: Gov't Breakdown & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Government Contributions Table */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
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
          <Card className="border-0 shadow-sm bg-white p-6">
            <h2 className="text-lg font-bold text-[#2A174E] mb-6 border-b border-slate-50 pb-4">Professional Details</h2>
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
            </div>
          </Card>
        </div>

        {/* Bottom Section: Activity Log Table */}
        <Card className="border-0 shadow-sm bg-white">
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
