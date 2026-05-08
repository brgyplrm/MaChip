import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import DownloadIcon from '@mui/icons-material/Download';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const LeaveSummary = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [months, setMonths] = useState([]);
  const [rates, setRates] = useState({ vlRate: 1.0, slRate: 1.0 });
  const [loading, setLoading] = useState(true);

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

  const SummaryTable = ({ title, type, showRemaining = false, showConversion = false }) => (
    <>
    <Card className="shadow-sm border-0 bg-white mb-0 py-0 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pt-4 px-6">
        <CardTitle className="text-lg font-bold text-[#2A174E] flex items-center gap-2">
          <EventAvailableIcon className="text-[#2A174E]/70 h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="min-w-max">
            <TableHeader className="bg-[#2B174F]">
              <TableRow className="hover:bg-transparent border-b-0">
                {/* Sticky Left Column Header - Added h-auto py-3 to fix vertical spacing */}
                <TableHead className="sticky left-0 z-20 bg-[#2B174F] font-semibold text-white h-auto py-3 px-6 uppercase text-xs tracking-wider border-r border-[#45297e] min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.1)] align-middle">
                  Employee Name
                </TableHead>
                
                {/* Month Headers */}
                {months.map(m => (
                  <TableHead key={m} className="font-semibold text-white h-auto py-3 text-center uppercase text-xs tracking-wider min-w-[60px] align-middle">
                    {m}
                  </TableHead>
                ))}
                
                {/* Totals & Conversions Headers */}
                <TableHead className="font-bold text-white h-auto py-3 text-center uppercase text-xs tracking-wider bg-[#1d0f36] min-w-[80px] align-middle">
                  Total
                </TableHead>
                {showRemaining && (
                  <TableHead className="font-semibold text-white h-auto py-3 text-center uppercase text-xs tracking-wider bg-[#1d0f36] min-w-[120px] align-middle">
                    Remaining <span className="normal-case tracking-normal opacity-80">(7 Max)</span>
                  </TableHead>
                )}
                {showConversion && (
                  <TableHead className="font-semibold text-white h-auto py-3 text-right uppercase text-xs tracking-wider pr-6 bg-[#1d0f36] min-w-[140px] align-middle">
                    Total Conversion
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => {
                const monthlyValues = row[type];
                const total = monthlyValues.reduce((a, b) => a + b, 0);
                const remaining = type === "vl" ? row.vlRemaining : row.slRemaining;
                const rate = type === "vl" ? rates.vlRate : rates.slRate;
                const conversionValue = remaining * rate;
                const conversion = conversionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                return (
                  <TableRow key={row.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors group">
                    {/* Sticky Left Column Body */}
                    <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 py-3 px-6 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#2A174E] text-sm">{row.name}</span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">{formatUserId(row.user_Id)}</span>
                      </div>
                    </TableCell>

                    {/* Monthly Values */}
                    {monthlyValues.map((val, idx) => (
                      <TableCell key={idx} className="text-center py-3">
                        <span className={val > 0 ? "font-bold text-[#2A174E]" : "text-slate-300 font-medium"}>
                          {val > 0 ? val : "—"}
                        </span>
                      </TableCell>
                    ))}

                    {/* Totals & Conversions Body */}
                    <TableCell className="text-center py-3 font-bold text-slate-700 bg-slate-50/30">
                      {total > 0 ? total : "—"}
                    </TableCell>
                    {showRemaining && (
                      <TableCell className="text-center py-3 font-bold text-blue-600 bg-slate-50/30">
                        {remaining}
                      </TableCell>
                    )}
                    {showConversion && (
                      <TableCell className="text-right py-3 pr-6 font-bold text-green-600 bg-slate-50/30">
                        ₱{conversion}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={months.length + (showRemaining ? 1 : 0) + (showConversion ? 1 : 0) + 2} className="h-24 text-center text-slate-400 italic bg-white">
                    No data available for this year.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <div className="h-6"></div>
    </>
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="flex-1 p-4 md:p-6 w-full max-w-full mx-auto overflow-x-hidden min-w-0">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 min-w-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Leave & Attendance Summary</h1>
              <span className="text-sm text-slate-500 mt-1 block">
                Comprehensive overview of employee leaves, conversions, lates, and absences.
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
                <SelectTrigger className="w-full sm:w-[140px] bg-white border-slate-200 font-semibold text-slate-700 focus-visible:ring-[#2A174E]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-sm transition-colors">
                <DownloadIcon className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>

          {/* Loading State or Summary Tables */}
          {loading ? (
            <div className="space-y-8 mt-6">
              {[1, 2].map((skeletonIdx) => (
                <Card key={skeletonIdx} className="shadow-sm border-0 bg-white">
                  <div className="p-4 border-b border-slate-100">
                    <Skeleton className="h-6 w-[200px]" />
                  </div>
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="w-full">
              <SummaryTable title="Vacation Leaves" type="vl" showRemaining={true} showConversion={true} />
              <SummaryTable title="Sick Leaves" type="sl" showRemaining={true} showConversion={true} />
              <SummaryTable title="Overtime (Hours)" type="ot" />
              <SummaryTable title="Lates" type="lates" />
              <SummaryTable title="Absences" type="absences" />
            </div>
          )}
        </div>

        {/* Global styling for custom scrollbars */}
        <style dangerouslySetContent={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            height: 10px;
            width: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
          }
        `}} />
      </Sidebar>
    </div>
  );
};

export default LeaveSummary;