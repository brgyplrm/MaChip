import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import { ChevronLeft } from "lucide-react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PaymentsIcon from "@mui/icons-material/Payments";
import WorkIcon from "@mui/icons-material/Work";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { useNavigate, Link, useParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const getMiddleInitial = (middleName) => {
  if (!middleName || !middleName.trim()) return "";
  return middleName
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + ".")
    .join("");
};

const Single = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Security & MaChip Reveal State
  const [isMachipRevealed, setIsMachipRevealed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminOrAccountant = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  const handleToggleMachip = () => {
    // If currently revealed, mask it back without requiring password
    if (isMachipRevealed) {
      setIsMachipRevealed(false);
      return;
    }

    // If masked, prompt for admin password verification before revealing
    setAdminPassword("");
    setPasswordError("");
    setShowAdminPassword(false);
    setShowPasswordModal(true);
  };

  const handleVerifyAdminPassword = async (e) => {
    if (e) e.preventDefault();
    if (!adminPassword || !adminPassword.trim()) {
      setPasswordError("Please enter your admin password.");
      return;
    }

    setVerifyingPassword(true);
    setPasswordError("");

    try {
      const res = await fetchWithAuth("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setIsMachipRevealed(true);
        setShowPasswordModal(false);
        setAdminPassword("");
        setPasswordError("");
        setToast({ message: "Admin authenticated. MaChip ID revealed.", type: "success" });
      } else {
        setPasswordError(result.error || "Incorrect password. Verification failed.");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setPasswordError("An error occurred during verification. Please try again.");
    } finally {
      setVerifyingPassword(false);
    }
  };

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
          
          {/* User Info Card with Hover Slide-in Back Button */}
          <div className="lg:col-span-1 flex flex-col items-center justify-start">
            <TooltipProvider>
              <div className="group flex items-start justify-center transition-all w-full">
                {/* Back Button: Slides in on hover, moving the ID card to the right */}
                <div className="w-0 overflow-hidden group-hover:w-12 transition-all duration-300 ease-in-out shrink-0 flex items-center justify-center pt-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(-1)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-primary hover:bg-slate-200/60 rounded-full h-10 w-10"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800">
                      Back to previous page
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* ID Card Wrapper & Contact Info */}
                <div className="flex flex-col items-center w-full max-w-[320px] transition-all duration-300 ease-in-out">
                  {/* ID Card */}
                  <div className="w-full h-[450px] bg-white rounded-2xl shadow-xl relative overflow-hidden flex flex-col border border-gray-200">
                    {isAdminOrAccountant && (
                      <Button 
                        asChild 
                        variant="ghost" 
                        className="absolute top-4 right-4 z-20 text-brand-primary hover:text-[#7A52B5] hover:bg-white/10 h-8 w-8 p-0 rounded-full"
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
                        <div className="absolute inset-0 bg-brand-primary [mask-image:url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%20200%20150%22%20preserveAspectRatio=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0,80%20C40,70%2060,90%20100,80%20C140,70%20160,60%20200,60%20L200,150%20L0,150%20Z%22%20fill=%22black%22/%3E%3C/svg%3E')] [mask-size:100%_100%] [mask-repeat:no-repeat]"></div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="relative z-10 flex flex-col h-full pt-8">
                      <div className="px-6 text-center">
                        <div className="w-16 h-16 bg-white mx-auto mb-2 flex items-center justify-center font-bold text-[8px] text-gray-400 overflow-hidden">
                          <img src="/images.png" alt="Logo" />
                        </div>
                        <h1 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">MAC-J Int'l. Forwarding Ltd., Co.</h1>
                        <h2 className="text-[9px] font-bold text-brand-primary uppercase">JCG CUSTOMS BROKERAGE</h2>
                      </div>

                      {/* Profile Image */}
                      <div className="flex-grow flex justify-center items-center">
                        <div className="w-32 h-32 rounded-full border-[6px] border-[#fea501] shadow-xl bg-gray-200 overflow-hidden relative flex items-center justify-center">
                          {user.user_ProfilePic ? (
                            <img
                              src={`/api/uploads/${user.user_ProfilePic}`}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                const fallback = e.target.nextSibling;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-full h-full bg-brand-primary items-center justify-center text-white text-3xl font-bold tracking-wider select-none ${user.user_ProfilePic ? "hidden" : "flex"}`}
                          >
                            {((user.user_FirstName?.trim().charAt(0) || "") + (user.user_LastName?.trim().charAt(0) || "")).toUpperCase() || "U"}
                          </div>
                        </div>
                      </div>

                      {/* Info Section */}
                      <div className="pb-8 px-6 text-white text-center">
                        <h2 className="text-xl font-black uppercase leading-tight tracking-tight">
                          {user.user_FirstName}{user.user_MiddleName?.trim() ? ` ${getMiddleInitial(user.user_MiddleName)}` : ""} {user.user_LastName}
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-brand-primary tracking-wider">
                          {user.user_MachipId
                            ? (isMachipRevealed ? user.user_MachipId : "••••••••••••")
                            : "NONE"}
                        </span>
                        {user.user_MachipId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={handleToggleMachip}
                                className="text-slate-400 hover:text-brand-primary transition-colors p-0.5 rounded focus:outline-none"
                              >
                                {isMachipRevealed ? (
                                  <VisibilityOffIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <VisibilityIcon sx={{ fontSize: 16 }} />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                              {isMachipRevealed ? "Hide MaChip ID" : "Verify Admin Password to View"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TooltipProvider>
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
            <div className="bg-brand-primary p-4">
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
                            <td className="p-4 text-right font-bold text-brand-primary">{format(sss_ee + sss_er)}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-700">PhilHealth</td>
                            <td className="p-4 text-right text-slate-600">{format(ph_ee)}</td>
                            <td className="p-4 text-right text-slate-600">{format(ph_er)}</td>
                            <td className="p-4 text-right font-bold text-brand-primary">{format(ph_ee + ph_er)}</td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-700">HDMF (Pag-IBIG)</td>
                            <td className="p-4 text-right text-slate-600">{format(hdmf_ee)}</td>
                            <td className="p-4 text-right text-slate-600">{format(hdmf_er)}</td>
                            <td className="p-4 text-right font-bold text-brand-primary">{format(hdmf_ee + hdmf_er)}</td>
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
            <div className="bg-brand-primary p-4">
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
                    <span className="font-mono font-bold text-brand-primary tracking-widest">
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
            <h2 className="text-lg font-bold text-brand-primary mb-6">Last Activity Log</h2>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <Table userId={userId} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ ...toast, message: "" })} 
      />

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl border-0 animate-in fade-in zoom-in duration-200">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <LockOutlinedIcon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-brand-primary">Security Verification Required</h2>
                <p className="text-xs text-slate-500 mt-2">
                  Please enter your admin password to reveal the hardware MaChip RFID credential.
                </p>
              </div>

              <form onSubmit={handleVerifyAdminPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Admin Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showAdminPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      className={`h-11 border-slate-200 pr-10 focus-visible:ring-brand-primary ${passwordError ? "border-red-500" : ""}`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showAdminPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 18 }} />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <span className="text-[11px] text-red-500 font-medium block mt-1">
                      {passwordError}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 border-slate-200"
                    disabled={verifyingPassword}
                    onClick={() => {
                      setShowPasswordModal(false);
                      setAdminPassword("");
                      setPasswordError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={verifyingPassword}
                    className="flex-1 h-11 bg-brand-primary hover:bg-brand-primary-hover text-white font-medium"
                  >
                    {verifyingPassword ? "Verifying..." : "Verify & View"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </Sidebar>
    </div>
  );
};

export default Single;
