import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ViewPayslipModal from "../../components/ViewPayslipModal";
import { fetchWithAuth } from "../../utils/api";
import { 
  FileText, 
  ChevronLeft, 
  Download, 
  Info,
  Banknote,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Eye,
  Receipt,
  Loader2,
  ChevronDown,
  HelpCircle,
  Wallet,
  CalendarDays,
  Clock
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const colorMap = {
  "brand-primary": "border-brand-primary",
  "accent-green": "border-accent-green",
  "accent-gold": "border-accent-gold",
  "status-info": "border-status-info",
  "status-danger": "border-status-danger",
  "rose-500": "border-status-danger",
  "amber-500": "border-amber-500",
  "indigo-500": "border-status-info",
  "blue-500": "border-status-info"
};

function MetricCard({ label, value, color, description, icon: Icon, tooltip }) {
  return (
    <Card className={`border-t-4 ${colorMap[color] || 'border-brand-primary'} bg-white py-0 h-full shadow-sm`}>
      <CardContent className="p-5 flex flex-col justify-between h-full text-left">
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
            <p className="text-2xl font-black text-brand-primary">{value}</p>
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
        <p className="text-[10px] text-slate-500 italic mt-3">{description}</p>
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
                className="bg-brand-primary text-white hover:bg-[#7A52B5] hover:border-brand-primary font-semibold h-10 px-4 rounded-xl shadow-none transition-all flex items-center gap-2"
              >
                <Eye className="h-4 w-4 text-white" />
                <span className=" text-white">View Payslips</span>
              </Button>

              {/* Download Payslip Dropdown Menu
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    disabled={Boolean(isDownloading)}
                    className="bg-brand-primary hover:bg-[#3d236e] text-white font-semibold h-10 px-4 rounded-xl shadow-none transition-all flex items-center gap-2"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Download className="h-4 w-4 text-white" />
                    )}
                    <span>Download Payslip</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2 bg-white rounded-xl shadow-xl border-none">
                  <DropdownMenuItem 
                    onClick={() => handleDownloadPDF("standard")}
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Standard Payslip</span>
                        <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">PDF</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Official compliance payslip layout</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1.5 bg-slate-100" />
                  <DropdownMenuItem 
                    onClick={() => handleDownloadPDF("detailed")}
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-700 mt-0.5">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Detailed Payslip</span>
                        <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">PDF</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Full audit breakdown with formulas & rates</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1.5 bg-slate-100" />
                  <DropdownMenuItem 
                    onClick={() => handleDownloadPDF("dtr")}
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 mt-0.5">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">Daily Time Record (DTR)</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">PDF</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Official attendance logs & cutoff time sheet</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}
            </div>
          </div>

          {/* Overview Statistical Cards (Admin MetricCard Pattern) */}
          {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <MetricCard
              label="Gross Earnings"
              value={formatCurrency(payroll.totalEarnings)}
              color="brand-primary"
              description="Basic pay, OT, night diff & allowances"
              icon={TrendingUp}
              tooltip="Total gross compensation earned before statutory deductions and taxes."
            />
            <MetricCard
              label="Total Deductions"
              value={`-${formatCurrency(payroll.totalDeductions)}`}
              color="accent-green"
              description="Taxes, statutory shares, absences & loans"
              icon={TrendingDown}
              tooltip="Combined statutory contributions, withholding tax, attendance penalties, and loan amortizations."
            />
            <MetricCard
              label="Net Take Home"
              value={formatCurrency(payroll.netPay)}
              color="accent-gold"
              description={`${netRetainedPercent}% of gross earnings credited`}
              icon={Wallet}
              tooltip="Final net pay deposited to your account for this cutoff."
            />
            <MetricCard
              label="Days Worked"
              value={`${payroll.NoDays_Worked} / ${payroll.totalScheduledDays || payroll.NoDays_Worked} Days`}
              color="status-info"
              description={`${payroll.NoHrs_Worked || 0} hrs worked @ ${formatCurrency(payroll.dailyRate)}/day`}
              icon={CalendarDays}
              tooltip="Total logged work days and hours present during this payroll period."
            />
          </div> */}

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
                    Detailed itemized computation is available on the next page.
                  </div>
                  <Button asChild variant="link" className="text-brand-primary font-semibold gap-1 px-0">
                    <Link to={`/employee/payroll-details/${id}`}>
                      View Full Computation
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
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
