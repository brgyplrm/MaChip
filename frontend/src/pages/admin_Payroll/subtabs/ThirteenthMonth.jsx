import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import VisibilityIcon from "@mui/icons-material/Visibility";
// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const ThirteenthMonth = () => {
  const { systemToday } = useSystemTime();
  const currentYear = useMemo(() => {
    return systemToday ? systemToday.getFullYear().toString() : new Date().getFullYear().toString();
  }, [systemToday]);

  const [previewData, setPreviewData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Modal states
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // Grouped history state
  const [expandedYears, setExpandedYears] = useState({});

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/payroll/thirteenth-month/preview?year=${currentYear}`);
      const data = await response.json();
      if (response.ok) {
        setPreviewData(data);
      } else {
        setToast({ message: data.error || "Failed to fetch preview", type: "error" });
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetchWithAuth("/api/payroll/thirteenth-month/history");
      const data = await response.json();
      if (response.ok) {
        setHistoryData(data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    fetchPreview();
    fetchHistory();
  }, [currentYear]);

  const groupedHistory = useMemo(() => {
    const groups = {};
    historyData.forEach(item => {
      if (!groups[item.year]) {
        groups[item.year] = {
          year: item.year,
          count: 0,
          total: 0,
          records: []
        };
      }
      groups[item.year].count += 1;
      groups[item.year].total += parseFloat(item.amount || 0);
      groups[item.year].records.push(item);
    });
    return Object.values(groups).sort((a, b) => b.year - a.year);
  }, [historyData]);

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const handleViewDetails = (item) => {
    setSelectedBreakdown(item);
    setIsBreakdownOpen(true);
  };

  const handleGenerateDrafts = async () => {
    const records = previewData.map(item => ({
      user_Id: item.user_Id,
      totalBasicEarned: item.totalBasicEarned,
      amount: item.computedAmount,
      taxable_Excess: item.taxableExcess
    }));

    if (records.length === 0) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/payroll/thirteenth-month/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: currentYear, records })
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message, type: "success" });
        fetchPreview();
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to generate drafts", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = () => {
    if (previewData.length === 0) return;
    setIsReleaseModalOpen(true);
  };

  const confirmRelease = async () => {
    setIsReleaseModalOpen(false);
    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/payroll/thirteenth-month/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: currentYear })
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message, type: "success" });
        fetchPreview();
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to release", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">13th Month Pay Management</h1>
              <p className="text-sm text-slate-500 mt-1">Calculate and process annual 13th-month bonuses based on Basic Salary.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button onClick={fetchPreview} variant="outline" size="sm" className="border-[#2A174E] text-[#2A174E]">
                <RefreshIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>

          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="preview">Compute & Draft ({currentYear})</TabsTrigger>
              <TabsTrigger value="history">Release History</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-t-4 border-t-[#2A174E]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase">Yearly Basis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-900">{currentYear}</p>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase">Eligible Employees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-900">{previewData.filter(i => i.totalBasicEarned > 0).length}</p>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase">Total Disbursement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(previewData.reduce((acc, curr) => acc + (curr.computedAmount || 0), 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm border-0 bg-white mb-6">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#2A174E]">Computation Table</CardTitle>
                    <CardDescription>Based on Released Payroll Basic Salary for {currentYear}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateDrafts} className="bg-[#2A174E] text-white">
                      <SaveIcon className="mr-2 h-4 w-4" /> Save Drafts
                    </Button>
                    <Button onClick={handleRelease} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                      <CheckCircleIcon className="mr-2 h-4 w-4" /> Release All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Total Basic Earned</TableHead>
                        <TableHead>13th Month Pay</TableHead>
                        <TableHead>Taxable Excess</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.length > 0 ? previewData.map((item) => (
                        <TableRow key={item.user_Id} className={item.deletedAt ? "bg-slate-50/50 grayscale-[0.2]" : ""}>
                          <TableCell className="font-bold text-[#2A174E]">
                            <div className="flex flex-col">
                              <span>{item.user_LastName}, {item.user_FirstName}</span>
                              {item.deletedAt && (
                                <span className="text-[9px] text-rose-500 font-black uppercase tracking-tighter">Separated Employee</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(item.totalBasicEarned)}</TableCell>
                          <TableCell className="font-bold text-green-700">{formatCurrency(item.computedAmount)}</TableCell>
                          <TableCell className={item.taxableExcess > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>
                            {formatCurrency(item.taxableExcess)}
                          </TableCell>
                          <TableCell>
                            {item.existingStatus === 'Released' ? (
                              <Badge className="bg-green-100 text-green-800 border-none">Released</Badge>
                            ) : item.existingStatus === 'Draft' ? (
                              <Badge className="bg-amber-100 text-amber-800 border-none">Draft</Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400">Not Saved</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)} title="View Breakdown">
                              <VisibilityIcon className="h-4 w-4 text-slate-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                            No data found for this year.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-4">
                {groupedHistory.length > 0 ? groupedHistory.map((group) => (
                  <Card key={group.year} className="shadow-sm border-0 bg-white overflow-hidden">
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => toggleYear(group.year)}
                    >
                      <div className="flex items-center gap-4">
                        {expandedYears[group.year] ? (
                          <KeyboardArrowDownIcon className="text-slate-400" />
                        ) : (
                          <KeyboardArrowRightIcon className="text-slate-400" />
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-[#2A174E]">{group.year}</h3>
                          <p className="text-xs text-slate-500 uppercase font-semibold">Annual Disbursement</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-8 text-right">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Employees</p>
                          <p className="font-bold text-slate-700">{group.count}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Total Paid</p>
                          <p className="font-bold text-green-700">{formatCurrency(group.total)}</p>
                        </div>
                      </div>
                    </div>

                    {expandedYears[group.year] && (
                      <div className="border-t border-slate-100">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="pl-12">Employee Name</TableHead>
                              <TableHead>Amount Paid</TableHead>
                              <TableHead>Date Released</TableHead>
                              <TableHead className="text-right pr-4">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.records.map((item) => (
                              <TableRow key={item.thirteenthId}>
                                <TableCell className="pl-12 font-medium text-slate-700">
                                  {item.user_LastName}, {item.user_FirstName}
                                </TableCell>
                                <TableCell className="font-bold">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-slate-500">
                                  {item.releasedAt ? new Date(item.releasedAt).toLocaleDateString() : "—"}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  <Button variant="ghost" size="sm" onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(item);
                                  }}>
                                    <VisibilityIcon className="h-4 w-4 text-slate-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </Card>
                )) : (
                  <Card className="p-12 flex flex-col items-center justify-center bg-white border-0 shadow-sm text-slate-400 italic">
                    <HistoryIcon className="h-12 w-12 mb-2 opacity-20" />
                    No release history found.
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Sidebar>

      {/* Breakdown Modal */}
      <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Earnings Breakdown - {selectedBreakdown?.year || currentYear}</DialogTitle>
            <DialogDescription>
              Calculation for {selectedBreakdown?.user_FirstName} {selectedBreakdown?.user_LastName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Basic Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBreakdown?.breakdown?.map((m) => (
                  <TableRow key={m.month_num}>
                    <TableCell className="font-medium">{m.month_name.trim()}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(m.monthly_basic)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell>Total Basic</TableCell>
                  <TableCell className="text-right text-[#2A174E]">{formatCurrency(selectedBreakdown?.totalBasicEarned)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-600 uppercase">Formula: Total / 12</span>
                <span className="text-lg font-bold text-blue-800">{formatCurrency(selectedBreakdown?.computedAmount)}</span>
              </div>
              <p className="text-[10px] text-blue-500 italic">
                *Based on Presidential Decree No. 851. Includes all basic remunerations paid for services rendered.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsBreakdownOpen(false)} className="bg-[#2A174E]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation Modal */}
      <Dialog open={isReleaseModalOpen} onOpenChange={setIsReleaseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6 text-green-600" /> Confirm Release
            </DialogTitle>
            <DialogDescription>
              You are about to finalize and release the 13th Month Pay for the year {currentYear}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="flex justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-sm text-slate-600">Total Employees:</span>
              <span className="text-sm font-bold text-[#2A174E]">
                {previewData.filter(i => i.totalBasicEarned > 0).length}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-sm text-slate-600">Total Disbursement:</span>
              <span className="text-sm font-bold text-green-700">
                {formatCurrency(previewData.reduce((acc, curr) => acc + (curr.computedAmount || 0), 0))}
              </span>
            </div>
            
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ This action is permanent. Once released, the records will be locked for auditing and historical tracking. Please ensure all details are correct.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsReleaseModalOpen(false)}>Cancel</Button>
            <Button onClick={confirmRelease} className="bg-green-600 hover:bg-green-700 text-white">
              Confirm & Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ThirteenthMonth;