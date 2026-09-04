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
  CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </Sidebar>
    );
  }

  if (error || !payroll) {
    return (
      <Sidebar>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="bg-red-50 p-6 rounded-full mb-4">
            <Info className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Details Not Found</h2>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/employeeHome">Return to Dashboard</Link>
          </Button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="group flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-0">
              {/* Animated Back Button */}
              <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      asChild 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E]"
                    >
                      <Link to={`/employee/payslip/${id}`}>
                        <ChevronLeft className="h-6 w-6" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                    Back to payslip preview
                  </TooltipContent>
                </Tooltip>
              </div>
  
              <div className="space-y-1 transition-all duration-300 ease-in-out group-hover:pl-2">
                <h1 className="text-2xl font-bold text-slate-800">Computation Details</h1>
                <p className="text-slate-500 text-sm">
                  Breakdown of earnings and deductions for {new Date(payroll.period_Start).toLocaleDateString()} - {new Date(payroll.period_End).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-[#2A174E] text-white p-4 rounded-xl shadow-lg flex flex-col items-end cursor-help">
                  <span className="text-xs text-slate-300 uppercase font-semibold">Net Take Home</span>
                  <span className="text-2xl font-bold">{formatCurrency(payroll.netPay)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                Final net pay deposited to your account
              </TooltipContent>
            </Tooltip>
          </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* EARNINGS COLUMN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-100 p-2 rounded-lg text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Earnings & Increases</h2>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Basic Compensation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Basic Pay</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Calculated as Daily Rate × Scheduled Days - Absences
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.basicPay)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 ml-4 italic">Worked Days: {payroll.NoDays_Worked} days</span>
                  <span className="text-slate-400">@ {formatCurrency(payroll.dailyRate)} / day</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Overtime & Premiums</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Regular Overtime ({payroll.OT_Hrs} hrs)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Regular Overtime: hour-based compensation for work exceeding 8 hours (1.25x hourly rate)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.OT_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Night Differential ({payroll.nightDiff_Hrs} hrs)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Night Differential: 10% premium for work hours between 10:00 PM and 6:00 AM
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.nightDiff_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Night OT ({payroll.nightOT_Hrs} hrs)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Night Overtime: hour-based compensation for overtime worked during night hours (1.375x hourly rate)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.nightOT_Amnt)}</span>
                </div>
                <Separator className="bg-slate-50" />
                {(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0)) > 0 && (
                  <div className="pt-1">
                    <div 
                      className="flex justify-between items-center cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1.5 rounded-lg transition-colors group"
                      onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 font-medium group-hover:text-[#2A174E]">Holiday Pay</span>
                        <Tooltip>
                          <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                            Statutory holiday compensation (100% premium for regular holidays, 30% for special holidays)
                          </TooltipContent>
                        </Tooltip>
                        {isHolidayExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-[#2A174E]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-[#2A174E]" />
                        )}
                      </div>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}
                      </span>
                    </div>

                    {/* Accordion Detailed Content */}
                    {isHolidayExpanded && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-[#2A174E]/30 space-y-2 text-xs">
                        {Array.isArray(payroll.holidayBreakdown) && payroll.holidayBreakdown.length > 0 ? (
                          payroll.holidayBreakdown.map((item, idx) => (
                            <div key={idx} className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-100 space-y-1">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800">{item.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${item.type === 'Regular Holiday' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                                    {item.type}
                                  </span>
                                </div>
                                <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5">
                                <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • {item.worked ? `Worked ${item.hoursWorked} hrs` : 'Unworked'}</span>
                                <span className="font-mono text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.formula}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <>
                            {parseFloat(payroll.legalHol_Amnt || 0) > 0 && (
                              <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-100 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800">Regular Holiday Pay</span>
                                  <span className="font-bold text-slate-900">{formatCurrency(payroll.legalHol_Amnt)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono">100% Base in Basic Pay + 100% Regular Holiday Premium = 200% Total</p>
                              </div>
                            )}
                            {parseFloat(payroll.specialHol_Amnt || 0) > 0 && (
                              <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-100 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800">Special Holiday Pay</span>
                                  <span className="font-bold text-slate-900">{formatCurrency(payroll.specialHol_Amnt)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono">100% Base in Basic Pay + 30% Special Holiday Premium = 130% Total</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Allowances & Incentives</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Allowance</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.allowance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Incentives</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.incentives)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex justify-between items-center">
              <span className="font-bold text-green-800">Total Gross Earnings</span>
              <span className="font-bold text-green-700 text-xl">{formatCurrency(payroll.totalEarnings)}</span>
            </div>
          </div>

          {/* DEDUCTIONS COLUMN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-red-100 p-2 rounded-lg text-red-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Deductions</h2>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Government Contributions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">SSS Contribution</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Social Security System employee contribution share
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.SSS_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">PhilHealth Contribution</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Philippine Health Insurance Corporation employee share
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.Philhealth_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Pag-IBIG Contribution</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Home Development Mutual Fund (HDMF) employee share
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.HDMF_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Withholding Tax</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Withholding Tax: Tax contribution computed using official BIR TRAIN law tables
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.Tax_Ded)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Attendance Penalties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Absences ({payroll.absence_Hrs / 8} days)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Absence: Unworked scheduled days subtracted from base compensation
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-red-500">-{formatCurrency(payroll.absence_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Tardiness ({payroll.tardiness_Mins} mins)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Tardiness: Deductions calculated based on total late minutes logged
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-red-500">-{formatCurrency(payroll.tardiness_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">Unpaid Leaves ({payroll.unpaidLeave_Days} days)</span>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300 cursor-help" /></TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                        Unpaid Leaves: Salary deductions for days off taken without leave credits
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-semibold text-red-500">-{formatCurrency(payroll.unpaidLeave_Amnt)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Loans & Others</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">SSS Loan</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.SSS_Loan || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Pag-IBIG Loan</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.HDMF_Loan || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Cash Advance</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.advances_Amnt || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Health Card (Maxicare)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.healthCard_Amnt || 0)}</span>
                </div>
                {parseFloat(payroll.Other_Deductions || 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Other Deductions</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(payroll.Other_Deductions || 0)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
              <span className="font-bold text-red-800">Total Deductions</span>
              <span className="font-bold text-red-700 text-xl">{formatCurrency(payroll.totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Year-To-Date (YTD) Snapshot Card */}
        <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-r from-slate-900 via-[#2A174E] to-slate-900 text-white">
          <CardHeader className="pb-3 border-b border-white/10">
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

        {/* Audit / Info Banner */}
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Notice on Discrepancies</p>
              <p className="opacity-80">If you believe there is an error in your computation, please coordinate with the Accounting Department within 3 days of payroll release.</p>
            </div>
          </CardContent>
        </Card>
      </div>
     </TooltipProvider>
    </Sidebar>
  );
};

export default PayrollComputationDetails;
