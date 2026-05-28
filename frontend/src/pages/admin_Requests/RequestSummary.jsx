import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const RequestSummary = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/request/all");
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("All Types");
    setStatusFilter("All Statuses");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || typeFilter !== "All Types" || statusFilter !== "All Statuses";

  // Filter and Search Logic
  const filteredRequests = requests.filter(req => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
        req.userName?.toLowerCase().includes(query) || 
        req.emp_reqId?.toString().includes(query) ||
        formatUserId(req.user_Id).toLowerCase().includes(query);

    const matchesType = typeFilter === "All Types" || req.reqTypeName === typeFilter;
    const matchesStatus = statusFilter === "All Statuses" || req.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Pagination Logic
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredRequests.slice(startIndex, endIndex);

  // Statistics Calculation
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.emp_reqStatusId === 1 || r.emp_reqStatusId === 4).length,
    approved: requests.filter(r => r.emp_reqStatusId === 2).length,
    rejected: requests.filter(r => r.emp_reqStatusId === 3).length,
  };

  const getStatusBadge = (statusId) => {
    switch (statusId) {
      case 1: case 4: return "bg-orange-100 text-orange-800 hover:bg-orange-100"; // Pending/Recommended
      case 2: return "bg-green-100 text-green-800 hover:bg-green-100"; // Approved
      case 3: return "bg-red-100 text-red-800 hover:bg-red-100"; // Rejected
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
        
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Request Data Summary</h1>
          <span className="text-sm text-slate-500 mt-1 block">Analyze and review the complete history of all user-filed requests</span>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Queue Total</p>
                    <p className="text-4xl font-bold text-[#2A174E]">{stats.pending}</p>
                  </div>
                  <p className="text-xs text-[#2A174E]/70 italic mt-4">Active and recommended requests</p>
                </div>
                <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <HourglassEmptyIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Approved History</p>
                    <p className="text-4xl font-bold text-[#3B4E17]">{stats.approved}</p>
                  </div>
                  <p className="text-xs text-[#3B4E17]/70 italic mt-4">Total processed and accepted</p>
                </div>
                <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <CheckCircleOutlineIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Rejected Records</p>
                    <p className="text-4xl font-bold text-[#BB8B26]">{stats.rejected}</p>
                  </div>
                  <p className="text-xs text-[#BB8B26]/70 italic mt-4">Declined historical records</p>
                </div>
                <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                  <CancelOutlinedIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
        </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by ID, Name, or Request Type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Types">All Types</SelectItem>
                    <SelectItem value="Vacation Leave">Vacation Leave</SelectItem>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                    <SelectItem value="Half-day Request">Half-Day</SelectItem>
                    <SelectItem value="Overtime">Overtime</SelectItem>
                    <SelectItem value="Onfield Work">Field Work</SelectItem>
                    <SelectItem value="Log Correction">Log Correct</SelectItem>
                    <SelectItem value="Solo Parent Leave">Solo Parent</SelectItem>
                    <SelectItem value="Maternity Leave">Maternity</SelectItem>
                    <SelectItem value="Paternity Leave">Paternity</SelectItem>
                    <SelectItem value="VAWC Leave">VAWC</SelectItem>
                    <SelectItem value="Special Leave for Women">Special Leave</SelectItem>
                    <SelectItem value="Loan Certification">Loan Cert</SelectItem>
                    <SelectItem value="Loan Enrollment">Loan Enroll</SelectItem>
                  </SelectContent>
                </Select>
                </div>

                <div className="flex items-center w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Statuses">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Recommended">Recommended</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isFiltering && (
                <Button variant="ghost" onClick={handleClearFilters} className="w-full sm:w-auto text-slate-500 hover:text-red-600 font-semibold">
                  <CloseIcon className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="shadow-sm border-0 bg-white py-0">
          <CardContent className="p-0 flex flex-col">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px] md:min-w-full">
                <TableHeader className="bg-[#2A174E]">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">REQ ID</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Request Type</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date Filed</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.length > 0 ? (
                    currentData.map((req) => (
                      <TableRow key={req.emp_reqId} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-[#2A174E] py-4 px-6">REQ-{req.emp_reqId}</TableCell>
                        <TableCell className="py-4">
                          <p className="font-semibold text-slate-800">{req.userName}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{formatUserId(req.user_Id)}</p>
                        </TableCell>
                        <TableCell className="text-slate-600 py-4 font-medium">{req.reqTypeName}</TableCell>
                        <TableCell className="text-slate-600 py-4 text-sm">{req.date_Filed}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className={`font-semibold px-3 py-1 ${getStatusBadge(req.emp_reqStatusId)}`}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6 font-medium text-slate-700">
                          {req.approverName || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="p-8 border-0">
                        <EmptyState
                          icon={<AssessmentOutlinedIcon className="h-8 w-8 text-slate-400" />}
                          title={isFiltering ? "No matching requests" : "Request queue empty"}
                          description={isFiltering ? "Try adjusting your filters to find specific records." : "No records currently exist in the database."}
                          action={isFiltering && (
                            <Button variant="outline" onClick={handleClearFilters} className="text-slate-600 border-slate-200">Clear Filters</Button>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="hidden sm:inline">Rows per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                    <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="font-medium">
                    Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{totalItems}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                  <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">{currentPage}</div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </Sidebar>
    </div>
  );
};

export default RequestSummary;