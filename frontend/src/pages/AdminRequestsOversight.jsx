import React, { useState, useEffect } from "react";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from "@mui/icons-material/Attachment";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GroupIcon from "@mui/icons-material/Group";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

// Mocked components and utilities to resolve missing local files in preview environment
const Toast = ({ message, type, onClose }) => message ? <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[100] text-white ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} cursor-pointer`} onClick={onClose}>{message}</div> : null;
const formatUserId = (id) => String(id).padStart(4, '0');
const fetchWithAuth = async () => ({ ok: true, json: async () => ([]) });

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const AdminRequestsOversight = () => {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Track which requests have been nudged in this session
  const [notifiedRequests, setNotifiedRequests] = useState(new Set());
  const [adminNote, setAdminNote] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/request/all");
      const data = await response.json();
      if (response.ok) {
        // For oversight, we primarily care about pending items (Status 1 & 4)
        setRequests(data.filter(r => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4));
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    window.addEventListener("dataRefresh", fetchRequests);
    return () => window.removeEventListener("dataRefresh", fetchRequests);
  }, []);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleNotifyApprover = async (emp_reqId, statusId) => {
    // In a real app, this would hit an endpoint like /api/request/notify
    // For this restructuring, we simulate the successful notification
    try {
      // Simulate API call delay
      setToast({ message: "Sending notification to approver...", type: "success" });
      
      setTimeout(() => {
        setNotifiedRequests(prev => new Set([...prev, emp_reqId]));
        setToast({ message: "Reminder successfully sent to the pending approver!", type: "success" });
        setAdminNote(""); // Clear note after sending
      }, 800);

    } catch (error) {
      setToast({ message: "Failed to send notification", type: "error" });
    }
  };

  const current = requests.length > selectedIdx ? requests[selectedIdx] : null;

  const getShortType = (typeName) => {
    if (!typeName) return "REQ";
    const name = typeName.toLowerCase();
    if (name.includes("vacation")) return "VL";
    if (name.includes("sick")) return "SL";
    if (name.includes("overtime")) return "OT";
    if (name.includes("onfield")) return "OW";
    if (name.includes("correction")) return "LC";
    if (name.includes("emergency")) return "EL";
    if (name.includes("half-day")) return "HD";
    return "REQ";
  };

  const getDates = (req) => {
    if (!req) return "";
    return req.VL_StartDate
      ? `${req.VL_StartDate} — ${req.VL_EndDate}`
      : req.SL_StartDate
        ? `${req.SL_StartDate} — ${req.SL_EndDate}`
        : req.OT_DateOf
          ? `${req.OT_DateOf} (${formatTime(req.HrFrom)} - ${formatTime(req.HrTo)})`
          : req.LC_logDate
            ? req.LC_logDate
            : req.EL_DateOfLeave
              ? req.EL_DateOfLeave
              : req.HD_DateOfLeave
                ? req.HD_DateOfLeave
                : req.DateonField;
  };

  const getTypeColor = (shortType) => {
    switch (shortType) {
      case "VL": return "bg-indigo-100 text-indigo-800 border-transparent";
      case "SL": return "bg-red-100 text-red-800 border-transparent";
      case "OW": return "bg-orange-100 text-orange-800 border-transparent";
      case "OT": return "bg-blue-100 text-blue-800 border-transparent";
      case "LC": return "bg-emerald-100 text-emerald-800 border-transparent";
      default: return "bg-slate-100 text-slate-800 border-transparent";
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
        
        {/* Statistics Row - Focused on Oversight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm border-0 py-0 bg-white">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-slate-500">Total Pending Requests</span>
                <p className="text-3xl font-bold text-[#2A174E] mt-1">{requests.length}</p>
              </div>
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                <HourglassEmptyIcon className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 py-0 bg-white">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-slate-500">Awaiting Recommendation</span>
                <p className="text-3xl font-bold text-orange-600 mt-1">{requests.filter((r) => r.emp_reqStatusId === 1).length}</p>
              </div>
              <div className="bg-orange-50 text-orange-600 p-3 rounded-xl">
                <GroupIcon className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 py-0 bg-white">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-slate-500">Awaiting Final Approval</span>
                <p className="text-3xl font-bold text-blue-600 mt-1">{requests.filter((r) => r.emp_reqStatusId === 4).length}</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                <AccessTimeIcon className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Split Content */}
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
          
          {/* Left: Request Queue */}
          <Card className="w-full lg:w-1/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-[#2A174E]">Oversight Queue</h3>
              <Badge variant="secondary" className="bg-white border-slate-200">{requests.length} Actionable</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 py-4">
              {loading ? (
                <div className="text-center py-8 text-slate-500 animate-pulse">Syncing pending requests...</div>
              ) : requests.length > 0 ? (
                requests.map((req, index) => {
                  const isNotified = notifiedRequests.has(req.emp_reqId);
                  return (
                    <div
                      key={req.emp_reqId}
                      onClick={() => setSelectedIdx(index)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all relative overflow-hidden ${selectedIdx === index ? "bg-[#f0ebfa] border-[#2A174E] shadow-sm" : "border-slate-200 bg-white hover:border-[#2A174E]/50"}`}
                    >
                      {isNotified && (
                        <div className="absolute top-0 right-0 w-2 h-full bg-green-500" title="Reminder Sent" />
                      )}
                      <div className="flex justify-between items-center mb-2 pr-2">
                        <Badge variant="outline" className={getTypeColor(getShortType(req.reqTypeName))}>
                          {getShortType(req.reqTypeName)}
                        </Badge>
                        <span className="text-xs text-slate-400 font-medium">{req.date_Filed}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm mb-1">{req.userName}</p>
                      <div className="flex justify-between items-end mt-2 pr-2">
                        <p className="text-xs text-slate-500">{getDates(req)}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${req.emp_reqStatusId === 1 ? 'text-orange-600' : 'text-blue-600'}`}>
                          {req.emp_reqStatusId === 1 ? 'Needs Rec' : 'Needs Appr'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl mt-2">
                  <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4">
                    <MarkEmailReadIcon className="h-8 w-8" />
                  </div>
                  <h5 className="font-bold text-[#2A174E] text-lg mb-2">Zero Bottlenecks</h5>
                  <p className="text-sm text-slate-500 max-w-[200px]">
                    There are no pending requests stuck in the approval pipeline.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Right: Detailed Review & Notification Panel */}
          <Card className="w-full lg:w-2/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-2">
            <CardContent className="flex-1 overflow-y-auto p-6 md:p-8">
              {current ? (
                <>
                  {/* Header / Primary Action Area */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-[#2A174E]">Review {current.reqTypeName}</h3>
                      <p className="text-sm text-slate-500 mt-1">Submitted by <span className="font-semibold text-slate-700">{current.userName}</span> on {current.date_Filed}</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                      {notifiedRequests.has(current.emp_reqId) ? (
                        <Button disabled className="w-full bg-green-50 text-green-700 border border-green-200 cursor-not-allowed">
                          <MarkEmailReadIcon className="mr-2 h-4 w-4" /> Reminder Sent
                        </Button>
                      ) : (
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:shadow-lg" 
                          onClick={() => handleNotifyApprover(current.emp_reqId, current.emp_reqStatusId)}
                        >
                          <NotificationsActiveIcon className="mr-2 h-4 w-4 animate-pulse" /> Ping Approver
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Bottleneck Indicator */}
                  <div className={`mb-6 p-4 rounded-xl border ${current.emp_reqStatusId === 1 ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'} flex items-center justify-between`}>
                     <div>
                       <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current Bottleneck</p>
                       <p className={`font-semibold ${current.emp_reqStatusId === 1 ? 'text-orange-800' : 'text-blue-800'}`}>
                         {current.emp_reqStatusId === 1 ? "Waiting for Direct Manager Recommendation" : "Waiting for Final HR/Admin Approval"}
                       </p>
                     </div>
                     <HourglassEmptyIcon className={`h-6 w-6 opacity-50 ${current.emp_reqStatusId === 1 ? 'text-orange-600' : 'text-blue-600'}`} />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100 mb-6">
                    
                    <div className="space-y-1 sm:col-span-2 xl:col-span-3 pb-2 border-b border-slate-200">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested Schedule</label>
                      <p className="text-lg font-bold text-[#2A174E]">{getDates(current)}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration / Amount</label>
                      <p className="font-semibold text-slate-800">
                        {current.emp_reqTypeId === 1
                          ? `${current.Total_Hrs || 0} Hrs`
                          : current.emp_reqTypeId === 2
                            ? `${current.OW_NoDays || 0} Day(s) (${current.OW_NoHrs || 0} Hrs)`
                            : current.emp_reqTypeId === 5
                              ? `${current.LC_correctionCategory || "Correction"}`
                              : current.emp_reqTypeId === 6
                                ? `${current.EL_NoDays || 0} Day(s)`
                                : current.emp_reqTypeId === 7
                                  ? `Half-day (${current.HD_period})`
                                  : `${current.VL_NoDays || current.SL_NoDays || 0} Day(s)`}
                      </p>
                    </div>

                    {current.emp_reqTypeId === 1 && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time From</label>
                          <p className="font-semibold text-slate-800">{formatTime(current.HrFrom)}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time To</label>
                          <p className="font-semibold text-slate-800">{formatTime(current.HrTo)}</p>
                        </div>
                      </>
                    )}

                    {current.emp_reqTypeId === 5 && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System In</label>
                          <p className="font-semibold text-slate-800">{current.LC_currentIn || "No Log"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Out</label>
                          <p className="font-semibold text-slate-800">{current.LC_currentOut || "No Log"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested In</label>
                          <p className="font-bold text-blue-700">{formatTime(current.LC_claimedIn)}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested Out</label>
                          <p className="font-bold text-blue-700">{formatTime(current.LC_claimedOut)}</p>
                        </div>
                      </>
                    )}

                    {(current.SL_proof_File || current.OW_proof_File || current.LC_proof_File) && (
                      <div className="space-y-1 col-span-1 sm:col-span-2 xl:col-span-3 pt-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supporting Documents</label>
                        <div>
                          <a 
                            href={`/api/uploads/${current.SL_proof_File || current.OW_proof_File || current.LC_proof_File}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[#2A174E] bg-white border border-slate-200 px-3 py-2 rounded-md text-sm font-semibold hover:bg-slate-50 transition-colors mt-1 shadow-sm"
                          >
                            <AttachmentIcon className="mr-2 h-4 w-4 text-slate-400" /> View Attachment File
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3 border-t border-slate-200 pt-4 mt-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Remarks / Purpose</label>
                      <p className="text-sm text-slate-700 italic bg-white p-4 rounded-lg border border-slate-200">"{current.remarks || "No additional context provided by employee."}"</p>
                    </div>
                  </div>

                  {/* Notification Context Box */}
                  {!notifiedRequests.has(current.emp_reqId) && (
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        Add a note to your reminder ping <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <Textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="e.g., 'Please review this urgently for payroll cut-off...'"
                        className="h-20 resize-none focus-visible:ring-[#2A174E] bg-slate-50"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-8 p-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                    <div className="space-y-3">
                      <Skeleton className="h-8 w-[40%] " />
                      <Skeleton className="h-4 w-[20%]" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-full" />
                  </div>
                  
                  <div className="mb-6 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center px-4">
                    <Skeleton className="h-4 w-48" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-20"/>
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ))}
                    <div className="col-span-1 sm:col-span-2 xl:col-span-3 space-y-2 pt-4">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  </div>

                  <div className="text-center pt-8">
                    <p className="text-slate-400 font-medium italic flex items-center justify-center gap-2">
                       Select a request from the queue to review and ping approvers
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
    </div>
  );
};

export default AdminRequestsOversight;