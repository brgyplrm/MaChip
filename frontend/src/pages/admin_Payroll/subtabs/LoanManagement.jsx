import React, { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoanAdjustmentDialog from "@/components/LoanAdjustmentDialog";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import AssessmentIcon  from "@mui/icons-material/Assessment";
import { fetchWithAuth } from "../../../utils/api";

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

  // Filtering Logic
  const filteredLoans = activeLoans.filter(loan => {
    const matchesSearch = 
      loan.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (loan.title && loan.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      loan.govtype.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || loan.status.toUpperCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalLoans: activeLoans.length,
    totalDisbursed: activeLoans.reduce((sum, l) => sum + parseFloat(l.principal || 0), 0),
    totalCollected: activeLoans.reduce((sum, l) => sum + parseFloat(l.paid || 0), 0),
    outstanding: activeLoans.reduce((sum, l) => sum + parseFloat(l.outstanding || 0), 0),
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredLoans.length);
  const currentLoans = filteredLoans.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <div className="p-2 md:p-4  min-h-screen w-full max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        {/* Header Text Group */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Government Loans</h1>
          <span className="text-sm text-slate-500 mt-1 block">Manage loan records - view details, make adjustments, or close loans</span>
        </div>

        {/* Button Group: These will now stay together on the right */}
        <div className="flex items-center gap-2">
          <Button 
              variant="outline" 
              asChild
              className="w-full md:w-auto border-[#2A174E]/20 hover:text-[#2A174E] text-[#2A174E]/70 font-semibold shadow-sm transition-all"
            >
              <Link 
                to="/govloans" 
                state={{ activeTab: "requests" }}
              >
              <AssessmentIcon className="mr-2 h-4 w-4" /> View Summary
              </Link>
            </Button>
          
          <Button onClick={() => setShowLoanModal(true)} className="bg-[#2A174E] hover:bg-[#7A52B5]">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Loan
          </Button>
        </div>
      </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-8 w-full">
          
          {/* Card 1: Total Loans */}
          <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Loans</p>
                <p className="text-4xl font-bold text-[#2A174E]">{loading ? "..." : stats.totalLoans}</p>
              </div>
              <p className="text-xs text-[#2A174E]/70 italic mt-4">Total loan agreements created</p>
            </CardContent>
          </Card>


          {/* Card 3: Total Disbursed */}
          <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Total Disbursed</p>
                <p className="text-4xl font-bold text-[#BB8B26]">
                  {loading ? "₱0.00" : `₱${stats.totalDisbursed.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-[#BB8B26]/70 italic mt-4">Cumulative loan principal amount</p>
            </CardContent>
          </Card>

          {/* Card 4: Total Collected */}
          <Card className="border-t-5 border-[#174e4e] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#174e4e] uppercase tracking-wider mb-2">Total Collected</p>
                <p className="text-4xl font-bold text-[#174e4e]">
                  {loading ? "₱0.00" : `₱${stats.totalCollected.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-[#174e4e]/70 italic mt-4">Total payments received</p>
            </CardContent>
          </Card>

          {/* Card 5: Outstanding */}
          <Card className="border-t-5 border-[#a12626] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#a12626] uppercase tracking-wider mb-2">Outstanding</p>
                <p className="text-4xl font-bold text-[#a12626]">
                  {loading ? "₱0.00" : `₱${stats.outstanding.toLocaleString()}`}
                </p>
              </div>
              <p className="text-xs text-[#a12626]/70 italic mt-4">Remaining balance to collect</p>
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
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            {/* Dropdown Filters and Clear Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              
              {/* Status Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="text-slate-400 h-5 w-5 hidden sm:block" />
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
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
              {(searchQuery !== "" || statusFilter !== "ALL") && (
                <Button 
                  variant="ghost" 
                  onClick={() => { 
                    setSearchQuery(""); 
                    setStatusFilter("ALL"); 
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
            onClick={() => setViewMode("table")}
            className={`h-7 text-xs font-bold transition-all px-4 ${
              viewMode === "table" 
                ? "bg-white text-[#2A174E] shadow-sm hover:bg-white" 
                : "text-slate-500 hover:text-[#2A174E]"
            }`}
          >
            Table Mode
          </Button>
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            onClick={() => setViewMode("grid")}
            className={`h-7 text-xs font-bold transition-all px-4 ${
              viewMode === "grid" 
                ? "bg-white text-[#2A174E] shadow-sm hover:bg-white" 
                : "text-slate-500 hover:text-[#2A174E]"
            }`}
          >
            Grid Mode
          </Button>
        </div>

        {viewMode === 'table' ? (
        <Card className="py-0">
          <CardHeader className="bg-[#2A174E] flex flex-row items-center justify-between pt-4 pb-4">
            <CardTitle className="text-white font-semibold">Active Loans</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">GOV TYPE</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4  uppercase text-xs tracking-wider">EMPLOYEE</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">LOAN TITLE</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">PRINCIPAL</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">PAID</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">OUTSTANDING</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">PROGRESS</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4  uppercase text-xs tracking-wider">STATUS</TableHead>
                    <TableHead className="font-semibold text-[#2A174E] py-4  pl-10 uppercase text-xs tracking-wider">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500 animate-pulse">Syncing loan database...</TableCell>
                    </TableRow>
                  ) : currentLoans.length > 0 ? (
                    currentLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-bold text-[11px] text-[#2A174E]">
                          <Badge variant="outline" className="border-[#2A174E]/20 text-[#2A174E] bg-[#2A174E]/5 rounded uppercase">
                            {loan.govtype}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-[#2A174E]">{loan.employee}</span>
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
                            <span className="text-[10px] font-black text-[#2A174E]">{loan.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={loan.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-700"}>
                            {loan.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-1 text-muted-foreground justify-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate(`/loanDetails/${loan.id}`)}
                            className="border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0]"
                            title="View Ledger"
                            >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)} className="border-[#B8551F]/40 text-[#B8551F] hover:bg-[#FEE0C0] hover:border-[#E18C52]">
                              <Edit2 className="h-4 w-4" />
                          </Button>
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
            {filteredLoans.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 gap-4 bg-slate-50/30">
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline">Rows per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="font-medium">
                  Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{filteredLoans.length}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                <div className="w-8 h-8 flex items-center justify-center font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">{currentPage}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {loading ? (
             <div className="col-span-full h-32 flex items-center justify-center text-slate-500 animate-pulse">Loading loan dashboard...</div>
          ) : currentLoans.map(loan => (
            <Card key={loan.id} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden text-left">
              
              {/* Card Header Profile Block */}
              <CardHeader className="bg-slate-50/60 pb-3.5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3 truncate mr-2">
                  <div className="p-2 bg-[#2A174E]/10 rounded-lg text-[#2A174E] shrink-0">
                    <Edit2 className="h-4 w-4" />
                  </div>
                  <div className="truncate text-left">
                    <h4 className="text-sm font-bold text-[#2A174E] truncate">{loan.employee}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono font-semibold text-slate-400">MACJ-{String(loan.employeeId).padStart(3, '0')}</span>
                      <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0 border-[#2A174E]/20 text-[#2A174E] bg-[#2A174E]/5 rounded">
                        {loan.govtype}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Main Upper Right Action Trigger */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(`/loanDetails/${loan.id}`)}
                  className="text-slate-400 hover:text-[#2A174E] hover:bg-[#2A174E]/5 rounded-full shrink-0"
                  title="View Ledger"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </CardHeader>

              {/* Card Body Core Parameters */}
              <CardContent className="p-5 space-y-4 flex-1 text-left">
                
                {/* Loan Description Detail Banner */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Agreement Label</span>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">{loan.title || "No Title Provided"}</span>
                </div>

                {/* Secondary 3-Column Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Principal</span>
                    <span className="text-xs font-bold text-slate-700 block truncate mt-0.5">
                      ₱{parseFloat(loan.principal || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Paid</span>
                    <span className="text-xs font-bold text-emerald-600 block truncate mt-0.5">
                      ₱{parseFloat(loan.paid || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">Outstanding</span>
                    <span className="text-xs font-bold text-orange-600 block truncate mt-0.5">
                      ₱{parseFloat(loan.outstanding || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Amortization Completion Progress Gauge */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-slate-500">Amortization Progress</span>
                    <span className="text-slate-800 font-bold">{loan.progress}%</span>
                  </div>
                  <Progress value={loan.progress} className="h-1.5 bg-slate-100" />
                </div>

                {/* Lower Card Control Segment Block */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">State:</span>
                    <Badge variant="secondary" className={`${loan.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-slate-100 text-slate-600"} text-[10px] font-bold px-2 py-0.5 rounded-full border`}>
                      {loan.status.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Inline Cell Modifier Tools Group */}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowEditModal(true)}
                      className="h-8 text-xs font-semibold px-2.5 text-slate-500 hover:text-[#2A174E] hover:bg-slate-100"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Adjust
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

        {/* Edit Modal */}
        <LoanAdjustmentDialog 
           isOpen={showEditModal} 
           onClose={() => setShowEditModal(false)} 
        />

        {/* Loan Creation Modal */}
        <Dialog open={showLoanModal} onOpenChange={setShowLoanModal}>
          <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden border-0 shadow-2xl">
            <DialogHeader className="bg-[#2A174E] text-white p-6 relative">
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
                <Button className="flex-1 bg-[#2A174E] text-white hover:bg-[#1a0e30]">Create Loan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Sidebar>
  );
}
