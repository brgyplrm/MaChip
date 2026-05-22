import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from "@mui/icons-material/Attachment";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatDateTime, calculateDays } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useNavigate, Link } from "react-router-dom";
import AssessmentIcon  from "@mui/icons-material/Assessment";
import EditIcon from "@mui/icons-material/Edit";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import EditRequestModal from "../../components/EditRequestModal";

const AdminRequests = () => {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedReqId, setSelectedReqId] = useState(null); // Upgraded from selectedIdx
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("2"); 
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRequestToEdit, setSelectedRequestToEdit] = useState(null);

  // History Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination States for the List
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Showing 8 items per page for a nice fit

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/request/all");
      const data = await response.json();
      if (response.ok) {
        setRequests(data);
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

  // Reset states when changing tabs or filters
  useEffect(() => {
    setPaymentStatus("2"); 
    setCurrentPage(1);
    setSelectedReqId(null);
  }, [activeTab, searchQuery, typeFilter, statusFilter]);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleStatusUpdate = async (emp_reqId, statusId) => {
    try {
      const response = await fetchWithAuth(
        "/api/request/update-status",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emp_reqId,
            emp_reqStatusId: statusId,
            processedBy: userData?.user_Id,
            remarks: adminNote,
            withPayId:
              current?.emp_reqTypeId === 3 || current?.emp_reqTypeId === 4
                ? parseInt(paymentStatus)
                : null,
          }),
        },
      );

      if (response.ok) {
        setToast({
          message: `Request ${statusId === 2 ? "Approved" : "Rejected"} successfully!`,
          type: "success",
        });
        setAdminNote("");

        if (userData?.user_RoleId === 1 && current?.emp_reqTypeId === 5 && statusId === 2) {
          const logDate = current.LC_logDate.split("T")[0];
          setTimeout(() => {
            navigate(`/logs/edit/${current.user_Id}/${logDate}?from=adminRequests`);
          }, 1500);
        } else {
          fetchRequests(); 
        }
      } else {
        const err = await response.json();
        setToast({
          message: err.error || "Failed to update status",
          type: "error",
        });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
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
    return "REQ";
  };

  const filteredRequests = requests.filter((req) => {
    const isPending = req.emp_reqStatusId === 1;
    const isRecommended = req.emp_reqStatusId === 4;
    const isCompleted = req.emp_reqStatusId === 2 || req.emp_reqStatusId === 3;

    let matchesTab = false;
    if (activeTab === "pending") {
      if (userData?.user_RoleId === 1) { 
        // Admins see everything pending, including Supervisor self-requests
        matchesTab = isPending || isRecommended;
      } else if (userData?.user_RoleId === 2) {
        // Supervisors see pending requests from Employees (Role 3) AND Admins (Role 1),
        // but NOT their own requests (those go to Admin)
        matchesTab = isPending && req.user_Id !== userData.user_Id && (req.user_RoleId === 3 || req.user_RoleId === 1);
      }
    } else { 
      if (userData?.user_RoleId === 1) {
        matchesTab = isCompleted;
      } else { 
        matchesTab = isRecommended || isCompleted;
      }
    }

    if (!matchesTab) return false;

    // Remove the redundant Role 2 check here since we handled it in matchesTab
    // if (userData?.user_RoleId === 2) { 
    //   if (req.user_RoleId !== 3 && req.user_RoleId !== 1) return false;
    // }

    if (activeTab === "completed") {
      const query = searchQuery.toLowerCase();
      
      // Search Name or ID
      const matchesSearch = 
        req.userName?.toLowerCase().includes(query) || 
        req.emp_reqId?.toString().includes(query);
      
      const shortType = getShortType(req.reqTypeName);
      const matchesType = typeFilter === "All" || shortType === typeFilter;
      
      let matchesStatus = true;
      if (statusFilter === "Approved") matchesStatus = req.emp_reqStatusId === 2;
      if (statusFilter === "Rejected") matchesStatus = req.emp_reqStatusId === 3;

      // NEW: Date Filter Logic
      const matchesDate = !dateFilter || req.date_Filed?.includes(dateFilter);

      if (!matchesSearch || !matchesType || !matchesStatus || !matchesDate) return false;
    }

    return true;
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

  const getStatusColor = (statusId) => {
    if (statusId === 1 || statusId === 4) return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    if (statusId === 2) return "bg-green-100 text-green-800 hover:bg-green-100";
    if (statusId === 3) return "bg-red-100 text-red-800 hover:bg-red-100";
    if (statusId === 5) return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    return "bg-slate-100 text-slate-800";
  };

  const getTypeColor = (shortType) => {
    switch (shortType) {
      case "VL": return "bg-indigo-100 text-indigo-800 border-transparent";
      case "SL": return "bg-red-100 text-red-800 border-transparent";
      case "OW": return "bg-orange-100 text-orange-800 border-transparent";
      case "OT": return "bg-blue-100 text-blue-800 border-transparent";
      default: return "bg-slate-100 text-slate-800 border-transparent";
    }
  };

  const isFiltering = searchQuery !== "" || typeFilter !== "All" || statusFilter !== "All";
  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("All");
    setStatusFilter("All");
  };

  const handleEditClick = (req) => {
    setSelectedRequestToEdit(req);
    setIsEditModalOpen(true);
  };

  return (
    <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">User Requests</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                Monitor and process employee requests, leave filings, and log correction tickets.
              </span>
            </div>
            {/* NEW: Redirect to Reports Button */}
            <Button 
            variant="outline" 
            asChild
            className="w-full md:w-auto border-[#2A174E] text-[#2A174E] hover:bg-[#f0ebfa] font-semibold shadow-sm transition-all"
          >
            <Link to="/requestSum">
              <AssessmentIcon className="mr-2 h-4 w-4" /> View Request Summary
            </Link>
          </Button>
          
        </div>

         {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Active Users */}
            <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Pending Requests</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{requests.filter((r) => r.emp_reqStatusId === 1).length}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">Awaiting review and approval</p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <HourglassEmptyIcon className="h-6 w-6" />
              </div>
              </CardContent>
            </Card>

            {/* Card 2: Employees */}
            <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Approved Total</p>
                  <p className="text-4xl font-bold text-[#3B4E17]">{requests.filter((r) => r.emp_reqStatusId === 2).length}</p>
                </div>
                <p className="text-xs text-[#3B4E17]/70 italic mt-4">Processed and approved requests</p>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <CheckCircleOutlineIcon className="h-6 w-6" />
              </div>
              </CardContent>
            </Card>

            {/* Card 3: Admins & Supervisors */}
            <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Rejected Total</p>
                  <p className="text-4xl font-bold text-[#BB8B26]">{requests.filter((r) => r.emp_reqStatusId === 3).length}</p>
                </div>
                <p className="text-xs text-[#BB8B26]/70 italic mt-4">Declined and unapproved requests</p>
              </div>
              <div className="bg-white/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <CancelOutlinedIcon className="h-6 w-6" />
              </div>
              </CardContent>
            </Card>
          </div>

        {/* Filters Card (Only visible when viewing History) */}
        {activeTab === "completed" && (
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
                  className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                
                {/* NEW: Date Filed Picker */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full sm:w-[150px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors h-10"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="VL">Vacation</SelectItem>
                      <SelectItem value="SL">Sick</SelectItem>
                      <SelectItem value="OT">Overtime</SelectItem>
                      <SelectItem value="OW">Field Work</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(isFiltering || dateFilter) && (
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      handleClearFilters();
                      setDateFilter("");
                    }}
                    className="w-full sm:w-auto text-slate-500 hover:text-red-600 font-semibold"
                  >
                    <CloseIcon className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Split Content */}
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
          
          {/* Left: Request Queue with Pagination */}
          <Card className="w-full lg:w-1/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-0">
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                className={`flex-1 py-4 font-semibold text-sm transition-colors ${activeTab === "pending" ? "text-[#2A174E] border-b-2 border-[#2A174E] bg-white" : "text-slate-500 hover:bg-slate-100"}`}
                onClick={() => setActiveTab("pending")}
              >
                Pending
              </button>
              <button
                className={`flex-1 py-4 font-semibold text-sm transition-colors ${activeTab === "completed" ? "text-[#2A174E] border-b-2 border-[#2A174E] bg-white" : "text-slate-500 hover:bg-slate-100"}`}
                onClick={() => setActiveTab("completed")}
              >
                History
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 py-0 custom-scrollbar">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1 mt-4">
                {activeTab === "pending" ? "Queue" : "Past Requests"} ({totalItems})
              </h4>
              
              {loading ? (
                <div className="text-center py-8 text-slate-500 animate-pulse">Syncing requests...</div>
              ) : currentData.length > 0 ? (
                currentData.map((req) => {
                  const isSelected = current?.emp_reqId === req.emp_reqId;
                  return (
                    <div
                      key={req.emp_reqId}
                      onClick={() => setSelectedReqId(req.emp_reqId)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? "bg-[#f0ebfa] border-[#2A174E] shadow-sm" : "border-slate-200 bg-white hover:border-[#2A174E]/50"}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="outline" className={getTypeColor(getShortType(req.reqTypeName))}>
                          {getShortType(req.reqTypeName)}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">REQ-{req.emp_reqId}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm mb-1">{req.userName}</p>
                      <p className="text-xs text-slate-500">{getDates(req)}</p>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl mt-2">
                  <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4">
                    <CheckCircleOutlineIcon className="h-8 w-8" />
                  </div>
                  <h5 className="font-bold text-[#2A174E] text-lg mb-2">
                    {activeTab === "pending" ? "All Caught Up!" : "No Records Found"}
                  </h5>
                  <p className="text-sm text-slate-500 max-w-[200px]">
                    {activeTab === "pending" 
                      ? "There are no pending requests requiring your attention right now." 
                      : "Your history is currently empty or does not match your search."}
                  </p>
                </div>
              )}
            </div>

            {/* Queue Pagination Footer */}
            {totalItems > itemsPerPage && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  className="h-8 px-2"
                >
                  <ChevronLeftIcon className="h-4 w-4 text-slate-500" />
                </Button>
                <span className="text-xs font-semibold text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  className="h-8 px-2"
                >
                  <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            )}
          </Card>

          {/* Right: Detailed Review */}
          <Card className="w-full lg:w-2/3 flex flex-col shadow-sm border-0 bg-white h-full overflow-hidden py-2">
            <CardContent className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {current ? (
                <>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-[#2A174E]">Review {current.reqTypeName}</h3>
                      <p className="text-sm text-slate-500 mt-1">Submitted on {current.date_Filed}</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                      {activeTab === "completed" && userData?.user_RoleId === 1 && (
                        <Button 
                          variant="outline" 
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
                          onClick={() => handleEditClick(current)}
                        >
                          <EditIcon className="mr-2 h-4 w-4" /> Edit Record
                        </Button>
                      )}
                      {(current.emp_reqStatusId === 1 || (current.emp_reqStatusId === 4 && userData?.user_RoleId === 1)) && (
                        <>
                          {current.user_Id === userData?.user_Id ? (
                            <Badge variant="secondary" className="px-4 py-2 text-sm justify-center bg-blue-100 text-blue-800">Your Self-Request</Badge>
                          ) : (userData?.user_RoleId === 4) ? (
                             <Badge variant="secondary" className="px-4 py-2 text-sm justify-center bg-slate-100 text-slate-500 italic">View Only</Badge>
                          ) : (
                            <div className="flex gap-2 w-full flex-wrap">
                              <Button className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusUpdate(current.emp_reqId, 2)}>
                                <CheckCircleOutlineIcon className="mr-2 h-4 w-4" /> Approve
                              </Button>
                              <Button className="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 text-white" onClick={() => handleStatusUpdate(current.emp_reqId, 3)}>
                                <CancelOutlinedIcon className="mr-2 h-4 w-4" /> Reject
                              </Button>
                              <Button className="flex-1 min-w-[120px] bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleStatusUpdate(current.emp_reqId, 5)}>
                                <ReplyIcon className="mr-2 h-4 w-4" /> Return
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      {(current.emp_reqStatusId === 2 || current.emp_reqStatusId === 3 || current.emp_reqStatusId === 4) && (
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary" className={`px-4 py-2 text-sm justify-center ${getStatusColor(current.emp_reqStatusId)}`}>
                            {current.status}
                          </Badge>
                          {current.emp_reqStatusId === 4 && userData?.user_RoleId === 2 && (
                            <span className="text-[10px] font-bold text-blue-600 uppercase italic">Awaiting Admin Final Action</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100 mb-4">
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Name</label>
                      <p className="font-semibold text-slate-800">{current.userName}</p>
                    </div>

                    <div className="space-y-1 sm:col-span-2 xl:col-span-1 p-3 -m-3 rounded-lg ">
                      <label className="text-xs font-bold text-slate-500 uppercase">Requested Schedule</label>
                      <p className="font-bold text-[#2A174E]">{getDates(current)}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration / Details</label>
                      <p className="font-semibold text-slate-800">
                        {current.emp_reqTypeId === 1
                          ? `${current.Total_Hrs || 0} Hrs`
                          : current.emp_reqTypeId === 2
                            ? `${current.OW_NoDays || 0} Day(s) (${current.OW_NoHrs || 0} Hrs)`
                            : current.emp_reqTypeId === 5
                              ? `${current.LC_correctionCategory || "Correction"} for ${new Date(current.LC_logDate).toLocaleDateString()}`
                              : [3, 4, 6, 8, 9, 10, 11, 12].includes(current.emp_reqTypeId)
                                ? (() => {
                                    const used = current.VL_NoDays || current.SL_NoDays || current.EL_NoDays || current.ST_NoDays || 0;
                                    const start = current.VL_StartDate || current.SL_StartDate || current.EL_DateOfLeave || current.ST_StartDate;
                                    const end = current.VL_EndDate || current.SL_EndDate || current.EL_DateOfLeave || current.ST_EndDate;
                                    const original = calculateDays(start, end);
                                    return used < original 
                                      ? `${used} Day(s) Used (Original: ${original})` 
                                      : `${used} Day(s)`;
                                  })()
                                : current.emp_reqTypeId === 7 // Half-day
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
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                          <Badge variant="outline" className="mt-1">{current.LC_correctionCategory || "N/A"}</Badge>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current In (System)</label>
                          <p className="font-semibold text-slate-800">{current.LC_currentIn || "No Log"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Out (System)</label>
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

                    {current.emp_reqTypeId !== 1 && current.emp_reqTypeId !== 5 && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Status</label>
                          {current.emp_reqStatusId === 1 && (current.emp_reqTypeId === 3 || current.emp_reqTypeId === 4) ? (
                            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                              <SelectTrigger className="bg-white h-8 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Leave with Pay</SelectItem>
                                <SelectItem value="2">Leave without Pay</SelectItem>
                                <SelectItem value="3">Considered AWOL</SelectItem>
                                <SelectItem value="4">For Suspension</SelectItem>
                                <SelectItem value="5">For Dismissal</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="font-semibold text-slate-800 mt-1">
                              {current.VL_withPayName || current.SL_withPayName || "N/A"}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {current.emp_reqStatusId === 1 ? "Remaining Balance" : "Leave Used"}
                          </label>
                          <p className={`font-semibold mt-1 ${(current.emp_reqStatusId === 1) && ((current.emp_reqTypeId === 3 && current.VL_balance < current.VL_NoDays) || (current.emp_reqTypeId === 4 && current.SL_balance < current.SL_NoDays)) ? "text-red-700 bg-red-100 px-2 py-0.5 rounded inline-block" : "text-slate-800"}`}>
                            {current.emp_reqTypeId === 3 
                              ? (current.emp_reqStatusId === 1 ? `${current.VL_balance || 0} VL Remaining` : `${current.VL_NoDays || 0} Day(s) Used`)
                              : current.emp_reqTypeId === 4 
                              ? (current.emp_reqStatusId === 1 ? `${current.SL_balance || 0} SL Remaining` : `${current.SL_NoDays || 0} Day(s) Used`)
                              : "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processed By</label>
                          <p className="font-semibold text-slate-800">{current.approverName ? `${current.approverName} (${formatUserId(current.processedBy)})` : "Pending Review"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                          <p className="font-semibold text-slate-800">{current.date_Processed ? formatDateTime(current.date_Processed) : "Pending"}</p>
                        </div>
                      </>
                    )}

                    {current.emp_reqTypeId === 5 && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommended By</label>
                          <p className="font-semibold text-slate-800">{current.recommenderName ? `${current.recommenderName} (${formatUserId(current.recommendedBy)})` : "Pending Recommendation"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved By</label>
                          <p className="font-semibold text-slate-800">{current.approverName ? `${current.approverName} (${formatUserId(current.processedBy)})` : "Pending Approval"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Processed</label>
                          <p className="font-semibold text-slate-800">{current.date_Processed ? formatDateTime(current.date_Processed) : "Pending"}</p>
                        </div>
                      </>
                    )}

                    {(current.SL_proof_File || current.OW_proof_File || current.LC_proof_File) && (
                      <div className="space-y-1 col-span-1 sm:col-span-2 xl:col-span-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachment</label>
                        <div>
                          <a 
                            href={`/api/uploads/${current.SL_proof_File || current.OW_proof_File || current.LC_proof_File}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[#2A174E] font-semibold hover:underline mt-1"
                          >
                            <AttachmentIcon className="mr-1 h-4 w-4" /> View Attachment
                          </a>
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

                    {current.admin_remarks && (
                      <div className="space-y-2 col-span-1 sm:col-span-2 xl:col-span-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Note</label>
                        <p className="text-sm text-slate-700 italic bg-white p-4 rounded-lg border border-slate-200">"{current.admin_remarks}"</p>
                      </div>
                    )}
                  </div>

                  {current.emp_reqStatusId === 1 && userData?.user_RoleId !== 4 && (
                    <div className="space-y-3 mt-2">
                      <label className="text-sm font-bold text-slate-800">Admin Note (Optional)</label>
                      <Textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Reason for approval or rejection..."
                        className="h-24 resize-none focus-visible:ring-[#2A174E]"
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
                    <Skeleton className="h-10 w-24 rounded-full" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-16"/>
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ))}
                    <div className="col-span-1 sm:col-span-2 xl:col-span-3 space-y-2 pt-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  </div>

                  <div className="text-center pt-8">
                    <p className="text-slate-400 font-medium italic">Select a request from the queue to review details</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Global styling for custom scrollbars to make the list look sleek */}
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

      <EditRequestModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        request={selectedRequestToEdit}
        onUpdate={fetchRequests}
      />
    </Sidebar>
  );
};

export default AdminRequests;