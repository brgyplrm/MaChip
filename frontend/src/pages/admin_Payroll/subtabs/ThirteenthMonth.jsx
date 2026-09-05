import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EmptyState from "../../../components/EmptyState";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EyeIcon } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";

const ThirteenthMonth = () => {
  const { systemToday } = useSystemTime();
  const currentYear = useMemo(() => {
    return systemToday ? systemToday.getFullYear().toString() : new Date().getFullYear().toString();
  }, [systemToday]);

  const [previewData, setPreviewData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [showGuideline, setShowGuideline] = useState(true);
  
  // Modal states
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // ... inside the component
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  // Reset pagination when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // Filter Logic
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return previewData;
    return previewData.filter(item => {
      const firstLast = `${item.user_FirstName || ""} ${item.user_LastName || ""}`.toLowerCase();
      const lastFirst = `${item.user_LastName || ""} ${item.user_FirstName || ""}`.toLowerCase();
      const status = (item.existingStatus || "").toLowerCase();
      const id = String(item.user_Id || "");
      return firstLast.includes(q) || lastFirst.includes(q) || status.includes(q) || id.includes(q);
    });
  }, [previewData, searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

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

  const handleDiscardDrafts = async () => {
    if (!window.confirm(`Are you sure you want to discard all 13th month drafts for ${currentYear}?`)) return;
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/payroll/thirteenth-month/drafts/${currentYear}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message, type: "success" });
        fetchPreview();
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to discard drafts", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen">
        <div className="p-1 overflow-x-hidden w-full max-w-6xl mx-auto">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}
          
          {showGuideline && (
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-2 w-full">
              <Card className="bg-blue-50 border-blue-200 shadow-none mb-4 w-full py-0 relative">
                <CardContent className="flex items-start gap-4 p-4 pr-12">
                  <div className="bg-blue-100 p-2 rounded-lg mt-0.5">
                    <InfoOutlinedIcon className="h-5 w-5 text-[#005a9c]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#005a9c] text-sm">Policy Guideline</h3>
                    <p className="text-sm text-blue-900/80 mt-0.5">
                      Calculate and process annual 13th-month bonuses based on Basic Salary according to Presidential Decree No. 851.
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setShowGuideline(false)}
                        className="absolute top-4 right-4 text-blue-900/40 hover:text-blue-900/80 transition-colors"
                      >
                        ✕
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs">
                      Dismiss Policy Guideline
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="preview">Compute & Draft ({currentYear})</TabsTrigger>
              <TabsTrigger value="history">Release History</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 w-full">
                  {/* Card 1: Yearly Basis */}
                  <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider">Yearly Basis</p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                                The fiscal year basis for 13th-month payroll computation.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-4xl font-bold text-[#2A174E]">{currentYear}</p>
                        </div>
                        <p className="text-xs text-[#2A174E]/70 italic mt-4">Calculation Period.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Eligible Employees */}
                  <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider">Eligible Employees</p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                                Total count of employees eligible for payouts.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-4xl font-bold text-[#3B4E17]">{previewData.filter(i => i.totalBasicEarned > 0).length}</p>
                        </div>
                        <p className="text-xs text-[#3B4E17]/70 italic mt-4">Employees eligible for payout.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: Total Disbursement */}
                  <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider">Total Disbursement</p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-xs font-normal normal-case">
                                Sum of all calculated 13th-month bonus payout drafts.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-4xl font-bold text-[#BB8B26]">{formatCurrency(previewData.reduce((acc, curr) => acc + (curr.computedAmount || 0), 0))}</p>
                        </div>
                        <p className="text-xs text-[#BB8B26]/70 italic mt-4">Total projected payout.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                  <Card className="mb-6 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:w-80">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search employee name or status..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                      Showing {paginatedData.length} of {filteredData.length} employees
                    </div>
                  </Card>

              <Card className="shadow-sm border-0 bg-white mb-6 py-0">
                <CardHeader className="bg-[#2A174E] pt-4! flex flex-row items-center justify-between border-b border-slate-100">
                  <div>
                    <CardTitle className="text-lg font-bold text-white">Computation Table</CardTitle>
                    <CardDescription className="text-white/80">
                      Based on Released Payroll Basic Salary for {currentYear}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {previewData.some(i => i.existingStatus === 'Draft') && (
                      <Button onClick={handleDiscardDrafts} variant="outline" className="border-rose-400 text-rose-300 hover:bg-rose-900/40 hover:text-white">
                        <DeleteOutlineIcon className="mr-2 h-4 w-4" /> Discard Drafts
                      </Button>
                    )}
                    <Button onClick={handleGenerateDrafts} className="bg-[#2A174E] text-white hover:bg-[#BA90E9] border border-white/20">
                      <SaveIcon className="mr-2 h-4 w-4" /> Save Drafts
                    </Button>
                    <Button onClick={handleRelease} variant="outline" className="border-green-400 text-green-300 hover:bg-green-900/40 hover:text-white">
                      <CheckCircleIcon className="mr-2 h-4 w-4" /> Release All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0! mt-0!">
                  <Table>
                    <TableHeader className="">
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
                      {paginatedData.length > 0 ? paginatedData.map((item) => (
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
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)} title="View Breakdown" className=" border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]">
                              <EyeIcon className="h-4 w-4 " />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <EmptyState 
                              icon={<AssessmentOutlinedIcon className="h-8 w-8 text-slate-400" />}
                              title="No 13th Month Pay Records"
                              description={searchQuery ? "No records match your search criteria." : "There are no 13th month pay records available for the period."}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {/* Pagination Controls */}
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    setCurrentPage={setCurrentPage}
                    totalItems={filteredData.length}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    itemLabel="records"
                  />
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
                  
                  <Card className="p-6 flex flex-col items-center justify-center bg-white border-0 shadow-sm text-slate-400 italic">

                    <EmptyState 
                      icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                      title="No release history found."
                      description="Release history will appear after the first payout is processed."
                    />
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

      {/* Breakdown Modal */}
      <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Earnings Breakdown - {selectedBreakdown?.year || currentYear}</DialogTitle>
            <DialogDescription>
              Calculation for {selectedBreakdown?.user_FirstName} {selectedBreakdown?.user_LastName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {(!selectedBreakdown?.breakdown || selectedBreakdown.breakdown.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 italic text-sm">
                <span>No monthly payroll data found for this period.</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-bold text-slate-600">Month</TableHead>
                    <TableHead className="text-right font-bold text-slate-600">Basic Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...selectedBreakdown.breakdown]
                    .sort((a, b) => Number(a.month_num) - Number(b.month_num))
                    .map((m) => (
                      <TableRow key={m.month_num}>
                        <TableCell className="font-medium">{String(m.month_name).trim()}</TableCell>
                        <TableCell className="text-right font-mono text-slate-700">{formatCurrency(m.monthly_basic)}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="bg-slate-100 font-bold border-t-2">
                    <TableCell className="font-bold text-[#2A174E]">Total Basic</TableCell>
                    <TableCell className="text-right text-[#2A174E] font-bold font-mono">
                      {formatCurrency(
                        selectedBreakdown?.totalBasicEarned ||
                        selectedBreakdown?.breakdown?.reduce((sum, m) => sum + parseFloat(m.monthly_basic || 0), 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-600 uppercase">Formula: Total Basic ÷ 12</span>
                <span className="text-lg font-bold text-blue-800">
                  {formatCurrency(
                    selectedBreakdown?.computedAmount ||
                    selectedBreakdown?.amount ||
                    (selectedBreakdown?.breakdown?.reduce((sum, m) => sum + parseFloat(m.monthly_basic || 0), 0) / 12)
                  )}
                </span>
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