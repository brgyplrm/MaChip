import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { formatUserId } from "../../../utils/formatUserId";
import { useSystemTime } from "../../../context/SystemTimeContext";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupsIcon from '@mui/icons-material/Groups';
import Toast from "../../../components/toast/Toast";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const MaxicareHistory = () => {
  const { systemToday } = useSystemTime();
  const [history, setHistory] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCycle, setSelectedCycle] = useState("All Cycles");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both history and cycle settings to calculate percentages
      const [historyRes, settingsRes] = await Promise.all([
        fetchWithAuth("/api/payroll/maxicare/history"),
        fetchWithAuth("/api/system/settings")
      ]);

      if (historyRes.ok && settingsRes.ok) {
        const historyData = await historyRes.json();
        const settingsData = await settingsRes.json();
        setHistory(historyData);
        setConfigs(settingsData.maxicareDates?.configs || {});
      }
    } catch (err) {
      console.error("Failed to load HMO history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Statistics
  const stats = useMemo(() => {
    const totalCollected = history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const uniqueEmployees = new Set(history.map(item => item.user_Id)).size;
    const currentYear = systemToday.getFullYear();
    const cyclePremium = configs[currentYear]?.totalGross || 0;

    return {
      totalCollected,
      activeSubscribers: uniqueEmployees,
      avgDeduction: uniqueEmployees > 0 ? totalCollected / history.length : 0,
      currentCyclePremium: cyclePremium
    };
  }, [history, configs, systemToday]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return history.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) || 
        formatUserId(item.user_Id).toLowerCase().includes(query);
      
      const itemYear = new Date(item.date).getFullYear().toString();
      const matchesCycle = selectedCycle === "All Cycles" || itemYear === selectedCycle;

      return matchesSearch && matchesCycle;
    });
  }, [history, searchQuery, selectedCycle]);

  // Pagination Logic
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen bg-slate-50 p-4 md:p-8">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
          <Link 
               to="/maxicare" 
               className="mr-4 flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0 hover:scale-110"
              >
            <ArrowBackIcon className="h-6 w-6" />
          </Link>
          <div className="flex justify-between gap-[330px]">
            <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Maxicare HMO History</h1>
            <span className="text-sm text-slate-500 mt-1 block">Audit and review all previous health insurance deduction periods.</span>
          </div>
          <Button className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm">
            <DownloadIcon className="mr-2 h-4 w-4" /> Export HMO Report (PDF)
          </Button>
          </div>
          
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <Card className="border-t-4 border-[#2A174E] shadow-sm">
            <CardContent className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lifetime Collection</p>
                <p className="text-3xl font-bold text-[#2A174E]">{peso(stats.totalCollected)}</p>
              </div>
              <div className="bg-[#2A174E]/10 p-2 rounded-lg text-[#2A174E]">
                <TrendingUpIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-blue-500 shadow-sm">
            <CardContent className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Subscribers</p>
                <p className="text-3xl font-bold text-blue-700">{stats.activeSubscribers}</p>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <GroupsIcon />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-amber-500 shadow-sm">
            <CardContent className=" flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Premium</p>
                <p className="text-3xl font-bold text-amber-700">{peso(stats.currentCyclePremium)}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                <AccountBalanceWalletIcon />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-4 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search employee or ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2">
                <FilterListIcon className="text-slate-400 h-5 w-5" />
                <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                  <SelectTrigger className="w-[180px] bg-slate-50">
                    <SelectValue placeholder="Filter Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Cycles">All Cycles</SelectItem>
                    {Object.keys(configs).sort((a,b) => b-a).map(year => (
                      <SelectItem key={year} value={year}>Cycle {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historical Table */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
            <Table>
              <TableHeader className="bg-[#2A174E]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-[10px] tracking-wider">Date Deducted</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Employee Name</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider">Cycle</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[10px] tracking-wider text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((item, idx) => (
                    <TableRow key={idx} className="border-b-slate-100">
                      <TableCell className="font-medium text-slate-600 px-6 py-4">
                        {new Date(item.date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-[#2A174E] text-sm">{item.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{formatUserId(item.user_Id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                          Cycle {new Date(item.date).getFullYear()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-slate-900">
                        {peso(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">No historical records found matching your filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 bg-slate-50/50 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-tighter">
                Showing {startIndex + 1} to {endIndex} of {totalItems} records
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                <div className="h-8 w-8 flex items-center justify-center bg-[#2A174E] text-white rounded text-xs font-bold">{currentPage}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
};

export default MaxicareHistory;