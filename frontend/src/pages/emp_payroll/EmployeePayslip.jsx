import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ViewPayslipModal from "../../components/ViewPayslipModal";
import { fetchWithAuth } from "../../utils/api";
import { 
  FileText, 
  ChevronLeft, 
  Info,
  Banknote,
  Calendar,
  User,
  ArrowRight,
  Eye,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarDays,
  Receipt,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import Toast from "../../components/toast/Toast";
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

function MetricCard({ label, value, color, description, icon: Icon, tooltip }) {
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
            <p className={`text-4xl font-bold ${styles.text}`}>{value}</p>
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

const EmployeePayslip = () => {
  const { id } = useParams();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(null); // 'standard' | 'detailed' | 'dtr' | null
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  useEffect(() => {
    const fetchPayslip = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/payroll/my-payslip/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch payslip details.");
        }
        const data = await response.json();
        setPayroll(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayslip();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  const handleDownloadPDF = async (type = "standard") => {
    try {
      setIsDownloading(type);
      const docLabel = type === "dtr" 
        ? "Daily Time Record (DTR)" 
        : type === "detailed" 
          ? "Detailed Payslip" 
          : "Standard Payslip";

      setToast({ message: `Generating ${docLabel} PDF...`, type: "info" });

      const endpoint = type === "dtr"
        ? `/api/payroll/my-payslip/${id}/dtr`
        : `/api/payroll/my-payslip/${id}/pdf?type=${type}`;

      const response = await fetchWithAuth(endpoint);
      if (!response.ok) {
        let errMessage = `Failed to download ${docLabel} PDF.`;
        try {
          const errData = await response.json();
          if (errData?.error) errMessage = errData.error;
        } catch {
          // not JSON
        }
        throw new Error(errMessage);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      if (type === "dtr") {
        a.download = `DTR_${payroll?.user_LastName || "Employee"}_${id}.pdf`;
      } else {
        const typeLabel = type === "detailed" ? "_Detailed" : "";
        a.download = `Payslip_${payroll?.user_LastName || "Employee"}_${id}${typeLabel}.pdf`;
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setToast({ message: `${docLabel} downloaded successfully!`, type: "success" });
    } catch (err) {
      console.error("Error downloading document PDF:", err);
      setToast({ message: err.message || "Failed to download document PDF.", type: "error" });
    } finally {
      setIsDownloading(null);
    }
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-44 rounded-lg" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-64 sm:w-80 rounded" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>

          {/* Metric Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[124px] w-full rounded-xl" />
            ))}
          </div>

          {/* Main Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Payslip Summary Skeleton */}
            <Skeleton className="lg:col-span-2 h-[340px] w-full rounded-xl" />

            {/* Quick Stats Sidebar Skeletons */}
            <div className="space-y-6">
              <Skeleton className="h-[158px] w-full rounded-xl" />
              <Skeleton className="h-[158px] w-full rounded-xl" />
            </div>
          </div>

          {/* Consolidated Itemized Statement Skeleton */}
          <Skeleton className="h-[520px] w-full rounded-2xl" />

          {/* YTD Totals Skeleton */}
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Notice Skeleton */}
          <Skeleton className="h-[72px] w-full rounded-xl" />
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
          <h2 className="text-2xl font-bold text-slate-800">Payslip Not Found</h2>
          <p className="text-slate-500 max-w-md mt-2">
            The payslip you are looking for might not exist or you don't have permission to view it.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/employeeHome">Return to Dashboard</Link>
          </Button>
        </div>
      </Sidebar>
    );
  }

  const netRetainedPercent = payroll?.totalEarnings > 0 
    ? ((payroll.netPay / payroll.totalEarnings) * 100).toFixed(0) 
    : 0;

  // Calculated subtotals for itemized statement
  const totalHoliday = parseFloat(payroll?.legalHol_Amnt || 0) + parseFloat(payroll?.specialHol_Amnt || 0);
  const totalGovContribs =
    (parseFloat(payroll?.SSS_Ded || 0) +
    parseFloat(payroll?.Philhealth_Ded || 0) +
    parseFloat(payroll?.HDMF_Ded || 0) +
    parseFloat(payroll?.Tax_Ded || 0));

  const totalAttendancePenalties =
    (parseFloat(payroll?.absence_Amnt || 0) +
    parseFloat(payroll?.tardiness_Amnt || 0) +
    parseFloat(payroll?.unpaidLeave_Amnt || 0));

  const totalLoans =
    (parseFloat(payroll?.SSS_Loan || 0) +
    parseFloat(payroll?.HDMF_Loan || 0) +
    parseFloat(payroll?.advances_Amnt || 0) +
    parseFloat(payroll?.healthCard_Amnt || 0) +
    parseFloat(payroll?.Other_Deductions || 0));

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                        <Link to="/employee/payroll">
                          <ChevronLeft className="h-6 w-6" />
                        </Link>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                    Back to Payroll History
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-800">Payslip Details</h1>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none font-bold text-xs">
                    {payroll.PaystatusName || "Released"}
                  </Badge>
                </div>
                <p className="text-slate-500 text-sm">Review your statement of earnings, deductions, and attendance.</p>
              </div>
            </div>
          
            {/* View & Download Payslip Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Payslips Modal Button */}
              <Button 
                variant="outline" 
                onClick={() => setIsPayslipModalOpen(true)}
                className="bg-brand-primary text-white hover:bg-brand-primary-hover hover:border-brand-primary font-semibold h-10 px-4 rounded-xl shadow-none transition-all flex items-center gap-2"
              >
                <Eye className="h-4 w-4 text-white" />
                <span className=" text-white">View Payslips</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Payslip Summary Card */}
            <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm rounded-xl py-0">
              <CardHeader className="bg-brand-primary text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <FileText className="h-6 w-6" />
                      Payslip Summary
                    </CardTitle>
                    <CardDescription className="text-slate-200 mt-1">
                      Payroll Period: {new Date(payroll.period_Start).toLocaleDateString()} - {new Date(payroll.period_End).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-sm">
                    {payroll.PaystatusName || "Released"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Employee Details Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Employee Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Employee Name</p>
                          <p className="font-semibold text-slate-800">{payroll.user_FirstName} {payroll.user_LastName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                          <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-transparent text-slate-600 border-none shadow-none">ID</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Employee ID</p>
                          <p className="font-semibold text-slate-800">#{String(payroll.user_Id).padStart(4, '0')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Earnings Summary Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Pay Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-600">Total Earnings</span>
                        <span className="font-semibold text-green-600">{formatCurrency(payroll.totalEarnings)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-100 pb-2">
                        <span className="text-slate-600">Total Deductions</span>
                        <span className="font-semibold text-red-600">-{formatCurrency(payroll.totalDeductions)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="font-bold text-slate-800 text-lg">Net Pay</span>
                        <span className="font-bold text-brand-primary text-2xl">{formatCurrency(payroll.netPay)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Info className="h-4 w-4" />
                    Detailed itemized computation is provided below.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats / Info Sidebar (Admin Card Styling) */}
            <div className="space-y-6">
              <Card className="border-t-4 border-brand-primary shadow-sm rounded-xl overflow-hidden bg-white py-0">
                <CardHeader className="bg-white border-b border-slate-100 p-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-slate-800">
                    <Banknote className="h-4 w-4 text-brand-primary" />
                    Rate Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">Daily Rate</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(payroll.dailyRate)} / day</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 text-xs">Hourly Rate</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(payroll.ratePerHr)} / hr</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-status-info shadow-sm rounded-xl overflow-hidden bg-white py-0">
                <CardHeader className="bg-white border-b border-slate-100 p-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 text-slate-800">
                    <Calendar className="h-4 w-4 text-status-info" />
                    Attendance Record
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500 text-xs">Days Worked</span>
                    <span className="font-semibold text-slate-800">{payroll.NoDays_Worked} of {payroll.totalScheduledDays || payroll.NoDays_Worked} days</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 text-xs">Total Hours</span>
                    <span className="font-semibold text-slate-800">{payroll.NoHrs_Worked} hrs</span>
                  </div>
                </CardContent>
              </Card>

              
            </div>
          </div>

          {/* Main Consolidated Ledger Statement Card (Itemized Statement of Earnings & Deductions) */}
          <Card id="itemized-statement" className="border-none shadow-sm bg-white rounded-2xl overflow-hidden py-0 scroll-mt-6">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-brand-primary" />
                  Itemized Statement of Earnings & Deductions
                </CardTitle>
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
                    {/* Section 1: Base Compensation */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
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
                              <span className="text-slate-600 group-hover:text-brand-primary">Holiday Pay</span>
                              <Tooltip>
                                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" /></TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                                  Statutory holiday compensation (100% regular, 30% special)
                                </TooltipContent>
                              </Tooltip>
                              {isHolidayExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-primary" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-primary" />
                              )}
                            </div>
                            <span className="font-medium text-slate-800">{formatCurrency(totalHoliday)}</span>
                          </div>

                          {isHolidayExpanded && (
                            <div className="mt-2 ml-1 pl-3 border-l-2 border-brand-primary/30 space-y-1.5 text-xs">
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
                    </div>
                    <span className="font-bold text-emerald-700 text-xl">{formatCurrency(payroll.totalEarnings)}</span>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* RIGHT COLUMN: DEDUCTIONS */}
                {/* ========================================================================= */}
                <div className="p-6 space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Section 1: Statutory Deductions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
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
                    </div>
                    <span className="font-bold text-rose-700 text-xl">-{formatCurrency(payroll.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Net Pay Reconciliation Bar */}
              <div className="bg-slate-50/90 border-t border-slate-100 p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary text-white p-2.5 rounded-xl">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Take-Home Formula</span>
                    <span className="text-xs text-slate-700 font-medium">
                      Gross – Deductions = Net Pay ({formatCurrency(payroll.totalEarnings)} – {formatCurrency(payroll.totalDeductions)} = {formatCurrency(payroll.netPay)}) 
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Final Net Pay Credited</span>
                    <span className="text-2xl font-bold text-brand-primary">{formatCurrency(payroll.netPay)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Year-To-Date (YTD) Accumulated Totals Card */}
          <Card className="bg-white border-t-5 border-brand-primary shadow-sm rounded-xl py-0 text-slate-800">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800 font-semibold">
                <CalendarDays className="h-5 w-5 text-black" />
                Year-To-Date (YTD) Accumulated Totals ({new Date(payroll.period_Start).getFullYear()})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Gross Earnings</p>
                <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(payroll.ytdGross)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Non-Taxable</p>
                <p className="text-xl font-bold text-blue-600 mt-0.5">{formatCurrency(payroll.ytdNonTaxable)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Total Deductions</p>
                <p className="text-xl font-bold text-rose-600 mt-0.5">({formatCurrency(payroll.ytdDeductions)})</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Withholding Tax</p>
                <p className="text-xl font-bold text-amber-600 mt-0.5">({formatCurrency(payroll.ytdBIR)})</p>
              </div>
            </CardContent>
          </Card>

          {/* Notice on Discrepancies Card */}
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

        {/* View Payslips Modal (Dual-View: Standard Compliance & Detailed Breakdown) */}
        <ViewPayslipModal
          isOpen={isPayslipModalOpen}
          onClose={() => setIsPayslipModalOpen(false)}
          payroll={payroll}
          onDownload={handleDownloadPDF}
        />

        {toast.message && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ message: "", type: "info" })}
          />
        )}
      </TooltipProvider>
    </Sidebar>
  );
};

export default EmployeePayslip;
