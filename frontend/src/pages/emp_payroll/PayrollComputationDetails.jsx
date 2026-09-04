import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import { 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CalendarDays, 
  Receipt, 
  Briefcase, 
  Clock, 
  Gift, 
  Building2, 
  AlertCircle, 
  Wallet, 
  Banknote,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

const colorMap = {
  "[#2A174E]": "border-[#2A174E]",
  "emerald-500": "border-emerald-500",
  "rose-500": "border-rose-500",
  "amber-500": "border-amber-500",
  "indigo-500": "border-indigo-500",
  "blue-500": "border-blue-500"
};

function MetricCard({ label, value, color, description, icon: Icon, tooltip }) {
  return (
    <Card className={`border-t-4 ${colorMap[color] || 'border-[#2A174E]'} bg-white py-0 h-full shadow-sm`}>
      <CardContent className="p-5 flex flex-col justify-between h-full text-left">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center cursor-help">
                      <HelpCircle className="h-3 w-3 text-[#2A174E]/60 hover:text-[#2A174E]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-[10px]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-2xl font-black text-[#2A174E]">{value}</p>
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-xl ${
              color === 'emerald-500' ? 'bg-emerald-50 text-emerald-600' :
              color === 'blue-500' ? 'bg-blue-50 text-blue-600' :
              color === 'amber-500' ? 'bg-amber-50 text-amber-600' :
              color === 'rose-500' ? 'bg-rose-50 text-rose-600' :
              color === 'indigo-500' ? 'bg-indigo-50 text-indigo-600' :
              'bg-[#2A174E]/10 text-[#2A174E]'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 italic mt-3">{description}</p>
      </CardContent>
    </Card>
  );
}

const PayrollComputationDetails = () => {
  const { id } = useParams();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/payroll/my-payslip/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch payroll details.");
        }
        const data = await response.json();
        setPayroll(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayrollDetails();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Math.max(0, parseFloat(amount) || 0));
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      </Sidebar>
    );
  }

  if (error || !payroll) {
    return (
      <Sidebar>
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="bg-red-50 p-6 rounded-full mb-4">
            <Info className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Payroll Details Not Found</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-md">
            The requested payroll record could not be loaded or is not yet released for viewing.
          </p>
          <Button asChild className="mt-6 bg-[#2A174E] hover:bg-[#3d236e] text-white">
            <Link to="/employee/payroll">Return to Payroll History</Link>
          </Button>
        </div>
      </Sidebar>
    );
  }

  // Calculated subtotals for summary
  const totalHoliday = parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0);
  const totalGovContribs =
    (parseFloat(payroll.SSS_Ded || 0) +
    parseFloat(payroll.Philhealth_Ded || 0) +
    parseFloat(payroll.HDMF_Ded || 0) +
    parseFloat(payroll.Tax_Ded || 0));

  const totalAttendancePenalties =
    (parseFloat(payroll.absence_Amnt || 0) +
    parseFloat(payroll.tardiness_Amnt || 0) +
    parseFloat(payroll.unpaidLeave_Amnt || 0));

  const totalLoans =
    (parseFloat(payroll.SSS_Loan || 0) +
    parseFloat(payroll.HDMF_Loan || 0) +
    parseFloat(payroll.advances_Amnt || 0) +
    parseFloat(payroll.healthCard_Amnt || 0) +
    parseFloat(payroll.Other_Deductions || 0));

  const netRetainedPercent = payroll.totalEarnings > 0 
    ? ((payroll.netPay / payroll.totalEarnings) * 100).toFixed(0) 
    : 0;

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          {/* Top Header Section */}
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
                        className="text-[#2A174E] hover:bg-[#2A174E]/10 rounded-full"
                      >
                        <Link to={`/employee/payslip/${id}`}>
                          <ChevronLeft className="h-6 w-6" />
                        </Link>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                    Back to Payslip Details
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-800">Computation Details</h1>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none font-bold text-xs">
                    {payroll.PaystatusName || "Released"}
                  </Badge>
                </div>
                <p className="text-slate-500 text-sm">
                  Full statement of earnings, statutory withholdings, and net take home pay
                </p>
              </div>
            </div>

            {/* Net Take Home Card */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-[#2A174E] text-white px-5 py-2.5 rounded-xl shadow-sm flex flex-col items-end justify-center min-w-[160px] cursor-help">
                  <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Net Take Home</span>
                  <span className="text-2xl font-bold tracking-tight text-white">{formatCurrency(payroll.netPay)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                Final net pay credited to your account
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Overview Statistical Cards (Admin MetricCard Pattern) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <MetricCard
              label="Gross Earnings"
              value={formatCurrency(payroll.totalEarnings)}
              color="emerald-500"
              description="Basic pay, OT, night diff & allowances"
              icon={TrendingUp}
              tooltip="Total gross compensation earned before statutory deductions and taxes."
            />
            <MetricCard
              label="Total Deductions"
              value={`-${formatCurrency(payroll.totalDeductions)}`}
              color="rose-500"
              description="Taxes, statutory shares, absences & loans"
              icon={TrendingDown}
              tooltip="Combined statutory contributions, withholding tax, attendance penalties, and loan amortizations."
            />
            <MetricCard
              label="Net Retained"
              value={`${netRetainedPercent}%`}
              color="[#2A174E]"
              description={`${formatCurrency(payroll.netPay)} take-home pay`}
              icon={Wallet}
              tooltip="Percentage of gross earnings retained as net take-home pay."
            />
            <MetricCard
              label="Attendance Record"
              value={`${payroll.NoDays_Worked} Days`}
              color="indigo-500"
              description={`${payroll.NoHrs_Worked || 0} hrs worked @ ${formatCurrency(payroll.dailyRate)}/day`}
              icon={CalendarDays}
              tooltip="Total logged work days and hours present during this payroll period."
            />
          </div>

          {/* Main Consolidated Ledger Statement Card (Borderless, Clean Two-Column Layout) */}
          <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden py-0">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#2A174E]" />
                  Itemized Statement of Earnings & Deductions
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Complete cutoff audit trail from timekeeping logs and statutory rate tables
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-slate-600 border-none shadow-xs text-xs font-semibold px-3 py-1 w-fit">
                Period: {new Date(payroll.period_Start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(payroll.period_End).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* ========================================================================= */}
                {/* LEFT COLUMN: GROSS EARNINGS */}
                {/* ========================================================================= */}
                <div className="p-6 space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-lg">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm tracking-wide">Gross Earnings & Additions</h3>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        {formatCurrency(payroll.totalEarnings)}
                      </span>
                    </div>

                    {/* Section 1: Base Compensation */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Basic Compensation</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Daily Base Rate</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Daily salary rate locked for this cutoff
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.dailyRate)} / day</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Hourly Rate</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Standard hourly rate (Daily Rate ÷ 8)
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.ratePerHr || (payroll.dailyRate / 8))} / hr</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Scheduled / Worked Days</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Total scheduled days vs actual present attendance
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{payroll.NoDays_Worked} of {payroll.totalScheduledDays || payroll.NoDays_Worked} days</span>
                        </div>

                        <div className="flex justify-between items-center py-1">
                          <span className="font-semibold text-slate-700">Basic Pay Earned</span>
                          <span className="font-bold text-slate-800">{formatCurrency(payroll.basicPay)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Overtime & Premium Pay */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Overtime & Premiums</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Regular OT ({payroll.OT_Hrs || 0} hrs)</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Work exceeding 8 hours (1.25× rate)
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.OT_Amnt)}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Night Differential ({payroll.nightDiff_Hrs || 0} hrs)</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                10% premium for work between 10PM - 6AM
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.nightDiff_Amnt)}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Night Overtime ({payroll.nightOT_Hrs || 0} hrs)</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Overtime during night differential hours (1.375× rate)
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.nightOT_Amnt)}</span>
                        </div>

                        {/* Holiday Pay with Collapsible Breakdown */}
                        <div className="pt-0.5">
                          <div 
                            className="flex justify-between items-center cursor-pointer hover:bg-slate-50/80 -mx-1.5 px-1.5 py-1 rounded-lg transition-colors group"
                            onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-600 group-hover:text-[#2A174E]">Holiday Pay</span>
                              <Tooltip>
                                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                  Statutory holiday compensation (100% regular, 30% special)
                                </TooltipContent>
                              </Tooltip>
                              {isHolidayExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#2A174E]" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#2A174E]" />
                              )}
                            </div>
                            <span className="font-medium text-slate-800">{formatCurrency(totalHoliday)}</span>
                          </div>

                          {isHolidayExpanded && (
                            <div className="mt-2 ml-1 pl-3 border-l-2 border-[#2A174E]/30 space-y-1.5 text-xs">
                              {Array.isArray(payroll.holidayBreakdown) && payroll.holidayBreakdown.length > 0 ? (
                                payroll.holidayBreakdown.map((item, idx) => (
                                  <div key={idx} className="bg-slate-50/90 p-2 rounded-lg space-y-0.5">
                                    <div className="flex justify-between items-center">
                                      <span className="font-bold text-slate-800">{item.name}</span>
                                      <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex justify-between">
                                      <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {item.worked ? `${item.hoursWorked} hrs` : 'Unworked'}</span>
                                      <span className="font-mono text-slate-600">{item.formula}</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[11px] text-slate-500 italic p-1">
                                  Regular Holiday: {formatCurrency(payroll.legalHol_Amnt)} • Special Holiday: {formatCurrency(payroll.specialHol_Amnt)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Allowances & Incentives */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Gift className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Allowances & Supplementary Pay</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Regular Allowance</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.allowance)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-600">Performance Incentives</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.incentives)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Left Column Subtotal Box */}
                  <div className="bg-emerald-50/70 p-4 rounded-xl flex justify-between items-center mt-6">
                    <div>
                      <span className="font-bold text-emerald-950 text-sm block">Total Gross Earnings</span>
                      <span className="text-[11px] text-emerald-700">All earnings before tax and contributions</span>
                    </div>
                    <span className="font-bold text-emerald-700 text-xl">{formatCurrency(payroll.totalEarnings)}</span>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* RIGHT COLUMN: DEDUCTIONS */}
                {/* ========================================================================= */}
                <div className="p-6 space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="bg-rose-50 text-rose-700 p-1.5 rounded-lg">
                          <TrendingDown className="h-4 w-4" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm tracking-wide">Deductions & Withholdings</h3>
                      </div>
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
                        -{formatCurrency(payroll.totalDeductions)}
                      </span>
                    </div>

                    {/* Section 1: Statutory Deductions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Building2 className="h-3.5 w-3.5 text-rose-600" />
                        <span>Government Contributions (Employee Share)</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">SSS Contribution</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.SSS_Ded)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">PhilHealth Contribution</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.Philhealth_Ded)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Pag-IBIG (HDMF)</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.HDMF_Ded)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">Withholding Tax (BIR)</span>
                            <Tooltip>
                              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                Graduated withholding tax under TRAIN Law
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-bold text-slate-800">{formatCurrency(payroll.Tax_Ded)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Attendance Deductions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                        <span>Attendance Penalties</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Absences ({(payroll.absence_Hrs || 0) / 8} days / {payroll.absence_Hrs || 0} hrs)</span>
                          <span className="font-medium text-rose-600">-{formatCurrency(payroll.absence_Amnt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Tardiness / Lates ({payroll.tardiness_Mins || 0} mins)</span>
                          <span className="font-medium text-rose-600">-{formatCurrency(payroll.tardiness_Amnt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-600">Unpaid Leaves ({payroll.unpaidLeave_Days || 0} days)</span>
                          <span className="font-medium text-rose-600">-{formatCurrency(payroll.unpaidLeave_Amnt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Loans & Others */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Wallet className="h-3.5 w-3.5 text-rose-600" />
                        <span>Loans & Company Deductions</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">SSS Salary / Calamity Loan</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.SSS_Loan || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Pag-IBIG / HDMF Loan</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.HDMF_Loan || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Cash Advance Amortization</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.advances_Amnt || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-600">Health Card (Maxicare)</span>
                          <span className="font-medium text-slate-800">{formatCurrency(payroll.healthCard_Amnt || 0)}</span>
                        </div>
                        {parseFloat(payroll.Other_Deductions || 0) > 0 && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-600">Other Miscellaneous Deductions</span>
                            <span className="font-medium text-slate-800">{formatCurrency(payroll.Other_Deductions || 0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column Subtotal Box */}
                  <div className="bg-rose-50/70 p-4 rounded-xl flex justify-between items-center mt-6">
                    <div>
                      <span className="font-bold text-rose-950 text-sm block">Total Deductions</span>
                      <span className="text-[11px] text-rose-700">Statutory shares, attendance, and loans</span>
                    </div>
                    <span className="font-bold text-rose-700 text-xl">-{formatCurrency(payroll.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Net Pay Reconciliation Bar */}
              <div className="bg-slate-50/90 border-t border-slate-100 p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#2A174E] text-white p-2.5 rounded-xl">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Take-Home Formula</span>
                    <span className="text-xs text-slate-700 font-medium">
                      Gross ({formatCurrency(payroll.totalEarnings)}) – Deductions ({formatCurrency(payroll.totalDeductions)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Final Net Pay Credited</span>
                    <span className="text-2xl font-bold text-[#2A174E]">{formatCurrency(payroll.netPay)}</span>
                  </div>
                  <Button 
                    asChild
                    variant="ghost" 
                    className="text-[#2A174E] hover:bg-[#2A174E]/10 font-semibold text-xs gap-1.5 hidden md:flex"
                  >
                    <Link to={`/employee/payslip/${id}`}>
                      <span>Back to Payslip Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Year-To-Date (YTD) Summary Card (Borderless) */}
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-[#2A174E] to-slate-900 text-white py-0">
            <CardHeader className="p-5 pb-3 border-b border-white/10">
              <CardTitle className="text-base flex items-center gap-2 text-white font-semibold">
                <CalendarDays className="h-5 w-5 text-amber-400" />
                Year-To-Date (YTD) Accumulated Totals ({new Date(payroll.period_Start).getFullYear()})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">YTD Gross Earnings</p>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">{formatCurrency(payroll.ytdGross)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">YTD Non-Taxable</p>
                <p className="text-xl font-bold text-blue-300 mt-0.5">{formatCurrency(payroll.ytdNonTaxable)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">YTD Total Deductions</p>
                <p className="text-xl font-bold text-rose-300 mt-0.5">({formatCurrency(payroll.ytdDeductions)})</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">YTD Withholding Tax</p>
                <p className="text-xl font-bold text-amber-300 mt-0.5">({formatCurrency(payroll.ytdBIR)})</p>
              </div>
            </CardContent>
          </Card>

          {/* Notice on Discrepancies Card (Borderless) */}
          <Card className="bg-blue-50/80 border-none shadow-none rounded-xl py-0">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold">Notice on Payroll Discrepancies</p>
                <p className="opacity-85 text-xs mt-0.5">
                  If you notice any discrepancies in attendance logs, overtime hours, or deduction amounts, please coordinate with the Accounting & HR Department within three (3) working days from the release of this payslip.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default PayrollComputationDetails;
