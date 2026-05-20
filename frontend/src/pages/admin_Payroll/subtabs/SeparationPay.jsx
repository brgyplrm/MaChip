import React, { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
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

const SeparationPay = () => {
  const { systemToday } = useSystemTime();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [separationDate, setSeparationDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [selectedCause, setSelectedCause] = useState("");
  const [reason, setReason] = useState("");

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth("/api/users?status=active");
      const data = await res.json();
      if (res.ok) setEmployees(data);
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
          setSelectedCause(data.preview[0].type);
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

  const handleGenerate = async () => {
    if (!preview || !selectedCause) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/payroll/separation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: selectedUser,
          separationDate,
          causeType: selectedCause,
          reason: reason || selectedCause
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

  const handleRelease = async (id) => {
    if (!window.confirm("Release this separation pay?")) return;
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
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />}

          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Separation Pay Management</h1>
              <p className="text-sm text-slate-500 mt-1">Calculate statutory separation pay according to DOLE Articles 298-299.</p>
            </div>
            <Button onClick={fetchHistory} variant="outline" size="icon" className="border-[#2A174E] text-[#2A174E]">
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
                          <CardTitle className="text-lg font-bold text-[#2A174E]">Choose Authorized Cause</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {preview.preview.map((p) => (
                              <div 
                                key={p.type}
                                onClick={() => setSelectedCause(p.type)}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                  selectedCause === p.type 
                                  ? 'border-[#2A174E] bg-[#2A174E]/5 shadow-md' 
                                  : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <Badge className={p.multiplier === 1.0 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>
                                    {p.multiplier === 1.0 ? "1 Month Pay / Yr" : "1/2 Month Pay / Yr"}
                                  </Badge>
                                  {selectedCause === p.type && <CheckCircleIcon className="text-[#2A174E] h-5 w-5" />}
                                </div>
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

                          <Button 
                            onClick={handleGenerate} 
                            className="w-full py-6 bg-green-600 hover:bg-green-700 text-white font-bold"
                            disabled={loading || !selectedCause}
                          >
                            <SaveIcon className="mr-2 h-4 w-4" /> Finalize Separation Payout
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="h-full border-dashed border-2 flex items-center justify-center p-12 text-slate-400 italic">
                      Compute an employee to see benefits preview.
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2A174E]">Separation Pay Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
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
                          <TableCell className="font-bold text-green-700">{formatCurrency(h.totalAmount)}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={h.reason}>{h.reason}</TableCell>
                          <TableCell>
                            <Badge className={h.status === 'Released' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {h.status === 'Draft' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleRelease(h.separationId)}
                                className="bg-[#2A174E] text-white"
                              >
                                Release
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                            No separation history records found.
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

export default SeparationPay;