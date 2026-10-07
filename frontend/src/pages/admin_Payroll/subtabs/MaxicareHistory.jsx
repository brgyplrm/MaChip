import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../../components/Sidebar";
import { fetchWithAuth } from "../../../utils/api";
import { useSystemTime } from "../../../context/SystemTimeContext";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Toast from "../../../components/toast/Toast";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import EmptyState from "../../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MaxicareHistory = () => {
  const { systemToday } = useSystemTime();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, settingsRes] = await Promise.all([
        fetchWithAuth("/api/payroll/maxicare/history"),
        fetchWithAuth("/api/system/settings")
      ]);

      if (historyRes.ok && settingsRes.ok) {
        const historyData = await historyRes.json();
        const settingsData = await settingsRes.json();
        
        // Ensure history is always an array
        const safeHistory = Array.isArray(historyData) ? historyData : (historyData.history || historyData.data || []);
        setHistory(safeHistory);
        
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

  const getCycleRange = (year, cycleConfig) => {
    const startDate = cycleConfig.cycleStartDate;
    if (!startDate) return null;
    
    const baseStart = new Date(startDate);
    const startMonth = baseStart.getUTCMonth();
    const startDay = baseStart.getUTCDate();
    
    const start = new Date(year, startMonth, startDay, 0, 0, 0);
    const end = new Date(start);
    
    const months = cycleConfig.monthsToPay || 12;
    end.setMonth(start.getMonth() + parseInt(months));
    
    const deductionEnd = new Date(end);
    deductionEnd.setMonth(deductionEnd.getMonth() + 1, 0); 
    deductionEnd.setHours(23, 59, 59, 999);
    
    return { start, end, deductionEnd };
  };

  const currentCycleYear = useMemo(() => {
    const today = new Date(systemToday);
    for (const yearStr of Object.keys(configs)) {
      const year = parseInt(yearStr);
      const range = getCycleRange(year, configs[yearStr]);
      if (range && today >= range.start && today <= range.deductionEnd) {
        return year;
      }
    }
    return null;
  }, [configs, systemToday]);

  const cycleSummaries = useMemo(() => {
    return Object.keys(configs).sort((a, b) => b - a).map(yearStr => {
      const year = parseInt(yearStr);
      const config = configs[yearStr];
      const range = getCycleRange(year, config);
      
      if (!range) return null;

      // Filter history for this cycle
      const cycleHistory = history.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= range.start && itemDate <= range.deductionEnd && parseFloat(item.amount) > 0;
      });

      const uniqueSubscribers = new Set(cycleHistory.map(item => item.user_Id)).size;
      const totalGrossPremium = config.totalGross || 0;
      const annualPremiumBilled = totalGrossPremium * uniqueSubscribers;

      return {
        year,
        label: `${year} - ${year + Math.ceil((config.monthsToPay || 12) / 12)}`,
        totalGrossPremium,
        annualPremiumBilled,
        totalSubscribers: uniqueSubscribers,
        config,
        isOver: new Date(systemToday) > range.deductionEnd
      };
    }).filter(Boolean);
  }, [configs, history, systemToday]);

  const stats = useMemo(() => {
    const totalCollected = history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalBilled = cycleSummaries.reduce((sum, s) => sum + s.annualPremiumBilled, 0);
    
    return {
      totalCollected,
      totalBilled,
      totalCycles: cycleSummaries.length
    };
  }, [history, cycleSummaries]);

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;


  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
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
                      className="text-brand-primary"
                    >
                      <Link to="/maxicare">
                        <ChevronLeft className="h-6 w-6" />
                      </Link>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                  Back to Maxicare HMO Dashboard
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Title Group: Moves to the right via ml-2 when hovered */}
            <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out flex-1 text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Maxicare Deduction History</h1>
              <span className="text-sm text-slate-500 mt-1 block">Overview of all health insurance cycles and premiums.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight shrink-0">Policy Cycle</span>
            <Select 
              onValueChange={(val) => {
                navigate(`/maxicare?year=${val}`);
              }}
            >
              <SelectTrigger className="w-[150px] h-9 bg-white font-bold text-slate-700">
                <SelectValue placeholder="Select Cycle" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(configs).sort((a, b) => b - a).map(yearStr => {
                  const year = parseInt(yearStr);
                  const isCurrent = year === currentCycleYear;
                  const config = configs[yearStr];
                  const endYear = year + Math.max(1, Math.ceil((config.monthsToPay || 12) / 12));
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year} - {endYear} {isCurrent ? "(Current)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-t-4 border-brand-primary shadow-sm py-0">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Cycles</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Total number of historical and active Maxicare cycle groups.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-brand-primary">{stats.totalCycles}</p>
              </div>
              <div className="bg-brand-primary/10 p-3 rounded-xl text-brand-primary">
                <HistoryIcon size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-status-info shadow-sm py-0">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lifetime Subscribers</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Total number of unique employees enrolled in any Maxicare cycle.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-status-info">{new Set(history.map(h => h.user_Id)).size}</p>
              </div>
              <div className="bg-sky-50 p-3 rounded-xl text-status-info">
                <GroupsIcon size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-accent-green shadow-sm py-0">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Lifetime Billed</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case text-xs">
                      Total premium amount billed to the company for all subscribers across all cycles.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-accent-green">{peso(stats.totalBilled)}</p>
              </div>
              <div className="bg-accent-green/10 p-3 rounded-xl text-accent-green">
                <AccountBalanceWalletIcon size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cycle History Table */}
        <Card className="shadow-sm border-0 bg-white overflow-hidden py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-brand-primary">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-[11px] tracking-wider">Annual Cycle</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[11px] tracking-wider">Total Gross Premium</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[11px] tracking-wider">Annual Premium Billed</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[11px] tracking-wider">Total Subscriber</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-[11px] tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">Loading history...</TableCell>
                  </TableRow>
                ) : cycleSummaries.length > 0 ? (
                  cycleSummaries.map((summary) => (
                    <TableRow key={summary.year} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-bold text-brand-primary px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span>Cycle {summary.label}</span>
                          {summary.year === currentCycleYear && (
                            <Badge className="bg-yellow-400 text-brand-primary hover:bg-yellow-500 border-none font-black text-[10px]">
                              CURRENT
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 font-medium block mt-1">
                          {summary.config?.cycleStartDate 
                            ? `${new Date(summary.config.cycleStartDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} - Aug 10, ${summary.year + Math.ceil((summary.config.monthsToPay || 12) / 12)}` 
                            : `Aug 11, ${summary.year} - Aug 10, ${summary.year + 1}`}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {peso(summary.totalGrossPremium)}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {peso(summary.annualPremiumBilled)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-600">
                        {summary.totalSubscribers} Employees
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/maxicare?year=${summary.year}`)}
                                className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                              >
                                <VisibilityIcon className="mr-2 h-4 w-4" /> View
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal text-xs">
                            Inspect detailed ledger for this cycle
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic p-6">
                      <EmptyState 
                        icon={<HistoryIcon className="h-8 w-8 text-slate-400" />}
                        title="No historical cycles found."
                        description="HMO cycle history will appear after the first cycle is archived or processed."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default MaxicareHistory;