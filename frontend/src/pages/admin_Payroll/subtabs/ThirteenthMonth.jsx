import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ThirteenthMonth = () => {
  const { systemToday } = useSystemTime();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [previewData, setPreviewData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const availableYears = useMemo(() => {
    const currentYear = systemToday ? systemToday.getFullYear() : new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, [systemToday]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/payroll/thirteenth-month/preview?year=${selectedYear}`);
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
      const response = await fetchWithAuth(`/api/payroll/thirteenth-month/history?year=${selectedYear}`);
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
  }, [selectedYear]);

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
        body: JSON.stringify({ year: selectedYear, records })
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

  const handleRelease = async () => {
    if (!window.confirm(`Are you sure you want to release the 13th month pay for ${selectedYear}? This action is permanent.`)) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/payroll/thirteenth-month/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear })
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
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[140px] bg-white border-slate-200">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={fetchPreview} variant="outline" size="icon" className="border-[#2A174E] text-[#2A174E]">
                <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="preview">Compute & Draft</TabsTrigger>
              <TabsTrigger value="history">Release History</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-t-4 border-t-[#2A174E]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase">Yearly Basis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-900">{selectedYear}</p>
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
                    <CardDescription>Based on Released Payroll Basic Salary for {selectedYear}</CardDescription>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.length > 0 ? previewData.map((item) => (
                        <TableRow key={item.user_Id}>
                          <TableCell className="font-bold text-[#2A174E]">{item.user_LastName}, {item.user_FirstName}</TableCell>
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
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
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
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2A174E]">Transaction History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Date Released</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.length > 0 ? historyData.map((item) => (
                        <TableRow key={item.thirteenthId}>
                          <TableCell className="font-bold text-[#2A174E]">{item.user_LastName}, {item.user_FirstName}</TableCell>
                          <TableCell>{item.year}</TableCell>
                          <TableCell className="font-bold">{formatCurrency(item.amount)}</TableCell>
                          <TableCell>{item.releasedAt ? new Date(item.releasedAt).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            <Badge className={item.status === 'Released' ? "bg-green-100 text-green-800 border-none" : "bg-amber-100 text-amber-800 border-none"}>
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                            No release history found for this year.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Sidebar>
    </div>
  );
};

export default ThirteenthMonth;