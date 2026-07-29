import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Calendar,
  ArrowUpRight,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Gift,
  LogOut,
  UserCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EmployeePayrollHistory = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [historyRes, thirteenthRes, separationRes, retirementRes] = await Promise.all([
          fetchWithAuth("/api/payroll/my-history"),
          fetchWithAuth("/api/payroll/my-thirteenth-history"),
          fetchWithAuth("/api/payroll/my-separation"),
          fetchWithAuth("/api/payroll/my-retirement")
        ]);

        if (!historyRes.ok) throw new Error("Failed to fetch regular payroll history.");

        const historyData = await historyRes.json();
        const thirteenthData = await thirteenthRes.json();
        const separationData = await separationRes.json();
        const retirementData = await retirementRes.json();

        // Standardize data for a unified list
        const regularItems = (historyData || []).map(p => ({
          ...p,
          type: "Regular Payroll",
          displayDate: p.period_End,
          label: p.period_Label || `${new Date(p.period_Start).toLocaleDateString()} - ${new Date(p.period_End).toLocaleDateString()}`,
          amount: p.netPay,
          status: p.PaystatusName || "Released",
          id: `p-${p.payrollId}`,
          link: `/employee/payslip/${p.payrollId}`,
          daysWorked: p.NoDays_Worked
        }));

        const bonusItems = (thirteenthData || []).map(b => ({
          ...b,
          type: "13th Month Pay",
          displayDate: `${b.year}-12-24`, // Approximate for sorting
          label: `${b.year} Year-End Bonus`,
          amount: b.amount,
          status: b.status,
          id: `tm-${b.thirteenthId}`,
          link: `/employee/13th-month/${b.year}`,
          daysWorked: null
        }));

        const separationItems = (separationData || []).map(s => ({
          ...s,
          type: "Separation Pay",
          displayDate: s.separationDate,
          label: `Final Pay (${s.causeName})`,
          amount: s.netAmount,
          status: s.status,
          id: `sp-${s.separationId}`,
          link: null,
          daysWorked: s.yearsOfService ? `${s.yearsOfService} yrs service` : null
        }));

        const retirementItems = (retirementData || []).map(r => ({
          ...r,
          type: "Retirement Pay",
          displayDate: r.retirementDate,
          label: `Retirement Benefit`,
          amount: r.netAmount,
          status: r.status,
          id: `rt-${r.retirementId}`,
          link: null,
          daysWorked: r.yearsOfService ? `${r.yearsOfService} yrs service` : null
        }));

        // Combine and sort
        const combined = [
          ...regularItems,
          ...bonusItems,
          ...separationItems,
          ...retirementItems
        ].sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

        setPayrolls(combined);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  const availableYears = useMemo(() => {
    const years = payrolls.map(p => new Date(p.displayDate).getFullYear());
    return [...new Set(years)].sort((a, b) => b - a);
  }, [payrolls]);

  const months = [
    { value: "0", label: "January" }, { value: "1", label: "February" }, { value: "2", label: "March" },
    { value: "3", label: "April" }, { value: "4", label: "May" }, { value: "5", label: "June" },
    { value: "6", label: "July" }, { value: "7", label: "August" }, { value: "8", label: "September" },
    { value: "9", label: "October" }, { value: "10", label: "November" }, { value: "11", label: "December" },
  ];

  // Filtering Logic
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter(p => {
      const date = new Date(p.displayDate);
      const dateStr = date.toLocaleDateString().toLowerCase();
      const month = date.getMonth().toString();
      const year = date.getFullYear().toString();

      const matchesSearch = dateStr.includes(searchTerm.toLowerCase()) || 
                           p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMonth = selectedMonth === "all" || month === selectedMonth;
      const matchesYear = selectedYear === "all" || year === selectedYear;
      const matchesType = selectedType === "all" || p.type === selectedType;

      return matchesSearch && matchesMonth && matchesYear && matchesType;
    });
  }, [payrolls, searchTerm, selectedMonth, selectedYear, selectedType]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, selectedYear, selectedType]);

  const totalPages = Math.ceil(filteredPayrolls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayrolls = filteredPayrolls.slice(startIndex, startIndex + itemsPerPage);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMonth("all");
    setSelectedYear("all");
    setSelectedType("all");
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "13th Month Pay": return <Gift className="h-5 w-5" />;
      case "Separation Pay": return <LogOut className="h-5 w-5" />;
      case "Retirement Pay": return <UserCheck className="h-5 w-5" />;
      default: return <Calendar className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "13th Month Pay": return "bg-pink-50 text-pink-600";
      case "Separation Pay": return "bg-orange-50 text-orange-600";
      case "Retirement Pay": return "bg-blue-50 text-blue-600";
      default: return "bg-[#2A174E]/10 text-[#2A174E]";
    }
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-[#2A174E]" />
                My Payroll History
              </h1>
              <p className="text-slate-500 text-sm">View and download your past payslips and benefits.</p>
            </div>
          </div>
  
          <Card className="border-none shadow-sm overflow-hidden pt-1">
            <CardHeader className="bg-white border-b border-slate-100 p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Input 
                        placeholder="Search date, type or label..." 
                        className="pl-9 bg-slate-50 border-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                      Search by date, type, or label
                    </TooltipContent>
                  </Tooltip>
                </div>
  
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-[140px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="bg-slate-50 border-none">
                              <SelectValue placeholder="Payment Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="Regular Payroll">Regular Payroll</SelectItem>
                              <SelectItem value="13th Month Pay">13th Month Pay</SelectItem>
                              <SelectItem value="Separation Pay">Separation Pay</SelectItem>
                              <SelectItem value="Retirement Pay">Retirement Pay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Filter by payment type
                      </TooltipContent>
                    </Tooltip>
                  </div>
  
                  <div className="w-[130px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="bg-slate-50 border-none">
                              <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Months</SelectItem>
                              {months.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Filter by month
                      </TooltipContent>
                    </Tooltip>
                  </div>
  
                  <div className="w-[100px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="bg-slate-50 border-none">
                              <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Years</SelectItem>
                              {availableYears.map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Filter by year
                      </TooltipContent>
                    </Tooltip>
                  </div>
  
                  {(searchTerm || selectedMonth !== "all" || selectedYear !== "all" || selectedType !== "all") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearFilters}
                          className="text-slate-500 hover:text-red-500 gap-1"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Reset all search and filter conditions
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardHeader>
  
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : paginatedPayrolls.length > 0 ? (
                <>
                  <div className="divide-y divide-slate-100">
                    {paginatedPayrolls.map((p) => (
                      <div key={p.id} className="p-4 md:p-6 hover:bg-slate-50/80 transition-colors group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`p-3 rounded-xl cursor-help ${getTypeColor(p.type)}`}>
                                  {getTypeIcon(p.type)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Payment Category: {p.type}
                              </TooltipContent>
                            </Tooltip>
                            <div>
                              <p className="font-bold text-slate-800">
                                {p.label}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] uppercase font-bold cursor-help">
                                      {p.status}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                    This payment has been successfully processed and released.
                                  </TooltipContent>
                                </Tooltip>
                                <span className="text-[11px] text-slate-400">•</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-slate-500 cursor-help border-b border-dotted border-slate-300">
                                      {p.type === "Regular Payroll" ? `Days Worked: ${p.daysWorked}` : (p.daysWorked || p.type)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                    {p.type === "Regular Payroll" ? "Total working days logged in this cutoff period" : `Payment classification: ${p.type}`}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between md:justify-end gap-8">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-right cursor-help">
                                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Net Pay</p>
                                  <p className="text-lg font-black text-[#2A174E]">{formatCurrency(p.amount)}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Estimated net take-home pay for this payment
                              </TooltipContent>
                            </Tooltip>
                            {p.link ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button asChild variant="outline" size="sm" className="rounded-full group-hover:bg-[#2A174E] group-hover:text-white hover:bg-[#1d0f3b] hover:text-white transition-all">
                                    <Link to={p.link}>
                                      View Details
                                      <ArrowUpRight className="ml-2 h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                  View detailed breakdown and print payslip
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="rounded-full cursor-not-allowed opacity-50">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                  Detailed digital payslip unavailable for this payment type
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                      <p className="text-sm text-slate-500">
                        Showing <span className="font-medium text-slate-700">{startIndex + 1}</span> to <span className="font-medium text-slate-700">{Math.min(startIndex + itemsPerPage, filteredPayrolls.length)}</span> of <span className="font-medium text-slate-700">{filteredPayrolls.length}</span> results
                      </p>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                            Previous page
                          </TooltipContent>
                        </Tooltip>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Tooltip key={page}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className={`h-8 w-8 p-0 ${currentPage === page ? "bg-[#2A174E] hover:bg-[#3d2270]" : ""}`}
                                >
                                  {page}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Go to page {page}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
  
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                            Next page
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <FileText className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">No Records Found</h3>
                  <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                    {searchTerm || selectedMonth !== "all" || selectedYear !== "all" || selectedType !== "all"
                      ? "Try adjusting your search or filter terms." 
                      : "You don't have any released payment records yet."}
                  </p>
                  {(searchTerm || selectedMonth !== "all" || selectedYear !== "all" || selectedType !== "all") && (
                    <Button variant="link" onClick={clearFilters} className="mt-2 text-[#2A174E]">
                      Clear all filters
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
  
          {/* Info Card */}
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-bold">Missing a record?</p>
              <p className="opacity-80">Only released payments are visible here. This includes regular payroll, 13th month bonuses, and final pay. If you expect a record that isn't showing, please contact the Accounting department.</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default EmployeePayrollHistory;
