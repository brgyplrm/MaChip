import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          console.error("Failed to fetch user data");
        }
      } catch (error) {
        console.error("Error connecting to server:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="flex-1 p-4 md:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Profile</h1>
              <span className="text-sm text-slate-500 mt-1 block">View and manage your personal information and activity history.</span>
            </div>
            {user && (
              <Button asChild className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm h-10">
                <Link to={`/users/edit/${user.user_Id}`}>
                  <EditOutlinedIcon className="mr-2 h-4 w-4" /> Edit Profile
                </Link>
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : !user ? (
            <div className="text-center p-12 text-slate-500 bg-white border border-slate-200 rounded-xl">
              User profile data could not be found.
            </div>
          ) : (
            <>
              {/* Hero Banner Section */}
              <Card className="bg-white border-0 shadow-sm mb-6 relative overflow-hidden">
                <div className="h-28 bg-gradient-to-r from-[#2A174E] to-[#45297e]"></div>
                <CardContent className="px-6 pb-6 pt-0 relative">
                  <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12">
                    <div className="w-28 h-28 rounded-full bg-white p-1.5 shadow-md">
                      <div className="w-full h-full rounded-full bg-[#f0ebfa] text-[#4a2b8c] flex items-center justify-center text-4xl font-black uppercase tracking-widest">
                        {user.user_FirstName?.[0]}{user.user_LastName?.[0]}
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">
                        {user.user_FirstName} {user.user_LastName}
                      </h2>
                      <p className="text-slate-500 flex items-center justify-center md:justify-start gap-2 mt-1.5 font-medium">
                        <EmailOutlinedIcon className="h-4 w-4" /> {user.user_Email || "No Email Provided"}
                      </p>
                    </div>
                    <div className="mb-3">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm">
                        Active Account
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dashboard Identity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full animate-in fade-in zoom-in-95 duration-200">
                
                {/* Card 1: Account ID */}
                <Card className="shadow-sm border-0 bg-[#2A174E] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-white uppercase tracking-wider mb-2">Account Identifier</p>
                        <p className="text-3xl font-bold text-white font-mono">{formatUserId(user.user_Id)}</p>
                      </div>
                      <p className="text-xs text-white/70 italic mt-4">System generated employee ID</p>
                    </div>
                    <div className="bg-white/10 text-white p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <BadgeOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Role */}
                <Card className="shadow-sm border-0 bg-[#3B4E17] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-white uppercase tracking-wider mb-2">System Role</p>
                        <p className="text-3xl font-bold text-white">{user.user_Role}</p>
                      </div>
                      <p className="text-xs text-white/70 italic mt-4">Current authorization access level</p>
                    </div>
                    <div className="bg-white/10 text-white p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <AdminPanelSettingsOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: MaChip */}
                <Card className="shadow-sm border-0 bg-[#ECC04B] py-0 h-full min-w-0">
                  <CardContent className="px-5 py-5 flex justify-between h-full">
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-white uppercase tracking-wider mb-2">MaChip Biometrics</p>
                        <p className="text-2xl font-bold text-white font-mono leading-tight max-w-[200px] truncate">
                          {user.user_MachipId || "Unlinked"}
                        </p>
                      </div>
                      <p className="text-xs text-white/70 italic mt-4">Hardware authentication token</p>
                    </div>
                    <div className="bg-white/20 text-[#D4AF37] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <FingerprintOutlinedIcon className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart Section */}
              <Card className="border-0 shadow-sm bg-white mb-6">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-800">Attendance Consistency (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 overflow-x-auto">
                  <div className="min-w-[700px]">
                    <Chart
                      aspect={4 / 1}
                      title="" // Title moved to CardHeader above
                      userId={user.user_Id}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Table Section */}
              <Card className="border-0 shadow-sm bg-white py-0">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-800">Personal Activity Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <Table userId={user.user_Id} />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </>
          )}
        </div>
      </Sidebar>
    </div>
  );
};

export default Profile;