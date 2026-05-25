import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import CakeIcon from "@mui/icons-material/Cake";
import WorkIcon from "@mui/icons-material/Work";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EditIcon from "@mui/icons-material/Edit";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import Toast from "../../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const RetirementPay = () => {
  const { systemToday } = useSystemTime();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [retirementDate, setRetirementDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Edit Modal State
  const [editRecord, setEditRecord] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
      const res = await fetchWithAuth("/api/payroll/retirement/history");
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, []);

  const handlePreview = async () => {
    if (!selectedUser || !retirementDate) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/preview?user_Id=${selectedUser}&retirementDate=${retirementDate}`);
      const data = await res.json();
      if (res.ok) {
        setPreview(data);
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

  const handleGenerate = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/payroll/retirement/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: selectedUser,
          retirementDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to generate", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!editRecord || !newDate) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/update-date/${editRecord.retirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retirementDate: newDate })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: data.message, type: "success" });
        setIsEditModalOpen(false);
        fetchHistory();
      } else {
        setToast({ message: data.error || "Failed to update date", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (id) => {
    if (!window.confirm("Release this retirement pay? This will mark the tax exemption as used for this employee.")) return;
    try {
      const res = await fetchWithAuth(`/api/payroll/retirement/release/${id}`, { method: "PUT" });
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
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Retirement Pay Management</h1>
              <p className="text-sm text-slate-500 mt-1">Calculate statutory retirement benefits according to Article 302 (RA 7641).</p>
            </div>
            <Button onClick={fetchHistory} variant="outline" size="icon" className="border-[#2A174E] text-[#2A174E]">
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <Tabs defaultValue="calculator" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="calculator">Compute Benefits</TabsTrigger>
              <TabsTrigger value="history">Retirement Payout History</TabsTrigger>
            </TabsList>

            <TabsContent value="calculator">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Card */}
                <Card className="lg:col-span-1 shadow-sm border-0 bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#2A174E]">Employee Selection</CardTitle>
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
                      <Label>Target Retirement Date</Label>
                      <Input 
                        type="date" 
                        value={retirementDate} 
                        onChange={(e) => setRetirementDate(e.target.value)}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <Button 
                      onClick={handlePreview} 
                      className="w-full bg-[#2A174E] text-white"
                      disabled={loading || !selectedUser}
                    >
                      <SearchIcon className="mr-2 h-4 w-4" /> Compute Retirement
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview Results */}
                <div className="lg:col-span-2 space-y-6">
                  {preview ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="shadow-sm border-0 bg-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                              <CakeIcon className="h-4 w-4" /> Eligibility Profile
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Current Age:</span>
                              <div className="flex items-center gap-2">
                                {preview.age < 60 && <span className="text-[10px] text-rose-500 font-bold uppercase">(Req: 60)</span>}
                                <span className={`font-bold ${preview.age >= 60 ? 'text-green-600' : 'text-amber-600'}`}>{preview.age} Years Old</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Tenure (Rounded):</span>
                              <div className="flex items-center gap-2">
                                {preview.yearsOfService < 5 && <span className="text-[10px] text-rose-500 font-bold uppercase">(Req: 5)</span>}
                                <span className={`font-bold ${preview.yearsOfService >= 5 ? 'text-green-600' : 'text-amber-600'}`}>{preview.yearsOfService} Years</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                                {preview.isEligible ? (
                                    <Badge className="bg-green-100 text-green-700">Fully Eligible</Badge>
                                ) : (
                                    <Badge variant="destructive">Ineligible for Statutory Pay</Badge>
                                )}
                                {preview.isCompulsory && <Badge className="bg-blue-100 text-blue-700">Compulsory (65+)</Badge>}
                                {preview.isTaxExempt && <Badge className="bg-purple-100 text-purple-700">Tax Exempt (BIR)</Badge>}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="shadow-sm border-0 bg-[#2A174E] text-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-purple-200 uppercase flex items-center gap-2">
                              <ReceiptIcon className="h-4 w-4" /> Final Computation
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-black">{formatCurrency(preview.totalAmount)}</p>
                            <p className="text-[10px] text-purple-200/70 mt-1">Formula: Daily Rate ({formatCurrency(preview.dailyRate)}) × 22.5 Days × {preview.yearsOfService} Yrs</p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="shadow-sm border-0 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Final Settlement Breakdown</CardTitle>
                          <CardDescription>Consolidated components of the retiree's final pay package.</CardDescription>
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
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Computation Breakdown (1/2 Month Salary)</CardTitle>
                          <CardDescription>Legal components per RA 7641 comprising the 22.5-day multiplier.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">15 Days Salary</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.salary15Days)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">5 Days SIL</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.sil5Days)}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">2.5 Days (1/12 of 13th)</p>
                                <p className="text-lg font-bold text-[#2A174E]">{formatCurrency(preview.components.thirteenthMonth2_5Days)}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 italic">
                            * One-half (1/2) month salary is equivalent to 22.5 days. The COLA is excluded from this computation per legal mandates.
                          </div>

                          <Button 
                            onClick={handleGenerate} 
                            className="w-full py-6 bg-green-600 hover:bg-green-700 text-white font-bold"
                            disabled={loading || !preview.isEligible}
                          >
                            <SaveIcon className="mr-2 h-4 w-4" /> Finalize Retirement Payout
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="h-full border-dashed border-2 flex items-center justify-center p-12 text-slate-400 italic">
                      Perform computation to see legal retirement benefit preview.
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2A174E]">Retirement Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Retirement Date</TableHead>
                        <TableHead>Tenure</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tax Exempt</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length > 0 ? history.map((h) => (
                        <TableRow key={h.retirementId}>
                          <TableCell className="font-bold text-[#2A174E]">{h.user_LastName}, {h.user_FirstName}</TableCell>
                          <TableCell>{new Date(h.retirementDate).toLocaleDateString()}</TableCell>
                          <TableCell>{h.yearsOfService} Years</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">{formatCurrency(parseFloat(h.totalAmount || 0) + parseFloat(h.backPay_Total || 0))}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">
                                Ret: {formatCurrency(h.totalAmount)} | Back: {formatCurrency(h.backPay_Total)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {h.isTaxExempt ? (
                                <Badge className="bg-purple-100 text-purple-700">Yes</Badge>
                            ) : (
                                <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={h.status === 'Released' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {h.status === 'Draft' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setEditRecord(h);
                                      setNewDate(h.retirementDate);
                                      setIsEditModalOpen(true);
                                    }}
                                    className="border-slate-200 text-slate-600 hover:bg-slate-50"
                                  >
                                    <EditIcon className="h-3 w-3 mr-1" /> Edit Date
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleRelease(h.retirementId)}
                                    className="bg-[#2A174E] text-white"
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
                          <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                            No retirement records found.
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

      {/* Edit Date Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2A174E]">Adjust Retirement Date</DialogTitle>
            <DialogDescription>
              Update the retirement date for {editRecord?.user_FirstName} {editRecord?.user_LastName}. 
              All benefits will be re-calculated based on this new date.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label>New Retirement Date</Label>
              <Input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800 font-medium italic">
                ℹ️ Changing the date may affect tenure rounding (Years of Service) and will re-audit attendance logs for the final salary component.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateDate} disabled={loading} className="bg-[#2A174E] text-white">
              {loading ? "Re-calculating..." : "Update & Re-calculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetirementPay;