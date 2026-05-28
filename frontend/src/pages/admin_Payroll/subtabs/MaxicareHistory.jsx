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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HmoCalculatorModal from "../../../components/HmoCalculatorModal";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const MaxicareHistory = () => {
  const { systemToday } = useSystemTime();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [showCalculator, setShowCalculator] = useState(false);
  
  // New Config State
  const [newConfig, setNewConfig] = useState({
    totalGross: 0,
    monthsToPay: 12,
    cycleStartDate: "",
    employerShare: 50
  });

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
        const safeHistory = Array.isArray(historyData) ? historyData : (historyData.data || []);
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
    }).filter(s => s && s.isOver);
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

  const handleSaveNewConfig = async () => {
    try {
      setLoading(true);
      const year = new Date(newConfig.cycleStartDate).getFullYear();
      if (isNaN(year)) {
        setToast({ message: "Invalid start date", type: "error" });
        return;
      }

      const updatedConfigs = {
        ...configs,
        [year]: {
          totalGross: newConfig.totalGross,
          monthsToPay: newConfig.monthsToPay,
          cycleStartDate: newConfig.cycleStartDate
        }
      };

      // We need to fetch the existing dates to keep them
      const settingsRes = await fetchWithAuth("/api/system/settings");
      const settingsData = await settingsRes.json();
      const existingDates = settingsData.maxicareDates?.dates || [];

      const saveRes = await fetchWithAuth("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxicareDates: {
            dates: existingDates,
            configs: updatedConfigs
          }
        })
      });

      if (saveRes.ok) {
        setToast({ message: `Configuration for Cycle ${year} saved!`, type: "success" });
        setShowCalculator(false);
        fetchData();
      } else {
        setToast({ message: "Failed to save configuration", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Error saving configuration", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
          <DialogContent className="max-w-4xl! p-0 overflow-hidden border-none bg-transparent shadow-none">
            <HmoCalculatorModal 
              premium={newConfig.totalGross}
              setPremium={(val) => setNewConfig(prev => ({ ...prev, totalGross: val }))}
              cutoffs={newConfig.monthsToPay * 2}
              setCutoffs={(val) => setNewConfig(prev => ({ ...prev, monthsToPay: val / 2 }))}
              employerShare={newConfig.employerShare}
              setEmployerShare={(val) => setNewConfig(prev => ({ ...prev, employerShare: val }))}
              cycleStartDate={newConfig.cycleStartDate}
              setCycleStartDate={(date) => setNewConfig(prev => ({ ...prev, cycleStartDate: date }))}
            />
            <div className="flex justify-center pb-6">
              <Button 
                onClick={handleSaveNewConfig}
                className="bg-[#2A174E] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#1a0e30] transition-colors shadow-lg"
              >
                Save New Configuration
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link 
              to="/maxicare" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 text-[#2A174E] transition-colors"
            >
              <ArrowBackIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Maxicare Deduction History</h1>
              <span className="text-sm text-slate-500 mt-1 block">Overview of all health insurance cycles and premiums.</span>
            </div>
          </div>
          <Button 
            onClick={() => setShowCalculator(true)}
            className="bg-[#2A174E] hover:bg-[#1a0e30] text-white font-bold"
          >
            <AddIcon className="mr-2 h-4 w-4" /> Add Config
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-t-4 border-[#2A174E] shadow-sm">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Cycles</p>
                <p className="text-3xl font-bold text-[#2A174E]">{stats.totalCycles}</p>
              </div>
              <div className="bg-[#2A174E]/10 p-3 rounded-xl text-[#2A174E]">
                <HistoryIcon size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-blue-500 shadow-sm">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lifetime Subscribers</p>
                <p className="text-3xl font-bold text-blue-700">{new Set(history.map(h => h.user_Id)).size}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <GroupsIcon size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-emerald-500 shadow-sm">
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Lifetime Billed</p>
                <p className="text-3xl font-bold text-emerald-700">{peso(stats.totalBilled)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                <AccountBalanceWalletIcon size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cycle History Table */}
        <Card className="shadow-sm border-0 bg-white overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#2A174E]">
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
                      <TableCell className="font-bold text-[#2A174E] px-6 py-5">
                        Cycle {summary.label}
                        {summary.year === currentCycleYear && (
                          <Badge className="ml-2 bg-yellow-400 text-[#2A174E] hover:bg-yellow-500 border-none font-black text-[10px]">
                            CURRENT
                          </Badge>
                        )}
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/maxicare?year=${summary.year}`)}
                          className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white"
                        >
                          <VisibilityIcon className="mr-2 h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">No historical cycles found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
};

export default MaxicareHistory;