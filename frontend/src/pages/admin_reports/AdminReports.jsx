import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PaymentsIcon from "@mui/icons-material/Payments";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { Link, useLocation } from "react-router-dom";
import { formatUserId } from "../../utils/formatUserId";
import { exportBatchToZip } from "../../utils/payrollExport";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminReports = () => {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState("All Employees");
  const [selectedPeriod, setSelectedPeriod] = useState("custom");
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const [activeReport, setActiveReport] = useState("attendance");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchPayrollPeriods = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/system/payroll-periods");
      if (response.ok) {
        const data = await response.json();
        setPayrollPeriods(data);
      }
    } catch (error) {
      console.error("Error fetching payroll periods:", error);
    }
  }, []);

  const handlePeriodChange = (val) => {
    setSelectedPeriod(val);
    if (val === "custom") return;

    const period = payrollPeriods.find(p => p.periodId.toString() === val);
    if (period) {
      setStartDate(period.startDate);
      setEndDate(period.endDate);
    }
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  const fetchAttendanceReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/attendance/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
      }
    } catch (error) {
      console.error("Error fetching attendance report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchPayrollReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/payroll/report?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error("Error fetching payroll report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  const fetchCalendarReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/request/report/calendar?startDate=${startDate}&endDate=${endDate}&user_Id=${selectedEmployee}`);
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data);
      }
    } catch (error) {
      console.error("Error fetching calendar report:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  useEffect(() => {
    fetchEmployees();
    fetchPayrollPeriods();
  }, [fetchEmployees, fetchPayrollPeriods]);

  useEffect(() => {
    if (activeReport === "attendance") fetchAttendanceReport();
    else if (activeReport === "payroll") fetchPayrollReport();
    else if (activeReport === "calendar") fetchCalendarReport();
  }, [activeReport, fetchAttendanceReport, fetchPayrollReport, fetchCalendarReport]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveReport(location.state.activeTab);
    }
  }, [location.state]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeReport, startDate, endDate, selectedEmployee, itemsPerPage]);

  const handleCSVExport = () => {
    let dataToExport = [];
    let filename = `${activeReport}_report_${startDate}_to_${endDate}.csv`;
    let headers = [];

    if (activeReport === "attendance") {
      headers = ["Employee ID", "Employee Name", "Date", "Time In", "Time Out", "Hours Worked", "Status", "Remarks"];
      dataToExport = attendanceData.map(r => [
        formatUserId(r.user_Id), 
        r.userName, 
        new Date(r.log_Date).toLocaleDateString(), 
        r.time_In, 
        r.time_Out, 
        r.hoursWorked, 
        r.status, 
        r.remarks
      ]);
    } else if (activeReport === "payroll") {
      headers = [
        "Emp ID", "Employee Name", "Period Start", "Period End", "Days Worked", "Hours Worked", 
        "Rate/Hr", "Basic Pay", "Overtime Pay", "Night Diff", "Holiday Pay", "Incentives", 
        "Allowance", "Total Earnings", "Absences Ded", "Tardiness Ded", "SSS Ded", "Philhealth Ded", 
        "HDMF Ded", "Tax Ded", "Loans/Others", "Total Deductions", "Net Pay", "Status"
      ];
      dataToExport = payrollData.map(r => [
        formatUserId(r.user_Id), `${r.user_FirstName} ${r.user_LastName}`, r.period_Start, r.period_End, 
        r.NoDays_Worked, r.NoHrs_Worked, r.ratePerHr, r.basicPay,
        (parseFloat(r.OT_Amnt) || 0) + (parseFloat(r.restDay_OT_Amnt) || 0), r.nightDiff_Amnt, r.specialHol_Amnt, 
        r.incentives, r.allowance, r.totalEarnings, r.absence_Amnt, r.tardiness_Amnt, r.SSS_Ded, 
        r.Philhealth_Ded, r.HDMF_Ded, r.Tax_Ded,
        (parseFloat(r.SSS_Loan) || 0) + (parseFloat(r.HDMF_Loan) || 0) + (parseFloat(r.Other_Deductions) || 0),
        r.totalDeductions, r.netPay, r.statusName
      ]);
    } else if (activeReport === "calendar") {
      headers = ["Type", "Date", "Name/Employee", "Details"];
      dataToExport = calendarData.map(r => [r.type, r.date, r.name, r.details]);
    }

    exportToCSV(headers, dataToExport, filename);
  };

  const handleBatchExport = () => {
    if (payrollData.length === 0) return;
    
    let label = "Payroll_Report";
    if (selectedPeriod !== "custom") {
      const period = payrollPeriods.find(p => p.periodId.toString() === selectedPeriod);
      if (period) {
        const [startY, startM, startD] = period.startDate.split('-').map(Number);
        const [endY, endM, endD] = period.endDate.split('-').map(Number);
        const month = new Date(startY, startM - 1, startD).toLocaleString('en-US', { month: 'long' });
        label = `${month}${startD}-${endD}`;
      }
    } else {
      label = `Payroll_${startDate}_to_${endDate}`;
    }
    
    exportBatchToZip(payrollData, label);
  };

  // --- Statistics Calculation ---
  const attStats = attendanceData.reduce((acc, curr) => {
    if (curr.status === "On-Time") acc.present++;
    else if (curr.status === "Late") { acc.present++; acc.late++; }
    else if (curr.status === "Absent") acc.absent++;
    acc.totalHours += parseFloat(curr.hoursWorked) || 0;
    return acc;
  }, { present: 0, absent: 0, late: 0, totalHours: 0 });

  const payStats = payrollData.reduce((acc, curr) => {
    acc.net += parseFloat(curr.netPay) || 0;
    acc.earn += parseFloat(curr.totalEarnings) || 0;
    acc.ded += parseFloat(curr.totalDeductions) || 0;
    return acc;
  }, { net: 0, earn: 0, ded: 0 });

  const peso = (val) => `₱${parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- Pagination Logic ---
  const activeData = activeReport === "attendance" ? attendanceData : activeReport === "payroll" ? payrollData : calendarData;
  const totalItems = activeData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = activeData.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0 bg-slate-50 min-h-screen">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Reports & Analytics</h1>
              <span className="text-sm text-slate-500 mt-1 block">Generate, analyze, and export system attendance and payroll data.</span>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button onClick={handleCSVExport} className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30] shadow-sm">
                <FileDownloadIcon className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              {activeReport === "payroll" && (
                <Button 
                  onClick={handleBatchExport}
                  disabled={payrollData.length === 0 || loading}
                  className="w-full md:w-auto bg-green-600 text-white hover:bg-green-700 shadow-sm"
                >
                  <ReceiptLongIcon className="mr-2 h-4 w-4" /> Batch ZIP Payslips
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeReport} onValueChange={(val) => setActiveReport(val)} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 bg-slate-200/60 p-1 rounded-lg gap-1 sm:gap-0">
              <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <AssessmentIcon className="mr-2 h-4 w-4" /> Attendance Report
              </TabsTrigger>
              <TabsTrigger value="payroll" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <PaymentsIcon className="mr-2 h-4 w-4" /> Payroll Report
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md py-2">
                <CalendarMonthIcon className="mr-2 h-4 w-4" /> Calendar / Events
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 w-full animate-in fade-in zoom-in-95 duration-200">
            {activeReport === "attendance" && (
              <>
                {/* Statistics Cards */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
                  {/* Card 1: Total Present */}
                  <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Present</p>
                        <p className="text-4xl font-bold text-[#2A174E]">{attStats.present}</p>
                      </div>
                      <p className="text-xs text-[#2A174E]/70 italic mt-4">Total recorded present days</p>
                    </div>
                    <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <CheckCircleOutlineIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
          
                  {/* Card 2: Total Hours */}
                  <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Total Hours</p>
                        <p className="text-4xl font-bold text-[#3B4E17]">{attStats.totalHours.toFixed(1)}<span className="text-lg opacity-80 ml-1">hrs</span></p>
                      </div>
                      <p className="text-xs text-[#3B4E17]/70 italic mt-4">Total clocked working hours</p>
                    </div>
                    <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <AccessTimeIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
          
                  {/* Card 3: Lates/Absences */}
                  <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Lates / Absences</p>
                        <p className="text-4xl font-bold text-[#BB8B26]">{attStats.late + attStats.absent}</p>
                      </div>
                      <p className="text-xs text-[#BB8B26]/70 italic mt-4">Recorded infractions in period</p>
                    </div>
                    <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <AssignmentLateIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {activeReport === "payroll" && (
              <>
              <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Net Pay</p>
                        <p className="text-4xl font-bold text-[#2A174E]">{peso(payStats.net)}</p>
                      </div>
                      <p className="text-xs text-[#2A174E]/70 italic mt-4">Calculated total distribution amount</p>
                    </div>
                    <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <PaymentsIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
          
                  {/* Card 2: Employees */}
                  <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Total Earnings</p>
                        <p className="text-4xl font-bold text-[#3B4E17]">{peso(payStats.earn)}</p>
                      </div>
                      <p className="text-xs text-[#3B4E17]/70 italic mt-4">Gross pay including OT and allowances</p>
                    </div>
                    <div className="bg-[#3B4E17]/10 text-[#3B4E17] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <KeyboardDoubleArrowUpIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
          
                  {/* Card 3: Admins & Supervisors */}
                  <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Total Deductions</p>
                        <p className="text-4xl font-bold text-[#BB8B26]">{peso(payStats.ded)}</p>
                      </div>
                      <p className="text-xs text-[#BB8B26]/70 italic mt-4">Withholdings including taxes and loans</p>
                    </div>
                    <div className="bg-[#BB8B26]/20 text-[#BB8B26] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <KeyboardDoubleArrowDownIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
              </> 
              
            )}

            {activeReport === "calendar" && (
              <>
              <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
                    <CardContent className="px-5 py-5 flex justify-between h-full">
                      <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Logged Events</p>
                        <p className="text-4xl font-bold text-[#2A174E]">{calendarData.length}</p>
                      </div>
                      <p className="text-xs text-[#2A174E]/70 italic mt-4">Holidays, leaves, and system events tracked in this period</p>
                    </div>
                    <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg flex items-center justify-center shrink-0 self-start">
                      <EventNoteIcon className="h-6 w-6" />
                    </div>
                    </CardContent>
                  </Card>
              </>
            )}
          </div>

          {/* Filters Card */}
          <Card className="mb-6 mt-6 shadow-sm border-0 bg-white py-0">
            <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
              
              <div className="flex items-center gap-2 font-bold text-slate-700 w-full xl:w-auto">
                <FilterListIcon className="h-5 w-5 text-slate-400" /> Filters
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto flex-wrap">
                
                {(activeReport === "payroll" || activeReport === "attendance") && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                      <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors font-medium text-slate-700">
                        <SelectValue placeholder="-- Select Period --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom Date Range</SelectItem>
                        {payrollPeriods.map(p => (
                          <SelectItem key={p.periodId} value={p.periodId.toString()}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(activeReport === "calendar" || selectedPeriod === "custom") && (
                  <>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700" />
                    </div>
                    <span className="hidden sm:block text-slate-400 font-bold">to</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-[150px] border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700" />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full sm:w-[200px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors font-medium text-slate-700">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Employees">All Employees</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                          {emp.user_LastName}, {emp.user_FirstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Data/Table Card */}
          <Card className="shadow-sm border-0 bg-white py-0">
            <CardContent className="p-0 flex flex-col">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Loading report data...</div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  
                  {/* Attendance Table */}
                  {activeReport === "attendance" && (
                    <Table className="min-w-[1000px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Emp ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time In</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Time Out</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Hours</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider pr-6">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let badgeStyle = "bg-slate-100 text-slate-800 font-bold";
                          if (r.status === "On-Time") badgeStyle = "bg-green-100 text-green-800 font-bold";
                          else if (r.status === "Late") badgeStyle = "bg-amber-100 text-amber-800 font-bold";
                          else if (r.status === "Absent") badgeStyle = "bg-red-100 text-red-800 font-bold";

                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-[#2A174E] px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
                              <TableCell className="font-semibold text-slate-800 py-4">{r.userName}</TableCell>
                              <TableCell className="text-slate-600 py-4">{new Date(r.log_Date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-slate-600 font-mono text-[13px] py-4">{r.time_In}</TableCell>
                              <TableCell className="text-slate-600 font-mono text-[13px] py-4">{r.time_Out}</TableCell>
                              <TableCell className="text-slate-700 font-bold py-4">{r.hoursWorked}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={badgeStyle}>{r.status}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 italic max-w-[200px] truncate pr-6 py-4">{r.remarks || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">No attendance records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* Payroll Table */}
                  {activeReport === "payroll" && (
                    <Table className="min-w-[1200px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Emp ID</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Employee Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Period</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Days/Hrs</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Basic Pay</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Earnings</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Deductions</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Net Pay</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Payslip</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let badgeStyle = "bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px]";
                          if (r.statusName === "Paid" || r.statusName === "Released") badgeStyle = "bg-green-100 text-green-800 font-bold uppercase tracking-wider text-[10px]";
                          else if (r.statusName === "Processed") badgeStyle = "bg-blue-100 text-blue-800 font-bold uppercase tracking-wider text-[10px]";
                          
                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-[#2A174E] px-6 py-4">{formatUserId(r.user_Id)}</TableCell>
                              <TableCell className="font-semibold text-slate-800 py-4">{r.user_FirstName} {r.user_LastName}</TableCell>
                              <TableCell className="text-slate-500 text-xs py-4 font-medium">
                                {new Date(r.period_Start).toLocaleDateString()} - <br/>{new Date(r.period_End).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-slate-600 font-semibold py-4">{r.NoDays_Worked}d / {r.NoHrs_Worked}h</TableCell>
                              <TableCell className="text-slate-700 py-4 font-mono text-[13px]">{peso(r.basicPay)}</TableCell>
                              <TableCell className="text-green-600 font-bold py-4 font-mono text-[13px]">{peso(r.totalEarnings)}</TableCell>
                              <TableCell className="text-red-500 font-bold py-4 font-mono text-[13px]">{peso(r.totalDeductions)}</TableCell>
                              <TableCell className="font-black text-slate-900 py-4 font-mono text-[13px]">{peso(r.netPay)}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={badgeStyle}>{r.statusName}</Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6 py-4">
                                <Button variant="ghost" size="icon" asChild className="text-[#2A174E] hover:bg-[#f0ebfa]">
                                  <Link title="View Payslip" to={`/adminReports/payslip/${r.payrollId}`} state={{ fromTab: activeReport }}>
                                    <ReceiptLongIcon className="h-5 w-5" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={10} className="h-24 text-center text-muted-foreground italic">No payroll records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}

                  {/* Calendar / Events Table */}
                  {activeReport === "calendar" && (
                    <Table className="min-w-[800px]">
                      <TableHeader className="bg-[#2B174F]">
                        <TableRow className="hover:bg-transparent border-b-0">
                          <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">Date</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Event Type</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Subject / Name</TableHead>
                          <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider pr-6">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentData.map((r, i) => {
                          let typeBadge = "bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px]";
                          if (r.type === "Holiday") typeBadge = "bg-purple-100 text-purple-800 font-bold uppercase tracking-wider text-[10px]";
                          else if (r.type === "Leave") typeBadge = "bg-blue-100 text-blue-800 font-bold uppercase tracking-wider text-[10px]";

                          return (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                              <TableCell className="font-bold text-slate-700 px-6 py-4">{new Date(r.date).toLocaleDateString()}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="secondary" className={typeBadge}>{r.type}</Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-[#2A174E] py-4">{r.name}</TableCell>
                              <TableCell className="text-slate-600 italic pr-6 py-4">{r.details || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {currentData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">No calendar events found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {/* Pagination Controls */}
              {totalItems > 0 && !loading && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30 mt-auto">
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
        </div>

        {/* Global styling for custom scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar {
            height: 10px;
            width: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
          }
        `}} />
    </Sidebar>
  );
};

export default AdminReports;