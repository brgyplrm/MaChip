import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import {
  Wallet,
  CheckCircle2,
  Sparkles,
  Download,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  PlusCircle,
  HelpCircle,
  ArrowUpRight,
  Flag
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose
} from "@/components/ui/sheet";

const LoanBurnDownTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xl border border-slate-800 text-xs min-w-[220px] space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
          <div>
            <p className="font-bold text-slate-200">{data.cutoff}</p>
            <p className="text-[10px] text-slate-400">{data.fullDate}</p>
          </div>
          <span className="text-[10px] bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-2 py-0.5 rounded font-mono font-bold">
            {data.activeCount} Active
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-brand-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-brand-primary"></span> Remaining Debt:
            </span>
            <span className="font-bold text-white">₱{data.balance.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-accent-green font-semibold">
              <span className="w-2 h-2 rounded-full bg-accent-green"></span> Cutoff Deduction:
            </span>
            <span className="font-semibold text-slate-300">₱{data.deduction.toLocaleString()}</span>
          </div>

          {data.milestone && (
            <div className="pt-1.5 border-t border-slate-800 text-[11px] text-emerald-400 flex items-start gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
              <span>{data.milestone}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function EmployeeLoans() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  // Trajectory Chart States
  const [loanHorizon, setLoanHorizon] = useState("full"); // "full" | "6m"
  const [showBalance, setShowBalance] = useState(true);
  const [showDeduction, setShowDeduction] = useState(true);

  // Drawer state for selected loan ledger
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState(null);

  // Active relief phase tab index for highlight
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);

  // Fetch employee loans and roadmap summary
  const fetchLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth("/api/payroll/my-loans");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load loan data.");
      }
      const data = await res.json();
      setLoans(data.loans || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Error fetching employee loans:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  // Fetch individual loan ledger for the drawer
  const handleOpenDrawer = async (loanId) => {
    setSelectedLoanId(loanId);
    setDrawerOpen(true);
    setLedgerLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/my-loans/${loanId}/ledger`);
      if (res.ok) {
        const data = await res.json();
        setDrawerData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to load loan ledger:", err);
      }
    } catch (err) {
      console.error("Error loading loan ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Download PDF statement
  const handleDownloadPDF = async (loanId) => {
    try {
      const res = await fetchWithAuth(`/api/payroll/my-loans/${loanId}/pdf`);
      if (!res.ok) throw new Error("Failed to download loan statement PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Loan_Statement_${loanId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert("Could not download loan statement PDF. Please try again.");
    }
  };

  const activeLoans = useMemo(() => loans.filter(l => l.status === "active"), [loans]);
  const completedLoans = useMemo(() => loans.filter(l => l.status !== "active"), [loans]);

  // Dynamic Burn-Down Projection Time Series
  const burnDownData = useMemo(() => {
    if (!summary || activeLoans.length === 0) return [];

    const now = new Date();
    const getNextCutoffDate = (currentDate) => {
      const d = new Date(currentDate);
      if (d.getDate() < 15) {
        return new Date(d.getFullYear(), d.getMonth(), 15);
      } else {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
      }
    };

    const getFollowingCutoff = (cutoffDate) => {
      const d = new Date(cutoffDate);
      if (d.getDate() === 15) {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
      } else {
        return new Date(d.getFullYear(), d.getMonth() + 1, 15);
      }
    };

    let currentLoanStates = activeLoans.map(l => ({
      id: l.id,
      title: l.title,
      remaining: parseFloat(l.remainingBalance || 0),
      deduction: parseFloat(l.deductionPerCutoff || 0),
      payoffDate: l.payoffDate ? new Date(l.payoffDate) : null,
      isCleared: false
    }));

    let currentBalance = currentLoanStates.reduce((sum, l) => sum + l.remaining, 0);
    let currentDeduction = currentLoanStates.reduce((sum, l) => sum + l.deduction, 0);

    const points = [];

    // Point 0: Current Point
    points.push({
      cutoff: "Current",
      fullDate: "Present Portfolio State",
      balance: Math.round(currentBalance),
      deduction: Math.round(currentDeduction),
      milestone: null,
      activeCount: currentLoanStates.length
    });

    let iterDate = getNextCutoffDate(now);
    let guard = 0;

    while (currentBalance > 0 && guard < 36) {
      guard++;
      const cutoffLabel = `${iterDate.toLocaleDateString("en-US", { month: "short" })} ${iterDate.getDate()}`;
      const cutoffFull = iterDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      
      let newlyCleared = [];

      currentLoanStates = currentLoanStates.map(loan => {
        if (loan.isCleared) return loan;

        const nextRem = Math.max(0, loan.remaining - loan.deduction);
        const reachedPayoff = (loan.payoffDate && iterDate >= loan.payoffDate) || nextRem <= 0;

        if (reachedPayoff && !loan.isCleared) {
          newlyCleared.push(loan);
          return {
            ...loan,
            remaining: 0,
            deduction: 0,
            isCleared: true
          };
        }

        return {
          ...loan,
          remaining: nextRem
        };
      });

      currentBalance = currentLoanStates.reduce((sum, l) => sum + l.remaining, 0);
      currentDeduction = currentLoanStates.reduce((sum, l) => sum + l.deduction, 0);
      const remainingActive = currentLoanStates.filter(l => !l.isCleared).length;

      let milestoneText = null;
      if (newlyCleared.length > 0) {
        if (remainingActive === 0) {
          milestoneText = `100% Debt-Free! All loans cleared.`;
        } else {
          milestoneText = `${newlyCleared.map(l => l.title).join(", ")} Cleared (+₱${newlyCleared.reduce((s, l) => s + l.deduction, 0)}/cutoff)`;
        }
      }

      points.push({
        cutoff: cutoffLabel,
        fullDate: cutoffFull,
        balance: Math.round(currentBalance),
        deduction: Math.round(currentDeduction),
        milestone: milestoneText,
        activeCount: remainingActive
      });

      iterDate = getFollowingCutoff(iterDate);
    }

    if (loanHorizon === "6m") {
      return points.slice(0, 13);
    }

    return points;
  }, [summary, activeLoans, loanHorizon]);

  // Color theme mapper
  const getLoanTheme = (color) => {
    switch (color) {
      case "purple":
        return {
          barBg: "bg-purple-600",
          badgeBg: "bg-purple-100 text-purple-800 border-purple-200",
          text: "text-purple-700",
          dot: "bg-purple-600",
          flag: "bg-purple-50 text-purple-900 border-purple-200"
        };
      case "green":
        return {
          barBg: "bg-emerald-600",
          badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          text: "text-emerald-700",
          dot: "bg-emerald-600",
          flag: "bg-emerald-50 text-emerald-900 border-emerald-200"
        };
      case "blue":
        return {
          barBg: "bg-sky-600",
          badgeBg: "bg-sky-100 text-sky-800 border-sky-200",
          text: "text-sky-700",
          dot: "bg-sky-600",
          flag: "bg-sky-50 text-sky-900 border-sky-200"
        };
      case "gold":
      default:
        return {
          barBg: "bg-amber-500",
          badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
          text: "text-amber-700",
          dot: "bg-amber-500",
          flag: "bg-amber-50 text-amber-900 border-amber-200"
        };
    }
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="flex flex-col w-full min-h-screen bg-slate-50/50">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

            {/* Header Section (Standard Employee Page Layout) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">
                  My Loan Repayments &amp; Horizon
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Concurrent amortization schedules, step-down cashflow relief milestones, and statement ledger audit.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  asChild
                  className="w-full sm:w-auto border-slate-200 text-slate-700 hover:text-brand-primary hover:border-brand-primary/40 font-semibold shadow-xs"
                >
                  <Link to="/requests" state={{ defaultTab: "loan" }}>
                    <PlusCircle className="mr-2 h-4 w-4 text-brand-primary" /> Apply for Loan / Advance
                  </Link>
                </Button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <p>{error}</p>
                <Button variant="ghost" size="sm" onClick={fetchLoans} className="ml-auto text-rose-800 font-bold hover:bg-rose-100">
                  Retry
                </Button>
              </div>
            )}

            {/* 1. DEBT BURN-DOWN TRAJECTORY HERO (Option 1) */}
            <Card className=" bg-white rounded-2xl shadow-xs overflow-hidden mb-6 py-0">
              {/* Header & Integrated Quick KPI Strip */}
              <CardHeader className="p-4 sm:p-5 md:p-6 border-b border-slate-100 bg-slate-50/40 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                      Debt Burn-Down &amp; Amortization Horizon
                    </CardTitle>
                    <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {summary?.activeLoansCount || 0} Active Stream{summary?.activeLoansCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Projected balance reduction across future semi-monthly cutoffs through final maturity
                  </p>
                </div>

                {/* Integrated 4-Metric Strip */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  {/* Total Outstanding */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                        <div className="h-8 w-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Balance</p>
                          <p className="text-sm font-black text-slate-900">₱{summary?.totalOutstanding || "0.00"}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Combined principal balance across all active loans
                    </TooltipContent>
                  </Tooltip>

                  {/* Next Cutoff Deduction */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                        <div className="h-8 w-8 rounded-lg bg-accent-gold/10 text-accent-gold flex items-center justify-center shrink-0">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next Cutoff</p>
                          <p className="text-sm font-black text-accent-gold">₱{summary?.nextCutoffDeduction || "0.00"}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Total parallel deduction scheduled on your upcoming paycheck
                    </TooltipContent>
                  </Tooltip>

                  {/* Earliest Relief */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs cursor-help">
                        <div className="h-8 w-8 rounded-lg bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Earliest Relief</p>
                          <p className="text-sm font-black text-accent-green">
                            {summary?.earliestPayoff ? summary.earliestPayoff.payoffDate : "None"}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      {summary?.earliestPayoff
                        ? `${summary.earliestPayoff.title} clears, freeing +₱${summary.earliestPayoff.freedPerCutoff}/cutoff`
                        : "No active loans pending payoff"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
                {/* Filter & Series Toggles Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Horizon Range Buttons */}
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setLoanHorizon("full")}
                      className={`px-3 py-1 font-semibold rounded-md transition-all text-xs ${
                        loanHorizon === "full"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Full Horizon ({burnDownData.length > 0 ? `${burnDownData.length - 1} Cutoffs` : "0"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoanHorizon("6m")}
                      className={`px-3 py-1 font-semibold rounded-md transition-all text-xs ${
                        loanHorizon === "6m"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Next 6 Months
                    </button>
                  </div>

                  {/* Series Toggle Checkboxes */}
                  <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showBalance}
                        onChange={(e) => setShowBalance(e.target.checked)}
                        className="rounded text-brand-primary focus:ring-brand-primary/30 h-3.5 w-3.5 accent-[#1058c7]"
                      />
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
                      <span className={showBalance ? "text-slate-800 font-bold" : "text-slate-400 line-through"}>
                        Remaining Liability (₱)
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showDeduction}
                        onChange={(e) => setShowDeduction(e.target.checked)}
                        className="rounded text-accent-green focus:ring-accent-green/30 h-3.5 w-3.5 accent-[#92b71b]"
                      />
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent-green"></span>
                      <span className={showDeduction ? "text-slate-800 font-bold" : "text-slate-400 line-through"}>
                        Cutoff Deduction (₱)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Chart Body */}
                {loading ? (
                  <div className="h-72 w-full flex flex-col justify-center items-center gap-3">
                    <Skeleton className="h-60 w-full rounded-xl" />
                  </div>
                ) : activeLoans.length === 0 ? (
                  <div className="h-64 w-full flex flex-col justify-center items-center text-center p-6 bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200">
                    <div className="p-3.5 rounded-full bg-emerald-100 text-emerald-700 mb-3">
                      <ShieldCheck className="h-8 w-8" />
                    </div>
                    <p className="font-bold text-emerald-900 text-base">Congratulations! You are 100% Debt-Free</p>
                    <p className="text-emerald-700 text-xs mt-1 max-w-md">
                      There are zero active loan amortizations deducting from your salary. 100% of your earned compensation is credited directly to your bank account.
                    </p>
                  </div>
                ) : (
                  <div className="h-72 sm:h-80 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={burnDownData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1058c7" stopOpacity={0.25} />
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
                          yAxisId="balance"
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} 
                          tick={{ fill: "#64748b", fontSize: 11 }} 
                        />
                        <YAxis 
                          yAxisId="deduction"
                          orientation="right"
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(val) => `₱${val}`} 
                          tick={{ fill: "#92b71b", fontSize: 11 }} 
                        />
                        <RechartsTooltip content={<LoanBurnDownTooltip />} />

                        {showBalance && (
                          <Area 
                            yAxisId="balance"
                            type="monotone" 
                            dataKey="balance" 
                            name="Remaining Debt"
                            stroke="#1058c7" 
                            fillOpacity={1} 
                            fill="url(#balanceGradient)" 
                            strokeWidth={3} 
                            dot={{ r: 3, fill: '#1058c7', strokeWidth: 1, stroke: '#fff' }}
                            activeDot={{ r: 6, fill: '#1058c7', stroke: '#fff', strokeWidth: 2 }}
                          />
                        )}

                        {showDeduction && (
                          <Line 
                            yAxisId="deduction"
                            type="stepAfter" 
                            dataKey="deduction" 
                            name="Cutoff Deduction"
                            stroke="#92b71b" 
                            strokeWidth={2.5} 
                            strokeDasharray="4 4"
                            dot={{ r: 2.5, fill: '#92b71b' }}
                            activeDot={{ r: 5, fill: '#92b71b', stroke: '#fff', strokeWidth: 2 }}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Footer Milestones Callout */}
                {summary?.earliestPayoff && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-bold text-[11px] border border-emerald-100">
                        <Flag className="h-3 w-3" /> Next Relief: {summary.earliestPayoff.payoffDate}
                      </span>
                      <span>
                        {summary.earliestPayoff.title} cleared (+₱{summary.earliestPayoff.freedPerCutoff}/cutoff restored to take-home pay).
                      </span>
                    </div>
                    <span className="italic text-slate-400 text-[11px]">Values calculated from append-only loan deduction ledger</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. CONCURRENT REPAYMENT STREAMS (Proposal 5 Visual Roadmap) */}
            {activeLoans.length > 0 && (
              <Card className="bg-white border-slate-200/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base sm:text-lg font-bold text-slate-800">
                          Concurrent Repayment Streams
                        </CardTitle>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-slate-400 hover:text-brand-primary cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs max-w-sm">
                            All active loans are deducted in parallel from each semi-monthly paycheck. Click any track bar or lane to slide out its immutable statement ledger.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Multi-track horizon. Click any track to inspect its statement ledger drawer.
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-brand-primary/20 font-semibold px-3 py-1 text-xs">
                      {activeLoans.length} Concurrent Stream{activeLoans.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  {/* Color Legend Bar */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 mt-2 text-xs text-slate-600 border-t border-slate-100">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Loan Legend:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-600 inline-block"></span>
                      <span className="font-medium text-slate-700">SSS Salary Loan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block"></span>
                      <span className="font-medium text-slate-700">Pag-IBIG MPL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span className="font-medium text-slate-700">Company Advance</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border border-emerald-300 bg-emerald-100 inline-block"></span>
                      <span className="font-medium text-slate-700">Paid Off / Relieved</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-4">
                  {/* Timeline Lanes */}
                  {activeLoans.map((loan) => {
                    const theme = getLoanTheme(loan.color);
                    const progress = Math.min(100, Math.max(5, loan.progressPct || 0));

                    return (
                      <div
                        key={loan.id}
                        className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-center p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/60 transition-all cursor-pointer group"
                        onClick={() => handleOpenDrawer(loan.id)}
                        title="Click to inspect loan statement ledger"
                      >
                        {/* Left Column: Loan Summary Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-slate-800 group-hover:text-brand-primary transition-colors">
                              {loan.title}
                            </h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${theme.badgeBg}`}>
                              {loan.category.split(" ")[0]}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            <strong className="text-rose-600 font-mono font-semibold">PHP {loan.deductionPerCutoff}</strong> / cutoff &bull;{" "}
                            <span className="font-normal text-slate-500">{loan.cutoffsRemaining} cutoff{loan.cutoffsRemaining === 1 ? "" : "s"} left</span>
                          </div>
                        </div>

                        {/* Right Column: Multi-Track Gantt Bar & Payoff Milestone Flag */}
                        <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden flex items-center shadow-inner">
                          {/* Active Repayment Progress Bar */}
                          <div
                            className={`h-full ${theme.barBg} transition-all duration-500 flex items-center px-3 text-white text-xs font-semibold tracking-normal`}
                            style={{ width: `${progress}%` }}
                          >
                            <span className="truncate">Active (PHP {loan.deductionPerCutoff}/cutoff)</span>
                          </div>

                          {/* Milestone Payoff Flag */}
                          <div
                            className={`absolute -translate-x-1/2 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs border z-10 ${theme.flag}`}
                            style={{ left: `${Math.min(92, Math.max(8, progress))}%` }}
                          >
                            Payoff: {loan.payoffDate}
                          </div>

                          {/* Relieved / Freed Take-Home Striped Zone */}
                          {progress < 100 && (
                            <div
                              className="absolute top-0 bottom-0 right-0 bg-emerald-50/90 border-l border-emerald-300 flex items-center justify-center text-[10px] font-semibold text-emerald-800 tracking-wider px-2"
                              style={{ left: `${progress}%` }}
                            >
                              FREED: +PHP {(parseFloat(loan.deductionPerCutoff) * 2).toFixed(2)}/MO
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* 3. STEP-DOWN RELIEF PHASES STRIP (Proposal 5 Feature) */}
                  {summary?.reliefPhases && summary.reliefPhases.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Step-Down Relief Phases
                          </h4>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-brand-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs max-w-xs">
                              Interactive cashflow timeline. Click or hover any phase pill to preview how take-home salary increases as concurrent loans drop off.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Click a phase to view impact</span>
                      </div>

                      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                        {summary.reliefPhases.map((phase, idx) => {
                          const isSelected = activePhaseIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActivePhaseIndex(idx)}
                              className={`px-4 py-2.5 rounded-full border text-left shrink-0 transition-all flex flex-col justify-center ${
                                isSelected
                                  ? "bg-brand-primary text-white border-brand-primary shadow-sm ring-2 ring-brand-primary/20"
                                  : phase.isDebtFree
                                    ? "bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <span className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-800"}`}>{phase.title}</span>
                              <span className={`text-[10px] mt-0.5 ${isSelected ? "text-purple-100" : phase.isDebtFree ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                                {phase.activeLoansCount} Loan{phase.activeLoansCount === 1 ? "" : "s"} &bull; PHP {phase.deductionPerCutoff}/cutoff
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Phase Detail Callout */}
                      {summary.reliefPhases[activePhaseIndex] && (
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <span>{summary.reliefPhases[activePhaseIndex].description}</span>
                          </div>
                          <div className="font-mono font-bold text-emerald-700">
                            Cumulative: +PHP {summary.reliefPhases[activePhaseIndex].freedMonthly}/mo restored
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 4. CONSOLIDATED LOAN MASTERLIST TABLE */}
            <Card className="bg-white border-slate-200/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-800">
                    Loan Accounts &amp; Statement Ledgers
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any account row to view detailed amortization ledger and download official statement PDF.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loans.length === 0 && !loading ? (
                  <div className="text-center py-12 px-4">
                    <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800">No Active or Past Loan Deductions</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      You do not have any registered company loans, salary advances, or bank amortizations on file.
                    </p>
                    <Button asChild size="sm" className="bg-brand-primary text-white">
                      <Link to="/requests" state={{ defaultTab: "loan" }}>
                        Submit Cash Advance Request
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Loan Account</th>
                          <th className="py-3 px-4">Reference #</th>
                          <th className="py-3 px-4 text-right">Deduction / Cutoff</th>
                          <th className="py-3 px-4 text-right">Total Borrowed</th>
                          <th className="py-3 px-4 text-right">Remaining Balance</th>
                          <th className="py-3 px-4 w-44">Repayment Progress</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right pr-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loans.map((loan) => {
                          const isActive = loan.status === "active";
                          const theme = getLoanTheme(loan.color);

                          return (
                            <tr
                              key={loan.id}
                              onClick={() => handleOpenDrawer(loan.id)}
                              className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                !isActive ? "opacity-75 bg-slate-50/30" : ""
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className={`font-semibold text-sm ${isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>
                                  {loan.title}
                                </div>
                                <div className="text-xs text-slate-400 font-normal">
                                  {loan.institution}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                {loan.reference}
                              </td>

                              <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-rose-600">
                                {isActive ? `- PHP ${loan.deductionPerCutoff}` : "PHP 0.00"}
                              </td>

                              <td className="py-3.5 px-4 text-right font-mono text-sm text-slate-700">
                                PHP {loan.totalAmount}
                              </td>

                              <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-brand-primary">
                                PHP {loan.remainingBalance}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${isActive ? theme.barBg : "bg-emerald-500"}`}
                                    style={{ width: `${loan.progressPct}%` }}
                                  />
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex justify-between font-normal">
                                  <span>{loan.progressPct}%</span>
                                  <span>{loan.cutoffsPaid}/{loan.totalCutoffs} cutoffs</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs font-semibold ${
                                    isActive
                                      ? loan.cutoffsRemaining <= 2
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {isActive ? (loan.cutoffsRemaining <= 2 ? "Final Stretch" : "Active") : "Paid Off"}
                                </Badge>
                              </td>

                              <td className="py-3.5 px-4 text-right pr-6">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDrawer(loan.id);
                                  }}
                                  className="text-xs font-semibold border-slate-200 hover:text-brand-primary hover:border-brand-primary"
                                >
                                  View Ledger <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 5. SLIDE-OVER DETAIL DRAWER (Radix UI Sheet Primitive) */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 bg-white">
                <SheetHeader className="pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary font-bold uppercase text-[10px] tracking-wider">
                      {drawerData?.loan?.provider || "Official Statement"}
                    </Badge>
                  </div>
                  <SheetTitle className="text-lg font-bold text-brand-primary">
                    {drawerData?.loan ? `${drawerData.loan.deductionType.toUpperCase()} Amortization Ledger` : "Loan Ledger"}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500 font-normal">
                    Immutable append-only payroll deduction audit history for reference account #{drawerData?.loan?.reference || selectedLoanId}.
                  </SheetDescription>
                </SheetHeader>

                {ledgerLoading ? (
                  <div className="py-8 space-y-4">
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                  </div>
                ) : drawerData?.loan ? (
                  <div className="py-5 space-y-6">
                    {/* Quick Loan Metric Snapshot */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-2.5 text-xs text-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Loan Reference:</span>
                        <span className="font-mono font-semibold text-slate-900">{drawerData.loan.reference || `REF-${drawerData.loan.id}`}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Contract Date:</span>
                        <span className="font-semibold text-slate-800">{drawerData.loan.contractDate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Original Principal:</span>
                        <span className="font-mono font-semibold text-slate-900">PHP {drawerData.loan.totalAmount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Amortization / Cutoff:</span>
                        <span className="font-mono font-bold text-rose-600">- PHP {drawerData.loan.deductionPerCutoff}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-semibold">
                        <span className="text-slate-800">Remaining Balance:</span>
                        <span className="font-mono text-brand-primary text-base font-bold">PHP {drawerData.loan.remainingBalance}</span>
                      </div>
                    </div>

                    {/* Deduction Payment Ledger Table */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Payroll Deduction History ({drawerData.history?.length || 0})
                        </h4>
                        <span className="text-[11px] text-slate-400">Append-Only Audit</span>
                      </div>

                      {(!drawerData.history || drawerData.history.length === 0) ? (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                          No payroll deductions recorded yet for this loan account.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                              <tr>
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Period</th>
                                <th className="py-2.5 px-3 text-right">Deducted</th>
                                <th className="py-2.5 px-3 text-right">Balance After</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {drawerData.history.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-3 font-medium text-slate-700">{item.deductionDate}</td>
                                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]" title={item.periodLabel || `${item.period_Start} to ${item.period_End}`}>
                                    {item.periodLabel || (item.period_Start ? `${item.period_Start} to ${item.period_End}` : "Payroll Cutoff")}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                    - PHP {item.amountDeducted}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                    PHP {item.balanceAfter}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* PDF Statement Download Trigger */}
                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(drawerData.loan.id)}
                        className="text-xs font-semibold border-brand-primary/30 text-brand-primary hover:bg-brand-primary/5"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download Statement PDF
                      </Button>
                      <SheetClose asChild>
                        <Button variant="secondary" size="sm" className="text-xs font-semibold">
                          Close
                        </Button>
                      </SheetClose>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Failed to load loan details.
                  </div>
                )}
              </SheetContent>
            </Sheet>

          </div>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
}
