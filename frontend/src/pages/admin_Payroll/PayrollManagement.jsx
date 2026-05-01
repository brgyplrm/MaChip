import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { Link } from "react-router-dom";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CreatePeriodModal from "../../components/createperiodmodal/CreatePeriodModal";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const Payroll = () => {
  const { systemToday } = useSystemTime();
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalNetPay: 0,
    totalEarnings: 0,
    totalDeductions: 0
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState(null);
  const [upcomingPeriods, setUpcomingPeriods] = useState([]);
  const [allPeriods, setAllPeriods] = useState([]);

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
    setLoading(true);
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
    }
  };

  const handleRefresh = () => fetchActive();

  useEffect(() => {
    if (systemToday) {
      fetchActive();
    }
  }, [systemToday]);

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
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshIcon className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Periods Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 min-w-0">
          {/* Active Period Column */}
          <div className="flex flex-col h-full">
            <h2 className="text-lg font-bold text-slate-700 mb-3">Active Period</h2>
            {activePeriod ? (
              <Card className="flex flex-col flex-1 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 bg-orange-50 text-orange-500 rounded-xl">
                        <CalendarMonthIcon />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-[#2A174E]">{activePeriod.month} {activePeriod.year}</CardTitle>
                        <CardDescription className="font-medium mt-1">{activePeriod.periodText}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-500 text-white hover:bg-slate-600 shadow-sm">
                      {activePeriod.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6 flex-1">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-medium">Employees:</span>
                    <span className="font-bold text-slate-800">{activePeriod.employees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Estimated Pay:</span>
                    <span className="font-bold text-[#2A174E] text-lg">{activePeriod.amount}</span>
                  </div>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <Button asChild className="w-full bg-[#2A174E] hover:bg-[#1a0e30] py-6 text-sm shadow-sm">
                    <Link to={`/payroll/payrollPeriod?periodId=${activePeriod.id}`}>
                      <VisibilityIcon className="mr-2 h-4 w-4" /> Process Payroll
                    </Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="flex flex-col flex-1 border-2 border-dashed border-slate-200 shadow-none bg-slate-50/50 justify-center items-center p-8 min-h-[250px] text-center">
                <CalendarMonthIcon className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500 max-w-[250px]">No draft payroll periods. Use the next period card to start one.</p>
              </Card>
            )}
          </div>

          {/* Next Period Column */}
          {upcomingPeriods.length > 0 && (
            <div className="flex flex-col h-full">
              <h2 className="text-lg font-bold text-slate-700 mb-3">Next Period</h2>
              <Card className="flex flex-col flex-1 bg-slate-50 border-slate-200 shadow-none hover:shadow-sm transition-shadow">
                <CardHeader className="pb-4 border-b border-slate-200">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 bg-slate-200 text-slate-600 rounded-xl">
                        <CalendarMonthIcon />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-[#2A174E]">{upcomingPeriods[0].month} {upcomingPeriods[0].year}</CardTitle>
                        <CardDescription className="font-medium mt-1">{upcomingPeriods[0].periodText}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-slate-500 border-slate-300 bg-white">Upcoming</Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6 flex-1 flex items-center">
                  <p className="text-slate-600">Automated schedule for the <span className="font-semibold">{upcomingPeriods[0].half.toLowerCase()}</span>.</p>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <Button 
                    variant="outline"
                    className="w-full bg-white border-[#c4b5e8] text-[#2A174E] hover:bg-[#f0ebfa] py-6 text-sm shadow-sm"
                    onClick={() => handleCreatePeriod(upcomingPeriods[0])}
                  >
                    <EventNoteIcon className="mr-2 h-4 w-4" /> Create This Period
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-700 mb-4">Previous Periods (Locked)</h2>

        {/* Previous Periods Table */}
        <Card className="shadow-sm border-0 bg-white min-w-0 px-4 py-2">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider">Period Label</TableHead>
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider">Date Range</TableHead>
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider">Employees</TableHead>
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider">Total Amount</TableHead>
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600 py-4 uppercase text-xs tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPeriods.filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id)).length > 0 ? (
                  allPeriods
                    .filter(p => p.status !== 'Draft' || (activePeriod && p.periodId !== activePeriod.id))
                    .map((p, index) => {
                      let badgeStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                      if (p.status?.toLowerCase() === "released") badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200";
                      
                      return (
                        <TableRow key={index} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-bold text-[#2A174E] py-4">{p.label}</TableCell>
                          <TableCell className="text-slate-600 py-4">
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
                                {/* <VisibilityIcon className="mr-2 h-4 w-4" />  */} View Details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                      No previous periods found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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