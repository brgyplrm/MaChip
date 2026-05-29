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
  Receipt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const ThirteenthMonthDetails = () => {
  const { year } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </Sidebar>
    );
  }

  if (error || !data) {
    return (
      <Sidebar>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="bg-red-50 p-6 rounded-full mb-4">
            <Info className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Record Not Found</h2>
          <p className="text-slate-500 mt-2">We couldn't find a 13th month pay record for the year {year}.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/employee/payroll">Back to History</Link>
          </Button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-slate-800 p-0 h-auto">
            <Link to="/employee/payroll" className="flex items-center gap-1 text-sm">
              <ChevronLeft className="h-4 w-4" />
              Back to History
            </Link>
          </Button>
          <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border-none font-bold">
            Released on {new Date(data.releasedAt || data.updatedAt).toLocaleDateString()}
          </Badge>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <Gift className="h-8 w-8 text-pink-500" />
              {data.year} Year-End Bonus
            </h1>
            <p className="text-slate-500 font-medium">13th Month Pay Computation Breakdown</p>
          </div>
          <div className="bg-[#2A174E] text-white p-6 rounded-2xl shadow-xl flex flex-col items-end min-w-[240px]">
            <span className="text-xs text-slate-300 uppercase font-black tracking-widest">Total Net Bonus</span>
            <span className="text-3xl font-black">{formatCurrency(data.amount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Basic Earned</p>
              <p className="text-xl font-black text-slate-800">{formatCurrency(data.totalBasicEarned)}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg">
                <Info className="h-3 w-3" />
                Sum of basic pay from all released payrolls in {year}.
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Computation Formula</p>
              <p className="text-xl font-black text-slate-800">Total / 12</p>
              <p className="text-[10px] text-slate-500 font-medium">Standard PH labor law calculation.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxable Amount</p>
              <p className="text-xl font-black text-slate-800">{formatCurrency(data.taxable_Excess)}</p>
              <p className="text-[10px] text-slate-500 font-medium">Excess of ₱90,000 threshold.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-[#2A174E]/5 border-b border-slate-100 p-6">
            <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Monthly Contribution Breakdown
            </CardTitle>
            <CardDescription>
              Detailed basic pay earned for each month in {data.year}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4 text-left">Month</th>
                    <th className="px-6 py-4 text-right">Basic Pay Earned</th>
                    <th className="px-6 py-4 text-center">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.breakdown && data.breakdown.length > 0 ? (
                    data.breakdown.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-lg text-slate-500 group-hover:bg-[#2A174E]/10 group-hover:text-[#2A174E] transition-colors">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-slate-700">{m.month_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-800">
                          {formatCurrency(m.monthly_basic)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className="bg-white text-[10px] font-bold">
                            {((m.monthly_basic / data.totalBasicEarned) * 100).toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-400 italic">
                        No monthly data available.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-[#2A174E] text-white">
                  <tr>
                    <td className="px-6 py-4 font-black uppercase tracking-widest text-xs">Total Yearly Basic</td>
                    <td className="px-6 py-4 text-right font-black text-lg">{formatCurrency(data.totalBasicEarned)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Audit / Info Banner */}
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4 shadow-inner">
          <div className="bg-blue-500 p-2 rounded-xl text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-sm text-blue-900 space-y-1">
            <p className="font-black uppercase tracking-wider text-xs">How is this calculated?</p>
            <p className="opacity-80 leading-relaxed font-medium">
              The 13th month pay is computed by dividing your total basic salary earned during the calendar year by 12. 
              Only basic salary from <strong>Released</strong> payrolls is included in the computation. 
              Overtime, allowances, and other premiums are excluded per labor regulations.
            </p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
};

export default ThirteenthMonthDetails;
