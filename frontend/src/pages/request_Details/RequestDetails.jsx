import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import DescriptionIcon from "@mui/icons-material/Description";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachmentIcon from "@mui/icons-material/Attachment";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";
import { formatUserId } from "../../utils/formatUserId";

// shadcn/ui components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RequestDetails = () => {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetchWithAuth(`/api/request/details/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          setRequest(data);
        } else {
          console.error("Failed to fetch request details");
        }
      } catch (error) {
        console.error("Error fetching request details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (requestId) {
      fetchDetails();
    }
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
        <div className="flex-1 p-4 md:p-8 w-full max-w-5xl mx-auto flex items-center justify-center">
          <p className="text-slate-500 italic animate-pulse">Loading request details...</p>
        </div>
        </Sidebar>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
        <div className="flex-1 p-4 md:p-8 w-full max-w-5xl mx-auto flex flex-col items-center justify-center gap-4">
          <p className="text-slate-500 italic">Request not found.</p>
          <button onClick={() => navigate(-1)} className="text-[#2A174E] font-semibold hover:underline">Go Back</button>
        </div>
        </Sidebar>
      </div>
    );
  }

  const statusClass = request.status?.toLowerCase() || "pending";
  const isApproved = statusClass.includes("approve");
  const isRejected = statusClass.includes("reject");

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full max-w-5xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0"
            >
              <ArrowBackIcon />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Request Details</h1>
              <span className="text-sm text-slate-500 font-mono mt-1 block">Request #REQ-{request.emp_reqId}</span>
            </div>
          </div>
          <Badge 
            className={`px-4 py-2 text-sm justify-center shadow-sm w-full sm:w-auto ${
              isApproved ? "bg-green-500 hover:bg-green-600 text-white" :
              isRejected ? "bg-red-500 hover:bg-red-600 text-white" :
              "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {isApproved && <CheckCircleIcon className="mr-2 h-4 w-4" />}
            {isRejected && <CancelIcon className="mr-2 h-4 w-4" />}
            {!isApproved && !isRejected && <HourglassEmptyIcon className="mr-2 h-4 w-4" />}
            {request.status}
          </Badge>
        </div>

        <div className="space-y-6">
          
          {/* Request Information */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 pb-4 mb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <DescriptionIcon className="text-slate-400 h-5 w-5" /> Request Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Employee Name</label>
                <p className="font-semibold text-slate-800">{request.userName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Request Type</label>
                <p className="font-semibold text-[#2A174E]">{request.reqTypeName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Submitted On</label>
                <p className="font-semibold text-slate-800">{new Date(request.date_Filed).toLocaleDateString()}</p>
              </div>

              {request.emp_reqTypeId === 1 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">OT Date</label>
                  <p className="font-semibold text-slate-800">{request.OT_DateOf}</p>
                </div>
              )}
              {request.emp_reqTypeId === 2 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Field Work Date</label>
                  <p className="font-semibold text-slate-800">{request.DateonField}</p>
                </div>
              )}
              {request.emp_reqTypeId === 5 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Log Date</label>
                    <p className="font-semibold text-slate-800">{request.LC_logDate}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Category</label>
                    <Badge variant="outline" className="mt-1">{request.LC_correctionCategory || "N/A"}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Specific Details Section */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 pb-4 mb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <CalendarTodayIcon className="text-slate-400 h-5 w-5" /> Specific Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              
              {/* Overtime Details */}
              {request.emp_reqTypeId === 1 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Time From</label>
                    <p className="font-semibold text-slate-800">{formatTime(request.HrFrom)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Time To</label>
                    <p className="font-semibold text-slate-800">{formatTime(request.HrTo)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Hours</label>
                    <p className="font-bold text-[#2A174E]">{request.Total_Hrs} Hrs</p>
                  </div>
                </>
              )}

              {/* On-field Details */}
              {request.emp_reqTypeId === 2 && (
                <>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Destination</label>
                    <p className="font-semibold text-slate-800">{request.destination}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Hours</label>
                    <p className="font-bold text-[#2A174E]">{request.OW_NoHrs} Hrs</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Days</label>
                    <p className="font-semibold text-slate-800">{request.OW_NoDays} Day(s)</p>
                  </div>
                </>
              )}

              {/* Log Correction Details */}
              {request.emp_reqTypeId === 5 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Current Time-In</label>
                    <p className="font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit">{request.LC_currentIn || "No Log"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Current Time-Out</label>
                    <p className="font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit">{request.LC_currentOut || "No Log"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Claimed Time-In</label>
                    <p className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded w-fit">{formatTime(request.LC_claimedIn)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Claimed Time-Out</label>
                    <p className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded w-fit">{formatTime(request.LC_claimedOut)}</p>
                  </div>
                </>
              )}

              {/* Leave Details (VL/SL) */}
              {(request.emp_reqTypeId === 3 || request.emp_reqTypeId === 4) && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
                    <p className="font-semibold text-slate-800">{request.VL_StartDate || request.SL_StartDate}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
                    <p className="font-semibold text-slate-800">{request.VL_EndDate || request.SL_EndDate}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Days</label>
                    <p className="font-bold text-[#2A174E]">{request.VL_NoDays || request.SL_NoDays} Day(s)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payment Status</label>
                    <p className="font-semibold text-slate-800">{request.VL_withPayName || request.SL_withPayName || "N/A"}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments (If any) */}
          {(request.SL_proof_File || request.OW_proof_File || request.LC_proof_File) && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-50 pb-4 mb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <AttachmentIcon className="text-slate-400 h-5 w-5" /> Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Proof Document</label>
                  <a 
                    href={`/api/uploads/${request.SL_proof_File || request.OW_proof_File || request.LC_proof_File}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[#2A174E] font-semibold hover:underline mt-1"
                  >
                    View Attached File
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reason / Remarks */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 pb-4 mb-4">
              <CardTitle className="text-lg text-slate-800">Employee Remarks / Purpose</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 italic bg-slate-50 p-4 rounded-xl border border-slate-100">"{request.remarks || "No details provided."}"</p>
            </CardContent>
          </Card>

          {/* Decision Section (Only if processed) */}
          {request.emp_reqStatusId !== 1 && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="border-b border-slate-50 pb-4 mb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <PersonIcon className="text-slate-400 h-5 w-5" /> Review Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Processed By</label>
                    <p className="font-semibold text-slate-800">{request.approverName ? `${request.approverName} (${formatUserId(request.processedBy)})` : "System"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Processed On</label>
                    <p className="font-medium text-slate-600">{request.date_Processed || "N/A"}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2A174E] uppercase tracking-wider block">Management Note / Remarks</label>
                  <p className="text-slate-700 bg-white p-4 rounded-xl border border-slate-200">
                    {request.admin_remarks || "No additional notes provided."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 pb-4 mb-4 bg-slate-50/50">
              <CardTitle className="text-lg text-slate-800">Request Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="ml-4 border-l-2 border-slate-200 space-y-8 py-2 relative">
                
                {/* Submit Event */}
                <div className="relative pl-8">
                  <div className="absolute -left-[17px] top-0.5 w-8 h-8 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm">
                    <AccessTimeIcon className="text-blue-500 h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Request Submitted</p>
                    <p className="text-sm text-slate-500 mt-0.5">{new Date(request.date_Filed).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Process Event (if applicable) */}
                {request.emp_reqStatusId !== 1 && (
                  <div className="relative pl-8">
                    <div className={`absolute -left-[17px] top-0.5 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-sm ${isApproved ? 'border-green-500' : 'border-red-500'}`}>
                      {isApproved ? <CheckCircleIcon className="text-green-500 h-4 w-4" /> : <CancelIcon className="text-red-500 h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Request {request.status}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{request.date_Processed}</p>
                      <p className="text-xs text-slate-400 italic mt-1">Reviewed by {request.approverName} ({formatUserId(request.processedBy)})</p>
                    </div>
                  </div>
                )}
                
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default RequestDetails;