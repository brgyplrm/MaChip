import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RefreshIcon from "@mui/icons-material/Refresh";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { formatUserId } from "../../utils/formatUserId";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "react-router-dom";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All Roles");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [visibleAccounts, setVisibleAccounts] = useState(new Set());
  const inputRef = useRef(null);

  const toggleAccountVisibility = (id) => {
    setVisibleAccounts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const maskAccountNumber = (acc) => {
    if (!acc) return "—";
    if (acc.length <= 4) return acc;
    return `**** ${acc.slice(-4)}`;
  };

  const fetchEmployees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetchWithAuth("/api/users/employees/masterlist");
      const data = await response.json();
      if (response.ok) {
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (emp) => {
    setEditingId(emp.user_Id);
    setEditValue(String(emp.dailyRate));
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSave = async (emp) => {
    // Strip commas before parsing
    const cleanValue = editValue.replace(/,/g, "");
    const newRate = parseFloat(cleanValue);
    if (isNaN(newRate) || newRate <= 0) {
      showToast("Please enter a valid rate.", "error");
      return;
    }
    if (newRate === parseFloat(emp.dailyRate)) {
      handleCancel();
      return;
    }
    setSavingId(emp.user_Id);
    try {
      const response = await fetchWithAuth(
        `/api/users/employees/${emp.user_Id}/daily-rate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newDailyRate: newRate }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.user_Id === emp.user_Id
              ? {
                  ...e,
                  previousDailyRate: emp.dailyRate,
                  dailyRate: newRate,
                  rateUpdatedAt: new Date().toISOString(),
                }
              : e
          )
        );
        showToast(`Daily rate updated for ${emp.user_FirstName} ${emp.user_LastName}.`);
      } else {
        showToast(result.message || "Failed to update rate.", "error");
      }
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingId(null);
      setEditingId(null);
      setEditValue("");
    }
  };

  const filtered = employees.filter((e) => {
    const fullName = `${e.user_FirstName} ${e.user_LastName}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      String(formatUserId(e.user_Id)).includes(search)
    );
  });

  const changedCount = employees.filter(
    (e) => e.previousDailyRate && e.previousDailyRate !== e.dailyRate
  ).length;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-start md:items-center gap-4">
            <Link 
              to="/payroll" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
            >
              <ArrowBackIcon />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Employee Masterlist</h1>
              <span className="text-sm text-slate-500 mt-1 block">Manage employee records and daily compensation rates</span>
            </div>
          </div>
          <Button 
            className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]" 
            onClick={() => fetchEmployees(true)}
            disabled={refreshing}
          >
            <RefreshIcon className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
            <InfoOutlinedIcon className="h-5 w-5" /> 
            <h3 className="text-base m-0">Employee Payroll Processing</h3>
          </div>
          <p className="text-blue-700 text-sm leading-relaxed m-0">
            Provide a daily rate to automatically calculate payroll for each employee. 
            Employees without a daily rate will be excluded from payroll calculations.
          </p>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-sm border-slate-200 py-0">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Employees</span>
              <span className="text-2xl font-bold text-[#2A174E]">{employees.length}</span>
            </CardContent>
          </Card>
          <Card className={`shadow-sm border transition-colors py-0 ${changedCount > 0 ? "bg-[#fcfaff] border-[#d1c4e9]" : "border-slate-200"}`}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SwapHorizIcon className={changedCount > 0 ? "text-[#7c5cbf]" : "text-slate-400"} />
                <span className={`text-sm font-semibold uppercase tracking-wider ${changedCount > 0 ? "text-[#7c5cbf]" : "text-slate-500"}`}>
                  Rate Changes This Session
                </span>
              </div>
              <span className={`text-2xl font-bold ${changedCount > 0 ? "text-[#4a2b8c]" : "text-[#2A174E]"}`}>{changedCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 shadow-sm border-0 py-0">
          <CardContent className="p-4">
            <div className="relative w-full md:w-96">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name or employee number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200 focus-visible:ring-[#2A174E]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table Container */}
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 italic">Loading employee records...</div>
            ) : (
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs w-12 text-center">#</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs">Emp</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs">Account Number</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs">Position</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs">Old Daily Rate</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs w-48">New Daily Rate</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs">Last Updated</TableHead>
                    <TableHead className="font-semibold text-slate-500 uppercase text-xs text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? (
                    filtered.map((emp, idx) => {
                      const hasChanged = emp.previousDailyRate && parseFloat(emp.previousDailyRate) !== parseFloat(emp.dailyRate);
                      const isEditing = editingId === emp.user_Id;
                      const isSaving = savingId === emp.user_Id;
                      const rateWentUp = hasChanged && parseFloat(emp.dailyRate) > parseFloat(emp.previousDailyRate);

                      return (
                        <TableRow key={emp.user_Id} className={`border-b-slate-100 transition-colors ${hasChanged ? "bg-purple-50/30 hover:bg-purple-50/50" : "hover:bg-slate-50/50"}`}>
                          
                          <TableCell className="text-slate-400 text-xs text-center">{idx + 1}</TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#f0ebfa] text-[#4a2b8c] font-bold text-xs flex items-center justify-center shrink-0 uppercase tracking-widest">
                                {emp.user_FirstName?.[0]}{emp.user_LastName?.[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-[#2A174E] text-sm">
                                  {emp.user_FirstName} {emp.user_LastName}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  {formatUserId(emp.user_Id)}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm min-w-[100px] text-slate-700">
                                {visibleAccounts.has(emp.user_Id) 
                                  ? (emp.account_Number || "—") 
                                  : maskAccountNumber(emp.account_Number)}
                              </span>
                              {emp.account_Number && (
                                <button 
                                  onClick={() => toggleAccountVisibility(emp.user_Id)}
                                  className="text-slate-400 hover:text-[#2A174E] transition-colors"
                                  title={visibleAccounts.has(emp.user_Id) ? "Hide Account Number" : "Show Account Number"}
                                >
                                  {visibleAccounts.has(emp.user_Id) 
                                    ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> 
                                    : <VisibilityIcon sx={{ fontSize: 16 }} />}
                                </button>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-slate-600 text-sm">{emp.user_Role || "—"}</TableCell>

                          <TableCell>
                            {hasChanged ? (
                              <span className="text-sm text-slate-400 line-through decoration-slate-300">
                                ₱{parseFloat(emp.previousDailyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {isEditing ? (
                              <div className="flex items-center border-2 border-[#7c5cbf] rounded-md px-3 py-1.5 bg-[#faf8ff] w-32 focus-within:ring-2 focus-within:ring-[#7c5cbf]/30">
                                <span className="text-[#7c5cbf] font-bold text-sm mr-1">₱</span>
                                <input
                                  ref={inputRef}
                                  type="text"
                                  className="bg-transparent border-none outline-none text-sm font-bold text-[#2A174E] w-full"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSave(emp);
                                    if (e.key === "Escape") handleCancel();
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${hasChanged ? (rateWentUp ? "text-green-700" : "text-red-600") : "text-[#2A174E]"}`}>
                                  ₱{parseFloat(emp.dailyRate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </span>
                                {hasChanged && (
                                  rateWentUp
                                    ? <TrendingUpIcon className="text-green-500 h-4 w-4" />
                                    : <TrendingDownIcon className="text-red-500 h-4 w-4" />
                                )}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                            {emp.rateUpdatedAt
                              ? new Date(emp.rateUpdatedAt).toLocaleDateString("en-PH", {
                                  month: "short", day: "numeric", year: "numeric",
                                })
                              : "—"}
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(emp)}
                                  disabled={isSaving}
                                  className="bg-[#2A174E] hover:bg-[#1a0e30] h-8 w-8 p-0 text-white"
                                  title="Save"
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleCancel}
                                  disabled={isSaving}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 h-8 w-8 p-0"
                                  title="Cancel"
                                >
                                  <CloseIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(emp)}
                                className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]"
                                title="Edit daily rate"
                              >
                                <EditIcon className="h-4 w-4 mr-1" /> Edit Rate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">
                        No employees found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"} animate-in slide-in-from-bottom-5`}>
          {toast.type === "success" ? <CheckIcon fontSize="small" /> : <CloseIcon fontSize="small" /> }
          {toast.message}
        </div>
      )}
      </Sidebar>
    </div>
  );
};

export default EmployeeList;