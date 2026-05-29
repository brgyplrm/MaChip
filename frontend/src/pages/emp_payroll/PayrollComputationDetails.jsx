import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import { 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown,
  Info,
  HelpCircle
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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="text-slate-500 hover:text-slate-800 p-0 h-auto mb-2">
              <Link to={`/employee/payslip/${id}`} className="flex items-center gap-1 text-sm">
                <ChevronLeft className="h-4 w-4" />
                Back to Payslip
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-slate-800">Computation Details</h1>
            <p className="text-slate-500 text-sm">
              Breakdown of earnings and deductions for {new Date(payroll.period_Start).toLocaleDateString()} - {new Date(payroll.period_End).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-[#2A174E] text-white p-4 rounded-xl shadow-lg flex flex-col items-end">
            <span className="text-xs text-slate-300 uppercase font-semibold">Net Take Home</span>
            <span className="text-2xl font-bold">{formatCurrency(payroll.netPay)}</span>
          </div>
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-300" /></TooltipTrigger>
                        <TooltipContent><p>Calculated as Daily Rate × Scheduled Days - Absences</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                  <span className="text-slate-700">Regular Overtime ({payroll.OT_Hrs} hrs)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.OT_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Night Differential ({payroll.nightDiff_Hrs} hrs)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.nightDiff_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Night OT ({payroll.nightOT_Hrs} hrs)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.nightOT_Amnt)}</span>
                </div>
                <Separator className="bg-slate-50" />
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Legal Holiday Pay</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.legalHol_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Special Holiday Pay</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.specialHol_Amnt)}</span>
                </div>
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
                  <span className="text-slate-700">SSS Contribution</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.SSS_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">PhilHealth Contribution</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.Philhealth_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Pag-IBIG Contribution</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.HDMF_Ded)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Withholding Tax</span>
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
                  <span className="text-slate-700">Absences ({payroll.absence_Hrs / 8} days)</span>
                  <span className="font-semibold text-red-500">-{formatCurrency(payroll.absence_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Tardiness ({payroll.tardiness_Mins} mins)</span>
                  <span className="font-semibold text-red-500">-{formatCurrency(payroll.tardiness_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Unpaid Leaves ({payroll.unpaidLeave_Days} days)</span>
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
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.SSS_Loan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Pag-IBIG Loan</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.HDMF_Loan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Cash Advance</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.advances_Amnt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Health Card (Maxicare)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(payroll.healthCard_Amnt)}</span>
                </div>
                {payroll.Other_Deductions > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Other Deductions</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(payroll.Other_Deductions)}</span>
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
    </Sidebar>
  );
};

export default PayrollComputationDetails;
