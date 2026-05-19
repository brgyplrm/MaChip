import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import { exportLeaveSummaryPDF } from "../../../utils/leaveSummaryExport";
import DownloadIcon from '@mui/icons-material/Download';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LeaveSummary = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [months, setMonths] = useState([]);
  const [rates, setRates] = useState({ vlRate: 1.0, slRate: 1.0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Track active tab for the PDF export requirement
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/api/request/summary/${year}`);
        const result = await res.json();
        if (res.ok) {
          setData(result.data);
          setMonths(result.months);
          setRates({ vlRate: result.vlRate, slRate: result.slRate });
        }
      } catch (err) {
        console.error("Failed to fetch leave summary:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

  // Client-side search matching employee names or IDs
  const filteredData = data.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.user_Id.toString().includes(searchTerm)
  );

  return (
    <Sidebar>
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] tracking-tight">Leave & Attendance Hub</h1>
            <span className="text-sm text-slate-500 mt-1 block">
              Manage and track comprehensive employee records and conversions.
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
            <Input
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[250px] bg-white text-slate-700 border-slate-200 focus-visible:ring-[#2A174E]"
            />
            <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="w-full sm:w-[120px] bg-white border-slate-200 font-semibold text-[#2A174E]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button 
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
              onClick={() => exportLeaveSummaryPDF(data, months, year, activeTab, rates)}
              disabled={loading || data.length === 0}
            >
              <DownloadIcon className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Dynamic View States */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[340px] w-full rounded-xl" />
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-medium border border-dashed rounded-xl bg-slate-50/50">
            No employee records found matching your search criteria.
          </div>
        ) : (
          /* Cards Grid Framework */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredData.map((row) => {
              // Exact mathematical transformations from your old component logic
              const monthlyVl = row.vl || [];
              const monthlySl = row.sl || [];
              const monthlyOt = row.ot || [];
              const monthlyLates = row.lates || [];
              const monthlyAbsences = row.absences || [];

              const totalVl = monthlyVl.reduce((a, b) => a + b, 0);
              const totalSl = monthlySl.reduce((a, b) => a + b, 0);
              const totalOt = monthlyOt.reduce((a, b) => a + b, 0);
              const totalLates = monthlyLates.reduce((a, b) => a + b, 0);
              const totalAbsences = monthlyAbsences.reduce((a, b) => a + b, 0);

              // Preserved original final calculation states
              const vlFinalAmount = row.vlRemaining * row.dailyRate;
              const slFinalAmount = row.slRemaining * row.dailyRate;
              const totalCombinedConversion = vlFinalAmount + slFinalAmount;

              return (
                <Card key={row.user_Id} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
                  
                  {/* Card Profile Section */}
                  <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3 truncate mr-2">
                      <div className="p-2 bg-[#2A174E]/10 rounded-lg text-[#2A174E] shrink-0">
                        <AccountCircleIcon />
                      </div>
                      <div className="truncate">
                        <CardTitle className="text-sm md:text-base font-bold text-[#2A174E] truncate">{row.name}</CardTitle>
                        <span className="text-xs font-mono text-slate-400 block mt-0.5">{formatUserId(row.user_Id)}</span>
                      </div>
                    </div>

                    {/* --- SHEET DRAWER FOR DETAILED BREAKDOWN MATRIX --- */}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-[#2A174E] hover:bg-[#2A174E]/5 rounded-full shrink-0">
                          <OpenInNewIcon fontSize="small" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-2xl bg-white overflow-y-auto custom-scrollbar p-6">
                        <SheetHeader className="pb-4 border-b border-slate-100">
                          <SheetTitle className="text-xl font-bold text-[#2A174E]">{row.name}'s History</SheetTitle>
                          <SheetDescription className="text-xs text-slate-400 font-mono">
                            ID: {formatUserId(row.user_Id)} | Target Calendar Year: {year}
                          </SheetDescription>
                        </SheetHeader>

                        {/* Summary Metrics List inside Drawer */}
                        <div className="grid grid-cols-2 gap-4 my-6">
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">VL Encashment</span>
                            <span className="text-base font-bold text-slate-800">₱{vlFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs text-slate-500 block mt-0.5">({row.vlRemaining} days remaining)</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">SL Encashment</span>
                            <span className="text-base font-bold text-slate-800">₱{slFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs text-slate-500 block mt-0.5">({row.slRemaining} days remaining)</span>
                          </div>
                        </div>

                        {/* Month-by-Month Matrix Table */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">12-Month Distributed Log Matrix</h3>
                          <div className="border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                            <Table>
                              <TableHeader className="bg-[#2B174F]">
                                <TableRow className="hover:bg-transparent border-b-0">
                                  <TableHead className="font-semibold text-white uppercase text-[10px] tracking-wider py-3 px-4">Month</TableHead>
                                  <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">VL</TableHead>
                                  <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">SL</TableHead>
                                  <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">OT (h)</TableHead>
                                  <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">Late (m)</TableHead>
                                  <TableHead className="font-semibold text-white text-center uppercase text-[10px] tracking-wider py-3">Abs (d)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {months.map((month, idx) => (
                                  <TableRow key={month} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="font-bold text-[#2A174E] text-xs py-2.5 px-4">{month}</td>
                                    <td className="text-center text-xs font-semibold text-slate-600">{monthlyVl[idx] > 0 ? monthlyVl[idx] : "—"}</td>
                                    <td className="text-center text-xs font-semibold text-slate-600">{monthlySl[idx] > 0 ? monthlySl[idx] : "—"}</td>
                                    <td className="text-center text-xs font-semibold text-slate-600">{monthlyOt[idx] > 0 ? monthlyOt[idx].toFixed(1) : "—"}</td>
                                    <td className="text-center text-xs font-semibold text-slate-600">{monthlyLates[idx] > 0 ? monthlyLates[idx] : "—"}</td>
                                    <td className="text-center text-xs font-semibold text-slate-600">{monthlyAbsences[idx] > 0 ? monthlyAbsences[idx] : "—"}</td>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 flex-1">
                    
                    {/* Progress Trackers for All Leaves (Assuming Max 7 parameters from your template headers) */}
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500">Vacation Leaves Used</span>
                          <span className="text-slate-800 font-bold">{totalVl > 0 ? `${totalVl} Days` : "—"} <span className="text-slate-400 font-normal">({row.vlRemaining} Left)</span></span>
                        </div>
                        <Progress value={(totalVl / 7) * 100} className="h-1.5 bg-slate-100" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500">Sick Leaves Used</span>
                          <span className="text-slate-800 font-bold">{totalSl > 0 ? `${totalSl} Days` : "—"} <span className="text-slate-400 font-normal">({row.slRemaining} Left)</span></span>
                        </div>
                        <Progress value={(totalSl / 7) * 100} className="h-1.5 bg-slate-100" />
                      </div>
                    </div>

                    {/* Attendance Metric Grids (Matches your original variable conversion formulas) */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-1 text-amber-600 mb-1">
                          <AccessTimeIcon className="text-xs shrink-0" fontSize="inherit" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Overtime</span>
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">{totalOt ? `${(totalOt * 60)} m` : "—"}</span>
                          <span className="text-[10px] text-slate-400 font-medium block truncate">{totalOt ? `${totalOt.toFixed(2)} hrs` : ""}</span>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-1 text-rose-500 mb-1">
                          <CalendarTodayIcon className="text-xs shrink-0" fontSize="inherit" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Lates</span>
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">{totalLates ? `${totalLates} m` : "—"}</span>
                          <span className="text-[10px] text-slate-400 font-medium block truncate">{totalLates ? `${(totalLates / 60).toFixed(2)} hrs` : ""}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-1 text-slate-500 mb-1">
                          <RemoveCircleOutlineIcon className="text-xs shrink-0" fontSize="inherit" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Absences</span>
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">{totalAbsences ? `${(totalAbsences * 8 * 60)} m` : "—"}</span>
                          <span className="text-[10px] text-slate-400 font-medium block truncate">{totalAbsences ? `${(totalAbsences * 8).toFixed(2)} hrs` : ""}</span>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Financial Calculations Banner */}
                    <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-2.5 flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AccountBalanceWalletIcon className="text-emerald-600 shrink-0" fontSize="small" />
                        <span className="text-[11px] font-semibold text-emerald-800 truncate">Total Leave Conversion</span>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-700 shrink-0">
                        ₱{totalCombinedConversion.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </Sidebar>
  );
};

export default LeaveSummary;