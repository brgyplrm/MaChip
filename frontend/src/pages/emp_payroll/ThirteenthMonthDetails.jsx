import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import { 
  ChevronLeft, 
  Gift, 
  Info,
  Calendar,
  Banknote,
  TrendingUp,
  Receipt,
  CheckCircle2
} from "lucide-react";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

const ThirteenthMonthDetails = () => {
  const { year } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-[#2A174E]/60 hover:text-[#2A174E] cursor-help" />
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

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/payroll/my-thirteenth-history?year=${year}`);
        if (!response.ok) throw new Error("Failed to fetch 13th month details.");
        
        const history = await response.json();
        const record = history.find(h => h.year === parseInt(year));
        
        if (!record) throw new Error("Record not found for this year.");
        
        // Robustness: ensure breakdown is an array and numeric fields are numbers
        let breakdown = record.breakdown || [];
        if (typeof breakdown === "string") {
          try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = []; }
        }
        
        record.breakdown = (breakdown || []).map(m => ({
          ...m,
          monthly_basic: parseFloat(m.monthly_basic || 0)
        }));
        
        record.totalBasicEarned = parseFloat(record.totalBasicEarned || 0);
        record.amount = parseFloat(record.amount || 0);
        record.taxable_Excess = parseFloat(record.taxable_Excess || 0);
        
        setData(record);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [year]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-14 w-48 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </Sidebar>
    );
  }

  if (error || !data) {
    return (
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm my-6">
            <div className="bg-red-50 p-4 rounded-full mb-4">
              <Info className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Record Not Found</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              We couldn't find a 13th month pay record for the year {year}.
            </p>
            <Button asChild className="mt-6 bg-[#2A174E] hover:bg-[#2A174E]/90 text-white font-bold text-xs" size="sm">
              <Link to="/employee/payroll" className="flex items-center gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back to History
              </Link>
            </Button>
          </div>
        </div>
      </Sidebar>
    );
  }

  const creditedMonths = (data.breakdown || []).filter(m => m.monthly_basic > 0).length;

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
          {/* Header Section */}
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

              <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out text-left space-y-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Gift className="h-6 w-6 text-[#2A174E]" />
                    {data.year} Year-End Bonus
                  </h1>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs">
                    {data.status || "Released"}
                  </Badge>
                </div>
                <p className="text-slate-500 text-sm">
                  13th Month Pay Computation Breakdown • Released on {new Date(data.releasedAt || data.updatedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Net Bonus Banner Card */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-[#2A174E] text-white p-4 px-6 rounded-xl shadow-lg flex flex-col items-start md:items-end cursor-help self-start md:self-auto min-w-[220px]">
                  <span className="text-xs text-slate-300 uppercase font-semibold tracking-wider">Total Net Bonus</span>
                  <span className="text-2xl font-bold">{formatCurrency(data.amount)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal">
                Final 13th month net benefit credited to you
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Overview Metric Cards (Aligned with Admin MetricCard layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <MetricCard
              label="Total Basic Earned"
              value={formatCurrency(data.totalBasicEarned)}
              color="emerald-500"
              description="Sum of released basic compensation"
              icon={TrendingUp}
              tooltip="Total cumulative basic earnings from all released payrolls in this calendar year."
            />
            <MetricCard
              label="Statutory Basis"
              value="Total ÷ 12"
              color="[#2A174E]"
              description="Prescribed by PH Labor Law (PD 851)"
              icon={Banknote}
              tooltip="Statutory formula dividing annual basic compensation by 12 calendar months."
            />
            <MetricCard
              label="Tax Exemption (TRAIN)"
              value={data.taxable_Excess > 0 ? formatCurrency(data.taxable_Excess) : "100% Exempt"}
              color={data.taxable_Excess > 0 ? "amber-500" : "blue-500"}
              description={data.taxable_Excess > 0 ? "Taxable excess above ₱90,000" : "Within ₱90,000 statutory threshold"}
              icon={Receipt}
              tooltip="Under the TRAIN Law, 13th month pay up to ₱90,000 is fully exempt from withholding tax."
            />
            <MetricCard
              label="Credited Months"
              value={`${creditedMonths} of 12 Months`}
              color="indigo-500"
              description="Months with active payroll earnings"
              icon={Calendar}
              tooltip="Number of calendar months where basic earnings were credited towards 13th month."
            />
          </div>

          {/* Monthly Contribution Breakdown Card */}
          <Card className="border-none shadow-sm overflow-hidden bg-white py-0">
            <CardHeader className="border-b border-slate-100 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#2A174E]" />
                  Monthly Contribution Breakdown
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Detailed basic pay earned for each month in calendar year {data.year}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-bold w-fit">
                12 Months Schedule
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow>
                      <TableHead className="py-3 px-6 text-left font-bold text-slate-500 uppercase text-[10px] tracking-wider">Month</TableHead>
                      <TableHead className="py-3 px-6 text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Basic Pay Earned</TableHead>
                      <TableHead className="py-3 px-6 text-center font-bold text-slate-500 uppercase text-[10px] tracking-wider">Monthly Share</TableHead>
                      <TableHead className="py-3 px-6 text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Accrued Bonus (÷ 12)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {data.breakdown && data.breakdown.length > 0 ? (
                      data.breakdown.map((m, idx) => {
                        const sharePercent = data.totalBasicEarned > 0 ? (m.monthly_basic / data.totalBasicEarned) * 100 : 0;
                        const accrued = m.monthly_basic / 12;
                        return (
                          <TableRow key={idx} className="hover:bg-slate-50/60 transition-colors group">
                            <TableCell className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#2A174E]/10 group-hover:text-[#2A174E] transition-colors">
                                  <Calendar className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-slate-800 text-sm">{m.month_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-6 text-right font-bold text-slate-800 text-sm">
                              {formatCurrency(m.monthly_basic)}
                            </TableCell>
                            <TableCell className="py-3.5 px-6 text-center">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                  <div 
                                    className="bg-[#2A174E] h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(100, Math.max(0, sharePercent))}%` }} 
                                  />
                                </div>
                                <Badge variant="secondary" className="text-[10px] font-bold font-mono px-2 py-0.5">
                                  {sharePercent.toFixed(1)}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-6 text-right font-bold text-emerald-600 text-sm">
                              {formatCurrency(accrued)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-slate-400 italic">
                          No monthly contribution records available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {/* Summary Row */}
                  <TableRow className="bg-[#2A174E] text-white hover:bg-[#2A174E] font-bold">
                    <TableCell className="py-4 px-6 uppercase tracking-wider text-xs font-bold text-slate-200">
                      Total Annual Basic
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right font-black text-base text-white">
                      {formatCurrency(data.totalBasicEarned)}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-center text-xs font-semibold text-slate-300">
                      100.0%
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right font-black text-base text-emerald-300">
                      {formatCurrency(data.amount)}
                    </TableCell>
                  </TableRow>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Statutory Policy & Guideline Card */}
          <Card className="border border-slate-200/80 bg-white shadow-xs p-5 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#2A174E]/10 text-[#2A174E] flex items-center justify-center shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  Statutory Computation & Guidelines
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Under Philippine Presidential Decree No. 851, the 13th month pay is computed by dividing your total basic salary earned during the calendar year by 12. Only basic compensation from <strong>Released</strong> payrolls is included in the computation. Overtime premiums, allowances, and other incentives are excluded from basic pay per labor standards.
                </p>
                {data.taxable_Excess > 0 ? (
                  <p className="text-amber-700 text-xs font-semibold pt-1">
                    Tax Advisory: The total bonus exceeds the statutory ₱90,000 tax-exemption threshold under the TRAIN Law. An excess of {formatCurrency(data.taxable_Excess)} is subject to applicable withholding tax.
                  </p>
                ) : (
                  <p className="text-emerald-700 text-xs font-semibold pt-1">
                    Tax Advisory: This benefit is within the ₱90,000 statutory exemption threshold under the TRAIN Law and is 100% tax-exempt.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default ThirteenthMonthDetails;
