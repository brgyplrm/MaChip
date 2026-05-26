import React, { useState } from "react";
import Sidebar from "../../../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit2, Eye, Pause, Search, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoanAdjustmentDialog from "@/components/LoanAdjustmentDialog";
import { useNavigate } from "react-router-dom";
import LoanDetails from "./LoanDetails";
import { Filter } from "lucide-react";
import GovLoans from "./GovLoans";
import { Link } from "react-router-dom";
import AssessmentIcon  from "@mui/icons-material/Assessment";


const loans = [
  { govtype: "PAG-IBIG", employee: "Cydoel Tomas", title: "Emergency Medical Advance", principal: 15000, paid: 7500, outstanding: 7500, progress: 50 },
  { govtype: "SSS", employee: "Michael Brown", title: "Laptop Co-Payment", principal: 25000, paid: 12000, outstanding: 13000, progress: 48 },
];

export default function LoanManagement() {
  const navigate = useNavigate();
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  const myLoan = {
  govtype: "PAG-IBIG",
  title: "Emergency Medical Advance",
  employee: "Cydoel Tomas",
  email: "cydtomas555@gmail.com",
  employeeId: "1"
};

  // --- Inside LoanManagement component ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Filtering Logic
  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          loan.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Ensure 'status' exists on your loan objects, or this will be undefined
    const matchesStatus = statusFilter === "ALL" || loan.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

// Update your Pagination Logic to use filteredLoans
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
          <Link to="/govloans">
            <Button className="bg-white hover:bg-[#BA90E9] hover:text-white hover:border-[#BA90E9] text-[#2A174E] border border-[#2A174E]">
              <AssessmentIcon className="mr-2 h-4 w-4" /> View Summary
            </Button>
          </Link>
          
          <Button onClick={() => setShowLoanModal(true)} className="bg-[#2A174E] hover:bg-[#1a0e30]">
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
                <p className="text-4xl font-bold text-[#2A174E]">{loans.length}</p>
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
                  ₱{loans.reduce((acc, curr) => acc + curr.principal, 0).toLocaleString()}
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
                  ₱{loans.reduce((acc, curr) => acc + curr.paid, 0).toLocaleString()}
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
                  ₱{loans.reduce((acc, curr) => acc + curr.outstanding, 0).toLocaleString()}
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
                    <SelectItem value="PAUSED">Paused</SelectItem>
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

        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg mb-4">
          <Button 
            size="sm" 
            variant={viewMode === 'table' ? 'default' : 'ghost'} 
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'bg-white text-[#2A174E] px-6 hover:bg-[#BA90E9] hover:text-white' : 'hover:bg-[#E2C6FC] hover:text-white'}
          >
            Table
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === 'grid' ? 'default' : 'ghost'} 
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-white text-[#2A174E] px-6 hover:bg-[#BA90E9] hover:text-white' : 'hover:bg-[#E2C6FC] hover:text-white'}
          >
            Grid
          </Button>
        </div>

        {viewMode === 'table' ? (
        <Card className="py-0">
          <CardHeader className="bg-[#2A174E] flex flex-row items-center justify-between pt-4 pb-4">
            <CardTitle className="text-white font-semibold">Active Loans</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
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
                {currentLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.id}</TableCell>
                    <TableCell>{loan.employee}</TableCell>
                    <TableCell>{loan.title}</TableCell>
                    <TableCell>₱{loan.principal.toLocaleString()}</TableCell>
                    <TableCell className="text-emerald-600">₱{loan.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-orange-600">₱{loan.outstanding.toLocaleString()}</TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={loan.progress} />
                        <span className="text-xs">{loan.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ACTIVE</Badge></TableCell>
                    <TableCell className="flex gap-0 text-muted-foreground justify-center">
                      <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)}>
                          <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate('/loanDetails')}
                        >
                        <Eye className="h-4 w-4 cursor-pointer hover:text-black" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentLoans.map(loan => (
            <Card key={loan.id} className="border border-slate-100 shadow-sm bg-white hover:shadow-md transition-all">
              <CardHeader className="bg-slate-50/50 pb-3.5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#2A174E]/10 rounded-lg text-[#2A174E]">
                    <Edit2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#2A174E]">{loan.employee}</h4>
                    <span className="text-xs font-mono text-slate-400">{loan.id}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigate('/loanDetails')}>
                  <Eye className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 uppercase">Title</span>
                  <span className="text-xs font-semibold">{loan.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 uppercase">Outstanding</span>
                  <span className="text-xs font-bold text-orange-600">₱{loan.outstanding.toLocaleString()}</span>
                </div>
                <Progress value={loan.progress} />
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