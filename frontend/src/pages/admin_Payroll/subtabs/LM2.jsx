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

const loans = [
  { id: "LOAN-001", employee: "Cydoel Tomas", title: "Emergency Medical Advance", principal: 15000, paid: 7500, outstanding: 7500, progress: 50 },
  { id: "LOAN-002", employee: "Michael Brown", title: "Laptop Co-Payment", principal: 25000, paid: 12000, outstanding: 13000, progress: 48 },
];

export default function LM2() {
  const navigate = useNavigate();
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const myLoan = {
  id: "LOAN-001",
  title: "Emergency Medical Advance",
  employee: "Cydoel Tomas",
  email: "cydtomas555@gmail.com",
  employeeId: "1"
};

  return (
    <Sidebar>
      <div className="p-2 md:p-4  min-h-screen w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Loan Management Hub</h1>
            <span className="text-sm text-slate-500 mt-1 block">Manage loan records - view details, make adjustments, or close loans</span>
          </div>
          <Button onClick={() => setShowLoanModal(true)} className="bg-[#2A174E] hover:bg-[#1a0e30]">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Loan
          </Button>
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

        {/* Table Section */}
        <Card className="py-0">
          <CardHeader className="bg-[#2A174E] flex flex-row items-center justify-between pt-4 pb-4">
            <CardTitle className="text-white font-semibold">Active Loans</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#2A174E]" />
              <Input placeholder="Search loans..." className="pl-8 text-[#2A174E] bg-white border-white" />
            </div>
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
                {loans.map((loan) => (
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
                    <TableCell className="flex gap-0 text-muted-foreground">
                      <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)}>
                          <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                          <Pause className="h-4 w-4" />
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
          </CardContent>
        </Card>

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