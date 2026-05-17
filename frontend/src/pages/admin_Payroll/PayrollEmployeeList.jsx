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
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import FilterListIcon from "@mui/icons-material/FilterList";
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
import EditPayrollModal from "../../components/editPayrollModal/EditPayrollModal";

const PayrollEmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [visibleAccounts, setVisibleAccounts] = useState(new Set());
  const isEditing = editingEmployee !== null;

  // Filter & Pagination States
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, statusFilter, itemsPerPage]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSave = async (updatedData) => {
    const newRate = parseFloat(updatedData.dailyRate);
    if (isNaN(newRate) || newRate <= 0) {
      showToast("Please enter a valid rate.", "error");
      return;
    }
    
    setSavingId(editingEmployee.user_Id);
    try {
      const response = await fetchWithAuth(
        `/api/users/employees/${editingEmployee.user_Id}/daily-rate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            newDailyRate: newRate,
            sss_Share: updatedData.SSS_Ded,
            philhealth_Share: updatedData.Philhealth_Ded,
            hdmf_Share: updatedData.HDMF_Ded,
            tax_Share: updatedData.Tax_Ded,
            healthCard_Amnt: updatedData.healthCard_Amnt,
            SSS_Loan: updatedData.SSS_Loan,
            HDMF_Loan: updatedData.HDMF_Loan,
            calamityLoan_Amnt: updatedData.calamityLoan_Amnt,
            advances_Amnt: updatedData.advances_Amnt,
            globe_Deduction: updatedData.globe_Deduction,
            eastwest_Loan: updatedData.eastwest_Loan,
            multiPurposeSavings: updatedData.multiPurposeSavings
          }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.user_Id === editingEmployee.user_Id
              ? {
                  ...e,
                  ...result.data,
                  // Preserve fields not returned by the specific patch response
                  user_Role: e.user_Role,
                  employmentStatus: e.employmentStatus,
                  account_Number: e.account_Number,
                  bank_Company: e.bank_Company,
                  bank_AccountName: e.bank_AccountName,
                  user_MachipId: e.user_MachipId,
                  user_FingerprintId: e.user_FingerprintId
                }
              : e
          )
        );
        showToast(result.message || `Compensation template updated for ${editingEmployee.user_FirstName} ${editingEmployee.user_LastName}.`);
        handleCloseModal();
      } else {
        showToast(result.message || "Failed to update rate.", "error");
      }
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setFilterRole("All Roles");
    setStatusFilter("All Statuses");
    setCurrentPage(1);
  };

  const isFiltering = search !== "" || filterRole !== "All Roles" || statusFilter !== "All Statuses";

  // Filtering Logic
  const filtered = employees.filter((e) => {
    const fullName = `${e.user_FirstName} ${e.user_LastName}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || String(formatUserId(e.user_Id)).includes(search);
    const matchesRole = filterRole === "All Roles" || e.user_Role === filterRole;
    const matchesStatus = statusFilter === "All Statuses" || e.user_EmploymentStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const changedCount = employees.filter(
    (e) => e.previousDailyRate && e.previousDailyRate !== e.dailyRate
  ).length;

  // Pagination Logic
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filtered.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-start md:items-center gap-4">
            <Link 
              to="/payroll" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
            >
              <ArrowBackIcon className="h-6 w-6" />
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

        <div className="h-2"></div>

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

        {/* Dashboard-Style Widgets Row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Total Employees */}
          <Card className="shadow-sm border-t-5 border-[#2A174E] bg-white py-0 h-full min-w-0">
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Employees</p>
                  <p className="text-4xl font-bold text-[#2A174E]">{employees.length}</p>
                </div>
                <p className="text-xs text-[#2A174E]/70 italic mt-4">Active masterlist records</p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                <PeopleAltIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Rate Changes (Dynamic Colors) */}
          <Card className={`shadow-sm border-0 py-0 h-full min-w-0 transition-colors duration-500 ${changedCount > 0 ? "bg-[#ECC04B]" : "bg-[#FCFBFA]"}`}>
            <CardContent className="px-5 py-5 flex justify-between h-full">
              <div className="flex flex-col justify-between">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 transition-colors ${changedCount > 0 ? "text-white" : "text-[slate-500]"}`}>
                    Rate Changes
                  </p>
                  <p className={`text-4xl font-bold transition-colors ${changedCount > 0 ? "text-white" : "text-slate-700"}`}>
                    {changedCount}
                  </p>
                </div>
                <p className={`text-xs italic mt-4 transition-colors ${changedCount > 0 ? "text-white/80" : "text-slate-400"}`}>
                  Adjustments made this session
                </p>
              </div>
              <div className={`p-3 rounded-lg flex items-center justify-center shrink-0 self-start transition-colors ${changedCount > 0 ? "bg-white/20 text-white" : "bg-slate-300/50 text-slate-500"}`}>
                <SwapHorizIcon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name or employee number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Filter by Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Roles">All Roles</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Admin Manager">Admin Manager</SelectItem>
                    <SelectItem value="Admin Accountant">Admin Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Statuses">All Statuses</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Intern / OJT">Intern / OJT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isFiltering && (
                <Button 
                  variant="ghost" 
                  onClick={handleClearFilters}
                  className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                >
                  <CloseIcon className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Table Container */}
        <Card className="shadow-sm border-0 bg-white py-0 flex flex-col">
          <CardContent className="p-0 overflow-x-auto flex flex-col">
            {loading ? (
              <div className="p-12 text-center text-slate-400 italic">Loading employee records...</div>
            ) : (
              <>
                <Table className="min-w-[1000px] md:min-w-full">
                  <TableHeader className="bg-[#2B174F]">
                    <TableRow className="hover:bg-transparent border-b-slate-200">
                      <TableHead className="font-semibold text-white uppercase text-xs w-12 text-center py-4">#</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs py-4 px-6">Emp</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs py-4">Account Number</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs py-4">Position</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs py-4">Old Daily Rate</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs w-48 py-4">New Daily Rate</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs py-4">Last Updated</TableHead>
                      <TableHead className="font-semibold text-white uppercase text-xs text-right pr-6 py-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentData.length > 0 ? (
                      currentData.map((emp, idx) => {
                        const hasChanged = emp.previousDailyRate && parseFloat(emp.previousDailyRate) !== parseFloat(emp.dailyRate);
                        const rateWentUp = hasChanged && parseFloat(emp.dailyRate) > parseFloat(emp.previousDailyRate);

                        return (
                          <TableRow key={emp.user_Id} className={`border-b-slate-100 transition-colors ${hasChanged ? "bg-purple-50/30 hover:bg-purple-50/50" : "hover:bg-slate-50/50"}`}>
                            
                            <TableCell className="text-slate-400 text-xs text-center py-4">{startIndex + idx + 1}</TableCell>
                            
                            <TableCell className="px-6 py-4">
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

                            <TableCell className="py-4">
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

                            <TableCell className="text-slate-600 text-sm py-4">{emp.user_Role || "—"}</TableCell>

                            <TableCell className="py-4">
                              {hasChanged ? (
                                <span className="text-sm text-slate-400 line-through decoration-slate-300">
                                  ₱{parseFloat(emp.previousDailyRate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </TableCell>

                            <TableCell className="py-4">
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
                            </TableCell>

                            <TableCell className="text-xs text-slate-400 whitespace-nowrap py-4">
                              {emp.rateUpdatedAt
                                ? new Date(emp.rateUpdatedAt).toLocaleDateString("en-PH", {
                                    month: "short", day: "numeric", year: "numeric",
                                  })
                                : "—"}
                            </TableCell>

                            <TableCell className="text-right pr-6 py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(emp)}
                                className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]"
                                title="Edit daily rate"
                              >
                                <EditIcon className="h-4 w-4 mr-1" /> Edit Rate
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                            <span className="font-semibold text-slate-600">No employees found</span>
                            <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Rows per page:</span>
                        <Select 
                          value={itemsPerPage.toString()} 
                          onValueChange={(val) => setItemsPerPage(Number(val))}
                        >
                          <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                            <SelectValue placeholder="10" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="font-medium">
                        Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{totalItems}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">
                        {currentPage}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>

      <EditPayrollModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        data={editingEmployee}
        onSave={handleSave}
        isMasterlist={true}
      />

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

export default PayrollEmployeeList;