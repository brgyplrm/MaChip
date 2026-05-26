import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Pencil, Pause, CheckCircle2, User, FileText, Clock, DollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Sidebar from "../../../components/Sidebar";
import { useState } from "react";


export default function LoanDetailsPage() {
    const loan = {
        id: "LOAN-001",
        title: "Emergency Medical Advance",
        employee: "John Doe",
        email: "john.doe@example.com",
        employeeId: "EMP-001",
        principal: 15000,
        paid: 7500,
        outstanding: 7500,
        progress: 50,
        amortization: [
            { id: 1, number: 1, periodId: "PERIOD-001", dueDate: "6/15/2026", principal: 2500, total: 2500, remaining: 12500, status: "PAID" },
            { id: 2, number: 2, periodId: "PERIOD-002", dueDate: "7/15/2026", principal: 2500, total: 2500, remaining: 10000, status: "PAID" },
            { id: 3, number: 3, periodId: "PERIOD-003", dueDate: "8/15/2026", principal: 2500, total: 2500, remaining: 7500, status: "PAID" },
            { id: 4, number: 4, periodId: "PERIOD-004", dueDate: "9/15/2026", principal: 2500, total: 2500, remaining: 5000, status: "PENDING" },
            { id: 5, number: 5, periodId: "PERIOD-005", dueDate: "10/15/2026", principal: 2500, total: 2500, remaining: 2500, status: "PENDING" },
            { id: 6, number: 6, periodId: "PERIOD-006", dueDate: "11/15/2026", principal: 2500, total: 2500, remaining: 0, status: "PENDING" },
        ],
        history: [
            { id: "PAY-001", period: "PERIOD-001", date: "6/15/2026", amount: 2500, method: "Payroll Deduction" },
            { id: "PAY-002", period: "PERIOD-002", date: "7/15/2026", amount: 2500, method: "Payroll Deduction" },
            { id: "PAY-003", period: "PERIOD-003", date: "8/15/2026", amount: 2500, method: "Payroll Deduction" },
        ]
    };

    function MetricCard({ label, value, color, description }) {
    return (
        <Card className={`border-t-5 border-${color} bg-white py-0 h-full`}>
        <CardContent className="px-5 p-5 flex flex-col justify-between h-full">
            <div>
            <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">{label}</p>
            <p className="text-2xl font-bold text-[#2A174E]">{value}</p>
            </div>
            <p className="text-xs text-slate-500 italic mt-4">{description}</p>
        </CardContent>
        </Card>
    );
    }

    const StyledCardHeader = ({ title, icon: Icon }) => (
        <CardHeader className="border-b border-slate-50 py-4 bg-[#2A174E]">
        <CardTitle className="text-base flex items-center gap-2 text-white font-bold">
            <Icon className="h-5 w-5" /> {title}
        </CardTitle>
        </CardHeader>
    );

    function InfoItem({ label, value }) {
        return (
            <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            <div className="font-semibold text-slate-800">{value}</div>
            </div>
        );
        }

    function formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-PH', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        }

    const useTableData = (data, rowsPerPage = 5) => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const filtered = data?.filter(item => 
        Object.values(item).some(val => 
            String(val).toLowerCase().includes(search.toLowerCase())
        )
    ) || [];

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return { page, setPage, search, setSearch, paginated, totalPages };
};

    // Inside your component, initialize them:
    const amortizationTable = useTableData(loan?.amortization);
    const historyTable = useTableData(loan?.history);
  return (
    <div className="flex flex-col w-full min-h-screen">
    <Sidebar>
    <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto gap-6 flex flex-col">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-[#2A174E]">Loan Details</h1>
            <p className="text-slate-500">Loan ID: LOAN-001</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export PDF</Button>
          <Button variant="outline" className="text-blue-600"><Pencil className="mr-2 h-4 w-4" /> Adjust Loan</Button>
          <Button variant="destructive"><Pause className="mr-2 h-4 w-4" /> Pause Loan</Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center gap-2 text-emerald-800 font-medium">
        <CheckCircle2 className="h-5 w-5" /> Status: ACTIVE - Deductions are being processed according to schedule
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 w-full">
        <MetricCard 
            label="Total Loan" 
            value="₱15,000" 
            color="[#2A174E]" 
            description="Principal + Interest" />

        <MetricCard 
            label="Amount Paid" 
            value="₱7,500" 
            color="[#3B4E17]" 
            description="50.0% Complete" />

        <MetricCard 
            label="Outstanding" 
            value="₱7,500" 
            color="[#a12626]" 
            description="Remaining balance" />

        <MetricCard 
            label="Paid Installments" 
            value="3 / 6" 
            color="[#BB8B26]" 
            description="3 periods pending" />

        <MetricCard 
            label="Progress" 
            value="50%" 
            color="[#174e4e]" 
            description="Overall completion rate" />
        </div>

      {/* Info Sections: Styled */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employee Information Card */}
        <Card className="border-0 shadow-sm bg-white py-0 h-full">
            <StyledCardHeader title="Employee Information" icon={User} />
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6">
            <InfoItem label="Name" value={loan.employee} />
            <InfoItem label="Employee ID" value={loan.employeeId} />
            <InfoItem label="Email" value={loan.email} />
            <InfoItem label="Employee Type" value={<Badge variant="secondary">Student</Badge>} />
            </CardContent>
        </Card>

        {/* Loan Configuration Card */}
        <Card className="border-0 shadow-sm bg-white py-0 h-full">
            <StyledCardHeader title="Loan Configuration" icon={FileText} />
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6">
            <InfoItem label="Principal" value={`₱${loan.principal.toLocaleString()}`} />
            <InfoItem label="Tax Treatment" value={<Badge className="bg-emerald-100 text-emerald-700">POST-TAX</Badge>} />
            <InfoItem label="Frequency" value="EVERY PAYROLL" />
            <InfoItem label="Disbursement" value="5/15/2026" />
            </CardContent>
        </Card>
        </div>

        {/* Tabulated Data: Styled */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="amortization">Amortization Schedule</TabsTrigger>
              <TabsTrigger value="history">Payment History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4">
                <Card className="p-8 bg-gradient-to-br from-[#FAF2FF] via-[#2B174F]/5 to-[#FAF2FF] shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 text-[#2A174E] mb-8">
                    <Clock className="h-4 w-4" /> Loan Timeline
                    </h2>
                    
                    <div className="relative flex justify-between items-center w-full max-w-3xl mx-auto">
                    {/* Background Connecting Line */}
                    <div className="absolute top-2 left-0 right-0 h-0.5 bg-[#7A52B5] z-0" />

                    {/* Timeline Items */}
                    {[
                        { label: "Loan Created", date: "5/15/2026" },
                        { label: "Disbursement", date: "5/15/2026" },
                        { label: "Completion", date: "11/15/2026" }
                    ].map((item, index) => (
                        <div key={index} className="hover:shadow-lg p-2 relative z-10 flex flex-col items-center bg-white shadow-sm rounded-lg px-2">
                        <div className="w-4 h-4 rounded-full bg-[#7A52B5] border-2 border-white shadow-sm mb-2" />
                        <p className="font-bold text-xs text-[#2A174E] whitespace-nowrap">{item.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{formatDate(item.date)}</p>
                        </div>
                    ))}
                    </div>
                </Card>
                </TabsContent>

            <TabsContent value="amortization" className="mt-4">
              <Card className="border-0 shadow-sm overflow-hidden py-0">
                {/* Header Title */}
                <div className="bg-[#2A174E] p-4 text-white font-bold text-sm">Amortization Schedule</div>
                
                {/* Added px-4 for side padding */}
                <div className="px-4 pb-6">
                    <Table>
                    {/* Added border-0 to Header to close the gap */}
                    <TableHeader className="bg-slate-50 [&_tr]:border-0">
                        <TableRow>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">#</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">PERIOD ID</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">DUE DATE</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-right pr-8">PRINCIPAL</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-right pr-8">TOTAL PAYMENT</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-right pr-8">REMAINING</TableHead>
                        <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-center">STATUS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loan?.amortization?.map((row) => (
                        <TableRow key={row?.id}>
                            <TableCell>{row?.number}</TableCell>
                            <TableCell>{row?.periodId}</TableCell>
                            <TableCell>{formatDate(row?.dueDate)}</TableCell>
                            <TableCell className="text-right pr-8">₱{row?.principal.toLocaleString()}</TableCell>
                            <TableCell className="text-right pr-8 text-emerald-600 font-bold">₱{row?.total.toLocaleString()}</TableCell>
                            <TableCell className="text-right pr-8">₱{row?.remaining.toLocaleString()}</TableCell>
                            <TableCell className="text-right pr-6">
                            <Badge className={row?.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                {row?.status}
                            </Badge>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
                </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="border-0 shadow-sm overflow-hidden py-0">
                <div className="bg-[#2A174E] p-4 text-white font-bold text-sm">Payment History</div>
                
                {/* Added 'px-4' here to provide padding for the table content */}
                <div className="px-4 pb-6"> 
                    <Table>
                    <TableHeader className="bg-slate-50 [&_tr]:border-0"> {/* Removed border to close the gap */}
                        <TableRow>
                            <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">Payment ID</TableHead>
                            <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider">Period</TableHead>
                            <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-center">Payment Date</TableHead>
                            <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-right pr-8">Amount Paid</TableHead>
                            <TableHead className="font-semibold text-[#2A174E] py-4 uppercase text-xs tracking-wider text-center">Method</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loan?.history?.map((pay) => (
                        <TableRow key={pay?.id}>
                            <TableCell className="font-bold">{pay?.id}</TableCell>
                            <TableCell>{pay?.period}</TableCell>
                            <TableCell className="text-center">{formatDate(pay?.date)}</TableCell>
                            <TableCell className="text-right pr-8 text-emerald-600 font-bold">₱{pay?.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{pay?.method}</Badge></TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
    </div>
    </Sidebar>
    </div>
  );
}

// Helper Components
function MetricCard({ label, value, highlight = "", isProgress }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight}`}>{value}</p>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function TimelineItem({ label, date }) {
  return (
    <div className="flex gap-4 items-center">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-slate-400">{date}</p>
      </div>
    </div>
  );
}