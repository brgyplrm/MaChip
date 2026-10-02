import React, { useState, useEffect, useCallback, react, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventNoteIcon from "@mui/icons-material/EventNote";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import SortIcon from "@mui/icons-material/Sort";
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import EmptyState from "../../components/EmptyState";
import { Link } from "react-router-dom";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import { EyeIcon } from "lucide-react";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TablePagination } from "@/components/ui/table-pagination";

const Payroll = () => {
  const [yearFilter, setYearFilter] = useState("All Years");
  const { systemToday } = useSystemTime();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState(null);
  const [upcomingPeriods, setUpcomingPeriods] = useState([]);
  const [allPeriods, setAllPeriods] = useState([]);

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Generate a range of years (e.g., 5 years back from today)
  const availableYears = useMemo(() => {
  const currentYear = systemToday.getFullYear();
  return Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());
}, [systemToday]);

  const formatLocalISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateUpcomingPeriods = (startDate, count = 6) => {
    const periods = [];
    let current;
    
    if (typeof startDate === "string") {
      const [y, m, d] = startDate.split("-").map(Number);
      current = new Date(y, m - 1, d);
    } else {
      current = new Date(startDate);
    }
    
    for (let i = 0; i < count; i++) {
      let start, end, half;
      const year = current.getFullYear();
      const month = current.getMonth();
      
      if (current.getDate() <= 15 && current.getDate() !== 0) { 
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 0); 
        half = "2nd Half";
      } else {
        start = new Date(year, month + 1, 1);
        end = new Date(year, month + 1, 15);
        half = "1st Half";
      }
      
      const monthName = start.toLocaleString('default', { month: 'long' });
      const dayRange = start.getDate() === 1 ? "1-15" : `16-${end.getDate()}`;
      const label = `${monthName} ${dayRange}, ${start.getFullYear()}`;
      const periodText = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      
      periods.push({
        month: monthName,
        year: start.getFullYear(),
        half,
        periodText,
        label,
        startDate: formatLocalISO(start),
        endDate: formatLocalISO(end)
      });
      
      current = new Date(end);
    }
    return periods;
  };

  const handleCreatePeriod = async (periodData) => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: periodData.startDate,
          endDate: periodData.endDate,
          label: periodData.label || `${periodData.month} ${periodData.year}`
        })
      });

      if (response.ok) {
        setIsCreateModalOpen(false);
        fetchActive();
      } else {
        alert("Failed to save payroll period.");
      }
    } catch (error) {
      console.error("Error saving period:", error);
    }
  };

  const fetchActive = async () => {
    setRefreshing(true);
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      const data = await response.json();
      
      if (response.ok) {
        setAllPeriods(data);
        
        // Find the "Draft" period which is currently active
        // Logic: The most recent draft is considered active
        const draftPeriods = data.filter(p => p.status === 'Draft');
        const active = draftPeriods[0]; 

        if (active) {
          const [startY, startM, startD] = active.startDate.split('-').map(Number);
          const [endY, endM, endD] = active.endDate.split('-').map(Number);
          const startObj = new Date(startY, startM - 1, startD);
          const endObj = new Date(endY, endM - 1, endD);
          
          setActivePeriod({
            id: active.periodId,
            month: startObj.toLocaleString('en-US', { month: 'long' }),
            year: startY,
            periodText: `${startObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${endObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            startDate: active.startDate,
            endDate: active.endDate,
            status: active.status,
            employees: active.employeeCount,
            amount: `₱${parseFloat(active.totalAmount).toLocaleString()}`
          });
        } else {
          setActivePeriod(null);
        }

        // Determine what the next upcoming period dates should be
        let seedDate = data.length > 0 ? data[0].endDate : null;
        
        if (systemToday) {
          let currentStartSeed;
          if (systemToday.getDate() <= 15) {
            currentStartSeed = new Date(systemToday.getFullYear(), systemToday.getMonth(), 0);
          } else {
            currentStartSeed = new Date(systemToday.getFullYear(), systemToday.getMonth(), 15);
          }

          if (!seedDate || new Date(seedDate) < currentStartSeed) {
            seedDate = formatLocalISO(currentStartSeed);
          }
        }

        if (seedDate) {
          setUpcomingPeriods(generateUpcomingPeriods(seedDate, 3));
        }
      }
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (systemToday) {
      fetchActive();
    }
  }, [systemToday]);

  // --- Filtering & Sorting Logic ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOrder, yearFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setYearFilter("All Years"); // Reset the year filter
    setSortOrder("newest");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || statusFilter !== "All" || yearFilter !== "All Years" || sortOrder !== "newest";
  // Filter out the active draft period from the list table
  let filteredPeriods = allPeriods.filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id));

  // Apply Search
  if (searchQuery) {
    filteredPeriods = filteredPeriods.filter(p => 
      p.label?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply Status
  if (statusFilter !== "All") {
    filteredPeriods = filteredPeriods.filter(p => 
      p.status?.toLowerCase() === statusFilter.toLowerCase()
    );
  }

  // Apply Year Filter
  if (yearFilter !== "All Years") {
    filteredPeriods = filteredPeriods.filter(p => {
      const periodYear = new Date(p.startDate).getFullYear().toString();
      return periodYear === yearFilter;
    });
  }

  // Apply Sorting
  filteredPeriods.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  // Pagination calculations
  const totalItems = filteredPeriods.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredPeriods.slice(startIndex, endIndex);


  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header */}
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 min-w-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Payroll Management</h1>
            <span className="text-sm text-slate-500 mt-1 block">Manage employee payroll and periods</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block w-full sm:w-auto">
                  <Button variant="outline" asChild className="w-full border-brand-primary/10 hover:text-brand-primary text-brand-primary/70 transition-colors">
                    <Link to="/laborBenefits">
                      <AssignmentTurnedInIcon className="mr-2 h-4 w-4" /> Labor Benefits
                    </Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                Manage employee bonuses, thirteenth-month pay, and special benefits.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block w-full sm:w-auto">
                  <Button variant="outline" asChild className="w-full bg-brand-primary text-white hover:bg-[#7A52B5] hover:text-white transition-colors">
                    <Link to="/payroll/employeeList">
                      <PeopleAltIcon className="mr-2 h-4 w-4" /> Employee List
                    </Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                View individual base daily rates, bank accounts, and payroll classifications.
              </TooltipContent>
            </Tooltip>
            {/* <Button 
              variant="outline" 
              className="w-full sm:w-auto bg-brand-primary-light text-brand-primary border-[#c4b5e8] hover:bg-[#e0d4f5] transition-colors"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <EventNoteIcon className="mr-2 h-4 w-4" /> Payroll Schedule
            </Button> */}
            {/* <Button 
              className="w-full sm:w-auto bg-brand-primary text-white hover:bg-brand-primary-hover"
              onClick={fetchActive}
              disabled={refreshing}
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button> */}
          </div>
        </div>

        {/* Periods Grid (Active & Next) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 min-w-0">
          
          {/* Active Period Column */}
          <div className="flex flex-col h-full">
            <h2 className="text-lg font-bold text-slate-700 mb-3">Active Period</h2>
            {activePeriod ? (
              <Card className="flex flex-col flex-1 border-brand-primary ring-2 ring-brand-primary/50 shadow-md hover:shadow-lg transition-shadow bg-white">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                        <CalendarMonthIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-brand-primary">{activePeriod.month} {activePeriod.year}</CardTitle>
                        <CardDescription className="font-medium mt-1">{activePeriod.periodText}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-brand-primary shadow-sm uppercase tracking-wider font-bold">
                      {activePeriod.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-5 flex-1">
                  <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Start Date</p>
                      <p className="text-sm font-semibold text-slate-800">{new Date(activePeriod.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">End Date</p>
                      <p className="text-sm font-semibold text-slate-800">{new Date(activePeriod.endDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3 px-2">
                    <span className="text-slate-500 font-medium">Included Employees:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full">{activePeriod.employees}</span>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-medium">Estimated Net Pay:</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 13 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          Estimated total net payout amount for the selected draft cycle.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="font-bold text-brand-primary text-lg">{activePeriod.amount}</span>
                  </div>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block w-full">
                        <Button asChild className="w-full bg-brand-primary hover:bg-[#7A52B5] py-6 text-sm shadow-sm transition-all hover:-translate-y-0.5">
                          <Link to={`/payroll/payrollPeriod?periodId=${activePeriod.id}`}>
                            <ReceiptOutlinedIcon className="mr-2 h-4 w-4" /> Process Active Payroll
                          </Link>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                      Recalculate, lock, or release payouts for the current period.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </Card>
            ) : (
              <Card className="flex flex-col flex-1 border-2 border-dashed border-slate-200 shadow-none bg-slate-50/50 justify-center items-center p-8 min-h-[300px] text-center">
                <CalendarMonthIcon className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="font-bold text-slate-600 mb-1">No Active Period</h3>
                <p className="text-slate-500 max-w-[250px] text-sm">There are currently no draft payroll periods for the current date.</p>
              </Card>
            )}
          </div>

          {/* Next Period Column */}
          {upcomingPeriods.length > 0 && (
            <div className="flex flex-col h-full">
              <h2 className="text-lg font-bold text-slate-700 mb-3">Next Scheduled Period</h2>
              <Card className="flex flex-col flex-1 bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 bg-slate-100 text-slate-500 rounded-xl">
                        <CalendarMonthIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-700">{upcomingPeriods[0].month} {upcomingPeriods[0].year}</CardTitle>
                        <CardDescription className="font-medium mt-1">{upcomingPeriods[0].periodText}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-slate-500 border-slate-200 bg-slate-50 uppercase tracking-wider font-bold">Upcoming</Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-5 flex-1 flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100/50">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Start Date</p>
                      <p className="text-sm font-semibold text-slate-600">{new Date(upcomingPeriods[0].startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">End Date</p>
                      <p className="text-sm font-semibold text-slate-600">{new Date(upcomingPeriods[0].endDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm px-2">This is the automated schedule for the <span className="font-semibold text-slate-700">{upcomingPeriods[0].half.toLowerCase()}</span>. The system will automatically activate this once the current period ends.</p>
                </CardContent>
                <div className="p-6 pt-0 mt-auto opacity-50 cursor-not-allowed">
                  <Button 
                    variant="outline"
                    disabled
                    className="w-full bg-slate-50 border-slate-200 text-slate-400 py-6 text-sm shadow-none"
                  >
                    <EventNoteIcon className="mr-2 h-4 w-4" /> Automatic Generation
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-700 mb-4">Previous Periods (Locked/Released)</h2>

        {/* Filters Card for Previous Periods */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by period label (e.g., January 1-15)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              {/* NEW: Year Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <CalendarMonthIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Years">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="Released">Released</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <SortIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Sort Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
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

        {/* Previous Periods Table */}
        <Card className="shadow-sm border-0 bg-white min-w-0 py-0 flex flex-col">
          <CardContent className="p-0 flex flex-col">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px] md:min-w-full">
                <TableHeader className="bg-brand-primary">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Period Label</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date Range</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employees</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Total Amount</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.length > 0 ? (
                    currentData.map((p, index) => {
                        let badgeStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                        if (p.status?.toLowerCase() === "released") badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200";
                        if (p.status?.toLowerCase() === "locked") badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-200";
                        
                        return (
                          <TableRow key={index} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-bold text-brand-primary py-4 px-6">{p.label}</TableCell>
                            <TableCell className="text-slate-600 py-4 font-medium">
                              {new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-slate-700 py-4 font-medium">{p.employeeCount || 0}</TableCell>
                            <TableCell className="font-semibold text-slate-800 py-4">₱{(parseFloat(p.totalAmount) || 0).toLocaleString()}</TableCell>
                            <TableCell className="py-4">
                              <Badge variant="secondary" className={badgeStyle}>{p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 py-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      asChild 
                                      className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-brand-primary-light hover:border-[#9c7de0] transition-colors"
                                    >
                                      <Link to={`/payroll/payrollPeriod?periodId=${p.periodId}`}>
                                        <EyeIcon className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                                  View Details
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <EmptyState 
                          icon={<SearchOffIcon className="w-8 h-8 text-slate-300" />}
                          title="No Payroll Periods Found"
                          description={searchQuery 
                            ? `We couldn't find any results matching "${searchQuery}". Please try a different search term.` 
                            : "There are currently no processed or locked payroll periods recorded."
                          }
                          action={searchQuery && (
                            <Button 
                              variant="outline" 
                              onClick={handleClearFilters}
                              className="text-brand-primary border-brand-primary hover:bg-brand-primary-light"
                            >
                              Clear Search
                            </Button>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

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
              itemLabel="payroll records"
            />
          </CardContent>
        </Card>

        <Dialog open={loading && !refreshing}>
          <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center p-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            <p className="mt-4 font-medium text-slate-600">Loading payroll data...</p>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default Payroll;