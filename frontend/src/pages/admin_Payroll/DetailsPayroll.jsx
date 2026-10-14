import { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { ChevronLeft, Mail } from "lucide-react";
import Toast from "../../components/toast/Toast";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  // Consolidated Single-Page Details View
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
      <div className="lg:col-span-2 space-y-6">
        {/* 1. EXECUTIVE KPI SUMMARY STRIP (4-Card Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Earnings */}
          <Card className="border-0 shadow-sm bg-white p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Earnings</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUpIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-800">₱{formatMoney(payroll.totalEarnings)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {payroll.NoDays_Worked || 0} Days Worked @ ₱{formatMoney(payroll.dailyRate)}
              </p>
            </div>
          </Card>

          {/* Total Deductions */}
          <Card className="border-0 shadow-sm bg-white p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deductions</span>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <TrendingDownIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-rose-600">-₱{formatMoney(totalAllDeductions)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                EE Gov't: ₱{formatMoney(totalEEShare)} | Other: ₱{formatMoney(totalTimeDeductions + totalLoans + totalMisc)}
              </p>
            </div>
          </Card>

          {/* Net Take-Home (Hero Highlight) */}
          <Card className="border-0 shadow-md bg-brand-primary text-white p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Net Take-Home Pay</span>
              <div className="p-2 rounded-lg bg-white/10 text-amber-300">
                <AttachMoneyIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">₱{formatMoney(payroll.netPay)}</p>
              <p className="text-xs text-indigo-100 mt-1 font-medium">
                Disbursed to Employee
              </p>
            </div>
          </Card>

          {/* Gov't Remittance (EE + ER) */}
          <Card className="border-0 shadow-sm bg-white p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Gov't Remittance</span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <AccountBalanceIcon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-blue-700">₱{formatMoney(totalRemittance)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                EE: ₱{formatMoney(totalEEShare)} | ER: ₱{formatMoney(totalERShare)}
              </p>
            </div>
          </Card>
        </div>

        {/* 2. CORE LEDGER BREAKDOWN: Gross Earnings (Left) & Deductions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card A: Gross Earnings Breakdown */}
          <Card className="pt-0 border-0 shadow-sm bg-white overflow-hidden rounded-xl flex flex-col justify-between">
            <div>
              <CardHeader className="py-4 px-6 bg-slate-800 text-white flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <TrendingUpIcon className="text-emerald-400 h-5 w-5" /> Gross Earnings Breakdown
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 1. Base Compensation */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Base Compensation
                  </h4>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">Daily Rate</span>
                      <span className="font-semibold text-slate-900">₱{formatMoney(payroll.dailyRate)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Basic Pay ({payroll.NoDays_Worked || 0} worked days
                        {payroll.totalScheduledDays && payroll.totalScheduledDays !== payroll.NoDays_Worked ? ` of ${payroll.totalScheduledDays} scheduled` : ""})
                      </span>
                      <span className="font-bold text-slate-900 text-base">
                        ₱{formatMoney(payroll.potentialBasicPay ?? (payroll.totalScheduledDays && payroll.dailyRate ? payroll.totalScheduledDays * payroll.dailyRate : payroll.basicPay))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Overtime & Premiums (Always Listed) */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Overtime & Holiday Premiums
                  </h4>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Regular Overtime ({payroll.OT_Hrs || 0} hrs)
                      </span>
                      <span className={parseFloat(payroll.OT_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.OT_Amnt || 0)}
                      </span>
                    </div>
                    {/* <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Night Overtime ({payroll.nightOT_Hrs || 0} hrs)
                      </span>
                      <span className={parseFloat(payroll.nightOT_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.nightOT_Amnt || 0)}
                      </span>
                    </div> */}
                    {/* <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Night Differential ({payroll.nightDiff_Hrs || 0} hrs)
                      </span>
                      <span className={parseFloat(payroll.nightDiff_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.nightDiff_Amnt || 0)}
                      </span>
                    </div> */}
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Regular Holiday Pay ({payroll.holidaysRegularWorked || 0} days)
                      </span>
                      <span className={parseFloat(payroll.legalHol_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.legalHol_Amnt || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Special Holiday Pay ({payroll.holidaysSpecialWorked || 0} days)
                      </span>
                      <span className={parseFloat(payroll.specialHol_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.specialHol_Amnt || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Total Footer Banner */}
            <div className="p-4 bg-emerald-50/80 border-t border-emerald-100 flex items-center justify-between mx-6 mb-6 rounded-xl">
              <span className="text-sm font-bold text-emerald-900">Total Gross Earnings</span>
              <span className="text-lg font-extrabold text-emerald-700">₱{formatMoney(payroll.totalEarnings)}</span>
            </div>
          </Card>

          {/* Card B: Total Deductions Breakdown */}
          <Card className="pt-0 border-0 shadow-sm bg-white overflow-hidden rounded-xl flex flex-col justify-between">
            <div>
              <CardHeader className="py-4 px-6 bg-slate-800 text-white flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <TrendingDownIcon className="text-rose-400 h-5 w-5" /> Consolidated Deductions
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 1. Time & Attendance Deductions (Always Listed) */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Attendance & Lost Time
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Tardiness / Late Arrival ({payroll.tardiness_Mins || 0} mins)
                      </span>
                      <span className={parseFloat(payroll.tardiness_Amnt || 0) > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>
                        ₱{formatMoney(payroll.tardiness_Amnt || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Absence Deductions ({payroll.absence_Hrs || 0} hrs)
                      </span>
                      <span className={parseFloat(payroll.absence_Amnt || 0) > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>
                        ₱{formatMoney(payroll.absence_Amnt || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">
                        Unpaid Leave ({payroll.unpaidLeave_Days || 0} days)
                      </span>
                      <span className={parseFloat(payroll.unpaidLeave_Amnt || 0) > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>
                        ₱{formatMoney(payroll.unpaidLeave_Amnt || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Mandatory Statutory Contributions Summary (De-duplicated) */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Government Statutory Share (EE)
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between items-center py-2.5">
                      <div>
                        <span className="text-slate-700 font-medium block">
                          Mandatory Contributions & Tax (EE Total)
                        </span>
                        <span className="text-xs text-slate-400">
                          Detailed EE vs ER breakdown in Remittance Audit table below
                        </span>
                      </div>
                      <span className="font-bold text-blue-700 text-base">
                        ₱{formatMoney(totalEEShare)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Government & Company Loans (Always Listed with Placeholders) */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Loans & Benefits Withholdings
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">SSS Salary / Calamity Loan</span>
                      <span className={(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0)) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(parseFloat(payroll.SSS_Loan || 0) + parseFloat(payroll.calamityLoan_Amnt || 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">Pag-IBIG (HDMF) Loan</span>
                      <span className={parseFloat(payroll.HDMF_Loan || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.HDMF_Loan || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">EastWest Cash Advance</span>
                      <span className={parseFloat(payroll.eastwest_Loan || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.eastwest_Loan || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">Health Card (HMO) Premium</span>
                      <span className={parseFloat(payroll.healthCard_Amnt || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.healthCard_Amnt || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-slate-700 font-medium">Multi-Purpose Savings (MPL)</span>
                      <span className={parseFloat(payroll.multiPurposeSavings || 0) > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                        ₱{formatMoney(payroll.multiPurposeSavings || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Total Footer Banner */}
            <div className="p-4 bg-rose-50/80 border-t border-rose-100 flex items-center justify-between mx-6 mb-6 rounded-xl">
              <span className="text-sm font-bold text-rose-900">Total Deductions</span>
              <span className="text-lg font-extrabold text-rose-700">-₱{formatMoney(totalAllDeductions)}</span>
            </div>
          </Card>
        </div>

        {/* 3. STATUTORY REMITTANCE AUDIT TABLE (Spacious & Clean) */}
        <Card className="pt-0 border-0 shadow-sm bg-white overflow-hidden rounded-xl">
          <CardHeader className="py-4 px-6 bg-slate-800 text-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AccountBalanceIcon className="text-blue-400 h-5 w-5" />
              <CardTitle className="text-base font-bold text-white">
                Government Agency Remittance & Compliance Audit
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="pb-0 px-6">
            <div className=" rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/80 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4">Government Agency</th>
                    <th className="py-3 px-4 text-right">Employee Share (EE)</th>
                    <th className="py-3 px-4 text-right">Employer Share (ER)</th>
                    <th className="py-3 px-4 text-right">Total Agency Remittance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span> Social Security System (SSS)
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(eeSSS)}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(erSSS)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">₱{formatMoney(eeSSS + erSSS)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span> Philippine Health Insurance (PhilHealth)
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(eePH)}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(erPH)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">₱{formatMoney(eePH + erPH)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span> Home Development Mutual Fund (Pag-IBIG)
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(eeHD)}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">₱{formatMoney(erHD)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">₱{formatMoney(eeHD + erHD)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span> Bureau of Internal Revenue (Withholding Tax)
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-purple-700">₱{formatMoney(eeTax)}</td>
                    <td className="py-3.5 px-4 text-right text-slate-400 italic font-medium">—</td>
                    <td className="py-3.5 px-4 text-right font-bold text-purple-700">₱{formatMoney(eeTax)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-200 text-sm">
                  <tr>
                    <td className="py-3.5 px-4 uppercase text-xs tracking-wider text-slate-700">Total Remittances</td>
                    <td className="py-3.5 px-4 text-right text-slate-800 font-extrabold">₱{formatMoney(totalEEShare)}</td>
                    <td className="py-3.5 px-4 text-right text-slate-800 font-extrabold">₱{formatMoney(totalERShare)}</td>
                    <td className="py-3.5 px-4 text-right text-blue-700 font-black text-base">₱{formatMoney(totalRemittance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. TAX INTELLIGENCE & YEAR-TO-DATE (YTD) AUDIT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card A: BIR Tax Withholding Schedule */}
          <Card className="pt-0 border-0 shadow-sm bg-white overflow-hidden rounded-xl">
            <CardHeader className="py-4 px-6 bg-slate-800 text-white flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                <AttachMoneyIcon className="text-purple-400 h-5 w-5" /> BIR Withholding Tax Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-purple-100 text-sm">
                  <span className="text-slate-600 font-medium">Cutoff Taxable Income Base</span>
                  <span className="font-extrabold text-slate-900 text-base">₱{formatMoney(taxable)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Progressive Bracket Formula</span>
                  <span className="font-bold text-purple-900">{rateText}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-purple-100 text-sm">
                  <span className="text-slate-700 font-semibold">Withheld Tax for this Period</span>
                  <span className="font-black text-purple-700 text-lg">₱{formatMoney(eeTax)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed italic">
                Evaluated against the official statutory withholding tax reference table. Gross earnings minus mandatory contributions (SSS, PhilHealth, Pag-IBIG).
              </p>
            </CardContent>
          </Card>

          {/* Card B: Year-To-Date (YTD) Ledger */}
          <Card className="pt-0 border-0 shadow-sm bg-white overflow-hidden rounded-xl">
            <CardHeader className="py-4 px-6 bg-slate-800 text-white flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                <CalendarTodayIcon className="text-slate-300 h-5 w-5" /> Year-To-Date (YTD) Cumulative
              </CardTitle>
              <span className="text-xs text-slate-300 font-medium">Fiscal Year 2026</span>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">YTD Gross Earnings</span>
                  <p className="text-xl font-extrabold text-slate-900">₱{formatMoney(payroll.ytdGross)}</p>
                </div>
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">YTD Non-Taxable</span>
                  <p className="text-xl font-extrabold text-emerald-700">₱{formatMoney(payroll.ytdNonTaxable)}</p>
                </div>
                <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block mb-1">YTD Total Deductions</span>
                  <p className="text-xl font-extrabold text-rose-700">₱{formatMoney(payroll.ytdDeductions)}</p>
                </div>
                <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-xl">
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block mb-1">YTD BIR Tax Withheld</span>
                  <p className="text-xl font-extrabold text-purple-700">₱{formatMoney(payroll.ytdBIR)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
        </div>

        {/* Payslip Preview Modal */}
        <ViewPayslipModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          payroll={payroll} 
        />

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

          {/* Consolidated Single-Page Details View */}
          {renderPlaygroundTab()}

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
