import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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
