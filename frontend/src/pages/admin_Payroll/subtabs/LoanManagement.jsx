import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit2, Eye, Pause, Search, Plus, X, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoanAdjustmentDialog from "@/components/LoanAdjustmentDialog";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import AssessmentIcon  from "@mui/icons-material/Assessment";
import { fetchWithAuth } from "../../../utils/api";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";

export default function LoanManagement() {
  const navigate = useNavigate();
  const [activeLoans, setActiveLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/payroll/loans/active");
      if (res.ok) {
        const data = await res.json();
        setActiveLoans(data);
      }
    } catch (err) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Filtering Logic
  const filteredLoans = useMemo(() => {
    return activeLoans.filter(loan => {
      const query = searchQuery.toLowerCase().trim();
      const empName = (loan.employee || "").toLowerCase();
      const loanTitle = (loan.title || "").toLowerCase();
      const govType = (loan.govtype || "").toLowerCase();
      const empIdStr = loan.employeeId ? `macj-${String(loan.employeeId).padStart(3, '0')}`.toLowerCase() : "";

      const matchesSearch = !query || 
        empName.includes(query) || 
        loanTitle.includes(query) ||
        govType.includes(query) ||
        empIdStr.includes(query);
      
      const matchesStatus = statusFilter === "ALL" || (loan.status || "").toUpperCase() === statusFilter.toUpperCase();
      
      let matchesType = true;
      if (typeFilter !== "ALL") {
        const govTypeUpper = (loan.govtype || "").toUpperCase();

        switch (typeFilter) {
          case "SSS_CALAMITY":
            matchesType = govTypeUpper.includes("SSS") && govTypeUpper.includes("CALAMITY");
            break;
          case "SSS_SALARY":
            matchesType = govTypeUpper.includes("SSS") && (govTypeUpper.includes("SALARY") || govTypeUpper.includes("SAL"));
            break;
          case "SSS_EMERGENCY":
            matchesType = govTypeUpper.includes("SSS") && govTypeUpper.includes("EMERGENCY");
            break;
          case "PAGIBIG_CALAMITY":
            matchesType = (govTypeUpper.includes("PAG-IBIG") || govTypeUpper.includes("PAGIBIG") || govTypeUpper.includes("HDMF")) && govTypeUpper.includes("CALAMITY");
            break;
          case "PAGIBIG_MPL":
            matchesType = (govTypeUpper.includes("PAG-IBIG") || govTypeUpper.includes("PAGIBIG") || govTypeUpper.includes("HDMF")) && (govTypeUpper.includes("MPL") || govTypeUpper.includes("MULTI"));
            break;
          default:
            matchesType = govTypeUpper === typeFilter.toUpperCase() || govTypeUpper.includes(typeFilter.toUpperCase());
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [activeLoans, searchQuery, statusFilter, typeFilter]);

  const stats = {
    totalLoans: activeLoans.length,
    totalDisbursed: activeLoans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0),
    totalCollected: activeLoans.reduce((sum, l) => sum + parseFloat(l.paid || 0), 0),
    outstanding: activeLoans.reduce((sum, l) => sum + parseFloat(l.outstanding || 0), 0),
  };

  // Group active loans by employee for grid view
  const groupedGridLoans = useMemo(() => {
    const groups = {};
    filteredLoans.forEach(loan => {
      const empId = loan.employeeId;
      if (!groups[empId]) {
        groups[empId] = {
          employeeId: empId,
          employeeName: loan.employee,
          loans: [],
          loanTypes: new Set(),
          totalPrincipal: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        };
      }
      groups[empId].loans.push(loan);
      groups[empId].loanTypes.add(loan.govtype);
      groups[empId].totalPrincipal += parseFloat(loan.principal || 0);
      groups[empId].totalPaid += parseFloat(loan.paid || 0);
      groups[empId].totalOutstanding += parseFloat(loan.outstanding || 0);
    });

    return Object.values(groups).map(group => {
      const overallProgress = group.totalPrincipal > 0 
        ? Math.round((group.totalPaid / group.totalPrincipal) * 100) 
        : 0;
      return {
        ...group,
        loanTypes: Array.from(group.loanTypes),
        overallProgress
      };
    });
  }, [filteredLoans]);

  const totalItems = viewMode === "table" ? filteredLoans.length : groupedGridLoans.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLoans = viewMode === "table" 
    ? filteredLoans.slice(startIndex, endIndex)
    : groupedGridLoans.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4  min-h-screen w-full max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        {/* Header Text Group */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">Government Loans</h1>
          <span className="text-sm text-slate-500 mt-1 block">Manage loan records - view details, make adjustments, or close loans</span>
        </div>

        {/* Button Group: These will now stay together on the right */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full md:w-auto">
                <Button 
                  variant="outline" 
                  asChild
                  className="w-full border-brand-primary/20 hover:text-brand-primary text-brand-primary/70 font-semibold shadow-sm transition-all"
                >
                  <Link 
                    to="/govloans" 
                    state={{ activeTab: "requests" }}
                  >
                  <AssessmentIcon className="mr-2 h-4 w-4" /> View Summary
                  </Link>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800">
              View consolidated loan statistics and request history
            </TooltipContent>
          </Tooltip>
          
          {/* <Button onClick={() => setShowLoanModal(true)} className="bg-brand-primary hover:bg-[#7A52B5]">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Loan
          </Button> */}
        </div>
      </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-8 w-full">
          
          {/* Card 1: Total Loans */}
          <Card className="border-t-5 border-brand-primary bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">Total Loans</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-brand-primary/60 hover:text-brand-primary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Total number of active loan contracts.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-4xl font-bold text-brand-primary">{loading ? "..." : stats.totalLoans}</p>
              </div>
              <p className="text-xs text-brand-primary/70 italic mt-4">Total loan agreements created</p>
            </CardContent>
          </Card>


          {/* Card 3: Total Disbursed */}
          <Card className="border-t-5 border-accent-gold bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-accent-gold uppercase tracking-wider">Total Disbursed</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-gold/60 hover:text-accent-gold cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Cumulative initial principal amount lent to employees.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-4xl font-bold text-accent-gold">
                  {loading ? "₱0.00" : `₱${stats.totalDisbursed.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-accent-gold/70 italic mt-4">Cumulative loan principal amount</p>
            </CardContent>
          </Card>

          {/* Card 4: Total Collected */}
          <Card className="border-t-5 border-accent-green bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-accent-green uppercase tracking-wider">Total Collected</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-accent-green/60 hover:text-accent-green cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Total cumulative repayments collected from employees.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-4xl font-bold text-accent-green">
                  {loading ? "₱0.00" : `₱${stats.totalCollected.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-accent-green/70 italic mt-4">Total payments received</p>
            </CardContent>
          </Card>

          {/* Card 5: Outstanding */}
          <Card className="border-t-5 border-status-danger bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold text-status-danger uppercase tracking-wider">Outstanding</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-status-danger/60 hover:text-status-danger cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                      Remaining unpaid loan balance.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-4xl font-bold text-status-danger">
                  {loading ? "₱0.00" : `₱${stats.outstanding.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-status-danger/70 italic mt-4">Remaining balance to collect</p>
            </CardContent>
          </Card>

        </div>

        {/* Filter Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            
            {/* Search Bar */}
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search employee or loan title..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10 border-slate-200 focus-visible:ring-brand-primary w-full"
              />
            </div>
            
            {/* Dropdown Filters and Clear Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              
              {/* Gov Type Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[175px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700">
                    <SelectValue placeholder="Filter by Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="font-bold text-xs uppercase tracking-wider text-brand-primary px-2 py-1.5">
                        SSS
                      </SelectLabel>
                      <SelectItem value="SSS_CALAMITY">Calamity Loan</SelectItem>
                      <SelectItem value="SSS_SALARY">Salary</SelectItem>
                      <SelectItem value="SSS_EMERGENCY">Emergency</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="font-bold text-xs uppercase tracking-wider text-brand-primary px-2 py-1.5">
                        Pag-ibig
                      </SelectLabel>
                      <SelectItem value="PAGIBIG_CALAMITY">Calamity</SelectItem>
                      <SelectItem value="PAGIBIG_MPL">MPL</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditionally Rendered Clear Button */}
              {(searchQuery !== "" || statusFilter !== "ALL" || typeFilter !== "ALL") && (
                <Button 
                  variant="ghost" 
                  onClick={() => { 
                    setSearchQuery(""); 
                    setStatusFilter("ALL"); 
                    setTypeFilter("ALL");
                    setCurrentPage(1); 
                  }}
                  className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Layout View Switcher */}
        <div className="mb-4 flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            onClick={() => { setViewMode("table"); setCurrentPage(1); }}
            className={`h-7 text-xs font-bold transition-all px-4 ${
              viewMode === "table" 
                ? "bg-white text-brand-primary shadow-sm hover:bg-white" 
                : "text-slate-500 hover:text-brand-primary"
            }`}
          >
            Table Mode
          </Button>
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            onClick={() => { setViewMode("grid"); setCurrentPage(1); }}
            className={`h-7 text-xs font-bold transition-all px-4 ${
              viewMode === "grid" 
                ? "bg-white text-brand-primary shadow-sm hover:bg-white" 
                : "text-slate-500 hover:text-brand-primary"
            }`}
          >
            Grid Mode
          </Button>
        </div>

        {viewMode === 'table' ? (
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          {/* <CardHeader className="bg-brand-primary flex flex-row items-center justify-between pt-4 pb-4">
            <CardTitle className="text-white font-semibold">Active Loans</CardTitle>
          </CardHeader> */}
          <CardContent className="p-0 flex flex-col">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-brand-primary">
                  <TableRow className="bg-brand-primary text-white hover:bg-brand-primary">
                    <TableHead className="font-semibold text-white py-4 pl-6 uppercase text-xs tracking-wider">GOV TYPE</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">LOAN TITLE</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PRINCIPAL</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PAID</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">OUTSTANDING</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">PROGRESS</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">STATUS</TableHead>
                    <TableHead className="font-semibold text-white py-4 pr-6 text-center uppercase text-xs tracking-wider">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500 animate-pulse">Syncing loan database...</TableCell>
                    </TableRow>
                  ) : currentLoans.length > 0 ? (
                    currentLoans.map((loan) => (
                      <TableRow key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-[11px] text-brand-primary pl-6">
                          <Badge variant="outline" className="border-brand-primary/20 text-brand-primary bg-brand-primary/5 rounded uppercase">
                            {loan.govtype}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-brand-primary">{loan.employee}</span>
                            <span className="text-[10px] text-slate-400 font-mono">MACJ-{String(loan.employeeId).padStart(3, '0')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs font-medium text-slate-600 text-left">{loan.title || "No Title"}</TableCell>
                        <TableCell className="font-bold">₱{parseFloat(loan.principal || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">₱{parseFloat(loan.paid || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-rose-600 font-bold">₱{parseFloat(loan.outstanding || 0).toLocaleString()}</TableCell>
                        <TableCell className="w-40">
                          <div className="flex items-center gap-2">
                            <Progress value={loan.progress} className="h-1.5" />
                            <span className="text-[10px] font-black text-brand-primary">{loan.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={loan.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-700"}>
                            {loan.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex text-muted-foreground justify-center pr-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => navigate(`/loanDetails/${loan.id}`)}
                                  className="border-brand-primary/20 text-brand-primary hover:bg-brand-primary-light hover:border-brand-primary/40"
                                  >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                              View Ledger
                            </TooltipContent>
                          </Tooltip>

                          {/* <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)} className="border-[#B8551F]/40 text-[#B8551F] hover:bg-[#FEE0C0] hover:border-[#E18C52]">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                              Adjust Loan
                            </TooltipContent>
                          </Tooltip> */}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-400 italic">No loan records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Table Pagination */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={filteredLoans.length}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="loans"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {loading ? (
               <div className="col-span-full h-32 flex items-center justify-center text-slate-500 animate-pulse">Loading loan dashboard...</div>
            ) : currentLoans.map(group => (
              <Card key={group.employeeId} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden text-left">
                
                {/* Card Header Profile Block */}
                <CardHeader className="bg-slate-50/60 pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3 truncate mr-2">
                    <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary shrink-0">
                      <Edit2 className="h-4 w-4" />
                    </div>
                    <div className="truncate text-left">
                      <h4 className="text-sm font-bold text-brand-primary truncate">{group.employeeName}</h4>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5 block">MACJ-{String(group.employeeId).padStart(3, '0')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                    {group.loanTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] font-black px-1.5 py-0 border-brand-primary/20 text-brand-primary bg-brand-primary/5 rounded">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>

                {/* Card Body Core Parameters */}
                <CardContent className="p-5 space-y-4 flex-1 text-left">
                  
                  {/* Secondary 3-Column Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Principal</span>
                      <span className="text-xs font-bold text-slate-700 block truncate mt-0.5">
                        ₱{group.totalPrincipal.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Paid</span>
                      <span className="text-xs font-bold text-emerald-600 block truncate mt-0.5">
                        ₱{group.totalPaid.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Outstanding</span>
                      <span className="text-xs font-bold text-orange-600 block truncate mt-0.5">
                        ₱{group.totalOutstanding.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Amortization Completion Progress Gauge */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-slate-500">Overall Progress</span>
                      <span className="text-slate-800 font-bold">{group.overallProgress}%</span>
                    </div>
                    <Progress value={group.overallProgress} className="h-1.5 bg-slate-100" />
                  </div>

                  {/* List of Individual Loans */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Individual Loans</span>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {group.loans.map((subLoan) => (
                        <div key={subLoan.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100/70 transition-colors">
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-brand-primary text-[11px] shrink-0">{subLoan.govtype}</span>
                              <span className="text-slate-500 truncate text-[10px]">{subLoan.title || "No Title"}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                              Bal: ₱{parseFloat(subLoan.outstanding || 0).toLocaleString()} / ₱{parseFloat(subLoan.principal || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-brand-primary rounded-full"
                                  onClick={() => navigate(`/loanDetails/${subLoan.id}`)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-[10px]">
                                View Ledger
                              </TooltipContent>
                            </Tooltip>
                            {/* <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-[#B8551F] rounded-full"
                                  onClick={() => setShowEditModal(true)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 text-[10px]">
                                Adjust Loan
                              </TooltipContent>
                            </Tooltip> */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>

          {/* Card Grid Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            totalItems={groupedGridLoans.length}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            startIndex={startIndex}
            endIndex={endIndex}
            itemLabel="employees"
          />
        </>
      )}

        {/* Edit Modal */}
        <LoanAdjustmentDialog 
           isOpen={showEditModal} 
           onClose={() => setShowEditModal(false)} 
        />

        {/* Loan Creation Modal */}
        <Dialog open={showLoanModal} onOpenChange={setShowLoanModal}>
          <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden border-0 shadow-2xl">
            <DialogHeader className="bg-brand-primary text-white p-6 relative">
              <DialogTitle className="text-xl font-bold">Create Custom Loan</DialogTitle>
              <DialogDescription className="text-purple-200">Set up a new employee loan agreement.</DialogDescription>
              <button onClick={() => setShowLoanModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
            </DialogHeader>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                  <SelectContent><SelectItem value="cydoel">Cydoel Tomas</SelectItem><SelectItem value="michael">Michael Brown</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Loan Title/Label *</Label><Input placeholder="e.g. Emergency Cash Advance" /></div>
                <div className="space-y-2"><Label>Disbursement Date *</Label><Input type="date" /></div>
              </div>

              <div className="space-y-4 border p-4 rounded-lg bg-slate-50">
                <h3 className="font-bold text-sm text-slate-700">Financial Terms</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Principal Amount (₱) *</Label><Input type="number" placeholder="0.00" /></div>
                  <div className="space-y-2"><Label>Interest Rate (%)</Label><Input type="number" placeholder="0" /></div>
                </div>
                <div className="flex gap-4 items-center">
                  <Label>Interest Type:</Label>
                  <div className="flex items-center gap-2"><input type="radio" name="interest" /> Flat Rate</div>
                  <div className="flex items-center gap-2"><input type="radio" name="interest" /> Diminishing</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Number of Periods *</Label><Input type="number" placeholder="6" /></div>
                <div className="space-y-2"><Label>Deduction Frequency</Label>
                  <Select>
                      <SelectTrigger><SelectValue placeholder="Every Payroll Run" /></SelectTrigger>
                      <SelectContent><SelectItem value="payroll">Every Payroll Run</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowLoanModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-brand-primary text-white hover:bg-brand-primary-hover">Create Loan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
    </Sidebar>
  );
}
