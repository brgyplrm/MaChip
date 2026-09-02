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
import { formatDateTime, calculateDays } from "../../utils/formatTime";

// shadcn/ui components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FileViewerModal from "../../components/FileViewerModal";

const RequestDetails = () => {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  // File Viewer State
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFileUrl, setViewingFileUrl] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");

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
  const proofFile = request.SL_proof_File || request.OW_proof_File || request.LC_proof_File || request.ST_proof_File;

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
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Review {request.reqTypeName}</h1>
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
                <p className="font-semibold text-slate-800">{formatDateTime(request.date_Filed)}</p>
              </div>
              {/* Other dynamic fields... */}
            </CardContent>
          </Card>

          {/* Schedule / Specific Details Section */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 pb-4 mb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <CalendarTodayIcon className="text-slate-400 h-5 w-5" /> Request Details & Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {/* Overtime */}
              {request.emp_reqTypeId === 1 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">OT Date</label>
                    <p className="font-semibold text-slate-800">{request.OT_DateOf ? new Date(request.OT_DateOf).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Time Range</label>
                    <p className="font-semibold text-slate-800">{formatTime(request.HrFrom)} – {formatTime(request.HrTo)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Hours</label>
                    <p className="font-bold text-[#2A174E]">{request.Total_Hrs || 0} Hours</p>
                  </div>
                </>
              )}

              {/* Onfield Work */}
              {request.emp_reqTypeId === 2 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Date on Field</label>
                    <p className="font-semibold text-slate-800">{request.DateonField ? new Date(request.DateonField).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Destination</label>
                    <p className="font-semibold text-slate-800">{request.destination || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Duration</label>
                    <p className="font-bold text-[#2A174E]">{request.OW_NoHrs || 0} Hours ({request.OW_NoDays || 1} Day)</p>
                  </div>
                </>
              )}

              {/* Log Correction */}
              {request.emp_reqTypeId === 5 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Log Date</label>
                    <p className="font-semibold text-slate-800">{request.LC_logDate ? new Date(request.LC_logDate).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Original Log</label>
                    <p className="font-semibold text-slate-800">In: {request.LC_currentIn || "—"} | Out: {request.LC_currentOut || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Claimed Corrected Log</label>
                    <p className="font-bold text-[#2A174E]">In: {formatTime(request.LC_claimedIn) || "—"} | Out: {formatTime(request.LC_claimedOut) || "—"}</p>
                  </div>
                </>
              )}

              {/* Half Day */}
              {request.emp_reqTypeId === 7 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Half-Day Date</label>
                    <p className="font-semibold text-slate-800">{request.HD_DateOfLeave ? new Date(request.HD_DateOfLeave).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Period</label>
                    <p className="font-semibold text-slate-800">{request.HD_period || "—"} {request.HD_timeRange ? `(${request.HD_timeRange})` : ""}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payment Status</label>
                    <p className="font-bold text-[#2A174E]">{request.HD_withPayName || "With Pay"}</p>
                  </div>
                </>
              )}

              {/* General Leaves (VL, SL, EL, Maternity, Paternity, Solo Parent, VAWC, Special) */}
              {![1, 2, 5, 7].includes(request.emp_reqTypeId) && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Duration</label>
                    <p className="font-bold text-[#2A174E]">
                      {request.VL_NoDays || request.SL_NoDays || request.EL_NoDays || request.ST_NoDays || 1} Day(s)
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
                    <p className="font-semibold text-slate-800">
                      {request.VL_StartDate ? new Date(request.VL_StartDate).toLocaleDateString() : 
                       request.SL_StartDate ? new Date(request.SL_StartDate).toLocaleDateString() : 
                       request.EL_DateOfLeave ? new Date(request.EL_DateOfLeave).toLocaleDateString() : 
                       request.ST_StartDate ? new Date(request.ST_StartDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
                    <p className="font-semibold text-slate-800">
                      {request.VL_EndDate ? new Date(request.VL_EndDate).toLocaleDateString() : 
                       request.SL_EndDate ? new Date(request.SL_EndDate).toLocaleDateString() : 
                       request.EL_DateOfLeave ? new Date(request.EL_DateOfLeave).toLocaleDateString() : 
                       request.ST_EndDate ? new Date(request.ST_EndDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {proofFile && (
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-6">
                <button 
                  type="button"
                  onClick={() => {
                    setViewingFileUrl(proofFile);
                    setViewingFileName(`Attachment for REQ-${request.emp_reqId}`);
                    setIsFileViewerOpen(true);
                  }}
                  className="inline-flex items-center text-[#2A174E] font-semibold hover:underline"
                >
                  <AttachmentIcon className="mr-1 h-4 w-4" /> View Supporting Attachment
                </button>
              </CardContent>
            </Card>
          )}

          {/* Remarks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-6">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Employee Purpose / Reason</label>
                <p className="text-slate-700 italic bg-slate-50 p-4 rounded-xl border border-slate-100">"{request.remarks || "No reason provided."}"</p>
              </CardContent>
            </Card>

            {(request.admin_remarks || request.system_remarks) && (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="pt-6">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Management / Administrator Feedback</label>
                  <p className="text-slate-700 bg-amber-50/60 p-4 rounded-xl border border-amber-100 font-medium">
                    {request.admin_remarks || request.system_remarks}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      </Sidebar>

      <FileViewerModal
        isOpen={isFileViewerOpen}
        onClose={() => setIsFileViewerOpen(false)}
        fileUrl={viewingFileUrl}
        fileName={viewingFileName}
      />
    </div>
  );
};

export default RequestDetails;
