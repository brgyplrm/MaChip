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
  HelpCircle,
  Percent,
  Sparkles
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip 
} from "recharts";
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

const colorStyleMap = {
  "brand-primary": {
    border: "border-brand-primary",
    text: "text-brand-primary",
    iconBox: "bg-brand-primary/10 text-brand-primary",
    subText: "text-brand-primary/70",
  },
  "accent-green": {
    border: "border-accent-green",
    text: "text-accent-green",
    iconBox: "bg-accent-green/10 text-accent-green",
    subText: "text-accent-green/70",
  },
  "accent-gold": {
    border: "border-accent-gold",
    text: "text-accent-gold",
    iconBox: "bg-accent-gold/10 text-accent-gold",
    subText: "text-accent-gold/70",
  },
  "status-info": {
    border: "border-status-info",
    text: "text-status-info",
    iconBox: "bg-status-info/10 text-status-info",
    subText: "text-status-info/70",
  },
  "status-danger": {
    border: "border-status-danger",
    text: "text-status-danger",
    iconBox: "bg-status-danger/10 text-status-danger",
    subText: "text-status-danger/70",
  },
};

function MetricCard({ label, value, color, description, icon: Icon, tooltip, loading }) {
  const styles = colorStyleMap[color] || colorStyleMap["brand-primary"];
  return (
    <Card className={`border-t-5 ${styles.border} bg-white py-0 h-full shadow-sm`}>
      <CardContent className="px-5 py-5 flex justify-between h-full text-left">
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className={`text-xs font-bold ${styles.text} uppercase tracking-wider`}>{label}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center cursor-help">
                      <HelpCircle className={`h-3 w-3 ${styles.text}/60 hover:${styles.text}`} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-32 my-1" />
            ) : (
              <p className={`text-4xl font-bold ${styles.text}`}>{value}</p>
            )}
          </div>
          {description && (
            <p className={`text-xs ${styles.subText} italic mt-4`}>{description}</p>
          )}
        </div>
        {Icon && (
          <div className={`${styles.iconBox} p-3 rounded-lg flex items-center justify-center shrink-0 self-start`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount || 0);
};

const TrajectoryTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xl border border-slate-800 text-xs min-w-[210px] space-y-2">
        <div className="border-b border-slate-800 pb-1.5">
          <p className="font-bold text-slate-200">{data.fullPeriod}</p>
          <p className="text-[10px] text-slate-400">Regular Payroll Cutoff</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-accent-green font-semibold">
              <span className="w-2 h-2 rounded-full bg-accent-green"></span> Net Take-Home:
            </span>
            <span className="font-bold text-white">{formatCurrency(data.net)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-brand-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-brand-primary"></span> Gross Pay:
            </span>
            <span className="font-semibold text-slate-300">{formatCurrency(data.gross)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-accent-gold font-semibold">
              <span className="w-2 h-2 rounded-full bg-accent-gold"></span> Deductions:
            </span>
            <span className="font-semibold text-slate-300">-{formatCurrency(data.deductions)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span>Recorded Attendance:</span>
            <span className="font-medium text-slate-200">{data.daysWorked} Days Worked</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const EmployeePayrollHistory = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  
  // Trajectory Chart States
  const [chartRange, setChartRange] = useState("all"); // "all" | "h2" | "last6"
  const [showNet, setShowNet] = useState(true);
  const [showGross, setShowGross] = useState(true);
  const [showDed, setShowDed] = useState(true);
  
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

  // Chronological Trajectory Chart Data
  const chartData = useMemo(() => {
    const regular = payrolls.filter(p => {
      const yr = new Date(p.displayDate).getFullYear();
      return yr === targetYear && p.type === "Regular Payroll";
    });

    // Chronological order (oldest to newest for trajectory)
    const sorted = [...regular].sort((a, b) => new Date(a.period_Start) - new Date(b.period_Start));

    let filtered = sorted;
    if (chartRange === "h2") {
      filtered = sorted.filter(p => new Date(p.period_Start).getMonth() >= 6);
      if (filtered.length === 0) filtered = sorted.slice(-Math.ceil(sorted.length / 2));
    } else if (chartRange === "last6") {
      filtered = sorted.slice(-6);
    }

    return filtered.map((p, idx, arr) => {
      const start = new Date(p.period_Start);
      const end = new Date(p.period_End);
      const label = `${end.toLocaleDateString("en-US", { month: "short" })} ${end.getDate()}`;
      const net = parseFloat(p.netPay || p.amount || 0);
      const gross = parseFloat(p.totalEarnings || 0);
      const deductions = parseFloat(p.totalDeductions || 0);
      
      const prevNet = idx > 0 ? parseFloat(arr[idx - 1].netPay || arr[idx - 1].amount || 0) : null;
      const diffPercent = prevNet && prevNet > 0 ? (((net - prevNet) / prevNet) * 100).toFixed(1) : null;

      return {
        id: p.payrollId,
        cutoff: label,
        fullPeriod: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        net,
        gross,
        deductions,
        daysWorked: p.NoDays_Worked || 0,
        diffPercent
      };
    });
  }, [payrolls, targetYear, chartRange]);

  const chartStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const peakCutoff = [...chartData].sort((a, b) => b.net - a.net)[0];
    const latest = chartData[chartData.length - 1];
    return {
      peakCutoff,
      latestDiff: latest?.diffPercent
    };
  }, [chartData]);

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

          {/* Trajectory Line Chart Hero (Option 1) */}
          <Card className="border-t-5 border-brand-primary bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden mb-6 py-0">
            {/* Chart Header & Integrated Quick KPI Strip */}
            <CardHeader className="p-4 sm:p-5 md:p-6 border-b border-slate-100 bg-slate-50/40 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                    Semi-Monthly Take-Home & Earnings Trajectory
                  </CardTitle>
                  <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                    CY {targetYear}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Cutoff-by-cutoff breakdown of Gross Compensation, Total Deductions, and Credited Net Pay
                </p>
              </div>

              {/* Integrated Quick Metric Strip */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* YTD Net */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                      <div className="h-8 w-8 rounded-lg bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Net Pay</p>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(ytdOverview.net)}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Total take-home pay credited across {ytdOverview.count} regular cutoffs in {targetYear}
                  </TooltipContent>
                </Tooltip>

                {/* Avg per Cutoff */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                      <div className="h-8 w-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg / Cutoff</p>
                        <p className="text-sm font-black text-brand-primary">
                          {formatCurrency(ytdOverview.count > 0 ? ytdOverview.net / ytdOverview.count : 0)}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Average net earnings received per semi-monthly cutoff period
                  </TooltipContent>
                </Tooltip>

                {/* Deduction Load */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                      <div className="h-8 w-8 rounded-lg bg-accent-gold/10 text-accent-gold flex items-center justify-center shrink-0">
                        <Percent className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deduction Load</p>
                        <p className="text-sm font-black text-slate-700">
                          {ytdOverview.gross > 0 ? ((ytdOverview.deductions / ytdOverview.gross) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                    Total statutory shares, taxes, and loan amortizations as a percentage of gross pay
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
              {/* Filter & Series Toggles Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                {/* Range Filter Buttons */}
                <div className="inline-flex p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setChartRange("all")}
                    className={`px-3 py-1 font-semibold rounded-md transition-all text-xs ${
                      chartRange === "all"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Full Year ({ytdOverview.count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange("h2")}
                    className={`px-3 py-1 font-semibold rounded-md transition-all text-xs ${
                      chartRange === "h2"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Recent 6 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange("last6")}
                    className={`px-3 py-1 font-semibold rounded-md transition-all text-xs ${
                      chartRange === "last6"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Last 6 Cutoffs
                  </button>
                </div>

                {/* Series Toggle Checkboxes */}
                <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showNet}
                      onChange={(e) => setShowNet(e.target.checked)}
                      className="rounded text-accent-green focus:ring-accent-green/30 h-3.5 w-3.5 accent-[#92b71b]"
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent-green"></span>
                    <span className={showNet ? "text-slate-800 font-bold" : "text-slate-400 line-through"}>Net Take-Home</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showGross}
                      onChange={(e) => setShowGross(e.target.checked)}
                      className="rounded text-brand-primary focus:ring-brand-primary/30 h-3.5 w-3.5 accent-[#1058c7]"
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
                    <span className={showGross ? "text-slate-800 font-bold" : "text-slate-400 line-through"}>Gross Pay</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showDed}
                      onChange={(e) => setShowDed(e.target.checked)}
                      className="rounded text-accent-gold focus:ring-accent-gold/30 h-3.5 w-3.5 accent-[#C4A300]"
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent-gold"></span>
                    <span className={showDed ? "text-slate-800 font-bold" : "text-slate-400 line-through"}>Deductions</span>
                  </label>
                </div>
              </div>

              {/* Chart Body */}
              {loading ? (
                <div className="h-72 w-full flex flex-col justify-center items-center gap-3">
                  <Skeleton className="h-60 w-full rounded-xl" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-64 w-full flex flex-col justify-center items-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-2">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <p className="font-bold text-slate-700 text-sm">No regular payroll records released for {targetYear}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Semi-monthly trajectory will chart automatically once payslips are published.</p>
                </div>
              ) : chartData.length === 1 ? (
                <div className="h-64 w-full flex flex-col justify-between p-4 bg-slate-50/40 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-brand-primary bg-brand-primary/5 p-3 rounded-lg border border-brand-primary/10">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>Showing 1 released cutoff ({chartData[0].fullPeriod}). Trajectory slope activates when subsequent cutoffs are released.</span>
                  </div>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="cutoff" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <RechartsTooltip content={<TrajectoryTooltip />} />
                        {showNet && <Area type="monotone" dataKey="net" stroke="#92b71b" fill="#92b71b" fillOpacity={0.2} strokeWidth={3} />}
                        {showGross && <Line type="monotone" dataKey="gross" stroke="#1058c7" strokeDasharray="4 4" strokeWidth={2} />}
                        {showDed && <Line type="monotone" dataKey="deductions" stroke="#C4A300" strokeWidth={2} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-72 sm:h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#92b71b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#92b71b" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1058c7" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1058c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="cutoff" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 11 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} 
                        tick={{ fill: "#64748b", fontSize: 11 }} 
                      />
                      <RechartsTooltip content={<TrajectoryTooltip />} />

                      {showNet && (
                        <Area 
                          type="monotone" 
                          dataKey="net" 
                          name="Net Take-Home"
                          stroke="#92b71b" 
                          fillOpacity={1} 
                          fill="url(#netGradient)" 
                          strokeWidth={3} 
                          dot={{ r: 3, fill: '#92b71b', strokeWidth: 1, stroke: '#fff' }}
                          activeDot={{ r: 6, fill: '#92b71b', stroke: '#fff', strokeWidth: 2 }}
                        />
                      )}

                      {showGross && (
                        <Line 
                          type="monotone" 
                          dataKey="gross" 
                          name="Gross Pay"
                          stroke="#1058c7" 
                          strokeWidth={2} 
                          strokeDasharray="4 4"
                          dot={{ r: 2.5, fill: '#1058c7' }}
                          activeDot={{ r: 5, fill: '#1058c7', stroke: '#fff', strokeWidth: 2 }}
                        />
                      )}

                      {showDed && (
                        <Line 
                          type="monotone" 
                          dataKey="deductions" 
                          name="Deductions"
                          stroke="#C4A300" 
                          strokeWidth={2} 
                          dot={{ r: 2.5, fill: '#C4A300' }}
                          activeDot={{ r: 5, fill: '#C4A300', stroke: '#fff', strokeWidth: 2 }}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Footer Callouts */}
              {chartStats?.peakCutoff && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[11px]">
                      <ArrowUpRight className="h-3 w-3" /> Peak Cutoff
                    </span>
                    <span>
                      Highest take-home in {chartStats.peakCutoff.cutoff} ({formatCurrency(chartStats.peakCutoff.net)} credited net pay).
                    </span>
                  </div>
                  <span className="italic text-slate-400 text-[11px]">Values synchronized with official released payroll logs</span>
                </div>
              )}
            </CardContent>
          </Card>
  
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
