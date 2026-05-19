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

const loans = [
  { id: "LOAN-001", employee: "Cydoel Tomas", title: "Emergency Medical Advance", principal: 15000, paid: 7500, outstanding: 7500, progress: 50 },
  { id: "LOAN-002", employee: "Michael Brown", title: "Laptop Co-Payment", principal: 25000, paid: 12000, outstanding: 13000, progress: 48 },
];

export default function LM2() {
  const navigate = useNavigate();
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <Sidebar>
      <div className="p-2 md:p-8  min-h-screen w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Loan Management</h1>
            <p className="text-muted-foreground">Create and manage custom employee loans dynamically</p>
          </div>
          <Button onClick={() => setShowLoanModal(true)} className="bg-[#2A174E] hover:bg-[#1a0e30]">
            <Plus className="mr-2 h-4 w-4" /> Create Custom Loan
          </Button>
        </div>

        {/* Stats Grid - Kept as is */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Loans", value: "2" },
            { label: "Active Loans", value: "2", color: "text-emerald-600" },
            { label: "Total Disbursed", value: "₱40,000" },
            { label: "Total Collected", value: "₱19,500", color: "text-emerald-600" },
            { label: "Outstanding", value: "₱20,500", color: "text-orange-500" },
          ].map((stat, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${stat.color || ""}`}>{stat.value}</p></CardContent>
            </Card>
          ))}
        </div>

        {/* Table Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Loans</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search loans..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LOAN ID</TableHead>
                  <TableHead>EMPLOYEE</TableHead>
                  <TableHead>LOAN TITLE</TableHead>
                  <TableHead>PRINCIPAL</TableHead>
                  <TableHead>PAID</TableHead>
                  <TableHead>OUTSTANDING</TableHead>
                  <TableHead>PROGRESS</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>ACTIONS</TableHead>
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
                    <TableCell className="flex gap-2 text-muted-foreground">
                        <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)}>
                            <Edit2 className="h-4 w-4" />
                        </Button>
                      <Button variant="ghost" size="icon">
                            <Pause className="h-4 w-4" />
                        </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/loanMan2 /${loan.id}`)}
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