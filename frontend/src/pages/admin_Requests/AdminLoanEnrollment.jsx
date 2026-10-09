import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import InfoIcon from "@mui/icons-material/Info";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AttachmentIcon from "@mui/icons-material/Attachment";
import SearchIcon from "@mui/icons-material/Search";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditIcon from "@mui/icons-material/Edit";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GridViewIcon from '@mui/icons-material/GridView';
import TableRowsIcon from '@mui/icons-material/TableRows';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatDateTime } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useNavigate, Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import EditRequestModal from "../../components/EditRequestModal";
import FileViewerModal from "../../components/FileViewerModal";
import { TablePagination } from "@/components/ui/table-pagination";

const LOAN_TYPE_IDS = [13, 14]; // 13: Loan Certification, 14: Loan Enrollment

const AdminLoanEnrollment = () => {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'government', 'company', 'certifications'
  const [statusTab, setStatusTab] = useState("pending"); // 'pending', 'completed'
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'table'
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [showHistoryBanner, setShowHistoryBanner] = useState(true);

  // Edit & File Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRequestToEdit, setSelectedRequestToEdit] = useState(null);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFileUrl, setViewingFileUrl] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchRequests = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetchWithAuth("/api/request/all");
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        const loanRequests = data.filter(
          (req) =>
            LOAN_TYPE_IDS.includes(req.emp_reqTypeId) ||
            req.reqTypeName?.toLowerCase().includes("loan")
        );
        setRequests(loanRequests);
      } else {
        console.warn("[AdminLoanEnrollment] Failed to refresh loan requests:", response.status, data);
      }
    } catch (error) {
      console.error("Error fetching loan requests:", error);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusTab, searchQuery, agencyFilter, statusFilter, dateFilter]);

  const handleStatusUpdate = async (emp_reqId, statusId) => {
    try {
      const response = await fetchWithAuth("/api/request/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_reqId,
          emp_reqStatusId: statusId,
          processedBy: userData?.user_Id,
          remarks: adminNote,
        }),
      });

      if (response.ok) {
        setToast({
          message: `Loan application ${
            statusId === 2 ? "Approved" : statusId === 3 ? "Rejected" : "Returned"
          } successfully!`,
          type: "success",
        });
        setAdminNote("");
        fetchRequests();
      } else {
        const err = await response.json();
        setToast({
          message: err.error || "Failed to update loan status",
          type: "error",
        });
      }
    } catch (error) {
      setToast({ message: "Error connecting to server", type: "error" });
    }
  };

  const getShortType = (typeName) => {
    if (!typeName) return "LOAN";
    const name = typeName.toLowerCase();
    if (name.includes("certification") || name.includes("cert")) return "LCERT";
    if (name.includes("enrollment") || name.includes("enroll")) return "LENRL";
    return "LOAN";
  };

  // Filter calculations
  const filteredRequests = requests.filter((req) => {
    const userRole = Number(userData?.user_RoleId);
    const reqStatus = Number(req.emp_reqStatusId);
    const requesterId = Number(req.user_Id);
    const currentUserId = Number(userData?.user_Id);

    const isPending = reqStatus === 1;
    const isRecommended = reqStatus === 4;
    const isCompleted = reqStatus === 2 || reqStatus === 3;
    const isReturned = reqStatus === 5;

    // Status Tab filter
    let matchesStatusTab = false;
    if (statusTab === "pending") {
      if (userRole === 1) {
        matchesStatusTab = isPending || isRecommended || isReturned;
      } else if (userRole === 2 || userRole === 4) {
        matchesStatusTab = isPending && requesterId !== currentUserId;
      }
    } else {
      if (userRole === 1) {
        matchesStatusTab = isCompleted;
      } else {
        matchesStatusTab = isRecommended || isCompleted;
      }
    }
    if (!matchesStatusTab) return false;

    // Subtab filter
    if (activeTab === "government") {
      if (req.LR_agency === "Company" || req.emp_reqTypeId === 13) return false;
    } else if (activeTab === "company") {
      if (req.LR_agency !== "Company" && req.emp_reqTypeId !== 14) return false;
    } else if (activeTab === "certifications") {
      if (req.emp_reqTypeId !== 13) return false;
    }

    // Agency Dropdown filter
    if (agencyFilter !== "All") {
      if (agencyFilter === "Govt" && req.LR_agency === "Company") return false;
      if (agencyFilter === "Company" && req.LR_agency !== "Company") return false;
      if (agencyFilter === "SSS" && req.LR_agency !== "SSS") return false;
      if (agencyFilter === "Pag-IBIG" && req.LR_agency !== "Pag-IBIG") return false;
    }

    // History Filters
    if (statusTab === "completed") {
      const filedDate = new Date(req.date_Filed);
      const today = new Date();
      const cutoff = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      if (filedDate < cutoff) return false;

      let matchesStatus = true;
      if (statusFilter === "Approved") matchesStatus = req.emp_reqStatusId === 2;
      if (statusFilter === "Rejected") matchesStatus = req.emp_reqStatusId === 3;
      if (statusFilter === "Returned") matchesStatus = req.emp_reqStatusId === 5;
      if (!matchesStatus) return false;
    }

    // Date Filter
    if (dateFilter && !req.date_Filed?.includes(dateFilter)) return false;

    // Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        req.userName?.toLowerCase().includes(query) ||
        req.emp_reqId?.toString().includes(query) ||
        (req.user_Id && formatUserId(req.user_Id).toLowerCase().includes(query)) ||
        req.LR_agency?.toLowerCase().includes(query) ||
        req.LR_loanType?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    return true;
  });

  // Calculate Metrics
  const pendingCount = requests.filter((r) => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4).length;
  const approvedCount = requests.filter((r) => r.emp_reqStatusId === 2).length;
  const totalPendingAmount = requests
    .filter((r) => (r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4) && r.LR_amount)
    .reduce((sum, r) => sum + (parseFloat(r.LR_amount) || 0), 0);
  const totalApprovedAmount = requests
    .filter((r) => r.emp_reqStatusId === 2 && r.LR_amount)
    .reduce((sum, r) => sum + (parseFloat(r.LR_amount) || 0), 0);

  // Pagination
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredRequests.slice(startIndex, endIndex);

  const current = selectedReqId
    ? requests.find((r) => r.emp_reqId === selectedReqId)
    : null;

  const openReviewDrawer = (reqId) => {
    setSelectedReqId(reqId);
    setIsDetailDrawerOpen(true);
  };

  const getStatusBadge = (statusId) => {
    switch (statusId) {
      case 1:
      case 4:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pending Review</Badge>;
      case 2:
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Approved</Badge>;
      case 3:
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">Rejected</Badge>;
      case 5:
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Returned</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">
                Loan Applications & Certifications
              </h1>
              <span className="text-sm text-slate-500 mt-1 block">
                Manage and process employee loan applications, certifications, and enrollment requests.
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

          {/* Metric Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Pending Applications */}
            <Card className="shadow-sm border-l-4 border-l-accent-gold bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Applications</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{pendingCount}</span>
                    <span className="text-xs font-semibold text-accent-gold">Awaiting Action</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Total Value: ₱{totalPendingAmount.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent-gold/10 text-accent-gold flex items-center justify-center shrink-0">
                  <HourglassEmptyIcon />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Total Approved */}
            <Card className="shadow-sm border-l-4 border-l-accent-green bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Loans</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{approvedCount}</span>
                    <span className="text-xs font-semibold text-accent-green">Enrolled</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Disbursed Value: ₱{totalApprovedAmount.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                  <CheckCircleOutlineIcon />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Govt Agency Applications */}
            <Card className="shadow-sm border-l-4 border-l-status-info bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Government Loans</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {requests.filter((r) => r.LR_agency && r.LR_agency !== "Company").length}
                    </span>
                    <span className="text-xs font-semibold text-status-info">SSS / Pag-IBIG</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Statutory deductibles</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-sky-50 text-status-info flex items-center justify-center shrink-0">
                  <CorporateFareIcon />
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Company Internal Loans */}
            <Card className="shadow-sm border-l-4 border-l-brand-primary bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Loans</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {requests.filter((r) => r.LR_agency === "Company").length}
                    </span>
                    <span className="text-xs font-semibold text-brand-primary">Internal Advances</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Company loan program</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                  <MonetizationOnIcon />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subtab Category & Status Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            
            {/* Left Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1 md:pb-0">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Applications ({requests.length})
              </button>
              <button
                onClick={() => setActiveTab("government")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "government"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Govt Loans (SSS / Pag-IBIG)
              </button>
              <button
                onClick={() => setActiveTab("company")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "company"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Company Loans
              </button>
              <button
                onClick={() => setActiveTab("certifications")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "certifications"
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Certifications
              </button>
            </div>

            {/* Right Status Switch & View Toggle */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
              <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                <button
                  onClick={() => setStatusTab("pending")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    statusTab === "pending"
                      ? "bg-white text-brand-primary shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Pending Queue
                </button>
                <button
                  onClick={() => setStatusTab("completed")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    statusTab === "completed"
                      ? "bg-white text-brand-primary shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  History Archive
                </button>
              </div>

              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${
                    viewMode === "grid" ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Grid View"
                >
                  <GridViewIcon fontSize="small" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 transition-colors ${
                    viewMode === "table" ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Table View"
                >
                  <TableRowsIcon fontSize="small" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="shadow-xs border-0 bg-white py-0">
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search Employee Name, ID, REQ ID, Agency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 border-slate-200 focus-visible:ring-brand-primary text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="w-full sm:w-auto">
                  <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] border-slate-200 h-10 text-xs bg-slate-50">
                      <SelectValue placeholder="Agency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Agencies</SelectItem>
                      <SelectItem value="SSS">SSS</SelectItem>
                      <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                      <SelectItem value="Govt">Government</SelectItem>
                      <SelectItem value="Company">Company Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {statusTab === "completed" && (
                  <div className="w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[140px] border-slate-200 h-10 text-xs bg-slate-50">
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
                )}

                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full sm:w-[140px] border-slate-200 h-10 text-xs bg-slate-50"
                />

                {(searchQuery || agencyFilter !== "All" || statusFilter !== "All" || dateFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setAgencyFilter("All");
                      setStatusFilter("All");
                      setDateFilter("");
                    }}
                    className="text-slate-500 hover:text-red-600 text-xs font-semibold"
                  >
                    <CloseIcon className="h-4 w-4 mr-1" /> Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area - Grid or Table View */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-5 space-y-4 bg-white">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))}
            </div>
          ) : currentData.length > 0 ? (
            viewMode === "grid" ? (
              /* GRID VIEW: Distinct Financial Loan Passbook Cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentData.map((req) => {
                  const isGovt = req.LR_agency && req.LR_agency !== "Company";
                  return (
                    <Card
                      key={req.emp_reqId}
                      className="bg-white border border-slate-200 hover:border-brand-primary shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group rounded-xl"
                    >
                      {/* Card Top Banner */}
                      <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white flex items-start justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                isGovt
                                  ? "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
                                  : "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100"
                              }
                            >
                              {req.LR_agency || "Company"}
                            </Badge>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                              REQ-{req.emp_reqId}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-base group-hover:text-brand-primary transition-colors line-clamp-1">
                            {req.userName}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">{req.user_Id ? formatUserId(req.user_Id) : "MACJ Employee"}</p>
                        </div>
                        <div>{getStatusBadge(req.emp_reqStatusId)}</div>
                      </div>

                      {/* Card Main Financial Info Body */}
                      <div className="p-5 space-y-4 flex-1 bg-white">
                        <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-100 space-y-2.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Loan Type</span>
                            <span className="font-semibold text-slate-800">{req.LR_loanType || "General Loan"}</span>
                          </div>
                          
                          <div className="flex justify-between items-baseline pt-1">
                            <span className="text-slate-400 text-xs font-medium">Principal Loan</span>
                            <span className="text-xl font-black text-emerald-600">
                              ₱{parseFloat(req.LR_amount || req.LR_balance || 0).toLocaleString()}
                            </span>
                          </div>

                          {req.LR_amortization && parseFloat(req.LR_amortization) > 0 && (
                            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200/60">
                              <span className="text-slate-500 text-xs">Monthly Amortization</span>
                              <span className="font-bold text-blue-700 text-sm">₱{parseFloat(req.LR_amortization).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                          <div>
                            <span className="block font-bold text-slate-400 text-[10px] uppercase">Term</span>
                            <span className="font-semibold">{req.LR_term ? `${req.LR_term} Months` : "1 Month"}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 text-[10px] uppercase">Date Filed</span>
                            <span className="font-semibold">{new Date(req.date_Filed).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {(req.LR_proof_File || req.LR_damageProof) && (
                          <div className="flex items-center gap-1.5 text-xs text-brand-primary font-semibold bg-purple-50 p-2 rounded-lg">
                            <AttachmentIcon fontSize="small" className="text-purple-600" />
                            <span>Attachment Included</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Footer */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 italic">
                          {req.approverName ? `By ${req.approverName}` : "Pending review"}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => openReviewDrawer(req.emp_reqId)}
                          className="bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold px-4 h-9 shadow-xs"
                        >
                          Audit & Review
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW: Clean Ledger Layout */
              <Card className="shadow-sm border-0 bg-white overflow-hidden py-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-4">REQ ID</th>
                        <th className="p-4">Borrower Name</th>
                        <th className="p-4">Agency & Loan Type</th>
                        <th className="p-4 text-right">Principal Amount</th>
                        <th className="p-4 text-right">Monthly Amort.</th>
                        <th className="p-4">Term</th>
                        <th className="p-4">Date Filed</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {currentData.map((req) => (
                        <tr key={req.emp_reqId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold text-slate-900">REQ-{req.emp_reqId}</td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800">{req.userName}</p>
                            <p className="text-[10px] text-slate-400">{req.user_Id ? formatUserId(req.user_Id) : "N/A"}</p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="mr-1 mb-0.5">
                              {req.LR_agency || "Company"}
                            </Badge>
                            <span className="block text-slate-600 text-[11px] mt-0.5">{req.LR_loanType || "General Loan"}</span>
                          </td>
                          <td className="p-4 text-right font-bold text-emerald-600 text-sm">
                            ₱{parseFloat(req.LR_amount || req.LR_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-bold text-blue-700">
                            {req.LR_amortization && parseFloat(req.LR_amortization) > 0
                              ? `₱${parseFloat(req.LR_amortization).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td className="p-4">{req.LR_term ? `${req.LR_term} Mos` : "1 Mo"}</td>
                          <td className="p-4">{new Date(req.date_Filed).toLocaleDateString()}</td>
                          <td className="p-4">{getStatusBadge(req.emp_reqStatusId)}</td>
                          <td className="p-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReviewDrawer(req.emp_reqId)}
                              className="h-8 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white font-semibold text-xs"
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          ) : (
            /* Empty State */
            <Card className="bg-white border border-dashed border-slate-200 py-16 text-center">
              <CardContent className="flex flex-col items-center justify-center space-y-3">
                <div className="bg-amber-50 text-amber-600 p-4 rounded-full">
                  <AccountBalanceIcon className="h-10 w-10" />
                </div>
                <h4 className="text-lg font-bold text-slate-800">No Loan Applications Found</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  There are currently no loan enrollment or certification requests matching your filter parameters.
                </p>
                {(searchQuery || agencyFilter !== "All" || statusFilter !== "All" || dateFilter) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setAgencyFilter("All");
                      setStatusFilter("All");
                      setDateFilter("");
                    }}
                    className="mt-2 text-xs border-slate-300 text-slate-700"
                  >
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pagination Footer */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            startIndex={startIndex}
            endIndex={endIndex}
            itemLabel="entries"
          />

          {/* Detail Review Modal / Slide-over Overlay */}
          {isDetailDrawerOpen && current && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
              <Card className="w-full max-w-3xl max-h-[90vh] bg-white shadow-2xl border-0 overflow-hidden flex flex-col rounded-2xl animate-in zoom-in-95 duration-200 py-0">
                
                {/* Modal Header */}
                <div className="p-5 bg-brand-primary text-white flex items-center justify-between shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400 font-bold text-[10px]">
                        REQ-{current.emp_reqId}
                      </Badge>
                      <span className="text-xs text-purple-200 font-semibold">{current.reqTypeName}</span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">{current.userName}</h2>
                  </div>

                  <button
                    onClick={() => setIsDetailDrawerOpen(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                  
                  {/* Financial Breakdown Grid */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                      <MonetizationOnIcon className="text-brand-primary h-4 w-4" /> Loan Financial Specification
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Agency</span>
                        <span className="font-bold text-brand-primary text-sm">{current.LR_agency || "Company"}</span>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Loan Category</span>
                        <span className="font-bold text-slate-800 text-sm">{current.LR_loanType || "General Loan"}</span>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Principal Amount / Balance</span>
                        <span className="font-black text-emerald-600 text-base">
                          ₱{parseFloat(current.LR_amount || current.LR_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Repayment Duration</span>
                        <span className="font-semibold text-slate-800">
                          {current.LR_agency === "Company" ? "1 Month (Full)" : `${current.LR_term || current.LR_months || 0} Months`}
                        </span>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Monthly Amortization</span>
                        <span className="font-bold text-blue-700 text-sm">
                          {current.LR_amortization && parseFloat(current.LR_amortization) > 0
                            ? `₱${parseFloat(current.LR_amortization).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "N/A"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[10px] font-bold uppercase">Amortization Start</span>
                        <span className="font-semibold text-slate-800">{current.LR_amortizationStart || "Upon Approval"}</span>
                      </div>

                      {current.LR_reference && (
                        <div>
                          <span className="block text-slate-400 text-[10px] font-bold uppercase">Reference No.</span>
                          <span className="font-mono font-bold text-slate-800">{current.LR_reference}</span>
                        </div>
                      )}

                      {current.LR_pagibigTAV > 0 && (
                        <div>
                          <span className="block text-slate-400 text-[10px] font-bold uppercase">Pag-IBIG TAV</span>
                          <span className="font-bold text-emerald-700">₱{parseFloat(current.LR_pagibigTAV).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {current.LR_calamityArea && (
                        <div>
                          <span className="block text-slate-400 text-[10px] font-bold uppercase">Calamity Area</span>
                          <span className="font-semibold text-orange-600">{current.LR_calamityArea}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attachments Section */}
                  {(current.LR_proof_File || current.LR_damageProof) && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attached Verification Documents</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {current.LR_proof_File && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setViewingFileUrl(current.LR_proof_File);
                              setViewingFileName(`Loan Document REQ-${current.emp_reqId}`);
                              setIsFileViewerOpen(true);
                            }}
                            className="border-slate-300 text-brand-primary font-semibold text-xs h-10"
                          >
                            <AttachmentIcon className="mr-2 h-4 w-4 text-purple-600" /> View Disclosure Statement
                          </Button>
                        )}
                        {current.LR_damageProof && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setViewingFileUrl(current.LR_damageProof);
                              setViewingFileName(`Damage Proof for REQ-${current.emp_reqId}`);
                              setIsFileViewerOpen(true);
                            }}
                            className="border-amber-300 text-amber-800 font-semibold text-xs h-10"
                          >
                            <AttachmentIcon className="mr-2 h-4 w-4 text-amber-600" /> View Property Damage Proof
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Employee Remarks */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Applicant Statement / Remarks</label>
                    <p className="text-xs text-slate-700 italic bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      "{current.remarks || "No additional remarks provided."}"
                    </p>
                  </div>

                  {/* Processing History & Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[9px]">Processed By</span>
                      <span className="font-semibold text-slate-800">
                        {current.approverName ? `${current.approverName} (${formatUserId(current.processedBy)})` : "Pending Review"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[9px]">Processing Date</span>
                      <span className="font-semibold text-slate-800">
                        {current.date_Processed ? formatDateTime(current.date_Processed) : "Pending"}
                      </span>
                    </div>
                  </div>

                  {current.admin_remarks && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Previous Admin Remarks</label>
                      <p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200">
                        "{current.admin_remarks}"
                      </p>
                    </div>
                  )}

                  {/* Admin Note Textarea for Pending items */}
                  {(current.emp_reqStatusId === 1 || current.emp_reqStatusId === 4) && userData?.user_RoleId !== 4 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Add Audit Remarks / Instructions
                      </label>
                      <Textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="State reason for approval, rejection, or return of loan application..."
                        className="h-20 text-xs resize-none focus-visible:ring-brand-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailDrawerOpen(false)}
                    className="border-slate-300 text-xs"
                  >
                    Close Window
                  </Button>

                  {(current.emp_reqStatusId === 1 || (current.emp_reqStatusId === 4 && userData?.user_RoleId === 1)) &&
                    userData?.user_RoleId !== 4 && (
                      <div className="flex items-center gap-2">
                        <Button
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold h-9"
                          onClick={() => {
                            handleStatusUpdate(current.emp_reqId, 5);
                            setIsDetailDrawerOpen(false);
                          }}
                        >
                          <ReplyIcon className="mr-1 h-4 w-4" /> Return Application
                        </Button>
                        <Button
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9"
                          onClick={() => {
                            handleStatusUpdate(current.emp_reqId, 3);
                            setIsDetailDrawerOpen(false);
                          }}
                        >
                          <CancelOutlinedIcon className="mr-1 h-4 w-4" /> Reject Loan
                        </Button>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 shadow-sm"
                          onClick={() => {
                            handleStatusUpdate(current.emp_reqId, 2);
                            setIsDetailDrawerOpen(false);
                          }}
                        >
                          <CheckCircleOutlineIcon className="mr-1 h-4 w-4" /> Approve & Enroll
                        </Button>
                      </div>
                    )}
                </div>
              </Card>
            </div>
          )}
        </div>

        <EditRequestModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          request={selectedRequestToEdit}
          onUpdate={fetchRequests}
        />

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

export default AdminLoanEnrollment;
