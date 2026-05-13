import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ProcessPayrollModal from "../../components/procpayrollmodal/ProcessPayrollModal";
import EditPayrollModal from "../../components/editPayrollModal/EditPayrollModal";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { fetchWithAuth } from "../../utils/api";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import PaymentsIcon from '@mui/icons-material/Payments';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PayrollPeriod = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodIdFromUrl = queryParams.get("periodId");

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const periodsRes = await fetchWithAuth("/api/system/payroll-periods");
      const periodsData = await periodsRes.json();

      if (periodsRes.ok && periodsData.length > 0) {
        setPeriods(periodsData);
        
        let current;
        if (periodIdFromUrl) {
          current = periodsData.find(p => p.periodId === parseInt(periodIdFromUrl));
        }
        if (!current) current = periodsData[0]; 
        
        setSelectedPeriod(current);

        if (current.status === 'Draft') {
          await fetchLivePreview(current);
        } else {
          await fetchSavedPayrolls(current);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLivePreview = async (period) => {
    try {
      const empRes = await fetchWithAuth("/api/users/all");
      const employees = await empRes.json();
      if (!empRes.ok) return;

      const livePayrolls = [];
      let totalNet = 0, totalEarn = 0, totalDed = 0;

      for (const emp of employees.filter(e => e.dailyRate > 0)) {
        const prevRes = await fetchWithAuth(`/api/payroll/preview?user_Id=${emp.user_Id}&period_Start=${period.startDate}&period_End=${period.endDate}`);
        const preview = await prevRes.json();

        if (prevRes.ok) {
          livePayrolls.push({
            payrollId: `preview-${emp.user_Id}`,
            user_FirstName: emp.user_FirstName,
            user_LastName: emp.user_LastName,
            user_Id: emp.user_Id,
            period_Start: period.startDate,
            period_End: period.endDate,
            NoDays_Worked: preview.NoDays_Worked,
            NoHrs_Worked: preview.NoHrs_Worked,
            basicPay: preview.basicPay,
            totalEarnings: preview.totalEarnings,
            totalDeductions: preview.totalDeductions,
            netPay: preview.netPay,
            dailyRate: emp.dailyRate,
            taxStatus: emp.taxStatus,
            PaystatusName: "Draft"
          });

          totalNet += preview.netPay;
          totalEarn += preview.totalEarnings;
          totalDed += preview.totalDeductions;
        }
      }
      setPayrolls(livePayrolls);
      setStats({ totalNetPay: totalNet, totalEarnings: totalEarn, totalDeductions: totalDed });
    } catch (err) { console.error(err); }
  };

  const fetchSavedPayrolls = async (period) => {
    try {
      const response = await fetchWithAuth(`/api/payroll/report?startDate=${period.startDate}&endDate=${period.endDate}`);
      const data = await response.json();
      if (response.ok) {
        setPayrolls(data);
        const net = data.reduce((acc, p) => acc + parseFloat(p.netPay || 0), 0);
        const earn = data.reduce((acc, p) => acc + parseFloat(p.totalEarnings || 0), 0);
        const ded = data.reduce((acc, p) => acc + parseFloat(p.totalDeductions || 0), 0);
        setStats({ totalNetPay: net, totalEarnings: earn, totalDeductions: ded });
      }
    } catch (err) { console.error(err); }
  };

  const handleBatchProcess = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/payroll/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_Start: selectedPeriod.startDate,
          period_End: selectedPeriod.endDate
        }),
      });
      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchData(); 
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setIsConfirmOpen(false); }
  };

  const handlePreviewSummary = async () => {
    if (!selectedPeriod) return;
    try {
      const response = await fetchWithAuth(`/api/payroll/summary-preview?period_Start=${selectedPeriod.startDate}&period_End=${selectedPeriod.endDate}`);
      if (response.ok) {
        const html = await response.text();
        setPreviewContent(html);
        setShowSummaryPreview(true);
      } else {
        alert("Failed to fetch summary preview.");
      }
    } catch (err) { console.error(err); }
  };

  const handleDownloadSummary = async () => {
    if (!selectedPeriod) return;
    try {
      const response = await fetchWithAuth(`/api/payroll/summary-pdf?period_Start=${selectedPeriod.startDate}&period_End=${selectedPeriod.endDate}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PayrollSummary_${selectedPeriod.label.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to download summary. Ensure payroll is processed for this period.");
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
  }, [periodIdFromUrl]);

  // --- Filtering & Pagination Logic ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || statusFilter !== "All";

  const filteredPayrolls = payrolls.filter(p => {
    const fullName = `${p.user_FirstName || p.userName} ${p.user_LastName || ""}`.toLowerCase();
    const formattedId = formatUserId(p.user_Id).toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(query) || formattedId.includes(query);

    const status = (p.PaystatusName || p.statusName || "Draft").toLowerCase();
    const matchesStatus = statusFilter === "All" || status === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredPayrolls.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredPayrolls.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:px-4 py-6 w-full overflow-x-hidden min-w-0">
        
        {/* Header section with back button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-start md:items-center gap-4">
            <Link 
              to="/payroll" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
            >
              <ArrowBackIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">
                {selectedPeriod?.label} {selectedPeriod?.status === 'Draft' ? "Current Period" : "Previous Period"}
              </h1>
              <span className="text-sm text-slate-500 mt-1 block">
                {selectedPeriod?.startDate ? new Date(selectedPeriod.startDate).toLocaleDateString() : "—"} to {selectedPeriod?.endDate ? new Date(selectedPeriod.endDate).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
            <Button 
              className="w-full sm:w-auto bg-[#f8fafc] text-[#2A174E] border border-slate-200 hover:bg-slate-100" 
              onClick={handlePreviewSummary}
              disabled={loading || payrolls.length === 0}
            >
              <VisibilityIcon className="mr-2 h-4 w-4" /> Summary View
            </Button>
            <Button 
              className={`w-full sm:w-auto bg-[#2A174E] text-white border border-[#b8daff] hover:bg-[#BA90E9] ${selectedPeriod?.status !== 'Draft' ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => setIsConfirmOpen(true)}
              disabled={selectedPeriod?.status !== 'Draft'}
            >
              <GroupsOutlinedIcon className="mr-2 h-4 w-4" /> {selectedPeriod?.status === 'Draft' ? "Process Batch" : "Processed"}
            </Button>
            
            {/* <Button 
              className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700" 
              onClick={handleDownloadSummary}
              disabled={loading || payrolls.length === 0 || selectedPeriod?.status === 'Draft'}
            >
              <DownloadIcon className="mr-2 h-4 w-4" /> Export PDF
            </Button> */}
            {/* <Button 
              className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]" 
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshIcon className={` h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button> */}
          </div>
        </div>

         {/* Statistics Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
            {/* Card 1: Total Active Users */}
            <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Net Pay</p>
                  <p className="text-3xl font-bold text-[#2A174E]">₱{stats.totalNetPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">Calculated total distribution amount</p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <PaymentsIcon className="h-6 w-6" />
              </div>
              </CardContent>
            </Card>

            {/* Card 2: Employees */}
            <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                 <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Total Earnings</p>
                  <p className="text-3xl font-bold text-[#3B4E17]">₱{stats.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <p className="text-xs text-[#3B4E17]/70 italic mt-4">Gross pay including OT and allowances</p>
              </div>
              <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <KeyboardDoubleArrowUpIcon className="h-6 w-6" />
              </div>
              </CardContent>
            </Card>

            {/* Card 3: Admins & Supervisors */}
            <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
              <CardContent className="px-5 py-5 flex justify-between h-full">
                <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Total Deductions</p>
                  <p className="text-3xl font-bold text-[#BB8B26]">₱{stats.totalDeductions.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <p className="text-xs text-[#BB8B26]/70 italic mt-4">Withholdings including taxes and loans</p>
              </div>
              <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <KeyboardDoubleArrowDownIcon className="h-6 w-6" />
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
                placeholder="Search by Employee Name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Released">Released</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isFiltering && (
                <Button 
                  variant="ghost" 
                  onClick={handleClearFilters}
                  className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                >
                  <CloseIcon className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="shadow-sm border-0 bg-white py-0">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 italic">Loading payroll records...</div>
            ) : (
              <Table className="min-w-[800px]">
                <TableHeader className="bg-[#2B174F]">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-white py-4">BASIC PAY</TableHead>
                    <TableHead className="font-semibold text-white py-4">EARNINGS</TableHead>
                    <TableHead className="font-semibold text-white py-4">DEDUCTIONS</TableHead>
                    <TableHead className="font-semibold text-white py-4">NET PAY</TableHead>
                    <TableHead className="font-semibold text-white py-4">STATUS</TableHead>
                    <TableHead className="font-semibold text-white py-4 text-right pr-6">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.length > 0 ? (
                    currentData.map(p => {
                      let badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-200";
                      const statusLabel = p.PaystatusName || p.statusName || "Draft";
                      if (statusLabel.toLowerCase() === "released") {
                        badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200";
                      }

                      return (
                        <TableRow key={p.payrollId} className="border-b-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-4 px-6">
                            <div className="font-semibold text-[#2A174E]">{p.user_FirstName || p.userName} {p.user_LastName || ""}</div>
                            <div className="text-xs text-slate-400 font-mono">ID: {formatUserId(p.user_Id)}</div>
                          </TableCell>
                          <TableCell className="py-4 text-slate-700">₱{parseFloat(p.basicPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                          <TableCell className="py-4 text-green-600 font-semibold">+₱{parseFloat(p.totalEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                          <TableCell className="py-4 text-red-500 font-semibold">-₱{parseFloat(p.totalDeductions).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                          <TableCell className="py-4 font-bold text-slate-900">₱{parseFloat(p.netPay).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                          <TableCell className="py-4">
                            <Badge variant="secondary" className={`font-semibold uppercase tracking-wide ${badgeStyle}`}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right pr-6">
                            <Button variant="outline" size="sm" asChild className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors">
                              <Link to={`/payrollDetails/${p.payrollId}?start=${p.period_Start || selectedPeriod.startDate}&end=${p.period_End || selectedPeriod.endDate}`}>
                                {/* <VisibilityIcon className="mr-1 h-4 w-4" />  */} View Details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                          <span className="font-semibold text-slate-600">No payroll records found</span>
                          <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            {totalItems > 0 && !loading && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Rows per page:</span>
                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(val) => setItemsPerPage(Number(val))}
                    >
                      <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="font-medium">
                    Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{totalItems}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">
                    {currentPage}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProcessPayrollModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleBatchProcess}
        employeeCount={payrolls.length}
      />

      {/* Summary Preview Modal */}
      {showSummaryPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border-0 overflow-hidden py-0">
            <CardContent className="p-0 flex flex-col h-full">
              <div className="flex justify-between items-center p-4 bg-[#2A174E] text-white">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <VisibilityIcon /> Payroll Summary Preview - {selectedPeriod?.label}
                </h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDownloadSummary} className="bg-green-600 hover:bg-green-700 text-white border-0">
                    <DownloadIcon className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowSummaryPreview(false)} className="text-white hover:bg-white/10">
                    <CloseIcon />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-4 custom-scrollbar">
                <div className="bg-white shadow-lg mx-auto min-w-[1000px] p-8" dangerouslySetInnerHTML={{ __html: previewContent }} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}} />
      </Sidebar>
    </div>
  );
};

export default PayrollPeriod;