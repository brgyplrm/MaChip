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
  UserCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownRight,
  CalendarDays,
  HelpCircle
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
import { TablePagination } from "@/components/ui/table-pagination";

const colorMap = {
  "brand-primary": "border-brand-primary",
  "accent-green": "border-accent-green",
  "accent-gold": "border-accent-gold",
  "status-info": "border-status-info",
  "rose-500": "border-status-danger",
  "indigo-500": "border-status-info",
  "blue-500": "border-status-info"
};

function MetricCard({ label, value, color, description, icon: Icon, tooltip, loading }) {
  return (
    <Card className={`border-t-4 ${colorMap[color] || 'border-brand-primary'} bg-white py-0 h-full shadow-sm`}>
      <CardContent className="px-5 py-6 flex flex-col justify-between h-full text-left">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center cursor-help">
                      <HelpCircle className="h-3 w-3 text-brand-primary/60 hover:text-brand-primary" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-[10px]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <p className="text-2xl font-black text-brand-primary">{value}</p>
            )}
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-xl ${
              color === 'emerald-500' ? 'bg-emerald-50 text-emerald-600' :
              color === 'blue-500' ? 'bg-blue-50 text-blue-600' :
              color === 'amber-500' ? 'bg-amber-50 text-amber-600' :
              color === 'rose-500' ? 'bg-rose-50 text-rose-600' :
              color === 'indigo-500' ? 'bg-indigo-50 text-indigo-600' :
              'bg-brand-primary/10 text-brand-primary'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {/* <p className="text-[10px] text-slate-500 italic mt-3">{description}</p> */}
      </CardContent>
    </Card>
  );
}

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
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

        const bonusItems = (thirteenthData || [])
          .filter(b => b.status === "Released")
          .map(b => ({
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

  const targetYear = selectedYear !== "all" ? parseInt(selectedYear) : (availableYears[0] || new Date().getFullYear());
  
  const ytdOverview = useMemo(() => {
    const yearPayrolls = payrolls.filter(p => {
      const yr = new Date(p.displayDate).getFullYear();
      return yr === targetYear && p.type === "Regular Payroll";
    });
    const gross = yearPayrolls.reduce((sum, p) => sum + parseFloat(p.totalEarnings || 0), 0);
    const net = yearPayrolls.reduce((sum, p) => sum + parseFloat(p.netPay || p.amount || 0), 0);
    const deductions = yearPayrolls.reduce((sum, p) => sum + parseFloat(p.totalDeductions || 0), 0);
    const daysWorked = yearPayrolls.reduce((sum, p) => sum + parseFloat(p.NoDays_Worked || 0), 0);
    return { gross, net, deductions, daysWorked, count: yearPayrolls.length, year: targetYear };
  }, [payrolls, targetYear]);

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
      default: return "bg-brand-primary/10 text-brand-primary";
    }
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          <div className="group flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-0">
              {/* Animated Back Button (Admin-style Hover Animation) */}
              <div className="w-0 overflow-hidden group-hover:w-10 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button 
                        asChild 
                        variant="ghost" 
                        size="icon" 
                        className="text-brand-primary hover:bg-brand-primary/10 rounded-full"
                      >
                        <Link to="/employeeHome">
                          <ChevronLeft className="h-6 w-6" />
                        </Link>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                    Back to Dashboard
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out">
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">My Payroll</h1>
                <p className="text-slate-500 text-sm">View and download your past payslips and benefits.</p>
              </div>
            </div>
          </div>

          {/* YTD Overview Cards for Current / Selected Year (Admin MetricCard Pattern) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <MetricCard
              label={`YTD Gross (${targetYear})`}
              value={formatCurrency(ytdOverview.gross)}
              color="brand-primary"
              description={`${ytdOverview.count} regular cutoffs released in ${targetYear}`}
              icon={TrendingUp}
              tooltip={`Cumulative gross compensation earned across all processed payroll cutoffs in ${targetYear}.`}
              loading={loading}
            />
            <MetricCard
              label={`YTD Net Pay (${targetYear})`}
              value={formatCurrency(ytdOverview.net)}
              color="accent-green"
              description="Total net take-home pay disbursed"
              icon={Wallet}
              tooltip={`Total net take-home pay credited to your account after all deductions in ${targetYear}.`}
              loading={loading}
            />
            <MetricCard
              label={`YTD Deductions (${targetYear})`}
              value={`-${formatCurrency(ytdOverview.deductions)}`}
              color="accent-gold"
              description="Taxes, statutory shares & loans"
              icon={TrendingDown}
              tooltip={`Cumulative withholding taxes, SSS, PhilHealth, Pag-IBIG contributions, and loans in ${targetYear}.`}
              loading={loading}
            />
            <MetricCard
              label={`YTD Days Worked (${targetYear})`}
              value={`${ytdOverview.daysWorked} Days`}
              color="status-info"
              description="Accumulated work attendance"
              icon={CalendarDays}
              tooltip={`Total recorded working days rendered and credited across payroll periods in ${targetYear}.`}
              loading={loading}
            />
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
                                  <p className="text-lg font-black text-brand-primary">{formatCurrency(p.amount)}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Estimated net take-home pay for this payment
                              </TooltipContent>
                            </Tooltip>
                            {p.link ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button asChild variant="outline" size="sm" className="rounded-full group-hover:bg-brand-primary group-hover:text-white hover:bg-[#1d0f3b] hover:text-white transition-all">
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
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    setCurrentPage={setCurrentPage}
                    totalItems={filteredPayrolls.length}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    startIndex={startIndex}
                    endIndex={Math.min(startIndex + itemsPerPage, filteredPayrolls.length)}
                    itemLabel="payslips"
                  />
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
                    <Button variant="link" onClick={clearFilters} className="mt-2 text-brand-primary">
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
