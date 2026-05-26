import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import EmptyState from "../../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const SeparationPay = () => {
  const { systemToday } = useSystemTime();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [separationDate, setSeparationDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [causes, setCauses] = useState([]);
  const [selectedCauseId, setSelectedCauseId] = useState("");
  const [reason, setReason] = useState("");

  const fetchCauses = async () => {
    try {
      const res = await fetchWithAuth("/api/payroll/separation/causes");
      const data = await res.json();
      if (res.ok) setCauses(data);
    } catch (err) {
      console.error("Error fetching causes:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth("/api/users/all");
      const data = await res.json();
      if (res.ok) {
        setEmployees(Array.isArray(data) ? data : (data.users || []));
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetchWithAuth("/api/payroll/separation/history");
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    fetchCauses();
    fetchEmployees();
    fetchHistory();
  }, []);

  const handlePreview = async () => {
    if (!selectedUser || !separationDate) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/separation/preview?user_Id=${selectedUser}&separationDate=${separationDate}`);
      const data = await res.json();
      if (res.ok) {
        setPreview(data);
        if (data.preview && data.preview.length > 0) {
          setSelectedCauseId(data.preview[0].causeId);
        }
      } else {
        setToast({ message: data.error || "Failed to fetch preview", type: "error" });
        setPreview(null);
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (targetStatus = 'Draft') => {
    if (!preview || !selectedCauseId) return;
    
    if (targetStatus === 'Notice Served') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const sepDate = new Date(separationDate);
      
      let confirmMsg = `Are you sure you want to serve the Notice of Termination to ${preview.name}?`;
      if (sepDate < thirtyDaysFromNow) {
        confirmMsg += "\n\n⚠️ WARNING: The selected separation date is less than 30 days from today. DOLE requires at least 30 days notice.";
      }
      if (!window.confirm(confirmMsg)) return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/payroll/separation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: selectedUser,
          separationDate,
          causeId: selectedCauseId,
          reason: reason,
          status: targetStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
        setPreview(null);
        setSelectedUser("");
      } else {
        setToast({ message: data.error || "Failed to generate", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to rescind this termination notice? This will restore the employee to Active status and send a notification email.")) return;
    try {
      const res = await fetchWithAuth(`/api/payroll/separation/cancel/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to cancel", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    }
  };

  const handleRelease = async (id) => {
    if (!window.confirm("Release the final settlement? This will mark the employee as 'Separated' and archive their profile.")) return;
    try {
      const res = await fetchWithAuth(`/api/payroll/separation/release/${id}`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to release", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    }
  };

  const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col w-full min-h-screen">
        <div className=" overflow-x-hidden w-full max-w-6xl mx-auto p-1">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-4">
            <Card className="bg-blue-50 border-blue-200 shadow-none mb-4 w-full py-0">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="bg-blue-100 p-2 rounded-lg mt-0.5">
                  <InfoOutlinedIcon className="h-5 w-5 text-[#005a9c]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#005a9c] text-sm">Policy Guideline</h3>
                  <p className="text-sm text-blue-900/80 mt-0.5">
                    Calculate and process statutory separation pay according to DOLE Articles 298-299.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="calculator" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="calculator">Compute Benefits</TabsTrigger>
              <TabsTrigger value="history">Payout History</TabsTrigger>
            </TabsList>

            <TabsContent value="calculator">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Card */}
                <Card className="lg:col-span-1 shadow-sm border-0 bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#2A174E]">Employee Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Employee</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder="Search Employee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                              {emp.user_LastName}, {emp.user_FirstName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Separation Date</Label>
                      <Input 
                        type="date" 
                        value={separationDate} 
                        onChange={(e) => setSeparationDate(e.target.value)}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <Button 
                      onClick={handlePreview} 
                      className="w-full bg-[#2A174E] text-white"
                      disabled={loading || !selectedUser}
                    >
                      <SearchIcon className="mr-2 h-4 w-4" /> Compute Preview
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview Results */}
                <div className="lg:col-span-2 space-y-6">
                  {preview ? (
                    <>
                      <Card className="shadow-sm border-0 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Tenure & Salary Base</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Hire Date</p>
                            <p className="text-sm font-semibold">{new Date(preview.hireDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Tenure Months</p>
                            <p className="text-sm font-semibold">{preview.diffMonths} Mo.</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Computed Years</p>
                            <p className="text-sm font-bold text-blue-600">{preview.yearsOfService} Yr.</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Salary Base</p>
                            <p className="text-sm font-bold text-green-600">{formatCurrency(preview.baseSalary)}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-0 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Final Settlement Breakdown</CardTitle>
                          <CardDescription>Consolidated components of the final pay package.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Pro-rated 13th Month</p>
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-xs text-slate-500">Basis: {formatCurrency(preview.backPay.totalBasicYear)}</p>
                                  <p className="text-xs text-slate-500">Formula: Basis / 12</p>
                                </div>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.backPay.prorated13thMonth)}</p>
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Leave Conversion</p>
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-xs text-slate-500">VL: {preview.backPay.vlBalance} | SL: {preview.backPay.slBalance}</p>
                                  <p className="text-xs text-slate-500">Formula: Credits x Daily Rate</p>
                                </div>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.backPay.leaveConversion)}</p>
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Final Worked Days</p>
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-xs text-slate-500">Days: {preview.backPay.workedDaysCount}</p>
                                  <p className="text-xs text-slate-500 font-medium text-rose-500 uppercase text-[9px] tracking-tight">Since Last Payroll</p>
                                </div>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.backPay.finalWorkedSalary)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-4 bg-[#2A174E]/5 border border-[#2A174E]/10 rounded-xl">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-[#2A174E]">Estimated Total Back Pay</span>
                              <span className="text-xl font-black text-[#2A174E]">
                                {formatCurrency(
                                  parseFloat(preview.backPay.prorated13thMonth || 0) + 
                                  parseFloat(preview.backPay.leaveConversion || 0) + 
                                  parseFloat(preview.backPay.finalWorkedSalary || 0)
                                )}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 italic">
                              *Includes earned 13th month, converted leave credits, and unpaid actual worked days.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-0 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Choose Authorized Cause</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {preview.preview.map((p) => (
                              <div 
                                key={p.causeId}
                                onClick={() => setSelectedCauseId(p.causeId)}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                  selectedCauseId === p.causeId 
                                  ? 'border-[#2A174E] bg-[#2A174E]/5 shadow-md' 
                                  : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <Badge className={p.multiplier === 1.0 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>
                                    {p.multiplier === 1.0 ? "1 Month Pay / Yr" : "1/2 Month Pay / Yr"}
                                  </Badge>
                                  {selectedCauseId === p.causeId && <CheckCircleIcon className="text-[#2A174E] h-5 w-5" />}
                                </div>
                                <p className="font-bold text-[#2A174E] mb-1">{p.causeName}</p>
                                <p className="text-xl font-black text-slate-900 mb-1">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">{p.desc}</p>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2">
                            <Label>Specific Reason (Optional)</Label>
                            <Input 
                              placeholder="e.g. Redundancy due to automation"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              className="bg-white border-slate-200"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <Button 
                              onClick={() => handleGenerate('Draft')} 
                              className="w-full py-6 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold"
                              disabled={loading || !selectedCauseId}
                            >
                              <SaveIcon className="mr-2 h-4 w-4" /> Save as Draft
                            </Button>
                            <Button 
                              onClick={() => handleGenerate('Notice Served')} 
                              className="w-full py-6 bg-[#2A174E] hover:bg-[#1a0f33] text-white font-bold"
                              disabled={loading || !selectedCauseId}
                            >
                              <CheckCircleIcon className="mr-2 h-4 w-4" /> Finalize & Serve Notice
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    
                    <Card className="h-full  flex items-center justify-center p-6 text-slate-400 italic">
                      <EmptyState 
                      icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                      title="Separation Pay Preview"
                      description="Choose an employee to view computed benefits."
                    />
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-sm border-0 bg-white py-0">
                <CardHeader className="bg-[#2A174E] border-b-0 pt-6 pb-4">
                  <CardTitle className="text-lg font-bold text-white">Separation Pay Records</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Separation Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length > 0 ? history.map((h) => (
                        <TableRow key={h.separationId}>
                          <TableCell className="font-bold text-[#2A174E]">{h.user_LastName}, {h.user_FirstName}</TableCell>
                          <TableCell>{new Date(h.separationDate).toLocaleDateString()}</TableCell>
                          <TableCell>{h.yearsOfService} Years</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">{formatCurrency(parseFloat(h.totalAmount || 0) + parseFloat(h.backPay_Total || 0))}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">
                                Sep: {formatCurrency(h.totalAmount)} | Back: {formatCurrency(h.backPay_Total)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{h.causeName}</span>
                              <span className="text-[10px] text-slate-400 italic truncate" title={h.reason}>{h.reason}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge className={
                                h.status === 'Released' ? "bg-green-100 text-green-800" : 
                                h.status === 'Notice Served' ? "bg-blue-100 text-blue-800" : 
                                "bg-amber-100 text-amber-800"
                              }>
                                {h.status}
                              </Badge>
                              <p className="text-[9px] text-slate-400 font-bold uppercase italic">{h.userCurrentStatus}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {h.status !== 'Released' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleCancel(h.separationId)}
                                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                                  >
                                    Rescind
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleRelease(h.separationId)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    Release
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic p-6">
                            <EmptyState 
                                icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                                title="No payout history found."
                                description="Payout history will appear after the first payout is processed."
                              />
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
    </div>
  );
};

export default SeparationPay;