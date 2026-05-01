import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const userDataString = localStorage.getItem("userData");
      const userData = userDataString ? JSON.parse(userDataString) : null;
      const userId = userData?.user_Id;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth(`/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          // Optional: Update localStorage if backend data is newer
          localStorage.setItem("userData", JSON.stringify(data));
        } else {
          console.error("Failed to fetch profile");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
          <Card className="border-0 shadow-sm bg-white mb-6 p-8">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
              <Skeleton className="w-32 h-32 rounded-2xl" />
              <div className="space-y-4 text-center md:text-left flex-1">
                <Skeleton className="h-8 w-64 mx-auto md:mx-0" />
                <Skeleton className="h-6 w-32 mx-auto md:mx-0 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </Card>
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
        
        {/* Hero Section */}
        <Card className="border-0 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 md:p-10">
            
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-8 border-b border-slate-100">
              
              <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-6">
                <div className="shrink-0">
                  <img
                    src={user.user_ProfilePic ? `/api/uploads/${user.user_ProfilePic}` : "/avatar.webp"}
                    alt="Profile"
                    className="w-28 h-28 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-[#2A174E] shadow-sm"
                    onError={(e) => { e.target.src = "/avatar.webp"; }}
                  />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-[#2A174E] capitalize">
                    {user.user_FirstName} {user.user_LastName}
                  </h1>
                  <Badge variant="secondary" className="bg-[#f0ebfa] text-[#2A174E] hover:bg-[#e0d4f5] px-4 py-1.5 text-sm font-semibold tracking-wide">
                    {user.user_Role || "—"}
                  </Badge>
                </div>
              </div>

              <div className="w-full md:w-auto shrink-0 mt-4 md:mt-0">
                <Button asChild className="w-full md:w-auto bg-[#2A174E] hover:bg-[#1a0e30] text-white shadow-sm">
                  <Link to={`/users/edit/${user.user_Id}`}>
                    <EditOutlinedIcon className="mr-2 h-4 w-4" /> Edit Profile
                  </Link>
                </Button>
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 text-center md:text-left">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">User ID</span>
                <span className="text-lg font-bold text-slate-800 font-mono">{formatUserId(user.user_Id)}</span>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                <span className="text-lg font-semibold text-slate-800">{user.user_Email || "—"}</span>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">MaChip ID</span>
                <span className="text-lg font-semibold text-slate-800 font-mono">{user.user_MachipId || "—"}</span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Chart Section */}
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[700px]">
            <Chart
              aspect={4 / 1}
              title="Attendance Consistency (Last 6 Months)"
              userId={user.user_Id}
            />
          </div>
        </div>

        {/* Table Section */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-[#2A174E] mb-6">Personal Activity Logs</h2>
            <div className="overflow-x-auto">
              {/* Note: If your <Table> component internal to this route does not use Shadcn, ensure it has min-width settings to trigger scrolling here */}
              <div className="min-w-[800px]">
                <Table userId={user.user_Id} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      </Sidebar>
    </div>
  );
};

export default Profile;