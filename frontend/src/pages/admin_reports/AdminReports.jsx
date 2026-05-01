import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PaymentsIcon from "@mui/icons-material/Payments";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
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

  const handleCSVExport = () => {
    let dataToExport = [];
    let filename = `${activeReport}_report_${startDate}_to_${endDate}.csv`;
    let headers = [];

    if (activeReport === "attendance") {
      headers = ["Employee MaChip ID", "Employee Name", "Date", "Time In", "Time Out", "Hours Worked", "Status", "Remarks"];
      dataToExport = attendanceData.map(r => [r.machipId, r.userName, r.log_Date, r.time_In, r.time_Out, r.hoursWorked, r.status, r.remarks]);
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

  const stats = attendanceData.reduce((acc, curr) => {
    if (curr.status === "On-Time") acc.present++;
    else if (curr.status === "Late") { acc.present++; acc.late++; }
    else if (curr.status === "Absent") acc.absent++;
    acc.totalHours += parseFloat(curr.hoursWorked) || 0;
    return acc;
  }, { present: 0, absent: 0, late: 0, totalHours: 0 });

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <div className="flex-1 p-4 md:p-8 w-full overflow-x-hidden min-w-0">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Reports & Export</h1>
            <span className="text-sm text-muted-foreground mt-1 block">Generate and export attendance and payroll</span>
          </div>
          <Button onClick={handleCSVExport} className="w-full md:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]">
            <FileDownloadIcon className="mr-2 h-4 w-4" /> CSV Export
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-3 mb-6 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
          <Button 
            variant={activeReport === "attendance" ? "default" : "ghost"} 
            className={activeReport === "attendance" ? "bg-[#2A174E] text-white hover:bg-[#1a0e30]" : "text-slate-600 hover:bg-slate-100"}
            onClick={() => setActiveReport("attendance")}
          >
            <AssessmentIcon className="mr-2 h-4 w-4" /> Attendance Report
          </Button>
          <Button 
            variant={activeReport === "payroll" ? "default" : "ghost"} 
            className={activeReport === "payroll" ? "bg-[#2A174E] text-white hover:bg-[#1a0e30]" : "text-slate-600 hover:bg-slate-100"}
            onClick={() => setActiveReport("payroll")}
          >
            <PaymentsIcon className="mr-2 h-4 w-4" /> Payroll Report
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="mb-6 shadow-sm border-0">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
              <FilterListIcon className="h-5 w-5" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {(activeReport === "payroll" || activeReport === "attendance") && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Payroll Period</label>
                  <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="bg-white">
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
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">Date From</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">Date To</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white" />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="bg-white">
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
        <Card className="shadow-sm border-0">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">Loading records...</div>
            ) : (
              <>
                {/* Attendance Report View */}
                {activeReport === "attendance" && (
                  <>
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold text-slate-800">Attendance Records</h3>
                      <span className="text-sm text-slate-500">Showing {attendanceData.length} records from {startDate} to {endDate}</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead>EMP ID</TableHead>
                            <TableHead>EMPLOYEE NAME</TableHead>
                            <TableHead>DATE</TableHead>
                            <TableHead>TIME IN</TableHead>
                            <TableHead>TIME OUT</TableHead>
                            <TableHead>HOURS</TableHead>
                            <TableHead>STATUS</TableHead>
                            <TableHead>REMARKS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceData.map((r, i) => {
                            let badgeStyle = "bg-slate-100 text-slate-800";
                            if (r.status === "On-Time") badgeStyle = "bg-green-100 text-green-800";
                            else if (r.status === "Late") badgeStyle = "bg-amber-100 text-amber-800";
                            else if (r.status === "Absent") badgeStyle = "bg-red-100 text-red-800";

                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{formatUserId(r.user_Id)}</TableCell>
                                <TableCell>{r.userName}</TableCell>
                                <TableCell>{new Date(r.log_Date).toLocaleDateString()}</TableCell>
                                <TableCell>{r.time_In}</TableCell>
                                <TableCell>{r.time_Out}</TableCell>
                                <TableCell>{r.hoursWorked}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={badgeStyle}>{r.status}</Badge>
                                </TableCell>
                                <TableCell className="text-slate-500 italic max-w-[200px] truncate">{r.remarks}</TableCell>
                              </TableRow>
                            );
                          })}
                          {attendanceData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No records found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Summary Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50/50 border-t border-slate-100">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <label className="text-sm font-semibold text-slate-500 uppercase">Total Present</label>
                        <p className="text-2xl font-bold text-green-600 mt-1">{stats.present}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <label className="text-sm font-semibold text-slate-500 uppercase">Total Absent</label>
                        <p className="text-2xl font-bold text-red-500 mt-1">{stats.absent}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <label className="text-sm font-semibold text-slate-500 uppercase">Total Late</label>
                        <p className="text-2xl font-bold text-amber-500 mt-1">{stats.late}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <label className="text-sm font-semibold text-slate-500 uppercase">Total Hours</label>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalHours.toFixed(1)} <span className="text-sm font-normal text-slate-500">hrs</span></p>
                      </div>
                    </div>
                  </>
                )}

                {/* Payroll Report View */}
                {activeReport === "payroll" && (
                  <>
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Payroll Records</h3>
                        <span className="text-sm text-slate-500">Payroll data from {startDate} to {endDate}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={handleBatchExport}
                        disabled={payrollData.length === 0}
                        className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 w-full sm:w-auto"
                      >
                        <FileDownloadIcon className="mr-2 h-4 w-4" /> Batch ZIP Export
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[1200px]">
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead>EMP ID</TableHead>
                            <TableHead>EMPLOYEE NAME</TableHead>
                            <TableHead>PERIOD</TableHead>
                            <TableHead>DAYS/HOURS</TableHead>
                            <TableHead>RATE/HR</TableHead>
                            <TableHead>BASIC PAY</TableHead>
                            <TableHead>EARNINGS</TableHead>
                            <TableHead>DEDUCTIONS</TableHead>
                            <TableHead>NET PAY</TableHead>
                            <TableHead>STATUS</TableHead>
                            <TableHead className="text-right pr-6">ACTIONS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollData.map((r, i) => {
                            let badgeStyle = "bg-slate-100 text-slate-800";
                            if (r.statusName === "Paid") badgeStyle = "bg-green-100 text-green-800";
                            else if (r.statusName === "Processed") badgeStyle = "bg-blue-100 text-blue-800";
                            
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{formatUserId(r.user_Id)}</TableCell>
                                <TableCell>{r.user_FirstName} {r.user_LastName}</TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                  {new Date(r.period_Start).toLocaleDateString()} - {new Date(r.period_End).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{r.NoDays_Worked}d / {r.NoHrs_Worked}h</TableCell>
                                <TableCell>₱{r.ratePerHr}</TableCell>
                                <TableCell>₱{r.basicPay.toLocaleString()}</TableCell>
                                <TableCell className="text-green-600 font-semibold">₱{r.totalEarnings.toLocaleString()}</TableCell>
                                <TableCell className="text-red-500 font-semibold">₱{r.totalDeductions.toLocaleString()}</TableCell>
                                <TableCell className="font-bold text-slate-900">₱{r.netPay.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={badgeStyle}>{r.statusName}</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button variant="ghost" size="icon" asChild className="text-[#2A174E] hover:bg-[#f0ebfa]">
                                    <Link title="View Payslip" to={`/adminReports/payslip/${r.payrollId}`} state={{ fromTab: activeReport }}>
                                      <ReceiptLongIcon className="h-5 w-5" />
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {payrollData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">No records found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
    </Sidebar>
  );
};

export default AdminReports;