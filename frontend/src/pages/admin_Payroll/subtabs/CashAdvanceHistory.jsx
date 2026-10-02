import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import { useSystemTime } from "../../../context/SystemTimeContext";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupIcon from '@mui/icons-material/Group';
import SpeedIcon from '@mui/icons-material/Speed';
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

import Toast from "../../../components/toast/Toast";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/ui/table-pagination";

const CashAdvancesHistory = () => {
  const { systemToday } = useSystemTime();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All Years");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Fetches historical records for the 'Cash Advance' type
      const response = await fetchWithAuth("/api/payroll/loans/history?type=Cash Advance");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to load cash advance history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const total = history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const uniqueBorrowers = new Set(history.map(item => item.user_Id)).size;
    const currentYearTotal = history
      .filter(item => new Date(item.date).getFullYear() === systemToday.getFullYear())
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    return {
      lifetimeTotal: total,
      borrowerCount: uniqueBorrowers,
      ytdTotal: currentYearTotal
    };
  }, [history, systemToday]);

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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
          <Link 
               to="/cashadvances" 
               className="mr-4 flex items-center justify-center w-10 h-10 rounded-full hover:bg-brand-primary-light text-brand-primary transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
              >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex justify-between gap-[290px]">
            <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Cash Advance Audit</h1>
            <span className="text-sm text-slate-500 mt-1 block">Historical ledger of all short-term employee cash advances and liquidations.</span>
          </div>
          <Button className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold shadow-sm">
            <DownloadIcon className="mr-2 h-4 w-4" /> Export Ledger (PDF)
          </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-t-4 border-brand-primary shadow-sm">
            <CardContent className=" flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lifetime Advances</p>
                <p className="text-3xl font-bold text-brand-primary">{peso(stats.lifetimeTotal)}</p>
              </div>
              <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
                <AccountBalanceWalletIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-accent-gold shadow-sm">
            <CardContent className=" flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Borrowers</p>
                <p className="text-3xl font-bold text-accent-gold">{stats.borrowerCount}</p>
              </div>
              <div className="bg-accent-gold/10 p-2 rounded-lg text-accent-gold">
                <GroupIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-status-info shadow-sm">
            <CardContent className=" flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">YTD Distributed</p>
                <p className="text-3xl font-bold text-status-info">{peso(stats.ytdTotal)}</p>
              </div>
              <div className="bg-sky-50 p-2 rounded-lg text-status-info">
                <SpeedIcon />
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
                placeholder="Search borrower name or Employee ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2">
                <FilterListIcon className="text-slate-400 h-5 w-5" />
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-50 font-semibold text-slate-700">
                    <SelectValue placeholder="Filter Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Years">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>Fiscal Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactional Table */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
            <Table>
              <TableHeader className="bg-brand-primary">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-[10px] tracking-wider">Disbursement Date</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Employee Name</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Reference</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider text-right pr-6">Amount Advanced</TableHead>
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
                          <span className="font-bold text-brand-primary text-sm">{item.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{formatUserId(item.user_Id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold border-slate-200 text-[9px] uppercase">
                          Payroll Deduction
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-slate-900">
                        {peso(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">No cash advance records found matching your criteria.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="disbursements"
            />
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
};

export default CashAdvancesHistory;