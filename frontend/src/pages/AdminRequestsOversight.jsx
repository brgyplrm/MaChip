import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from "@mui/icons-material/Attachment";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GroupIcon from "@mui/icons-material/Group";
import AssessmentIcon from "@mui/icons-material/Assessment";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Toast from "../components/toast/Toast";
import { formatUserId } from "../utils/formatUserId";
import { fetchWithAuth } from "../utils/api";
import { useNavigate, Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import FileViewerModal from "../components/FileViewerModal";
import { TablePagination } from "@/components/ui/table-pagination";

const AdminRequestsOversight = () => {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Track which requests have been nudged in this session
  const [notifiedRequests, setNotifiedRequests] = useState(new Set());
  const [adminNote, setAdminNote] = useState("");

  // File Viewer Modal State
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFileUrl, setViewingFileUrl] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination States for the List
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchRequests = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetchWithAuth("/api/request/all");
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        // For oversight, we primarily care about pending items (Status 1 & 4)
        setRequests(data.filter(r => {
          const s = Number(r.emp_reqStatusId);
          return s === 1 || s === 4;
        }));
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(false);
    const handleBackgroundRefresh = () => fetchRequests(true);
    window.addEventListener("dataRefresh", handleBackgroundRefresh);
    return () => window.removeEventListener("dataRefresh", handleBackgroundRefresh);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedReqId(null);
  }, [searchQuery, typeFilter, statusFilter, dateFilter]);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleNotifyApprover = async (emp_reqId, statusId) => {
    try {
      setToast({ message: "Sending notification to approver...", type: "success" });
      const response = await fetchWithAuth(`/api/request/ping-approver/${emp_reqId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote, statusId })
      });
      const data = await response.json();
      if (response.ok) {
        setNotifiedRequests(prev => new Set([...prev, emp_reqId]));
        setToast({ message: data.message || "Reminder successfully sent to the pending approver!", type: "success" });
        setAdminNote(""); // Clear note after sending
      } else {
        setToast({ message: data.error || "Failed to send notification", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Failed to send notification: " + error.message, type: "error" });
    }
  };

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
    if (name.includes("loan cert")) return "LCERT";
    if (name.includes("loan enroll")) return "LENRL";
    return "REQ";
  };

  const getDates = (req) => {
    if (!req) return "";
    return req.VL_StartDate
      ? `${new Date(req.VL_StartDate).toLocaleDateString()} — ${new Date(req.VL_EndDate).toLocaleDateString()}`
      : req.SL_StartDate
        ? `${new Date(req.SL_StartDate).toLocaleDateString()} — ${new Date(req.SL_EndDate).toLocaleDateString()}`
        : req.ST_StartDate
          ? `${new Date(req.ST_StartDate).toLocaleDateString()} — ${new Date(req.ST_EndDate).toLocaleDateString()}`
          : req.OT_DateOf
            ? `${new Date(req.OT_DateOf).toLocaleDateString()} (${formatTime(req.HrFrom)} - ${formatTime(req.HrTo)})`
            : req.LC_logDate
              ? new Date(req.LC_logDate).toLocaleDateString()
              : req.EL_DateOfLeave
                ? new Date(req.EL_DateOfLeave).toLocaleDateString()
                : req.HD_DateOfLeave
                  ? new Date(req.HD_DateOfLeave).toLocaleDateString()
                  : req.DateonField 
                    ? new Date(req.DateonField).toLocaleDateString() 
                    : (req.emp_reqTypeId === 13 || req.emp_reqTypeId === 14) 
                      ? new Date(req.date_Filed).toLocaleDateString() 
                      : "";
  };

  const getTypeColor = (shortType) => {
    switch (shortType) {
      case "VL": return "bg-indigo-100 text-indigo-800 border-transparent";
      case "SL": return "bg-red-100 text-red-800 border-transparent";
      case "OW": return "bg-orange-100 text-orange-800 border-transparent";
      case "OT": return "bg-blue-100 text-blue-800 border-transparent";
      case "LC": return "bg-emerald-100 text-emerald-800 border-transparent";
      case "EL": return "bg-purple-100 text-purple-800 border-transparent";
      case "HD": return "bg-amber-100 text-amber-800 border-transparent";
      case "LCERT": return "bg-sky-100 text-sky-800 border-transparent";
      case "LENRL": return "bg-teal-100 text-teal-800 border-transparent";
      default: return "bg-slate-100 text-slate-800 border-transparent";
    }
  };

  // Filter Logic
  const filteredRequests = requests.filter((req) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      req.userName?.toLowerCase().includes(query) ||
      req.emp_reqId?.toString().includes(query) ||
      req.user_Id?.toString().includes(query);
    
    const shortType = getShortType(req.reqTypeName);
    const matchesType = typeFilter === "All" || shortType === typeFilter;
    
    let matchesStatus = true;
    if (statusFilter === "1") matchesStatus = Number(req.emp_reqStatusId) === 1;
    if (statusFilter === "4") matchesStatus = Number(req.emp_reqStatusId) === 4;

    const matchesDate = !dateFilter || req.date_Filed?.includes(dateFilter);

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  // Pagination Logic
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredRequests.slice(startIndex, endIndex);

  // Derived current selection
  const current = selectedReqId 
    ? filteredRequests.find(r => r.emp_reqId === selectedReqId) 
    : filteredRequests[0] || null;

  const isFiltering = searchQuery !== "" || typeFilter !== "All" || statusFilter !== "All" || dateFilter !== "";
  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("All");
    setStatusFilter("All");
    setDateFilter("");
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          
          {/* Header Section */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">Requests Oversight</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                Monitor approval bottlenecks, review pending filings, and ping approvers.
              </span>
            </div>
            <Button 
              variant="outline" 
              asChild
              className="w-full md:w-auto border-brand-primary/20 hover:text-brand-primary text-brand-primary/70 font-semibold shadow-sm transition-all"
            >
              <Link 
                to="/adminReports" 
                state={{ activeTab: "requests" }}
              >
                <AssessmentIcon className="mr-2 h-4 w-4" /> View Request Report
              </Link>
            </Button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Pending Requests */}
            <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Total Pending Requests</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Total requests currently awaiting supervisor recommendation or final admin approval.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-brand-primary">{requests.length}</p>
                  </div>
                  <p className="text-xs text-brand-primary/70 italic mt-4">Actionable pending queue</p>
                </div>
                <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <HourglassEmptyIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Awaiting Recommendation */}
            <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Awaiting Recommendation</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Requests waiting for direct supervisor recommendation.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-accent-green">{requests.filter((r) => r.emp_reqStatusId === 1).length}</p>
                  </div>
                  <p className="text-xs text-accent-green/70 italic mt-4">Pending direct supervisor action</p>
                </div>
                <div className="bg-accent-green/10 text-accent-green p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <GroupIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Awaiting Final Approval */}
            <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Awaiting Final Approval</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Recommended requests waiting for final administrative sign-off.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-4xl font-bold text-accent-gold">{requests.filter((r) => r.emp_reqStatusId === 4).length}</p>
                  </div>
                  <p className="text-xs text-accent-gold/70 italic mt-4">Pending Admin sign-off</p>
                </div>
                <div className="bg-accent-gold/10 text-accent-gold p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <AccessTimeIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Card */}
          <Card className="shadow-sm border-0 bg-white mb-6 py-0 animate-in fade-in zoom-in-95 duration-200">
            <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
              
              {/* Search by Name/ID */}
              <div className="relative w-full xl:max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search Employee Name or REQ ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                {/* Date Filed Picker */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full sm:w-[150px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors h-10"
                  />
                </div>

                {/* Request Type Selector */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="VL">Vacation</SelectItem>
                      <SelectItem value="SL">Sick</SelectItem>
                      <SelectItem value="EL">Emergency</SelectItem>
                      <SelectItem value="HD">Half-Day</SelectItem>
                      <SelectItem value="OT">Overtime</SelectItem>
                      <SelectItem value="OW">Field Work</SelectItem>
                      <SelectItem value="LC">Log Correct</SelectItem>
                      <SelectItem value="LCERT">Loan Cert</SelectItem>
                      <SelectItem value="LENRL">Loan Enroll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Selector */}
                <div className="flex items-center w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[170px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Pending</SelectItem>
                      <SelectItem value="1">Needs Recommendation</SelectItem>
                      <SelectItem value="4">Needs Final Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isFiltering && (
                  <Button 
                    variant="ghost" 
                    onClick={handleClearFilters}
                    className="w-full sm:w-auto text-slate-500 hover:text-red-600 font-semibold"
                  >
                    <CloseIcon className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Split Content */}
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
            
            {/* Left: Request Queue */}
            <Card className="w-full lg:w-1/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-0">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-brand-primary text-base">Oversight Queue</h3>
                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-semibold px-2.5 py-0.5">
                  {totalItems} Actionable
                </Badge>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 py-0 custom-scrollbar">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1 mt-3">
                  Pending Action ({totalItems})
                </h4>
                
                {loading ? (
                  <div className="text-center py-8 text-slate-500 animate-pulse">Syncing pending requests...</div>
                ) : currentData.length > 0 ? (
                  currentData.map((req) => {
                    const isSelected = current?.emp_reqId === req.emp_reqId;
                    const isNotified = notifiedRequests.has(req.emp_reqId);
                    return (
                      <div
                        key={req.emp_reqId}
                        onClick={() => setSelectedReqId(req.emp_reqId)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all relative overflow-hidden ${isSelected ? "bg-brand-primary-light border-brand-primary shadow-sm" : "border-slate-200 bg-white hover:border-brand-primary/50"}`}
                      >
                        {isNotified && (
                          <div className="absolute top-0 right-0 w-2 h-full bg-green-500" title="Reminder Sent" />
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={getTypeColor(getShortType(req.reqTypeName))}>
                              {getShortType(req.reqTypeName)}
                            </Badge>
                            {req.system_remarks && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                                ⚠️ Notice
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium">REQ-{req.emp_reqId}</span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm mb-1">{req.userName}</p>
                        <div className="flex justify-between items-end mt-2">
                          <p className="text-xs text-slate-500">{getDates(req)}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${req.emp_reqStatusId === 1 ? 'text-orange-700 bg-orange-50' : 'text-blue-700 bg-blue-50'}`}>
                            {req.emp_reqStatusId === 1 ? 'Needs Rec' : 'Needs Appr'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl mt-2">
                    <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4">
                      <CheckCircleOutlineIcon className="h-8 w-8" />
                    </div>
                    <h5 className="font-bold text-brand-primary text-lg mb-2">Zero Bottlenecks</h5>
                    <p className="text-sm text-slate-500 max-w-[200px]">
                      {isFiltering 
                        ? "No pending requests match your active filters." 
                        : "There are no pending requests stuck in the approval pipeline."}
                    </p>
                  </div>
                )}
              </div>

              {/* Queue Pagination Footer */}
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                startIndex={startIndex}
                endIndex={endIndex}
                itemLabel="requests"
                compact={true}
              />
            </Card>

            {/* Right: Detailed Review & Notification Panel */}
            <Card className="w-full lg:w-2/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-2">
              <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {current ? (
                  <>
                    {/* Header / Primary Action Area */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-brand-primary">Review {current.reqTypeName}</h3>
                        <p className="text-sm text-slate-500 mt-1">Submitted by <span className="font-semibold text-slate-700">{current.userName}</span> on {new Date(current.date_Filed).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="flex flex-row items-center gap-2 ml-auto md:ml-0 shrink-0">
                        {notifiedRequests.has(current.emp_reqId) ? (
                          <Button disabled className="w-full md:w-auto bg-green-50 text-green-700 border border-green-200 cursor-not-allowed font-semibold shadow-none">
                            <MarkEmailReadIcon className="mr-2 h-4 w-4 text-green-600" /> Reminder Sent
                          </Button>
                        ) : (
                          <Button 
                            className="w-full md:w-auto bg-brand-primary hover:bg-[#1f1138] text-white font-semibold shadow-md transition-all hover:shadow-lg" 
                            onClick={() => handleNotifyApprover(current.emp_reqId, current.emp_reqStatusId)}
                          >
                            <NotificationsActiveIcon className="mr-2 h-4 w-4 animate-pulse" /> Ping Approver
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Bottleneck Indicator */}
                    <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${current.emp_reqStatusId === 1 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                       <div>
                         <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current Bottleneck</p>
                         <p className={`font-semibold text-sm ${current.emp_reqStatusId === 1 ? 'text-orange-900' : 'text-blue-900'}`}>
                           {current.emp_reqStatusId === 1 ? "Waiting for Direct Manager Recommendation" : "Waiting for Final HR/Admin Approval"}
                         </p>
                       </div>
                       <div className={`p-2 rounded-lg ${current.emp_reqStatusId === 1 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                         <HourglassEmptyIcon className="h-5 w-5" />
                       </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100 mb-4">
                      
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Name</label>
                        <p className="font-semibold text-slate-800">{current.userName}</p>
                      </div>

                      <div className="space-y-1 sm:col-span-2 xl:col-span-1 p-3 -m-3 rounded-lg">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested Schedule</label>
                        <p className="font-bold text-brand-primary">{getDates(current)}</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration / Details</label>
                        <p className="font-semibold text-slate-800">
                          {current.emp_reqTypeId === 1
                            ? `${current.Total_Hrs || 0} Hrs`
                            : current.emp_reqTypeId === 2
                              ? `${current.OW_NoDays || 0} Day(s) (${current.OW_NoHrs || 0} Hrs)`
                              : current.emp_reqTypeId === 5
                                ? `${current.LC_correctionCategory || "Correction"}`
                                : [3, 4, 6, 8, 9, 10, 11, 12].includes(current.emp_reqTypeId)
                                  ? `${current.VL_NoDays || current.SL_NoDays || current.EL_NoDays || current.ST_NoDays || 0} Day(s)`
                                  : current.emp_reqTypeId === 7
                                    ? `Half-day (${current.HD_period})`
                                    : [13, 14].includes(current.emp_reqTypeId)
                                      ? `${current.LR_agency} ${current.LR_loanType}`
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
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claimed In</label>
                            <p className="font-bold text-blue-700">{formatTime(current.LC_claimedIn)}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claimed Out</label>
                            <p className="font-bold text-blue-700">{formatTime(current.LC_claimedOut)}</p>
                          </div>
                        </>
                      )}

                      {(current.SL_proof_File || current.OW_proof_File || current.LC_proof_File || current.ST_proof_File || current.LR_proof_File || current.LR_damageProof) && (
                        <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachments</label>
                          <div className="flex flex-col gap-2">
                            {(current.SL_proof_File || current.OW_proof_File || current.LC_proof_File || current.ST_proof_File || current.LR_proof_File) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingFileUrl(current.SL_proof_File || current.OW_proof_File || current.LC_proof_File || current.ST_proof_File || current.LR_proof_File);
                                  setViewingFileName(`Attachment for REQ-${current.emp_reqId}`);
                                  setIsFileViewerOpen(true);
                                }}
                                className="inline-flex items-center text-brand-primary font-semibold hover:underline w-fit bg-transparent border-none cursor-pointer"
                              >
                                <AttachmentIcon className="mr-1 h-4 w-4" /> View Primary Document (Medical / Proof File)
                              </button>
                            )}
                            {current.LR_damageProof && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingFileUrl(current.LR_damageProof);
                                  setViewingFileName(`Damage Proof for REQ-${current.emp_reqId}`);
                                  setIsFileViewerOpen(true);
                                }}
                                className="inline-flex items-center text-orange-600 font-semibold hover:underline w-fit bg-transparent border-none cursor-pointer"
                              >
                                <AttachmentIcon className="mr-1 h-4 w-4" /> View Property Damage Proof
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3 border-t border-slate-200 pt-4 mt-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Remarks / Purpose</label>
                        <p className="text-sm text-slate-700 italic bg-white p-4 rounded-lg border border-slate-200">"{current.remarks || "No details provided"}"</p>
                      </div>

                      {current.system_remarks && (
                        <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                          <label className="text-xs font-bold text-red-600 uppercase tracking-wider">System Remarks Note:</label>
                          <p className="text-sm text-red-700 italic bg-red-50 p-4 rounded-lg border border-red-200">"{current.system_remarks}"</p>
                        </div>
                      )}
                    </div>

                    {/* Notification Context Box */}
                    {!notifiedRequests.has(current.emp_reqId) && (
                      <div className="space-y-3 mt-2">
                        <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          Add a note to your reminder ping <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <Textarea
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="e.g., 'Please review this urgently for payroll cut-off...'"
                          className="h-20 resize-none focus-visible:ring-brand-primary bg-white border-slate-200"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-8 p-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-[40%]" />
                        <Skeleton className="h-4 w-[20%]" />
                      </div>
                      <Skeleton className="h-10 w-28 rounded-full" />
                    </div>
                    
                    <div className="mb-6 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center px-4">
                      <Skeleton className="h-4 w-48" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      {[...Array(6)].map((_, i) => (
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
                      <p className="text-slate-400 font-medium italic">
                        Select a request from the queue to review and ping approvers
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Global styling for custom scrollbars to match AdminRequests */}
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent; 
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0; 
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1; 
          }
        `}} />

        <FileViewerModal
          isOpen={isFileViewerOpen}
          onClose={() => setIsFileViewerOpen(false)}
          fileUrl={viewingFileUrl}
          fileName={viewingFileName}
        />
      </TooltipProvider>
    </Sidebar>
  );
};

export default AdminRequestsOversight;