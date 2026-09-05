import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import CakeIcon from "@mui/icons-material/Cake";
import WorkIcon from "@mui/icons-material/Work";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EditIcon from "@mui/icons-material/Edit";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutline";
import HistoryIcon from "@mui/icons-material/History";
import EmptyState from "../../../components/EmptyState";  
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TablePagination } from "@/components/ui/table-pagination";

const RetirementPay = () => {
  const { systemToday } = useSystemTime();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [retirementDate, setRetirementDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [showGuideline, setShowGuideline] = useState(true);

  // Edit Modal State
  const [editRecord, setEditRecord] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // --- Pagination & Filter States ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

    const [startIndex, setStartIndex] = useState(0);
    const [endIndex, setEndIndex] = useState(0);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // Filtering and Pagination Logic
  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return history;
    return history.filter(h => {
      const firstLast = `${h.user_FirstName || ""} ${h.user_LastName || ""}`.toLowerCase();
      const lastFirst = `${h.user_LastName || ""} ${h.user_FirstName || ""}`.toLowerCase();
      const status = (h.status || "").toLowerCase();
      const id = String(h.user_Id || "");
      return firstLast.includes(q) || lastFirst.includes(q) || status.includes(q) || id.includes(q);
    });
  }, [history, searchQuery]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth("/api/users/all");
      const data = await res.json();
      if (res.ok) {
        setEmployees(Array.isArray(data) ? data : (data.users || []));
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetchWithAuth("/api/payroll/retirement/history");
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, []);

  const handlePreview = async () => {
    if (!selectedUser || !retirementDate) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/preview?user_Id=${selectedUser}&retirementDate=${retirementDate}`);
      const data = await res.json();
      if (res.ok) {
        setPreview(data);
      } else {
        setToast({ message: data.error || "Failed to fetch preview", type: "error" });
        setPreview(null);
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/payroll/retirement/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: selectedUser,
          retirementDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to generate", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!editRecord || !newDate) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/update-date/${editRecord.retirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retirementDate: newDate })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        setIsEditModalOpen(false);
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to update date", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (id) => {
    if (!window.confirm("Release this retirement pay? This will mark the tax exemption as used for this employee.")) return;
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/release/${id}`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to release", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    }
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen">
        <div className="p-1 overflow-x-hidden w-full max-w-6xl mx-auto">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

          {showGuideline && (
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-4 w-full">
              <Card className="bg-blue-50 border-blue-200 shadow-none mb-4 w-full py-0 relative">
                <CardContent className="flex items-start gap-4 p-4 pr-12">
                  <div className="bg-blue-100 p-2 rounded-lg mt-0.5">
                    <InfoOutlinedIcon className="h-5 w-5 text-[#005a9c]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#005a9c] text-sm">Policy Guideline</h3>
                    <p className="text-sm text-blue-900/80 mt-0.5">
                      Calculate and process statutory retirement benefits according to Article 302 (RA 7641).
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setShowGuideline(false)}
                        className="absolute top-4 right-4 text-blue-900/40 hover:text-blue-900/80 transition-colors"
                      >
                        ✕
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Dismiss Policy Guideline
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="calculator" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="calculator">Compute Benefits</TabsTrigger>
              <TabsTrigger value="history">Retirement Payout History</TabsTrigger>
            </TabsList>

            <TabsContent value="calculator">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Card */}
                <Card className="lg:col-span-1 shadow-sm border-0 bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#2A174E]">Employee Selection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Employee</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder="Search Employee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                              {emp.user_LastName}, {emp.user_FirstName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Retirement Date</Label>
                      <Input 
                        type="date" 
                        value={retirementDate} 
                        onChange={(e) => setRetirementDate(e.target.value)}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <Button 
                      onClick={handlePreview} 
                      className="w-full bg-[#2A174E] text-white"
                      disabled={loading || !selectedUser}
                    >
                      <SearchIcon className="mr-2 h-4 w-4" /> Compute Retirement
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview Results */}
                <div className="lg:col-span-2 space-y-6">
                  {preview ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="shadow-sm border-0 bg-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                              <CakeIcon className="h-4 w-4" /> Eligibility Profile
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Current Age:</span>
                              <div className="flex items-center gap-2">
                                {preview.age < 60 && <span className="text-[10px] text-rose-500 font-bold uppercase">(Req: 60)</span>}
                                <span className={`font-bold ${preview.age >= 60 ? 'text-green-600' : 'text-amber-600'}`}>{preview.age} Years Old</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Tenure (Rounded):</span>
                              <div className="flex items-center gap-2">
                                {preview.yearsOfService < 5 && <span className="text-[10px] text-rose-500 font-bold uppercase">(Req: 5)</span>}
                                <span className={`font-bold ${preview.yearsOfService >= 5 ? 'text-green-600' : 'text-amber-600'}`}>{preview.yearsOfService} Years</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                                {preview.isEligible ? (
                                    <Badge className="bg-green-100 text-green-700">Fully Eligible</Badge>
                                ) : (
                                    <Badge variant="destructive">Ineligible for Statutory Pay</Badge>
                                )}
                                {preview.isCompulsory && <Badge className="bg-blue-100 text-blue-700">Compulsory (65+)</Badge>}
                                {preview.isTaxExempt && <Badge className="bg-purple-100 text-purple-700">Tax Exempt (BIR)</Badge>}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="shadow-sm border-0 bg-[#2A174E] text-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-purple-200 uppercase flex items-center gap-2">
                              <ReceiptIcon className="h-4 w-4" /> Final Computation
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-black">{formatCurrency(preview.totalAmount)}</p>
                            <p className="text-[10px] text-purple-200/70 mt-1">Formula: Daily Rate ({formatCurrency(preview.dailyRate)}) × 22.5 Days × {preview.yearsOfService} Yrs</p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="shadow-sm border-t-6 border-[#2A174E] bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Computation Breakdown (1/2 Month Salary)</CardTitle>
                          <CardDescription>Legal components per RA 7641 comprising the 22.5-day multiplier.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">15 Days Salary</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.salary15Days)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">5 Days SIL</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.sil5Days)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">2.5 Days (1/12 of 13th)</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.thirteenthMonth2_5Days)}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 italic">
                            * One-half (1/2) month salary is equivalent to 22.5 days. The COLA is excluded from this computation per legal mandates.
                          </div>

                          {/* Comprehensive Retirement Pay Formula Breakdown Box */}
                          <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl space-y-3 text-left">
                            <div className="flex items-center space-x-2 text-[#2A174E] font-bold text-xs uppercase tracking-wide">
                              <InfoOutlinedIcon className="w-4 h-4 text-purple-600" />
                              <span>Comprehensive Retirement Benefit Formula Breakdown (RA 7641)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div className="bg-white p-3 rounded-lg border border-purple-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Step 1: Daily Wage Base</p>
                                <p className="font-bold text-slate-800">{formatCurrency(preview.dailyRate)}</p>
                                <p className="text-[10px] text-slate-500">Live Daily Rate</p>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-purple-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Step 2: Legal Multiplier</p>
                                <p className="font-bold text-purple-700">22.5 Days / Year</p>
                                <p className="text-[10px] text-slate-500">(15d Basic + 5d SIL + 2.5d 1/12th 13th)</p>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-purple-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Step 3: Service Tenure</p>
                                <p className="font-bold text-blue-600">{preview.yearsOfService} Years</p>
                                <p className="text-[10px] text-slate-500">({preview.diffMonths} months, 6+ mos = 1 yr)</p>
                              </div>
                            </div>
                            <div className="p-3 bg-white border border-purple-200 rounded-lg text-xs font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <span className="text-slate-600">
                                Formula: {formatCurrency(preview.dailyRate)} × 22.5 Days × {preview.yearsOfService} Yrs
                              </span>
                              <span className="font-bold text-[#2A174E] text-sm">
                                = {formatCurrency(preview.totalAmount)}
                              </span>
                            </div>
                          </div>

                          
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-t-6 border-[#2A174E] bg-white overflow-hidden text-left py-0">
                        <CardHeader className=" text-[#2A174E] pt-6">
                          <CardTitle className="text-base font-bold text-[#2A174E] flex items-center gap-2">
                            <span>Final Settlement Breakdown & Mathematical Basis</span>
                          </CardTitle>
                          <CardDescription className="text-[#2A174E] text-xs mt-0.5">
                            Itemized mathematical origin for pro-rated 13th month, leave encashment, and final worked days.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* 1. Pro-rated 13th Month Card */}
                            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col justify-between space-y-3">
                              <div className="flex justify-between items-start">
                                <Badge className="bg-indigo-100 text-indigo-700 font-bold text-[10px]">PD 851 Mandate</Badge>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pro-rated 13th Month</span>

                              <div>
                                <p className="text-2xl font-black text-indigo-950">{formatCurrency(preview.backPay.prorated13thMonth)}</p>
                                <p className="text-[11px] font-semibold text-indigo-700 mt-1">Basis: {formatCurrency(preview.backPay.totalBasicYear)}</p>
                                <p className="text-[10px] text-slate-500 italic mt-0.5 leading-tight">
                                  Origin of Basis: Total basic salary earnings accrued from Jan 1 of current year up to retirement date.
                                </p>
                              </div>
                              <div className="pt-2 border-t border-indigo-100 font-mono text-[10px] text-indigo-900 font-medium">
                                Formula: {formatCurrency(preview.backPay.totalBasicYear)} ÷ 12
                              </div>
                            </div>

                            {/* 2. Leave Conversion Card */}
                            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-col justify-between space-y-3">
                              <div className="flex justify-between items-start">
                                <Badge className="bg-emerald-100 text-emerald-700 font-bold text-[10px]">SIL / Leave Encashment</Badge>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Conversion</span>
                              <div>
                                <p className="text-2xl font-black text-emerald-950">{formatCurrency(preview.backPay.leaveConversion)}</p>
                                <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                                  Total Credits: {parseFloat(preview.backPay.vlBalance || 0) + parseFloat(preview.backPay.slBalance || 0)} Days ( VL +  SL)
                                </p>
                                <p className="text-[10px] text-slate-500 italic mt-0.5 leading-tight">
                                  Origin of Basis: Remaining Vacation & Sick Leave credits multiplied by live Daily Rate ({formatCurrency(preview.dailyRate)}).
                                </p>
                              </div>
                              <div className="pt-2 border-t border-emerald-100 font-mono text-[10px] text-emerald-900 font-medium">
                                Formula: {parseFloat(preview.backPay.vlBalance || 0) + parseFloat(preview.backPay.slBalance || 0)} Credits × {formatCurrency(preview.dailyRate)}
                              </div>
                            </div>

                            {/* 3. Final Worked Days Card */}
                            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 flex flex-col justify-between space-y-3">
                              <div className="flex justify-between items-start">
                                <Badge className="bg-amber-100 text-amber-700 font-bold text-[10px]">Unbilled Days</Badge>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Final Worked Days</span>
                              <div>
                                <p className="text-2xl font-black text-amber-950">{formatCurrency(preview.backPay.finalWorkedSalary)}</p>
                                <p className="text-[11px] font-semibold text-amber-700 mt-1">
                                  Days Worked: {preview.backPay.workedDaysCount} Days
                                </p>
                                <p className="text-[10px] text-slate-500 italic mt-0.5 leading-tight">
                                  Origin of Basis: Attendance logs rendered after last closed payroll cutoff up to retirement date.
                                </p>
                              </div>
                              <div className="pt-2 border-t border-amber-100 font-mono text-[10px] text-amber-900 font-medium">
                                Formula: {preview.backPay.workedDaysCount} Days × {formatCurrency(preview.dailyRate)}
                              </div>
                            </div>
                          </div>

                          {/* Outstanding Loan Deduction Banner if any */}
                          {preview.loanDeductions > 0 && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex justify-between items-center">
                              <div>
                                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Outstanding Loan / Advance Balance</p>
                                <p className="text-[10px] text-rose-500 italic">Mandatory deduction deducted from settlement package per SSS/company rules.</p>
                              </div>
                              <p className="text-2xl font-black text-rose-600">-{formatCurrency(preview.loanDeductions)}</p>
                            </div>
                          )}

                          {/* FINAL PAY COMPUTATION GRAND TOTAL CARD */}
                          <div className="p-5 bg-gradient-to-br from-[#2A174E] to-indigo-950 text-white rounded-2xl shadow-md border border-indigo-800 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                              <div>
                                <p className="text-xs font-bold text-purple-200 uppercase tracking-widest">Final Retirement Pay Settlement Package Grand Total</p>
                                <p className="text-[10px] text-slate-300">Consolidated back pay components + statutory retirement benefit (RA 7641) minus outstanding loans</p>
                              </div>
                              <Badge className="bg-emerald-500 text-white font-bold text-xs">Final Retirement Summary</Badge>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                                <p className="text-[9px] font-bold text-purple-200 uppercase">Gross Back Pay</p>
                                <p className="font-bold text-white text-sm">
                                  {formatCurrency(
                                    parseFloat(preview.backPay.prorated13thMonth || 0) + 
                                    parseFloat(preview.backPay.leaveConversion || 0) + 
                                    parseFloat(preview.backPay.finalWorkedSalary || 0)
                                  )}
                                </p>
                              </div>
                              <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                                <p className="text-[9px] font-bold text-purple-200 uppercase">Retirement Pay (RA 7641)</p>
                                <p className="font-bold text-purple-300 text-sm">
                                  {formatCurrency(preview.totalAmount || 0)}
                                </p>
                              </div>
                              <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                                <p className="text-[9px] font-bold text-purple-200 uppercase">Outstanding Loans</p>
                                <p className="font-bold text-rose-300 text-sm">
                                  -{formatCurrency(preview.loanDeductions || 0)}
                                </p>
                              </div>
                              <div className="bg-emerald-500/20 p-2.5 rounded-lg border border-emerald-400/40">
                                <p className="text-[9px] font-bold text-emerald-300 uppercase">Net Settlement Payable</p>
                                <p className="font-black text-emerald-400 text-base">
                                  {formatCurrency(preview.netAmount || 0)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button 
                            onClick={handleGenerate} 
                            className="w-full py-6 bg-green-600 hover:bg-green-700 text-white font-bold"
                            disabled={loading || !preview.isEligible}
                          >
                            <SaveIcon className="mr-2 h-4 w-4" /> Finalize Retirement Payout
                          </Button>
                        </CardContent>
                      </Card>

                      
                    </>
                  ) : (
                    <Card className="h-full flex items-center justify-center p-6 text-slate-400 italic">

                      <EmptyState 
                        icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                        title="Retirement Pay Preview"
                        description="Perform computation to see legal retirement benefit preview."
                      />
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">

              <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm border-0">
                <div className="relative w-full sm:w-80">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search employee name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  Showing {paginatedHistory.length} of {filteredHistory.length} records
                </div>
              </Card>
              <Card className="shadow-sm border-0 bg-white py-0">
                <CardHeader className="pt-6 pb-4 bg-[#2A174E]">
                  <CardTitle className="text-lg font-bold text-white">Retirement Records</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Retirement Date</TableHead>
                        <TableHead>Tenure</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tax Exempt</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistory.length > 0 ? paginatedHistory.map((h) => (
                        <TableRow key={h.retirementId}>
                          <TableCell className="font-bold text-[#2A174E]">{h.user_LastName}, {h.user_FirstName}</TableCell>
                          <TableCell>{new Date(h.retirementDate).toLocaleDateString()}</TableCell>
                          <TableCell>{h.yearsOfService} Years</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">{formatCurrency(parseFloat(h.totalAmount || 0) + parseFloat(h.backPay_Total || 0))}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">
                                Ret: {formatCurrency(h.totalAmount)} | Back: {formatCurrency(h.backPay_Total)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {h.isTaxExempt ? (
                                <Badge className="bg-purple-100 text-purple-700">Yes</Badge>
                            ) : (
                                <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={h.status === 'Released' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {h.status === 'Draft' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setEditRecord(h);
                                      setNewDate(h.retirementDate);
                                      setIsEditModalOpen(true);
                                    }}
                                    className="border-slate-200 text-slate-600 hover:bg-slate-50"
                                  >
                                    <EditIcon className="h-3 w-3 mr-1" /> Edit Date
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleRelease(h.retirementId)}
                                    className="bg-[#2A174E] text-white"
                                  >
                                    Release
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic p-6">
                            <EmptyState 
                              icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                              title="No Retirement Pay History"
                              description="Process Retirement Pay to see records here."
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {/* Pagination Controls */}
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    setCurrentPage={setCurrentPage}
                    totalItems={filteredHistory.length}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    itemLabel="records"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      {/* Edit Date Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Adjust Retirement Date</DialogTitle>
            <DialogDescription>
              Update the retirement date for {editRecord?.user_FirstName} {editRecord?.user_LastName}. 
              All benefits will be re-calculated based on this new date.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label>New Retirement Date</Label>
              <Input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800 font-medium italic">
                ℹ️ Changing the date may affect tenure rounding (Years of Service) and will re-audit attendance logs for the final salary component.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateDate} disabled={loading} className="bg-[#2A174E] text-white">
              {loading ? "Re-calculating..." : "Update & Re-calculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetirementPay;