import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { ChevronLeft, ChevronDown, ChevronUp, Mail } from "lucide-react";
import Toast from "../../components/toast/Toast";
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

const formatMoney = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [isTaxBracketExpanded, setIsTaxBracketExpanded] = useState(false);
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [taxRefTable, setTaxRefTable] = useState([]);
  const [taxEvaluationMode, setTaxEvaluationMode] = useState("PROJECTED_MONTHLY");

  useEffect(() => {
    fetchWithAuth("/api/system/reference-data/tax")
      .then(res => res.json())
      .then(data => {
        if (data?.records && Array.isArray(data.records)) {
          const activeMonthly = data.records.filter(r => r.isActive && r.periodType === "monthly");
          if (activeMonthly.length > 0) {
            setTaxRefTable(activeMonthly);
          }
        }
      })
      .catch(err => console.warn("[DetailsPayroll] Could not load tax ref table:", err));

    fetchWithAuth("/api/system/settings")
      .then(res => res.json())
      .then(s => {
        if (s?.taxEvaluationMode) {
          setTaxEvaluationMode(s.taxEvaluationMode);
        }
      })
      .catch(err => console.warn("[DetailsPayroll] Could not load settings:", err));
  }, []);

  const handleResendEmail = async () => {
    if (!payroll?.payrollId || String(payroll.payrollId).includes("PREVIEW")) return;
    setIsSendingEmail(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/resend-email/${payroll.payrollId}`, {
        method: "POST"
      });
      if (res.ok) {
        setToast({ message: "Payroll email sent with Payslip 1 & 2 and DTR!", type: "success" });
      } else {
        const err = await res.json();
        setToast({ message: err.error || "Failed to resend payroll email.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Error resending email: " + err.message, type: "error" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      setLoading(true);
      setError(null);
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
          } else {
            setError(preview.error || emp.error || "Failed to load live preview.");
          }
        } else {
          const res = await fetchWithAuth(`/api/payroll/${payrollId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.payrollId) {
               setPayroll(data);
            } else {
               console.error("Fetched payroll data is invalid:", data);
               setError("Fetched payroll data is invalid.");
            }
          } else {
            console.error("Failed to fetch payroll:", res.status, res.statusText);
            const errData = await res.json().catch(() => ({}));
            setError(errData.error || `Failed to fetch payroll (${res.status})`);
          }
        }
      } catch (err) {
        console.error("Error fetching payroll details:", err);
        setError(err.message || "An unexpected error occurred while fetching payroll details.");
      } finally {
        setLoading(false);
      }
    };
    fetchPayrollDetails();
  }, [payrollId]);

  if (loading) return <Skeleton className="h-screen w-full" />;

  if (error || !payroll) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
        <Sidebar>
          <div className="p-8 max-w-xl mx-auto mt-16 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Payroll Record Not Found</h2>
            <p className="text-sm text-slate-500 mb-6">{error || "The requested payroll record could not be loaded."}</p>
            <Button asChild className="bg-brand-primary text-white">
              <Link to={periodId ? `/payroll/payrollPeriod?periodId=${periodId}` : "/payroll/payrollPeriod"}>
                Back to Payroll Period
              </Link>
            </Button>
          </div>
        </Sidebar>
      </div>
    );
  }

  const eeSSS = parseFloat(payroll.SSS_Ded || 0);
  const erSSS = parseFloat(payroll.SSS_Ded_ER || 0);
  const eePH = parseFloat(payroll.Philhealth_Ded || 0);
  const erPH = parseFloat(payroll.Philhealth_Ded_ER || 0);
  const eeHD = parseFloat(payroll.HDMF_Ded || 0);
  const erHD = parseFloat(payroll.HDMF_Ded_ER || 0);
  const eeTax = parseFloat(payroll.Tax_Ded || 0);

  // ---------------------------------------------------------------------------
  // Modular Render Functions for Individual Cards
  // (Preserves exact design and functionality for existing tabs)
  // ---------------------------------------------------------------------------

  // 1. Earnings Breakdown Card (From Overview Tab)
  const renderEarningsBreakdown = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-green-900">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <TrendingUpIcon className="text-green-100 h-5 w-5" /> Earnings Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Basic Pay</span>
          <span className="font-semibold text-slate-800">
            ₱{formatMoney(payroll.potentialBasicPay ?? (payroll.totalScheduledDays && payroll.dailyRate ? payroll.totalScheduledDays * payroll.dailyRate : payroll.basicPay))}
          </span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Overtime ({payroll.OT_Hrs || 0} hrs)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.OT_Amnt)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Overtime with Night Shift ({payroll.nightOT_Hrs || 0} hrs)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.nightOT_Amnt)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Night Differential ({payroll.nightDiff_Hrs || 0} hrs)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.nightDiff_Amnt)}</span>
        </div>
        {(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0)) > 0 && (
          <div className="border-b border-slate-50 pb-3">
            <div 
              className="flex justify-between items-center cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1.5 rounded-lg transition-colors group"
              onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700 font-medium group-hover:text-brand-primary">Holiday Pay</span>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  {(payroll.holidaysRegularWorked || 0) + (payroll.holidaysSpecialWorked || 0)} Days Worked
                </Badge>
                {isHolidayExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-brand-primary" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-brand-primary" />
                )}
              </div>
              <span className="font-semibold text-slate-800">
                ₱{formatMoney(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}
              </span>
            </div>

            {/* Accordion Detailed Content */}
            {isHolidayExpanded && (
              <div className="mt-2 ml-1 pl-3 border-l-2 border-brand-primary/30 space-y-2 text-xs">
                {Array.isArray(payroll.holidayBreakdown) && payroll.holidayBreakdown.length > 0 ? (
                  payroll.holidayBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <Badge className={`text-[9px] px-1.5 py-0 border-0 ${item.type === 'Regular Holiday' ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'bg-purple-100 text-purple-800 font-semibold'}`}>
                            {item.type}
                          </Badge>
                        </div>
                        <span className="font-bold text-slate-900">₱{formatMoney(item.amount)}</span>
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
                      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">Regular Holiday Pay</span>
                            <Badge className="text-[9px] px-1.5 py-0 bg-indigo-100 text-indigo-800 border-0 font-semibold">Regular</Badge>
                          </div>
                          <span className="font-bold text-slate-900">₱{formatMoney(payroll.legalHol_Amnt)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">100% Base in Basic Pay + 100% Regular Holiday Premium = 200% Total</p>
                      </div>
                    )}
                    {parseFloat(payroll.specialHol_Amnt || 0) > 0 && (
                      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">Special Holiday Pay</span>
                            <Badge className="text-[9px] px-1.5 py-0 bg-purple-100 text-purple-800 border-0 font-semibold">Special</Badge>
                          </div>
                          <span className="font-bold text-slate-900">₱{formatMoney(payroll.specialHol_Amnt)}</span>
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
        {payroll.incentives > 0 && (
          <div className="flex justify-between items-center pb-3 border-b border-slate-50">
            <span className="text-sm text-slate-600">Incentives</span>
            <span className="font-semibold text-slate-800">₱{formatMoney(payroll.incentives)}</span>
          </div>
        )}
        {payroll.allowance > 0 && (
          <div className="flex justify-between items-center pb-3 border-b border-slate-50">
            <span className="text-sm text-slate-600">Allowance</span>
            <span className="font-semibold text-slate-800">₱{formatMoney(payroll.allowance)}</span>
          </div>
        )}
        <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl mt-4 border border-green-100">
          <span className="font-bold text-green-800">Total Earnings</span>
          <span className="font-bold text-green-700 text-lg">₱{formatMoney(payroll.totalEarnings)}</span>
        </div>
      </CardContent>
    </Card>
  );

  // 2. Time-based Deductions Card (From Overview Tab)
  const renderTimeDeductions = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-red-500">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <TrendingDownIcon className="text-red-200 h-5 w-5" /> Time-based Deductions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Absence ({payroll.absence_Hrs} hrs)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.absence_Amnt)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Tardiness ({payroll.tardiness_Mins} mins)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.tardiness_Amnt)}</span>
        </div>
        {payroll.unpaidLeave_Amnt > 0 && (
          <div className="flex justify-between items-center pb-3 border-b border-slate-50">
            <span className="text-sm text-slate-600">Unpaid Leave ({payroll.unpaidLeave_Days} days)</span>
            <span className="font-semibold text-slate-800">₱{formatMoney(payroll.unpaidLeave_Amnt)}</span>
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
            ₱{formatMoney(parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // 3. YTD Snapshot Card (From Overview Tab)
  const renderYTDSnapshot = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full lg:col-span-2">
      <CardHeader className="border-b border-slate-50 py-4 bg-[#0C0530]">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <TrendingUpIcon className="text-white h-5 w-5" /> Year-To-Date (YTD) Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-0 pb-6">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Gross</label>
          <p className="font-bold text-brand-primary text-lg">₱{formatMoney(payroll.ytdGross)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Non-Taxable</label>
          <p className="font-bold text-emerald-600 text-lg">₱{formatMoney(payroll.ytdNonTaxable)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD Deductions</label>
          <p className="font-bold text-rose-600 text-lg">₱{formatMoney(payroll.ytdDeductions)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YTD BIR (Tax)</label>
          <p className="font-bold text-rose-600 text-lg">₱{formatMoney(payroll.ytdBIR)}</p>
        </div>
      </CardContent>
    </Card>
  );

  // 4. Net Pay Highlight Banner (From Overview Tab)
  const renderNetPayBanner = () => (
    <div className="bg-white border-t-5 border-accent-gold p-8 rounded-2xl text-slate-800 flex justify-between items-center relative overflow-hidden mb-4 shadow-sm border border-slate-200/80 lg:col-span-2">
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-sm uppercase tracking-wider font-bold text-accent-gold">Net Pay</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center cursor-pointer">
                <HelpOutlineIcon className="text-slate-400 hover:text-slate-600 h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800 p-3 max-w-sm">
              <p className="font-bold text-amber-300 text-xs mb-2 border-b border-slate-700 pb-1">
                Net Pay Formula Breakdown:
              </p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between gap-4">
                  <span>Gross Earnings:</span>
                  <span className="font-semibold text-emerald-400">₱{formatMoney(payroll.totalEarnings)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>- Absences / Lates:</span>
                  <span className="font-semibold text-rose-300">₱{formatMoney(parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>- Gov't Share (SSS/PH/HDMF):</span>
                  <span className="font-semibold text-rose-300">₱{formatMoney(eeSSS + eePH + eeHD)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>- Withholding Tax:</span>
                  <span className="font-semibold text-rose-300">₱{formatMoney(eeTax)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>- Loans & Advances:</span>
                  <span className="font-semibold text-rose-300">₱{formatMoney(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0) + parseFloat(payroll.advances_Amnt || 0))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>- Health Card / Misc:</span>
                  <span className="font-semibold text-rose-300">₱{formatMoney(parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0))}</span>
                </div>
                <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-700 font-bold text-amber-300 text-sm">
                  <span>= Net Take-Home Pay:</span>
                  <span>₱{formatMoney(payroll.netPay)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">₱{formatMoney(payroll.netPay)}</p>
      </div>
      <AttachMoneyIcon className="absolute -right-4 -bottom-4 text-[150px] opacity-10 text-accent-gold transform -rotate-12" />
    </div>
  );

  // 5. Employee Gov't Share (EE) Card (From Gov't Share Tab)
  const renderEmployeeGovtShare = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-blue-700">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <AccountBalanceIcon className="text-blue-100 h-5 w-5" /> Employee Share (EE)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">SSS Contribution</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(eeSSS)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">PhilHealth Contribution</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(eePH)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">HDMF (Pag-IBIG)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(eeHD)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Withholding Tax</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(eeTax)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl mt-4 border border-blue-100">
          <span className="font-bold text-blue-800">Total EE Share</span>
          <span className="font-bold text-blue-700 text-lg">₱{formatMoney(eeSSS + eePH + eeHD + eeTax)}</span>
        </div>
      </CardContent>
    </Card>
  );

  // 6. Employer Gov't Share (ER) Card (From Gov't Share Tab)
  const renderEmployerGovtShare = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-slate-700">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <AccountBalanceIcon className="text-slate-100 h-5 w-5" /> Employer Share (ER)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">SSS (Employer)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(erSSS)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">PhilHealth (Employer)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(erPH)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">HDMF (Employer)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(erHD)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl mt-4 border border-slate-200">
          <span className="font-bold text-slate-800">Total ER Share</span>
          <span className="font-bold text-slate-700 text-lg">₱{formatMoney(erSSS + erPH + erHD)}</span>
        </div>
      </CardContent>
    </Card>
  );

  // 7. Withholding Tax Calculation Card (From Gov't Share Tab)
  const renderWithholdingTax = () => {
    const taxable = Math.max(0, (parseFloat(payroll.totalEarnings || 0) - (eeSSS + eePH + eeHD)));
    
    // Dynamic evaluation against Settings Reference Table (taxRefTable)
    const defaultBrackets = [
      { id: 1, range_Min: 0, range_Max: 20833, baseTax: 0, excessRate: 0, excessOver: 0 },
      { id: 2, range_Min: 20833.01, range_Max: 33332, baseTax: 0, excessRate: 0.15, excessOver: 20833 },
      { id: 3, range_Min: 33333, range_Max: 66666, baseTax: 1875, excessRate: 0.20, excessOver: 33333 },
      { id: 4, range_Min: 66667, range_Max: 166666, baseTax: 8541.80, excessRate: 0.25, excessOver: 66667 },
      { id: 5, range_Min: 166667, range_Max: 666666, baseTax: 33541.80, excessRate: 0.30, excessOver: 166667 },
      { id: 6, range_Min: 666667, range_Max: 99999999, baseTax: 183541.80, excessRate: 0.35, excessOver: 666667 }
    ];

    const activeTable = (taxRefTable && taxRefTable.length > 0) ? taxRefTable : defaultBrackets;

    const computeTaxFromTable = (inc) => {
      if (inc <= 0) return 0;
      const b = activeTable.find(r => inc >= parseFloat(r.range_Min) && inc <= parseFloat(r.range_Max)) ||
        [...activeTable].reverse().find(r => inc >= parseFloat(r.range_Min)) ||
        activeTable[0];
      const base = parseFloat(b.baseTax || 0);
      const over = parseFloat(b.excessOver || 0);
      const rate = parseFloat(b.excessRate || 0);
      return base + (Math.max(0, inc - over) * rate);
    };

    const mode2Tax = computeTaxFromTable(taxable);
    const isDirectMode = (taxEvaluationMode === "DIRECT_CUTOFF") || Math.abs(eeTax - mode2Tax) < 1.0;
    const evalMonthly = isDirectMode ? taxable : (taxable * 2);

    const matchedBracket = activeTable.find(b => evalMonthly >= parseFloat(b.range_Min) && evalMonthly <= parseFloat(b.range_Max)) ||
      [...activeTable].reverse().find(b => evalMonthly >= parseFloat(b.range_Min)) ||
      activeTable[0];

    const bracketIdx = activeTable.indexOf(matchedBracket) + 1;
    const bracketMin = parseFloat(matchedBracket.range_Min);
    const bracketMax = parseFloat(matchedBracket.range_Max);
    const baseTaxVal = parseFloat(matchedBracket.baseTax || 0);
    const excessRateVal = parseFloat(matchedBracket.excessRate || 0);

    const bracketLabel = (baseTaxVal === 0 && excessRateVal === 0)
      ? `Bracket ${bracketIdx} (₱${formatMoney(bracketMax)} & below - Tax Exempt)`
      : `Bracket ${bracketIdx} (₱${formatMoney(bracketMin)} - ${bracketMax >= 9999999 ? "above" : "₱" + formatMoney(bracketMax)})`;

    const rateText = (baseTaxVal === 0 && excessRateVal === 0)
      ? "₱0.00 (Exempt)"
      : `₱${formatMoney(baseTaxVal)} + ${(excessRateVal * 100).toFixed(0)}%`;

    const monthlyProjectedTax = computeTaxFromTable(evalMonthly);

    let deductionSubtext = "Monthly Tax ÷ 2";
    if (isDirectMode) {
      deductionSubtext = "Direct Cutoff Assessment";
    } else if (Math.abs(eeTax - monthlyProjectedTax) < 1.0 && eeTax > 0) {
      deductionSubtext = "1st Cutoff (100% Monthly Tax)";
    } else if (eeTax === 0 && monthlyProjectedTax > 0) {
      deductionSubtext = "2nd Cutoff (Deducted in 1st Period)";
    } else if (Math.abs(eeTax - (monthlyProjectedTax / 2)) < 1.0 && eeTax > 0) {
      deductionSubtext = "Monthly Tax ÷ 2";
    }

    return (
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
              <p className="font-bold text-brand-primary text-xl">₱{formatMoney(payroll.totalEarnings)}</p>
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
                    <p className="text-xs">Sum of SSS, PhilHealth, and Pag-IBIG employee contributions: ₱{formatMoney(eeSSS)} + ₱{formatMoney(eePH)} + ₱{formatMoney(eeHD)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="font-bold text-red-600 text-xl">₱{formatMoney(eeSSS + eePH + eeHD)}</p>
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
              <p className="font-bold text-emerald-600 text-xl">₱{formatMoney(taxable)}</p>
            </div>
          </div>

          {/* BIR Withholding Tax Bracket Computation Breakdown Card */}
          <div className="mt-6 border border-purple-200 bg-purple-50/50 rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>BIR Tax Withholding Bracket Breakdown</span>
              </span>
              <Badge className="bg-purple-700 text-white font-bold text-[10px]">
                {bracketLabel}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Period Taxable Income</p>
                <p className="font-bold text-slate-800 text-sm">
                  ₱{formatMoney(taxable)}
                </p>
                <p className="text-[9px] text-slate-400">Gross - (SSS+PH+HDMF)</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Evaluated Tax Base</p>
                <p className="font-bold text-purple-700 text-sm">
                  ₱{formatMoney(evalMonthly)}
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
                  ₱{formatMoney(eeTax)}
                </p>
                <p className="text-[9px] text-slate-400">
                  {deductionSubtext}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl mt-6 border border-purple-100">
            <span className="font-bold text-purple-800">Final Withholding Tax Deducted</span>
            <span className="font-bold text-purple-700 text-lg">₱{formatMoney(eeTax)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // 8. Loans Breakdown Card (From Deductions Tab)
  const renderLoans = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-amber-600">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <ListAltIcon className="text-amber-100 h-5 w-5" /> Governmental & Personal Loans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">SSS Loan</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.SSS_Loan)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">HDMF Loan</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.HDMF_Loan)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Calamity Loan</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.calamityLoan_Amnt)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Personal Loan</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.eastwest_Loan)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-amber-50 rounded-xl mt-4 border border-amber-100">
          <span className="font-bold text-amber-800">Total Loans</span>
          <span className="font-bold text-amber-700 text-lg">
            ₱{formatMoney(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // 9. Misc Deductions Card (From Deductions Tab)
  const renderMiscDeductions = () => (
    <Card className="border-0 shadow-sm bg-white py-0 h-full">
      <CardHeader className="border-b border-slate-50 py-4 bg-cyan-700">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <AttachMoneyIcon className="text-cyan-100 h-5 w-5" /> Misc. Deductions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 pb-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Health Card (HMO)</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.healthCard_Amnt)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
          <span className="text-sm text-slate-600">Multi-purpose Savings</span>
          <span className="font-semibold text-slate-800">₱{formatMoney(payroll.multiPurposeSavings)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-cyan-50 rounded-xl mt-4 border border-cyan-100">
          <span className="font-bold text-cyan-800">Total Misc</span>
          <span className="font-bold text-cyan-700 text-lg">
            ₱{formatMoney(parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Concise Playground Tab View (activeTab === "all")
  // Streamlined, compact, zero redundant clutter, defensive audit-ready
  // ---------------------------------------------------------------------------
  const renderPlaygroundTab = () => {
    const totalTimeDeductions = parseFloat(payroll.absence_Amnt || 0) + parseFloat(payroll.tardiness_Amnt || 0) + parseFloat(payroll.unpaidLeave_Amnt || 0);
    const totalEEShare = eeSSS + eePH + eeHD + eeTax;
    const totalERShare = erSSS + erPH + erHD;
    const totalRemittance = totalEEShare + totalERShare;
    const totalLoans = parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.HDMF_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0) + parseFloat(payroll.eastwest_Loan || 0);
    const totalMisc = parseFloat(payroll.healthCard_Amnt || 0) + parseFloat(payroll.multiPurposeSavings || 0);
    const totalAllDeductions = totalTimeDeductions + totalEEShare + totalLoans + totalMisc;
    const taxable = Math.max(0, (parseFloat(payroll.totalEarnings || 0) - (eeSSS + eePH + eeHD)));

    // Dynamic evaluation against Settings Reference Table (taxRefTable)
    const defaultBrackets = [
      { id: 1, range_Min: 0, range_Max: 20833, baseTax: 0, excessRate: 0, excessOver: 0 },
      { id: 2, range_Min: 20833.01, range_Max: 33332, baseTax: 0, excessRate: 0.15, excessOver: 20833 },
      { id: 3, range_Min: 33333, range_Max: 66666, baseTax: 1875, excessRate: 0.20, excessOver: 33333 },
      { id: 4, range_Min: 66667, range_Max: 166666, baseTax: 8541.80, excessRate: 0.25, excessOver: 66667 },
      { id: 5, range_Min: 166667, range_Max: 666666, baseTax: 33541.80, excessRate: 0.30, excessOver: 166667 },
      { id: 6, range_Min: 666667, range_Max: 99999999, baseTax: 183541.80, excessRate: 0.35, excessOver: 666667 }
    ];

    const activeTable = (taxRefTable && taxRefTable.length > 0) ? taxRefTable : defaultBrackets;

    const computeTaxFromTable = (inc) => {
      if (inc <= 0) return 0;
      const b = activeTable.find(r => inc >= parseFloat(r.range_Min) && inc <= parseFloat(r.range_Max)) ||
        [...activeTable].reverse().find(r => inc >= parseFloat(r.range_Min)) ||
        activeTable[0];
      const base = parseFloat(b.baseTax || 0);
      const over = parseFloat(b.excessOver || 0);
      const rate = parseFloat(b.excessRate || 0);
      return base + (Math.max(0, inc - over) * rate);
    };

    const mode2Tax = computeTaxFromTable(taxable);
    const isDirectMode = (taxEvaluationMode === "DIRECT_CUTOFF") || Math.abs(eeTax - mode2Tax) < 1.0;
    const evalMonthly = isDirectMode ? taxable : (taxable * 2);

    const matchedBracket = activeTable.find(b => evalMonthly >= parseFloat(b.range_Min) && evalMonthly <= parseFloat(b.range_Max)) ||
      [...activeTable].reverse().find(b => evalMonthly >= parseFloat(b.range_Min)) ||
      activeTable[0];

    const bracketIdx = activeTable.indexOf(matchedBracket) + 1;
    const baseTaxVal = parseFloat(matchedBracket.baseTax || 0);
    const excessRateVal = parseFloat(matchedBracket.excessRate || 0);

    const bracketLabel = (baseTaxVal === 0 && excessRateVal === 0)
      ? `Bracket ${bracketIdx} (Exempt)`
      : `Bracket ${bracketIdx} (₱${formatMoney(matchedBracket.range_Min)} - ${parseFloat(matchedBracket.range_Max) >= 9999999 ? "above" : "₱" + formatMoney(matchedBracket.range_Max)})`;

    const rateText = (baseTaxVal === 0 && excessRateVal === 0)
      ? "₱0.00 (Exempt)"
      : `₱${formatMoney(baseTaxVal)} + ${(excessRateVal * 100).toFixed(0)}%`;

    return (
      <>
        {/* 1. COMPACT EXECUTIVE SUMMARY STRIP */}
        <div className="lg:col-span-2 bg-white rounded-xl p-3.5 shadow-sm border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
          <div className="border-r border-slate-100 pr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Earnings</span>
            <p className="font-bold text-slate-800 text-lg sm:text-xl">₱{formatMoney(payroll.totalEarnings)}</p>
          </div>
          <div className="border-r border-slate-100 pr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deductions</span>
            <p className="font-bold text-rose-600 text-lg sm:text-xl">-₱{formatMoney(totalAllDeductions)}</p>
          </div>
          <div className="bg-brand-primary text-white p-2.5 rounded-lg flex flex-col justify-center">
            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider block">Net Take-Home</span>
            <p className="font-extrabold text-lg sm:text-xl text-white">₱{formatMoney(payroll.netPay)}</p>
          </div>
          <div className="pl-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gov't Remittance (EE+ER)</span>
            <p className="font-bold text-blue-700 text-lg sm:text-xl">₱{formatMoney(totalRemittance)}</p>
          </div>
        </div>

        {/* 2. CORE BREAKDOWN: Earnings (Left) & Deductions (Right) Side-by-Side */}
        
        {/* Left Column: Concise Gross Earnings */}
        <Card className="border-0 shadow-sm bg-white py-0 h-full">
          <CardHeader className="border-b border-slate-100 py-3 bg-slate-800 text-white">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUpIcon className="text-emerald-400 h-4 w-4" /> Gross Earnings
              </span>
              <Badge className="bg-emerald-950 text-emerald-300 text-[11px] font-bold border border-emerald-800/40">
                ₱{formatMoney(payroll.totalEarnings)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 pb-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-600 font-medium">Basic Pay ({payroll.NoDays_Worked} days @ ₱{formatMoney(payroll.dailyRate)})</span>
              <span className="font-bold text-slate-800">₱{formatMoney(payroll.potentialBasicPay ?? (payroll.totalScheduledDays && payroll.dailyRate ? payroll.totalScheduledDays * payroll.dailyRate : payroll.basicPay))}</span>
            </div>
            {(parseFloat(payroll.OT_Amnt || 0) > 0 || parseFloat(payroll.nightOT_Amnt || 0) > 0) && (
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Overtime ({((payroll.OT_Hrs || 0) + (payroll.nightOT_Hrs || 0))} hrs)</span>
                <span className="font-bold text-slate-800">₱{formatMoney(parseFloat(payroll.OT_Amnt || 0) + parseFloat(payroll.nightOT_Amnt || 0))}</span>
              </div>
            )}
            {parseFloat(payroll.nightDiff_Amnt || 0) > 0 && (
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Night Differential ({payroll.nightDiff_Hrs || 0} hrs)</span>
                <span className="font-bold text-slate-800">₱{formatMoney(payroll.nightDiff_Amnt)}</span>
              </div>
            )}
            {(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0)) > 0 && (
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Holiday Pay ({((payroll.holidaysRegularWorked || 0) + (payroll.holidaysSpecialWorked || 0))} days)</span>
                <span className="font-bold text-slate-800">₱{formatMoney(parseFloat(payroll.legalHol_Amnt || 0) + parseFloat(payroll.specialHol_Amnt || 0))}</span>
              </div>
            )}
            {parseFloat(payroll.allowance || 0) > 0 && (
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Allowance</span>
                <span className="font-bold text-slate-800">₱{formatMoney(payroll.allowance)}</span>
              </div>
            )}
            {parseFloat(payroll.incentives || 0) > 0 && (
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Incentives</span>
                <span className="font-bold text-slate-800">₱{formatMoney(payroll.incentives)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Consolidated Deductions */}
        <Card className="border-0 shadow-sm bg-white py-0 h-full">
          <CardHeader className="border-b border-slate-100 py-3 bg-slate-800 text-white">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingDownIcon className="text-rose-400 h-4 w-4" /> Deductions
              </span>
              <Badge className="bg-rose-950 text-rose-300 text-[11px] font-bold border border-rose-800/40">
                -₱{formatMoney(totalAllDeductions)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 pb-3 text-xs">
            {/* 1. Time / Attendance Deductions (if any) */}
            {totalTimeDeductions > 0 && (
              <div className="pb-1.5 border-b border-slate-100">
                <div className="flex justify-between items-center text-slate-500 font-semibold text-[10px] uppercase mb-1">
                  <span>Attendance & Time</span>
                  <span className="text-rose-600 font-bold">₱{formatMoney(totalTimeDeductions)}</span>
                </div>
                {parseFloat(payroll.absence_Amnt || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-700 py-0.5 pl-2">
                    <span>Absence ({payroll.absence_Hrs || 0} hrs)</span>
                    <span className="font-medium">₱{formatMoney(payroll.absence_Amnt)}</span>
                  </div>
                )}
                {parseFloat(payroll.tardiness_Amnt || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-700 py-0.5 pl-2">
                    <span>Tardiness ({payroll.tardiness_Mins || 0} mins)</span>
                    <span className="font-medium">₱{formatMoney(payroll.tardiness_Amnt)}</span>
                  </div>
                )}
                {parseFloat(payroll.unpaidLeave_Amnt || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-700 py-0.5 pl-2">
                    <span>Unpaid Leave ({payroll.unpaidLeave_Days} days)</span>
                    <span className="font-medium">₱{formatMoney(payroll.unpaidLeave_Amnt)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. Statutory Contributions & Tax (EE) */}
            <div className="pb-1.5 border-b border-slate-100">
              <div className="flex justify-between items-center text-slate-500 font-semibold text-[10px] uppercase mb-1">
                <span>Gov't Contributions & Tax (EE)</span>
                <span className="text-rose-600 font-bold">₱{formatMoney(totalEEShare)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700 pl-2">
                <div className="flex justify-between"><span>SSS:</span> <span className="font-semibold">₱{formatMoney(eeSSS)}</span></div>
                <div className="flex justify-between"><span>PhilHealth:</span> <span className="font-semibold">₱{formatMoney(eePH)}</span></div>
                <div className="flex justify-between"><span>Pag-IBIG:</span> <span className="font-semibold">₱{formatMoney(eeHD)}</span></div>
                <div className="flex justify-between"><span>Withholding Tax:</span> <span className="font-semibold text-purple-700">₱{formatMoney(eeTax)}</span></div>
              </div>
            </div>

            {/* 3. Loans & Benefits (if any) */}
            {(totalLoans + totalMisc) > 0 && (
              <div>
                <div className="flex justify-between items-center text-slate-500 font-semibold text-[10px] uppercase mb-1">
                  <span>Loans & HMO</span>
                  <span className="text-rose-600 font-bold">₱{formatMoney(totalLoans + totalMisc)}</span>
                </div>
                <div className="space-y-0.5 text-slate-700 pl-2">
                  {(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0)) > 0 && (
                    <div className="flex justify-between"><span>SSS / Calamity Loan:</span> <span className="font-medium">₱{formatMoney(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0))}</span></div>
                  )}
                  {parseFloat(payroll.HDMF_Loan || 0) > 0 && (
                    <div className="flex justify-between"><span>HDMF Loan:</span> <span className="font-medium">₱{formatMoney(payroll.HDMF_Loan)}</span></div>
                  )}
                  {parseFloat(payroll.eastwest_Loan || 0) > 0 && (
                    <div className="flex justify-between"><span>EastWest Advance:</span> <span className="font-medium">₱{formatMoney(payroll.eastwest_Loan)}</span></div>
                  )}
                  {parseFloat(payroll.healthCard_Amnt || 0) > 0 && (
                    <div className="flex justify-between"><span>Health Card (HMO):</span> <span className="font-medium">₱{formatMoney(payroll.healthCard_Amnt)}</span></div>
                  )}
                  {parseFloat(payroll.multiPurposeSavings || 0) > 0 && (
                    <div className="flex justify-between"><span>Savings:</span> <span className="font-medium">₱{formatMoney(payroll.multiPurposeSavings)}</span></div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. CONSOLIDATED STATUTORY REMITTANCE & COMPLIANCE AUDIT (Collapsible & Compact) */}
        <Card className="border-0 shadow-sm bg-white py-0 h-full lg:col-span-2">
          <CardHeader 
            className="border-b border-slate-100 py-2.5 bg-slate-100/90 cursor-pointer hover:bg-slate-200/70 transition-colors"
            onClick={() => setIsAuditExpanded(!isAuditExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AccountBalanceIcon className="text-slate-700 h-4 w-4" />
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Employer Share & Compliance Audit
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-[11px] text-slate-600 font-medium">
                  ER Share: <strong className="text-slate-800">₱{formatMoney(totalERShare)}</strong>
                </span>
                <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">
                  Total Remittance: <strong className="text-blue-700">₱{formatMoney(totalRemittance)}</strong>
                </span>
                <span className="text-[11px] text-slate-600 font-medium hidden md:inline">
                  YTD Gross: <strong className="text-slate-800">₱{formatMoney(payroll.ytdGross)}</strong>
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-600">
                  {isAuditExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          {isAuditExpanded && (
            <CardContent className="pt-3 pb-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Combined Statutory Contributions Table */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Gov't Agency Remittance (EE vs ER)
                  </span>
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr className="border-b border-slate-100">
                          <th className="py-2 px-2.5">Agency</th>
                          <th className="py-2 px-2.5 text-right">EE Share</th>
                          <th className="py-2 px-2.5 text-right">ER Share</th>
                          <th className="py-2 px-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-700">SSS</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(eeSSS)}</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(erSSS)}</td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-slate-800">₱{formatMoney(eeSSS + erSSS)}</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-700">PhilHealth</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(eePH)}</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(erPH)}</td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-slate-800">₱{formatMoney(eePH + erPH)}</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-700">HDMF (Pag-IBIG)</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(eeHD)}</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">₱{formatMoney(erHD)}</td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-slate-800">₱{formatMoney(eeHD + erHD)}</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-700">Withholding Tax (BIR)</td>
                          <td className="py-1.5 px-2.5 text-right text-purple-700 font-semibold">₱{formatMoney(eeTax)}</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-400 italic">—</td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-slate-800">₱{formatMoney(eeTax)}</td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-[11px]">
                        <tr>
                          <td className="py-2 px-2.5 uppercase text-[9px] text-slate-500">Total Remittance</td>
                          <td className="py-2 px-2.5 text-right text-slate-700">₱{formatMoney(totalEEShare)}</td>
                          <td className="py-2 px-2.5 text-right text-slate-700">₱{formatMoney(totalERShare)}</td>
                          <td className="py-2 px-2.5 text-right text-blue-700">₱{formatMoney(totalRemittance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Right Side: YTD Summary & BIR Tax Assessment */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Year-To-Date (YTD) & Tax Assessment
                  </span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">YTD Gross</span>
                      <p className="font-bold text-slate-800 text-sm">₱{formatMoney(payroll.ytdGross)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">YTD Non-Taxable</span>
                      <p className="font-bold text-emerald-600 text-sm">₱{formatMoney(payroll.ytdNonTaxable)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">YTD Deductions</span>
                      <p className="font-bold text-rose-600 text-sm">₱{formatMoney(payroll.ytdDeductions)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">YTD BIR Tax</span>
                      <p className="font-bold text-rose-600 text-sm">₱{formatMoney(payroll.ytdBIR)}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-purple-50/70 rounded-lg border border-purple-100 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-purple-900 text-xs">BIR Tax Withholding Schedule</span>
                      <Badge className="bg-purple-700 text-white text-[9px] px-1.5 py-0 border-0">{bracketLabel}</Badge>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
                      <span>Tax Base: <strong>₱{formatMoney(taxable)}</strong></span>
                      <span>Formula: <strong>{rateText}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </>
    );
  };

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
                        className="flex items-center justify-center rounded-full hover:bg-brand-primary-light text-brand-primary transition-all hover:scale-110"
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
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Payroll Details</h1>
              <span className="text-sm text-slate-500 font-mono">Payroll ID: {payroll.payrollId}</span>
            </div>
          </div>

          {/* Right Side: Actions (Payslip + Badge) */}
          <div className="flex items-center gap-3">
            {!String(payroll.payrollId).includes("PREVIEW") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendEmail}
                disabled={isSendingEmail}
                className="border-purple-200 text-brand-primary hover:bg-purple-50 flex items-center gap-2"
                title="Resend password-protected Payslips 1 & 2 and DTR to employee email"
              >
                <Mail className="w-4 h-4 text-purple-700" />
                {isSendingEmail ? "Sending..." : "Resend Email"}
              </Button>
            )}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          
          {/* Tab Group (Left) */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={activeTab === "overview" ? "default" : "outline"} 
              onClick={() => setActiveTab("overview")}
              className={activeTab === "overview" ? "bg-brand-primary text-white" : "text-brand-primary border-brand-primary hover:bg-brand-primary/5"}
            >
              Overview
            </Button>
            <Button 
              variant={activeTab === "govt" ? "default" : "outline"} 
              onClick={() => setActiveTab("govt")}
              className={activeTab === "govt" ? "bg-brand-primary text-white" : "text-brand-primary border-brand-primary hover:bg-brand-primary/5"}
            >
              Gov't Share
            </Button>
            <Button 
              variant={activeTab === "other" ? "default" : "outline"} 
              onClick={() => setActiveTab("other")}
              className={activeTab === "other" ? "bg-brand-primary text-white" : "text-brand-primary border-brand-primary hover:bg-brand-primary/5"}
            >
              Deductions
            </Button>
            {/* <Button 
              variant={activeTab === "all" ? "default" : "outline"} 
              onClick={() => setActiveTab("all")}
              className={activeTab === "all" ? "bg-brand-primary text-white shadow-sm" : "text-brand-primary border-brand-primary hover:bg-brand-primary/5"}
            >
              All-in-One (Playground)
            </Button> */}
          </div>  

          {/* View Payslip (Right) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button 
                  variant="outline" 
                  onClick={() => setIsModalOpen(true)}
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm flex items-center gap-2"
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
            <CardHeader className="border-b border-slate-50 py-4 bg-brand-primary">
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
                <p className="font-semibold text-slate-800">₱{formatMoney(payroll.ratePerHr)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Rate</label>
                <p className="font-semibold text-slate-800">₱{formatMoney(payroll.dailyRate)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pay Period Card */}
          <Card className="border-0 shadow-sm bg-white py-0 h-full">
            <CardHeader className="border-b border-slate-50 py-4 bg-brand-primary">
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

          {/* TAB 1: OVERVIEW (Existing Layout - Untouched) */}
          {activeTab === "overview" && (
            <>
              {renderEarningsBreakdown()}
              {renderTimeDeductions()}
              {renderYTDSnapshot()}
              {renderNetPayBanner()}
            </>
          )}

          {/* TAB 2: GOV'T SHARE (Existing Layout - Untouched) */}
          {activeTab === "govt" && (
            <>
              {renderEmployeeGovtShare()}
              {renderEmployerGovtShare()}
              {renderWithholdingTax()}
            </>
          )}

          {/* TAB 3: DEDUCTIONS (Existing Layout - Untouched) */}
          {activeTab === "other" && (
            <>
              {renderLoans()}
              {renderMiscDeductions()}
            </>
          )}

          {/* TAB 4: ALL-IN-ONE CONCISE PLAYGROUND (Streamlined, Non-Cluttered) */}
          {activeTab === "all" && renderPlaygroundTab()}

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
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ ...toast, message: "" })} 
        />
      </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default PayrollDetails;
