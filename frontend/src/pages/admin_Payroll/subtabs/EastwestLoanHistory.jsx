import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import { useSystemTime } from "../../../context/SystemTimeContext";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupIcon from '@mui/icons-material/Group';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Toast from "../../../components/toast/Toast";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "react-router-dom";
import EmptyState from "../../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EastwestLoanHistory = () => {
  const { systemToday } = useSystemTime();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All Years");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLoanHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Endpoint follows the pattern of your Maxicare history
      const response = await fetchWithAuth("/api/payroll/eastwest/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to load loan history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanHistory();
  }, [fetchLoanHistory]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const totalDeducted = history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const uniqueBorrowers = new Set(history.map(item => item.user_Id)).size;
    const latestDeduction = history.length > 0 ? history[0].amount : 0;

    return {
      totalDeducted,
      totalBorrowers: uniqueBorrowers,
      avgPerTransaction: history.length > 0 ? totalDeducted / history.length : 0,
      latestAmount: latestDeduction
    };
  }, [history]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return history.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) || 
        formatUserId(item.user_Id).toLowerCase().includes(query);
      
      const itemYear = new Date(item.date).getFullYear().toString();
      const matchesYear = yearFilter === "All Years" || itemYear === yearFilter;

      return matchesSearch && matchesYear;
    });
  }, [history, searchQuery, yearFilter]);

  // Pagination Logic
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const availableYears = useMemo(() => {
    const years = [...new Set(history.map(item => new Date(item.date).getFullYear().toString()))];
    return years.sort((a, b) => b - a);
  }, [history]);

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
    
          {/* Group container for the sliding animation */}
          <div className="group flex items-center gap-0 w-full md:w-auto">
            
            {/* Back Button Container: Slides out from 0 width */}
            <div className="w-0 overflow-hidden group-hover:w-10 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      asChild 
                      className="text-[#2A174E]"
                    >
                      <Link to="/eastwestloan">
                        <ArrowBackIcon className="h-6 w-6" />
                      </Link>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                  Back to Eastwest Loan Dashboard
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Title Group: Moves to the right via ml-2 when hovered */}
            <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Employee Loan Records</h1>
              <span className="text-sm text-slate-500 mt-1 block">Complete historical log of employee bank loan repayments via payroll.</span>
            </div>
          </div>

          {/* Right Action: PDF Export */}
          <div className="shrink-0 mt-4 md:mt-0 w-full md:w-auto text-right">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button className="bg-[#2A174E] hover:bg-[#1a0e30] text-white font-bold shadow-sm w-full md:w-auto">
                    <DownloadIcon className="mr-2 h-4 w-4" /> Export History (PDF)
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                Download complete repayment history report as PDF
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-t-4 border-[#2A174E] shadow-sm">
            <CardContent className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lifetime Remittance</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Total cumulative payments collected from employees for Eastwest loans across all cycles.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-[#2A174E]">{peso(stats.totalDeducted)}</p>
              </div>
              <div className="bg-[#2A174E]/10 p-2 rounded-lg text-[#2A174E]">
                <AccountBalanceIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-indigo-500 shadow-sm">
            <CardContent className=" flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Borrowers</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Total number of unique employees with Eastwest loan deductions.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-indigo-700">{stats.totalBorrowers}</p>
              </div>
              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                <GroupIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-emerald-500 shadow-sm">
            <CardContent className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Deduction</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Average repayment amount collected per transaction.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-emerald-700">{peso(stats.avgPerTransaction)}</p>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <AccountBalanceWalletIcon />
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
                placeholder="Search by name or Employee ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2">
                <FilterListIcon className="text-slate-400 h-5 w-5" />
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-50">
                    <SelectValue placeholder="Filter Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Years">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flat Records Table */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
            <Table>
              <TableHeader className="bg-[#2A174E]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-[10px] tracking-wider">Date Filed</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Borrower Name</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Deduction Type</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider text-right pr-6">Amount Deducted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((item, idx) => (
                    <TableRow key={idx} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-600 px-6 py-4">
                        {new Date(item.date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-[#2A174E] text-sm">{item.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">{formatUserId(item.user_Id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                          Eastwest Bank Loan
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-slate-900">
                        {peso(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic p-6">
                        <EmptyState 
                        icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                        title="No employee loan history found."
                        description="Loan history will appear after the first deduction is processed."
                      />
                      </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 bg-slate-50/50 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">
                Showing {startIndex + 1} to {endIndex} of {totalItems} loan records
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                <div className="h-8 w-8 flex items-center justify-center bg-[#2A174E] text-white rounded text-xs font-bold shadow-sm">{currentPage}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default EastwestLoanHistory;