import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { ChevronLeft } from "lucide-react";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import ViewPayslipModal from "../../components/ViewPayslipModal";

// shadcn/ui
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import InfoIcon from "@mui/icons-material/Info";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PayrollDetails = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodStart = queryParams.get("start");
  const periodEnd = queryParams.get("end");
  const periodId = queryParams.get("periodId");

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      try {
        if (payrollId.startsWith("live-") || payrollId.startsWith("preview-")) {
          const userId = payrollId.split("-")[1];
          const empRes = await fetchWithAuth(`/api/users/${userId}`);
          const emp = await empRes.json();
          const prevRes = await fetchWithAuth(`/api/payroll/preview?user_Id=${userId}&period_Start=${periodStart}&period_End=${periodEnd}`);
          const preview = await prevRes.json();

          if (empRes.ok && prevRes.ok) {
            setPayroll({
              payrollId: "LIVE-PREVIEW",
              user_FirstName: emp.user_FirstName,
              user_LastName: emp.user_LastName,
              user_Position: emp.position,
              user_Id: emp.user_Id,
              dailyRate: preview.dailyRate,
              ratePerHr: preview.ratePerHr,
              period_Start: periodStart,
              period_End: periodEnd,
              NoDays_Worked: preview.NoDays_Worked,
              NoHrs_Worked: preview.NoHrs_Worked,
              potentialBasicPay: preview.potentialBasicPay || (preview.totalScheduledDays ? preview.totalScheduledDays * preview.dailyRate : preview.dailyRate * 13),
              basicPay: preview.basicPay,
              OT_Hrs: preview.OT_Hrs,
              OT_Amnt: preview.OT_Amnt,
              nightOT_Hrs: preview.nightOT_Hrs,
              nightOT_Amnt: preview.nightOT_Amnt,
              nightDiff_Hrs: preview.nightDiff_Hrs,
              nightDiff_Amnt: preview.nightDiff_Amnt,
              legalHol_Amnt: preview.legalHol_Amnt,
              specialHol_Amnt: preview.specialHol_Amnt,
              totalEarnings: preview.totalEarnings,
              absence_Hrs: preview.absence_Days * 8,
              absence_Amnt: preview.absence_Amnt,
              tardiness_Mins: preview.tardiness_Mins,
              tardiness_Amnt: preview.tardiness_Amnt,
              unpaidLeave_Days: preview.unpaidLeave_Days,
              unpaidLeave_Amnt: preview.unpaidLeave_Amnt,
              paidLeave_Days: preview.paidLeave_Days,
              SSS_Ded: preview.SSS_Ded,
              Philhealth_Ded: preview.Philhealth_Ded,
              HDMF_Ded: preview.HDMF_Ded,
              SSS_Ded_ER: preview.SSS_Ded_ER,
              Philhealth_Ded_ER: preview.Philhealth_Ded_ER,
              HDMF_Ded_ER: preview.HDMF_Ded_ER,
              Tax_Ded: preview.Tax_Ded,
              healthCard_Amnt: preview.healthCard_Amnt,
              SSS_Loan: preview.SSS_Loan,
              HDMF_Loan: preview.HDMF_Loan,
              calamityLoan_Amnt: preview.calamityLoan_Amnt,
              // advances_Amnt: preview.advances_Amnt,
              // globe_Deduction: preview.globe_Deduction,
              eastwest_Loan: preview.eastwest_Loan,
              multiPurposeSavings: preview.multiPurposeSavings,
              totalDeductions: preview.totalDeductions,
              netPay: preview.netPay,
              holidaysTotal: preview.holidaysTotal || 0,
              holidaysRegularWorked: preview.workedHolidays?.regular || 0,
              holidaysSpecialWorked: preview.workedHolidays?.special || 0,
              PaystatusName: "Draft",
              incentives: preview.incentives || 0,
              allowance: preview.allowance || 0,
              ytdGross: preview.ytdGross || 0,
              ytdNonTaxable: preview.ytdNonTaxable || 0,
              ytdDeductions: preview.ytdDeductions || 0,
              ytdBIR: preview.ytdBIR || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          const res = await fetchWithAuth(`/api/payroll/${payrollId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.payrollId) {
               setPayroll(data);
            } else {
               console.error("Fetched payroll data is invalid:", data);
            }
          } else {
            console.error("Failed to fetch payroll:", res.status, res.statusText);
          }
        }
      } catch (err) {
        console.error("Error fetching payroll details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayrollDetails();
  }, [payrollId]);

  if (loading || !payroll) return <Skeleton className="h-screen w-full" />;

  const eeSSS = parseFloat(payroll.SSS_Ded || 0);
  const erSSS = parseFloat(payroll.SSS_Ded_ER || 0);
  const eePH = parseFloat(payroll.Philhealth_Ded || 0);
  const erPH = parseFloat(payroll.Philhealth_Ded_ER || 0);
  const eeHD = parseFloat(payroll.HDMF_Ded || 0);
  const erHD = parseFloat(payroll.HDMF_Ded_ER || 0);
  const eeTax = parseFloat(payroll.Tax_Ded || 0);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="group flex items-center justify-between gap-4 mb-8">
      {/* Left Side: Back Button + Title */}
      <div className="flex items-center gap-2">
        {/* Animated Back Button */}
        <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  asChild 
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <Link 
                    to={periodId ? `/payroll/payrollPeriod?periodId=${periodId}` : "/payroll/payrollPeriod"}
                    className="flex items-center justify-center rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-all hover:scale-110"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Link>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
              Back to Payroll Period
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Title & Subtitle */}
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Payroll Details</h1>
          <span className="text-sm text-slate-500 font-mono">Payroll ID: {payroll.payrollId}</span>
        </div>
      </div>

      {/* Right Side: Actions (Payslip + Badge) */}
      <div className="flex items-center gap-3">
        
        <Badge 
          variant="secondary" 
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${
            payroll.PaystatusName?.toLowerCase() === "released" 
              ? "bg-green-100 text-green-800" 
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {payroll.PaystatusName}
        </Badge>
      </div>
    </div>

        {/* Payslip Preview Modal */}
        <ViewPayslipModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          payroll={payroll} 
        />

        {/* Flex container to separate left (tabs) and right (action) */}
        <div className="flex items-center justify-between mb-6">
          
          {/* Tab Group (Left) */}
          <div className="flex gap-2">
            <Button 
              variant={activeTab === "overview" ? "default" : "outline"} 
              onClick={() => setActiveTab("overview")}
              className={activeTab === "overview" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E] hover:bg-[#2A174E]/5"}
            >
              Overview
            </Button>
            <Button 
              variant={activeTab === "govt" ? "default" : "outline"} 
              onClick={() => setActiveTab("govt")}
              className={activeTab === "govt" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E] hover:bg-[#2A174E]/5"}
            >
              Gov't Share
            </Button>
            <Button 
              variant={activeTab === "other" ? "default" : "outline"} 
              onClick={() => setActiveTab("other")}
              className={activeTab === "other" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E] hover:bg-[#2A174E]/5"}
            >
              Deductions
            </Button>
          </div>  

          {/* View Payslip (Right) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button 
                  variant="outline" 
                  onClick={() => setIsModalOpen(true)}
                  className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-all shadow-sm flex items-center gap-2"
                >
                  <ReceiptLongIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">View Payslip</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
              View and print employee payslip receipt
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Employee Information Card */}
          <Card className="border-0 shadow-sm bg-white py-0 h-full">
            <CardHeader className="border-b border-slate-50 py-4 bg-[#2A174E]">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <PersonOutlineIcon className="text-white h-5 w-5" /> Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-0 pb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Name</label>
                <p className="font-semibold text-slate-800">{payroll.user_FirstName} {payroll.user_LastName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                <p className="font-mono text-slate-800">{formatUserId(payroll.user_Id)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rate Per Hour</label>
                <p className="font-semibold text-slate-800">₱{parseFloat(payroll.ratePerHr).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Rate</label>
                <p className="font-semibold text-slate-800">₱{parseFloat(payroll.dailyRate || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pay Period Card */}
          <Card className="border-0 shadow-sm bg-white py-0 h-full">
            <CardHeader className="border-b border-slate-50 py-4 bg-[#2A174E]">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <CalendarTodayIcon className="text-white h-5 w-5" /> Pay Period
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-0 pb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period Start</label>
                <p className="font-semibold text-slate-800">{new Date(payroll.period_Start).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period End</label>
                <p className="font-semibold text-slate-800">{new Date(payroll.period_End).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Days Worked</label>
                <p className="font-semibold text-slate-800">{payroll.NoDays_Worked} days</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hours Worked</label>
                <p className="font-semibold text-slate-800">{payroll.NoHrs_Worked} hours</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Holiday Total</label>
                <p className="font-semibold text-slate-800">{payroll.holidaysTotal || 0} days</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Worked Holidays</label>
                <p className="text-sm font-semibold text-slate-800">Regular: {payroll.holidaysRegularWorked || 0} | Special: {payroll.holidaysSpecialWorked || 0}</p>
              </div>
            </CardContent>
          </Card>

          {activeTab === "overview" && (
            <>
              {/* Earnings Breakdown Card */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-green-900">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <TrendingUpIcon className="text-green-100 h-5 w-5" /> Earnings Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4  pt-0 pb-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Basic Pay</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.potentialBasicPay ?? (payroll.totalScheduledDays && payroll.dailyRate ? payroll.totalScheduledDays * payroll.dailyRate : payroll.basicPay)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Overtime ({payroll.OT_Hrs || 0} hrs)</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.OT_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Overtime with Night Shift ({payroll.nightOT_Hrs || 0} hrs)</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.nightOT_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Night Differential ({payroll.nightDiff_Hrs || 0} hrs)</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.nightDiff_Amnt || 0).toLocaleString()}</span>
                  </div>
                  {payroll.legalHol_Amnt > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Regular Holiday Pay</span>
                      <span className="font-semibold text-slate-800">₱{parseFloat(payroll.legalHol_Amnt).toLocaleString()}</span>
                    </div>
                  )}
                  {payroll.specialHol_Amnt > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Special Holiday Pay</span>
                      <span className="font-semibold text-slate-800">₱{parseFloat(payroll.specialHol_Amnt).toLocaleString()}</span>
                    </div>
                  )}
                  {payroll.incentives > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Incentives</span>
                      <span className="font-semibold text-slate-800">₱{parseFloat(payroll.incentives).toLocaleString()}</span>
                    </div>
                  )}
                  {payroll.allowance > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Allowance</span>
                      <span className="font-semibold text-slate-800">₱{parseFloat(payroll.allowance).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl mt-4 border border-green-100">
                    <span className="font-bold text-green-800">Total Earnings</span>
                    <span className="font-bold text-green-700 text-lg">₱{parseFloat(payroll.totalEarnings).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Deductions Breakdown Card */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-red-500">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <TrendingDownIcon className="text-red-200 h-5 w-5" /> Time-based Deductions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 pb-6">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <span className="text-sm text-slate-600">Absence ({payroll.absence_Hrs} hrs)</span>
                        <span className="font-semibold text-slate-800">₱{parseFloat(payroll.absence_Amnt || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <span className="text-sm text-slate-600">Tardiness ({payroll.tardiness_Mins} mins)</span>
                        <span className="font-semibold text-slate-800">₱{parseFloat(payroll.tardiness_Amnt || 0).toLocaleString()}</span>
                      </div>
                      {payroll.unpaidLeave_Amnt > 0 && (
                        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                          <span className="text-sm text-slate-600">Unpaid Leave ({payroll.unpaidLeave_Days} days)</span>
                          <span className="font-semibold text-slate-800">₱{parseFloat(payroll.unpaidLeave_Amnt).toLocaleString()}</span>
                        </div>
                      )}
                      {payroll.paidLeave_Days > 0 && (
                        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                          <span className="text-sm text-slate-600">Paid Leave ({payroll.paidLeave_Days} days)</span>
                          <span className="font-semibold text-slate-400 italic">(Covered)</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl mt-4 border border-red-100">
                        <span className="font-bold text-red-800">Total Time-based</span>
                        <span className="font-bold text-red-700 text-lg">
                          ₱{(parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0)).toLocaleString()}
                        </span>
                      </div>
                </CardContent>
              </Card>

              {/* YTD Snapshot Card */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full lg:col-span-2">
                <CardHeader className="border-b border-slate-50 py-4 bg-[#0C0530]">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <TrendingUpIcon className="text-white h-5 w-5" /> Year-To-Date (YTD) Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-0 pb-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Gross</label>
                    <p className="font-bold text-[#2A174E] text-lg">₱{parseFloat(payroll.ytdGross || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Non-Taxable</label>
                    <p className="font-bold text-emerald-600 text-lg">₱{parseFloat(payroll.ytdNonTaxable || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Deductions</label>
                    <p className="font-bold text-rose-600 text-lg">₱{parseFloat(payroll.ytdDeductions || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD BIR (Tax)</label>
                    <p className="font-bold text-rose-600 text-lg">₱{parseFloat(payroll.ytdBIR || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </CardContent>
              </Card>

               {/* Net Pay Highlight */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-8 rounded-2xl text-white flex justify-between items-center relative overflow-hidden mb-4 shadow-md lg:col-span-2">
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-sm uppercase tracking-wider font-bold opacity-90">Net Pay</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center cursor-pointer">
                          <HelpOutlineIcon className="text-white/80 hover:text-white h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 max-w-sm">
                        <p className="font-bold text-amber-300 text-xs mb-2 border-b border-slate-700 pb-1">
                          Net Pay Formula Breakdown:
                        </p>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between gap-4">
                            <span>Gross Earnings:</span>
                            <span className="font-semibold text-emerald-400">₱{parseFloat(payroll.totalEarnings || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>- Absences / Lates:</span>
                            <span className="font-semibold text-rose-300">₱{(parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>- Gov't Share (SSS/PH/HDMF):</span>
                            <span className="font-semibold text-rose-300">₱{(eeSSS + eePH + eeHD).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>- Withholding Tax:</span>
                            <span className="font-semibold text-rose-300">₱{eeTax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>- Loans & Advances:</span>
                            <span className="font-semibold text-rose-300">₱{(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0) + parseFloat(payroll.advances_Amnt || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>- Health Card / Misc:</span>
                            <span className="font-semibold text-rose-300">₱{(parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-700 font-bold text-amber-300 text-sm">
                            <span>= Net Take-Home Pay:</span>
                            <span>₱{parseFloat(payroll.netPay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-4xl md:text-5xl font-extrabold tracking-tight">₱{parseFloat(payroll.netPay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <AttachMoneyIcon className="absolute -right-4 -bottom-4 text-[150px] opacity-20 transform -rotate-12" />
              </div>
            </>
          )}

          {activeTab === "govt" && (
            <>
              {/* Employee Gov't Share */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-blue-700">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <AccountBalanceIcon className="text-blue-100 h-5 w-5" /> Employee Share (EE)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 pb-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">SSS Contribution</span>
                    <span className="font-semibold text-slate-800">₱{eeSSS.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">PhilHealth Contribution</span>
                    <span className="font-semibold text-slate-800">₱{eePH.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">HDMF (Pag-IBIG)</span>
                    <span className="font-semibold text-slate-800">₱{eeHD.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Withholding Tax</span>
                    <span className="font-semibold text-slate-800">₱{eeTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl mt-4 border border-blue-100">
                    <span className="font-bold text-blue-800">Total EE Share</span>
                    <span className="font-bold text-blue-700 text-lg">₱{(eeSSS + eePH + eeHD + eeTax).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Employer Gov't Share */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-slate-700">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <AccountBalanceIcon className="text-slate-100 h-5 w-5" /> Employer Share (ER)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 pb-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">SSS (Employer)</span>
                    <span className="font-semibold text-slate-800">₱{erSSS.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">PhilHealth (Employer)</span>
                    <span className="font-semibold text-slate-800">₱{erPH.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">HDMF (Employer)</span>
                    <span className="font-semibold text-slate-800">₱{erHD.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl mt-4 border border-slate-200">
                    <span className="font-bold text-slate-800">Total ER Share</span>
                    <span className="font-bold text-slate-700 text-lg">₱{(erSSS + erPH + erHD).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Withholding Tax Breakdown */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full lg:col-span-2">
                <CardHeader className="border-b border-slate-50 py-4 bg-purple-700">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <AccountBalanceIcon className="text-purple-100 h-5 w-5" /> Withholding Tax Calculation (BIR)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex flex-col justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-purple-200 transition-all">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Basic Pay (Gross)</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center cursor-pointer">
                                <InfoIcon className="text-slate-400 hover:text-purple-600 h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Total gross earnings before any government deductions are applied.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="font-bold text-[#2A174E] text-xl">₱{parseFloat(payroll.totalEarnings || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>

                      <div className="flex flex-col justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-purple-200 transition-all">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gov't Deductions</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center cursor-pointer">
                                <InfoIcon className="text-slate-400 hover:text-purple-600 h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Sum of SSS, PhilHealth, and Pag-IBIG employee contributions: ₱{eeSSS.toLocaleString(undefined, {minimumFractionDigits: 2})} + ₱{eePH.toLocaleString(undefined, {minimumFractionDigits: 2})} + ₱{eeHD.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="font-bold text-red-600 text-xl">₱{(eeSSS + eePH + eeHD).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>

                      <div className="flex flex-col justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-purple-200 transition-all">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Taxable Income</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center cursor-pointer">
                                <InfoIcon className="text-slate-400 hover:text-purple-600 h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">The taxable income base used to calculate BIR withholding tax: (Total Gross - Total Gov't Deductions)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="font-bold text-emerald-600 text-xl">₱{Math.max(0, parseFloat(payroll.totalEarnings || 0) - (eeSSS + eePH + eeHD)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>

                  {/* BIR Withholding Tax Bracket Computation Breakdown Card */}
                  {(() => {
                    const taxable = Math.max(0, (parseFloat(payroll.totalEarnings || 0) - (eeSSS + eePH + eeHD)));
                    
                    // Check if actual tax matches Mode 2 (Direct Cutoff Evaluation)
                    let mode2Tax = 0;
                    if (taxable > 666667) mode2Tax = 200833.33 + (taxable - 666667) * 0.35;
                    else if (taxable > 166667) mode2Tax = 40833.33 + (taxable - 166667) * 0.32;
                    else if (taxable > 66667) mode2Tax = 10833.33 + (taxable - 66667) * 0.30;
                    else if (taxable > 33333) mode2Tax = 2500.00 + (taxable - 33333) * 0.25;
                    else if (taxable > 20833) mode2Tax = (taxable - 20833) * 0.20;

                    const isDirectMode = Math.abs(eeTax - mode2Tax) < 1.0;
                    const evalMonthly = isDirectMode ? taxable : (taxable * 2);

                    let bracketLabel = "Bracket 1 (₱20,833 & below - Tax Exempt)";
                    let rateText = "₱0.00 (Exempt)";
                    
                    if (evalMonthly > 666667) {
                      bracketLabel = "Bracket 6 (₱666,667 & above)";
                      rateText = "₱200,833.33 + 35%";
                    } else if (evalMonthly > 166667) {
                      bracketLabel = "Bracket 5 (₱166,667 - ₱666,666)";
                      rateText = "₱40,833.33 + 32%";
                    } else if (evalMonthly > 66667) {
                      bracketLabel = "Bracket 4 (₱66,667 - ₱166,666)";
                      rateText = "₱10,833.33 + 30%";
                    } else if (evalMonthly > 33333) {
                      bracketLabel = "Bracket 3 (₱33,333 - ₱66,666)";
                      rateText = "₱2,500.00 + 25%";
                    } else if (evalMonthly > 20833) {
                      bracketLabel = "Bracket 2 (₱20,833 - ₱33,332)";
                      rateText = "₱0.00 + 20%";
                    }

                    return (
                      <div className="mt-6 border border-purple-200 bg-purple-50/50 rounded-xl p-4 text-left space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                            <span>🏛️ BIR Tax Withholding Bracket Breakdown</span>
                          </span>
                          <Badge className="bg-purple-700 text-white font-bold text-[10px]">
                            {bracketLabel}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Period Taxable Income</p>
                            <p className="font-bold text-slate-800 text-sm">
                              ₱{taxable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                            <p className="text-[9px] text-slate-400">Gross - (SSS+PH+HDMF)</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Evaluated Tax Base</p>
                            <p className="font-bold text-purple-700 text-sm">
                              ₱{evalMonthly.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {isDirectMode ? "Direct Period Evaluation" : "Period Taxable × 2"}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Base Tax & Excess Rate</p>
                            <p className="font-bold text-slate-800 text-sm">
                              {rateText}
                            </p>
                            <p className="text-[9px] text-slate-400">Monthly BIR Schedule</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Cutoff Tax Deduction</p>
                            <p className="font-bold text-rose-600 text-sm">
                              ₱{eeTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {isDirectMode ? "Direct Cutoff Assessment" : "Monthly Tax ÷ 2"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl mt-6 border border-purple-100">
                    <span className="font-bold text-purple-800">Final Withholding Tax Deducted</span>
                    <span className="font-bold text-purple-700 text-lg">₱{eeTax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "other" && (
            <>
              {/* Loans Breakdown */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-amber-600">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <ListAltIcon className="text-amber-100 h-5 w-5" /> Governmental & Personal Loans
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 pb-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">SSS Loan</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.SSS_Loan || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">HDMF Loan</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.HDMF_Loan || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Calamity Loan</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.calamityLoan_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Personal Loan</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.eastwest_Loan || 0).toLocaleString()}</span>
                  </div>
                  {/* <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Cash Advances</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.advances_Amnt || 0).toLocaleString()}</span>
                  </div> */}
                  <div className="flex justify-between items-center p-4 bg-amber-50 rounded-xl mt-4 border border-amber-100">
                    <span className="font-bold text-amber-800">Total Loans</span>
                    <span className="font-bold text-amber-700 text-lg">₱{(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0)).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Misc Deductions */}
              <Card className="border-0 shadow-sm bg-white py-0 h-full">
                <CardHeader className="border-b border-slate-50 py-4 bg-cyan-700">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <AttachMoneyIcon className="text-cyan-100 h-5 w-5" /> Misc. Deductions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 pb-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Health Card (HMO)</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.healthCard_Amnt || 0).toLocaleString()}</span>
                  </div>
                  {/* <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Globe Deduction</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.globe_Deduction || 0).toLocaleString()}</span>
                  </div> */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Multi-purpose Savings</span>
                    <span className="font-semibold text-slate-800">₱{parseFloat(payroll.multiPurposeSavings || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-cyan-50 rounded-xl mt-4 border border-cyan-100">
                    <span className="font-bold text-cyan-800">Total Misc</span>
                    <span className="font-bold text-cyan-700 text-lg">₱{(parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0)).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

        </div>

        {/* Record Information */}
        <div className="flex flex-col sm:flex-row gap-8 px-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Created At</label>
            <p className="text-sm text-slate-600">{new Date(payroll.createdAt).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Updated</label>
            <p className="text-sm text-slate-600">{new Date(payroll.updatedAt).toLocaleString()}</p>
          </div>
        </div>
        </div>
      </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default PayrollDetails;
