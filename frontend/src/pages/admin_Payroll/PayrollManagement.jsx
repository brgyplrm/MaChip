import React, { useState, useEffect, useCallback } from "react";
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
import { Link } from "react-router-dom";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Payroll = () => {
  const { systemToday } = useSystemTime();
  const [payrolls, setPayrolls] = useState([]);
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
  }, [searchQuery, statusFilter, sortOrder, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || statusFilter !== "All" || sortOrder !== "newest";

  // Filter out the active draft period, then apply search/status filters
  let filteredPeriods = allPeriods.filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id));

  if (searchQuery) {
    filteredPeriods = filteredPeriods.filter(p => 
      p.label?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (statusFilter !== "All") {
    filteredPeriods = filteredPeriods.filter(p => 
      p.status?.toLowerCase() === statusFilter.toLowerCase()
    );
  }

  // Sorting
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
      <div className="flex-1 p-4 md:p-4 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 min-w-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Payroll Management</h1>
            <span className="text-sm text-slate-500 mt-1 block">Manage employee payroll and periods</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <Button variant="outline" asChild className="w-full sm:w-auto border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white">
              <Link to="/payroll/employeeList">
                <PeopleAltIcon className="mr-2 h-4 w-4" /> Employee List
              </Link>
            </Button>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto bg-[#f0ebfa] text-[#2A174E] border-[#c4b5e8] hover:bg-[#e0d4f5]"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <EventNoteIcon className="mr-2 h-4 w-4" /> Payroll Schedule
            </Button>
            <Button 
              className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]"
              onClick={fetchActive}
              disabled={refreshing}
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Periods Grid (Active & Next) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 min-w-0">
          
          {/* Active Period Column */}
          <div className="flex flex-col h-full">
            <h2 className="text-lg font-bold text-slate-700 mb-3">Active Period</h2>
            {activePeriod ? (
              <Card className="flex flex-col flex-1 border-[#2A174E] ring-2 ring-[#2A174E]/50 shadow-md hover:shadow-lg transition-shadow bg-white">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 bg-[#2A174E]/10 text-[#2A174E] rounded-xl">
                        <CalendarMonthIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-[#2A174E]">{activePeriod.month} {activePeriod.year}</CardTitle>
                        <CardDescription className="font-medium mt-1">{activePeriod.periodText}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-[#2A174E] shadow-sm uppercase tracking-wider font-bold">
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
                    <span className="text-slate-500 font-medium">Estimated Net Pay:</span>
                    <span className="font-bold text-[#2A174E] text-lg">{activePeriod.amount}</span>
                  </div>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <Button asChild className="w-full bg-[#2A174E] hover:bg-[#1a0e30] py-6 text-sm shadow-sm transition-all hover:-translate-y-0.5">
                    <Link to={`/payroll/payrollPeriod?periodId=${activePeriod.id}`}>
                      <VisibilityIcon className="mr-2 h-4 w-4" /> Process Active Payroll
                    </Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="flex flex-col flex-1 border-2 border-dashed border-slate-200 shadow-none bg-slate-50/50 justify-center items-center p-8 min-h-[300px] text-center">
                <CalendarMonthIcon className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="font-bold text-slate-600 mb-1">No Active Period</h3>
                <p className="text-slate-500 max-w-[250px] text-sm">There are currently no draft payroll periods. Use the next period card to start one.</p>
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
                  <p className="text-slate-500 text-sm px-2">This is the automated schedule for the <span className="font-semibold text-slate-700">{upcomingPeriods[0].half.toLowerCase()}</span>. Generating it now will lock previous unreleased periods.</p>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <Button 
                    variant="outline"
                    className="w-full bg-white border-[#2A174E]/30 text-[#2A174E] hover:bg-[#f0ebfa] py-6 text-sm shadow-sm transition-all hover:-translate-y-0.5"
                    onClick={() => handleCreatePeriod(upcomingPeriods[0])}
                  >
                    <EventNoteIcon className="mr-2 h-4 w-4" /> Generate This Period
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
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="Locked">Locked</SelectItem>
                    <SelectItem value="Released">Released</SelectItem>
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
        <Card className="shadow-sm border-0 bg-white min-w-0 py-0">
          <CardContent className="p-0 flex flex-col">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px] md:min-w-full">
                <TableHeader className="bg-[#2B174F]">
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
                            <TableCell className="font-bold text-[#2A174E] py-4 px-6">{p.label}</TableCell>
                            <TableCell className="text-slate-600 py-4 font-medium">
                              {new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-slate-700 py-4 font-medium">{p.employeeCount || 0}</TableCell>
                            <TableCell className="font-semibold text-slate-800 py-4">₱{(parseFloat(p.totalAmount) || 0).toLocaleString()}</TableCell>
                            <TableCell className="py-4">
                              <Badge variant="secondary" className={badgeStyle}>{p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 py-4">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                asChild 
                                className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors"
                              >
                                <Link to={`/payroll/payrollPeriod?periodId=${p.periodId}`}>
                                  View Details
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                          <span className="font-semibold text-slate-600">No periods found</span>
                          <span className="text-sm text-slate-400">Adjust your search or filters to see more results.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

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
          </CardContent>
        </Card>

        <CreatePeriodModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreatePeriod}
        />
      </div>
      </Sidebar>
    </div>
  );
};

export default Payroll;