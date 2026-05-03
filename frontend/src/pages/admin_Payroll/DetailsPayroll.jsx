import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const PayrollDetails = () => {
  const navigate = useNavigate();
  const { payrollId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const periodStart = queryParams.get("start");
  const periodEnd = queryParams.get("end");

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

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
              user_Id: emp.user_Id,
              dailyRate: preview.dailyRate,
              ratePerHr: preview.ratePerHr,
              period_Start: periodStart,
              period_End: periodEnd,
              NoDays_Worked: preview.NoDays_Worked,
              NoHrs_Worked: preview.NoHrs_Worked,
              basicPay: preview.basicPay,
              OT_Hrs: preview.OT_Hrs,
              OT_Amnt: preview.OT_Amnt,
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
              Tax_Ded: preview.Tax_Ded,
              healthCard_Amnt: preview.healthCard_Amnt,
              SSS_Loan: preview.SSS_Loan,
              HDMF_Loan: preview.HDMF_Loan,
              calamityLoan_Amnt: preview.calamityLoan_Amnt,
              advances_Amnt: preview.advances_Amnt,
              globe_Deduction: preview.globe_Deduction,
              eastwest_Loan: preview.eastwest_Loan,
              multiPurposeSavings: preview.multiPurposeSavings,
              totalDeductions: preview.totalDeductions,
              netPay: preview.netPay,
              PaystatusName: "Draft",
              incentives: preview.incentives || 0,
              allowance: preview.allowance || 0
            });
          }
        } else {
          const response = await fetchWithAuth(`/api/payroll/${payrollId}`);
          const data = await response.json();
          if (response.ok) setPayroll(data);
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    if (payrollId) fetchPayrollDetails();
  }, [payrollId, periodStart, periodEnd]);

  if (loading) return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-8 w-[100px] rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardHeader className="pb-3"><Skeleton className="h-6 w-[150px]" /></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[120px] w-full mt-6 rounded-xl" />
      </div>
      </Sidebar>
    </div>
  );

  if (!payroll) return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 flex justify-center items-center p-4">
        <p className="text-slate-500 italic">Payroll record not found.</p>
      </div>
      </Sidebar>
    </div>
  );

  const eeSSS = parseFloat(payroll.SSS_Ded || 0);
  const eePH = parseFloat(payroll.Philhealth_Ded || 0);
  const eeHD = parseFloat(payroll.HDMF_Ded || 0);
  const eeTax = parseFloat(payroll.Tax_Ded || 0);

  // ER shares - these might be in the payroll object if the API returns them
  // For now, I'll check if they exist, otherwise default to 0
  const erSSS = parseFloat(payroll.SSS_Ded_ER || 0);
  const erPH = parseFloat(payroll.Philhealth_Ded_ER || 0);
  const erHD = parseFloat(payroll.HDMF_Ded_ER || 0);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full overflow-x-hidden min-w-0">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-start sm:items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 sm:mt-0 hover:scale-110"
            >
              <ArrowBackIcon />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Payroll Details</h1>
              <span className="text-sm text-slate-500 mt-1 block font-mono">Payroll ID: {payroll.payrollId}</span>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${payroll.PaystatusName?.toLowerCase() === "released" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
          >
            {payroll.PaystatusName}
          </Badge>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant={activeTab === "overview" ? "default" : "outline"} 
            onClick={() => setActiveTab("overview")}
            className={activeTab === "overview" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E]"}
          >
            Overview
          </Button>
          <Button 
            variant={activeTab === "govt" ? "default" : "outline"} 
            onClick={() => setActiveTab("govt")}
            className={activeTab === "govt" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E]"}
          >
            Gov't Share
          </Button>
          <Button 
            variant={activeTab === "other" ? "default" : "outline"} 
            onClick={() => setActiveTab("other")}
            className={activeTab === "other" ? "bg-[#2A174E] text-white" : "text-[#2A174E] border-[#2A174E]"}
          >
            Other Deductions
          </Button>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Employee Information Card */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 py-0">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <PersonOutlineIcon className="text-slate-400 h-5 w-5" /> Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 py-0">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <CalendarTodayIcon className="text-slate-400 h-5 w-5" /> Pay Period
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <p className="font-semibold text-slate-800">Regular: {payroll.holidaysRegularWorked || 0} | Special: {payroll.holidaysSpecialWorked || 0}</p>
              </div>
            </CardContent>
          </Card>

          {/* Earnings Breakdown Card */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 py-0">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <TrendingUpIcon className="text-green-500 h-5 w-5" /> Earnings Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <span className="text-sm text-slate-600">Basic Pay</span>
                <span className="font-semibold text-slate-800">₱{parseFloat(payroll.basicPay).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <span className="text-sm text-slate-600">Overtime ({payroll.OT_Hrs} hrs)</span>
                <span className="font-semibold text-slate-800">₱{parseFloat(payroll.OT_Amnt || 0).toLocaleString()}</span>
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
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 py-0">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <TrendingDownIcon className="text-red-500 h-5 w-5" /> {activeTab === 'overview' ? 'Deductions Breakdown' : activeTab === 'govt' ? 'Government Contributions' : 'Other Deductions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeTab === 'overview' && (
                <>
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
                    <span className="font-bold text-red-800">Total Deductions</span>
                    <span className="font-bold text-red-700 text-lg">₱{parseFloat(payroll.totalDeductions).toLocaleString()}</span>
                  </div>
                </>
              )}

              {activeTab === 'govt' && (
                <div className="govtTableWrapper overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="p-2 text-left">Deduction Name</th>
                        <th className="p-2 text-right">Employee</th>
                        <th className="p-2 text-right">Employer</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2">SSS Contribution</td>
                        <td className="p-2 text-right">₱{eeSSS.toLocaleString()}</td>
                        <td className="p-2 text-right">₱{erSSS.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold">₱{(eeSSS + erSSS).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2">PhilHealth</td>
                        <td className="p-2 text-right">₱{eePH.toLocaleString()}</td>
                        <td className="p-2 text-right">₱{erPH.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold">₱{(eePH + erPH).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="p-2">HDMF (Pag-IBIG)</td>
                        <td className="p-2 text-right">₱{eeHD.toLocaleString()}</td>
                        <td className="p-2 text-right">₱{erHD.toLocaleString()}</td>
                        <td className="p-2 text-right font-bold">₱{(eeHD + erHD).toLocaleString()}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td className="p-2">Total Government</td>
                        <td className="p-2 text-right">₱{(eeSSS + eePH + eeHD).toLocaleString()}</td>
                        <td className="p-2 text-right">₱{(erSSS + erPH + erHD).toLocaleString()}</td>
                        <td className="p-2 text-right">₱{(eeSSS + eePH + eeHD + erSSS + erPH + erHD).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {activeTab === 'other' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50 bg-blue-50/50 p-2 rounded">
                    <span className="text-sm font-bold text-blue-800">Withholding Tax</span>
                    <span className="font-bold text-blue-700">₱{eeTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Health Card (Maxicare)</span>
                    <span className="font-semibold">₱{parseFloat(payroll.healthCard_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">SSS Loan</span>
                    <span className="font-semibold">₱{parseFloat(payroll.SSS_Loan || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">HDMF Loan</span>
                    <span className="font-semibold">₱{parseFloat(payroll.HDMF_Loan || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Calamity Loan</span>
                    <span className="font-semibold">₱{parseFloat(payroll.calamityLoan_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Advances to Employees</span>
                    <span className="font-semibold">₱{parseFloat(payroll.advances_Amnt || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Eastwest Loan</span>
                    <span className="font-semibold">₱{parseFloat(payroll.eastwest_Loan || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Globe Deduction</span>
                    <span className="font-semibold">₱{parseFloat(payroll.globe_Deduction || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Multi-Purpose Savings</span>
                    <span className="font-semibold">₱{parseFloat(payroll.multiPurposeSavings || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Net Pay Highlight */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-8 rounded-2xl text-white flex justify-between items-center relative overflow-hidden mb-8 shadow-md">
          <div className="relative z-10">
            <p className="text-sm uppercase tracking-wider font-bold opacity-90 mb-1">Net Pay</p>
            <p className="text-4xl md:text-5xl font-extrabold tracking-tight">₱{parseFloat(payroll.netPay).toLocaleString()}</p>
          </div>
          <AttachMoneyIcon className="absolute -right-4 -bottom-4 text-[150px] opacity-20 transform -rotate-12" />
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
    </Sidebar>
    </div>
  );
};

export default PayrollDetails;
