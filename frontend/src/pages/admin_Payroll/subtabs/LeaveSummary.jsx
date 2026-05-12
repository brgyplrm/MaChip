import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import DownloadIcon from '@mui/icons-material/Download';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const LeaveSummary = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [months, setMonths] = useState([]);
  const [rates, setRates] = useState({ vlRate: 1.0, slRate: 1.0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vl");

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

  const SummaryTable = ({ type, showRemaining = true, showConversion = true }) => (
    <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto custom-scrollbar relative">
          <Table className="min-w-max border-separate border-spacing-0">
            <TableHeader className="bg-[#2B174F]">
              <TableRow className="hover:bg-transparent border-b-0">
                {/* STICKY LEFT: Name */}
                <TableHead className="sticky left-0 z-30 bg-[#2B174F] font-semibold text-white h-auto py-4 px-6 uppercase text-xs tracking-wider border-r border-[#45297e] min-w-[220px] shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  Employee Name
                </TableHead>
                
                {months.map(m => (
                  <TableHead key={m} className="font-semibold text-white h-auto py-4 text-center uppercase text-xs tracking-wider min-w-[70px]">
                    {m}
                  </TableHead>
                ))}
                
                {/* STICKY RIGHT: Totals */}
                <TableHead className={`sticky right-${showConversion ? (showRemaining ? '[340px]' : '[140px]') : '0'} z-20 font-bold text-white h-auto py-4 text-center uppercase text-xs tracking-wider bg-[#1d0f36] min-w-[80px] shadow-[-2px_0_5px_rgba(0,0,0,0.2)]`}>
                  Total
                </TableHead>

                {showRemaining && (
                  <TableHead className={`sticky right-${showConversion ? '[140px]' : '0'} z-20 font-semibold text-white h-auto py-4 text-center uppercase text-xs tracking-wider bg-[#1d0f36] min-w-[120px] border-l border-[#45297e]`}>
                    Remaining <span className="normal-case tracking-normal opacity-80">(7 Max)</span>
                  </TableHead>
                )}

                {showConversion && (
                  <TableHead className="sticky right-0 z-20 font-semibold text-white h-auto py-4 text-right uppercase text-xs tracking-wider pr-6 bg-[#1d0f36] min-w-[140px] border-l border-[#45297e]">
                    Total Conversion
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => {
                const monthlyValues = row[type] || [];
                const total = monthlyValues.reduce((a, b) => a + b, 0);
                const remaining = type === "vl" ? row.vlRemaining : row.slRemaining;
                const rate = type === "vl" ? rates.vlRate : rates.slRate;
                const conversion = (remaining * rate).toLocaleString(undefined, { minimumFractionDigits: 2 });

                return (
                  <TableRow key={row.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors group">
                    {/* STICKY LEFT: Body */}
                    <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 py-4 px-6 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#2A174E] text-sm">{row.name}</span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">{formatUserId(row.user_Id)}</span>
                      </div>
                    </TableCell>

                    {monthlyValues.map((val, idx) => (
                      <TableCell key={idx} className="text-center py-4">
                        <span className={val > 0 ? "font-bold text-[#2A174E]" : "text-slate-300 font-medium"}>
                          {val > 0 ? val : "—"}
                        </span>
                      </TableCell>
                    ))}

                    {/* STICKY RIGHT: Body */}
                    <TableCell className={`sticky right-${showConversion ? (showRemaining ? '[340px]' : '[140px]') : '0'} z-10 bg-slate-50 font-bold text-slate-700 text-center shadow-[-2px_0_5px_rgba(0,0,0,0.02)]`}>
                      {total > 0 ? total : "—"}
                    </TableCell>

                    {showRemaining && (
                      <TableCell className={`sticky right-${showConversion ? '[140px]' : '0'} z-10 bg-blue-50/50 font-bold text-blue-600 text-center border-l border-slate-100`}>
                        {remaining}
                      </TableCell>
                    )}

                    {showConversion && (
                      <TableCell className="sticky right-0 z-10 bg-green-50/50 text-right py-4 pr-6 font-bold text-green-600 border-l border-slate-100">
                        ₱{conversion}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen bg-slate-50 p-4 md:p-6">
        {/* Header - Consistent with Logs styling */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Leave & Attendance Summary</h1>
            <span className="text-sm text-slate-500 mt-1 block">
              Manage and track comprehensive employee records and conversions.
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="w-full sm:w-[140px] bg-white border-slate-200 font-semibold text-[#2A174E]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold">
              <DownloadIcon className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Tabs - Styled exactly like Logs management */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto bg-slate-200/60 p-1 rounded-lg mb-6 w-full lg:w-max">
            <TabsTrigger value="vl" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500 transition-all rounded-md px-6 py-2">
              Vacation Leaves
            </TabsTrigger>
            <TabsTrigger value="sl" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500 transition-all rounded-md px-6 py-2">
              Sick Leaves
            </TabsTrigger>
            <TabsTrigger value="ot" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500 transition-all rounded-md px-6 py-2">
              Overtime
            </TabsTrigger>
            <TabsTrigger value="lates" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500 transition-all rounded-md px-6 py-2">
              Lates
            </TabsTrigger>
            <TabsTrigger value="absences" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500 transition-all rounded-md px-6 py-2">
              Absences
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <>
              <TabsContent value="vl" className="mt-0">
                <SummaryTable type="vl" showRemaining={true} showConversion={true} />
              </TabsContent>
              <TabsContent value="sl" className="mt-0">
                <SummaryTable type="sl" showRemaining={true} showConversion={true} />
              </TabsContent>
              <TabsContent value="ot" className="mt-0">
                <SummaryTable type="ot" />
              </TabsContent>
              <TabsContent value="lates" className="mt-0">
                <SummaryTable type="lates" />
              </TabsContent>
              <TabsContent value="absences" className="mt-0">
                <SummaryTable type="absences" />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </Sidebar>
  );
};

export default LeaveSummary;