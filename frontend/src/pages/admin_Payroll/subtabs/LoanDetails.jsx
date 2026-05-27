import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, User, FileText, Clock, DollarSign, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Sidebar from "../../../components/Sidebar";
import { Link, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { fetchWithAuth } from "../../../utils/api";

export default function LoanDetailsPage() {
    const { id } = useParams();
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/payroll/loans/details/${id}`);
            if (res.ok) {
                const data = await res.json();
                setLoan(data);
            }
        } catch (err) {
            console.error("Error fetching loan details:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const formatCurrency = (val) => `₱${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const colorMap = {
      "[#2A174E]": "border-[#2A174E]",
      "emerald-500": "border-emerald-500",
      "rose-500": "border-rose-500",
      "amber-500": "border-amber-500",
      "indigo-500": "border-indigo-500"
    };

    function MetricCard({ label, value, color, description }) {
        return (
            <Card className={`border-t-4 ${colorMap[color] || 'border-slate-200'} bg-white py-0 h-full shadow-sm`}>
                <CardContent className="px-5 p-5 flex flex-col justify-between h-full text-left">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                        <p className="text-2xl font-black text-[#2A174E]">{value}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mt-4">{description}</p>
                </CardContent>
            </Card>
        );
    }

    const StyledCardHeader = ({ title, icon: Icon }) => (
        <CardHeader className="border-b border-slate-50 py-4 bg-[#2A174E]">
            <CardTitle className="text-sm flex items-center gap-2 text-white font-bold uppercase tracking-tight">
                <Icon className="h-4 w-4" /> {title}
            </CardTitle>
        </CardHeader>
    );

    function InfoItem({ label, value }) {
        return (
            <div className="space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                <div className="text-sm font-bold text-[#2A174E]">{value}</div>
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

    const useTableData = (data, itemsPerPage = 10) => {
        const [page, setPage] = useState(1);
        const [rowsPerPage, setRowsPerPage] = useState(itemsPerPage);
        const [search, setSearch] = useState("");
        const [filter, setFilter] = useState("ALL");

        const filtered = data?.filter(item => {
            const matchesSearch = Object.values(item).some(val =>
                String(val).toLowerCase().includes(search.toLowerCase())
            );
            const matchesFilter = filter === "ALL" || item.status === filter;
            return matchesSearch && matchesFilter;
        }) || [];

        const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, filtered.length);
        const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

        return { page, setPage, rowsPerPage, setRowsPerPage, search, setSearch, filter, setFilter, paginated, totalPages, startIndex, endIndex, totalItems: filtered.length };
    };

    const amortizationTable = useTableData(loan?.schedule);
    const historyTable = useTableData(loan?.history);

    if (loading) return (
        <Sidebar>
            <div className="p-12 text-center text-slate-500 animate-pulse font-bold uppercase tracking-widest">
              Synchronizing Ledger...
            </div>
        </Sidebar>
    );

    if (!loan) return (
        <Sidebar>
            <div className="p-12 text-center text-rose-500 font-bold uppercase tracking-widest">
              Loan Agreement Not Found
            </div>
        </Sidebar>
    );

    const paidAmount = parseFloat(loan.totalAmount) - parseFloat(loan.remainingBalance);
    const paidPercentage = (paidAmount / parseFloat(loan.totalAmount)) * 100;
    const installmentsPaid = loan.history?.length || 0;
    const totalInstallments = loan.schedule?.length || 0;

    return (
        <div className="flex flex-col w-full min-h-screen bg-slate-50">
            <Sidebar>
                <div className="p-2 md:p-6 overflow-x-hidden w-full max-w-6xl mx-auto gap-6 flex flex-col">
                    {/* Header Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                        <div className="group flex items-center gap-0">
                            <div className="w-0 overflow-hidden group-hover:w-10 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
                                <Button variant="ghost" size="icon" asChild className="text-[#2A174E]">
                                    <Link to="/loanManagement"><ArrowBackIcon className="h-6 w-6" /></Link>
                                </Button>
                            </div>
                            <div className="ml-0 group-hover:ml-2 transition-all duration-300 ease-in-out text-left">
                                <h1 className="text-2xl font-black text-[#2A174E] tracking-tight uppercase">{loan.notes || 'Loan Details'}</h1>
                                <p className="text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest">Agreement ID: L-{id}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-[#2A174E]/20 text-[#2A174E] font-bold h-9 text-xs">
                              <Download className="mr-2 h-4 w-4" /> Export Ledger
                            </Button>
                        </div>
                    </div>

                    {/* Status Banner */}
                    <div className={`${loan.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-500'} border p-4 rounded-xl flex items-center gap-3 font-bold text-xs uppercase tracking-wider`}>
                        <CheckCircle2 className="h-5 w-5" /> 
                        <span>Status: {loan.status} — {loan.status === 'active' ? 'Deductions are active and being processed' : 'Loan agreement is closed'}</span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                        <MetricCard
                            label="Initial Principal"
                            value={formatCurrency(loan.totalAmount)}
                            color="[#2A174E]"
                            description="Total disbursed amount" />
                        <MetricCard
                            label="Amount Collected"
                            value={formatCurrency(paidAmount)}
                            color="emerald-500"
                            description={`${paidPercentage.toFixed(1)}% Recovered`} />
                        <MetricCard
                            label="Outstanding"
                            value={formatCurrency(loan.remainingBalance)}
                            color="rose-500"
                            description="Balance to collect" />
                        <MetricCard
                            label="Monthly Amort"
                            value={formatCurrency(parseFloat(loan.deductionPerCutoff) * 2)}
                            color="amber-500"
                            description="Fixed monthly rate" />
                        <MetricCard
                            label="Progress"
                            value={`${paidPercentage.toFixed(0)}%`}
                            color="indigo-500"
                            description={`${installmentsPaid} of ${totalInstallments} paid`} />
                    </div>

                    {/* Info Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-0 shadow-sm bg-white py-0 h-full overflow-hidden rounded-xl">
                            <StyledCardHeader title="Employee Information" icon={User} />
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 pt-6">
                                <InfoItem label="Name" value={loan.employeeName} />
                                <InfoItem label="Employee ID" value={`MACJ-${String(loan.empId).padStart(3, '0')}`} />
                                <InfoItem label="Email" value={loan.employeeEmail} />
                                <InfoItem label="Employment Status" value={<Badge variant="secondary" className="text-[10px] font-black uppercase">{loan.employmentStatus || 'N/A'}</Badge>} />
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm bg-white py-0 h-full overflow-hidden rounded-xl">
                            <StyledCardHeader title="Agreement Configuration" icon={FileText} />
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 pt-6">
                                <InfoItem label="Provider" value={loan.provider ? loan.provider.toUpperCase() : 'N/A'} />
                                <InfoItem label="Reference No." value={<span className="font-mono text-xs font-black text-indigo-600">{loan.reference || 'N/A'}</span>} />
                                <InfoItem label="Total Term" value={`${loan.monthsToPay} Months`} />
                                <InfoItem label="Deduction Start" value={formatDate(loan.contractDate)} />
                                {loan.calamityArea && (
                                  <div className="sm:col-span-2 mt-2">
                                    <InfoItem label="Calamity Area" value={<span className="text-orange-600 font-bold uppercase text-xs">{loan.calamityArea}</span>} />
                                  </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabulated Data */}
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="bg-slate-200/50 p-1 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg font-bold text-xs uppercase px-6">Overview</TabsTrigger>
                            <TabsTrigger value="amortization" className="rounded-lg font-bold text-xs uppercase px-6">Full Ledger</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg font-bold text-xs uppercase px-6">Paid History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4">
                            <Card className="p-8 bg-gradient-to-br from-[#FAF2FF] via-white to-[#FAF2FF] shadow-sm rounded-xl border-slate-100">
                                <h2 className="font-black flex items-center gap-2 text-[#2A174E] mb-8 text-sm uppercase tracking-wider">
                                    <Clock className="h-4 w-4" /> Repayment Timeline
                                </h2>
                                <div className="relative flex justify-between items-center w-full max-w-3xl mx-auto py-4">
                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
                                    <div className="absolute top-1/2 left-0 h-1 bg-indigo-500 -translate-y-1/2 z-0 rounded-full transition-all duration-1000" style={{ width: `${paidPercentage}%` }} />

                                    {(() => {
                                        const firstDeduction = loan.schedule?.[0]?.dueDate || loan.contractDate;
                                        // Calculate final date if schedule is empty
                                        let finalDate = loan.schedule?.[loan.schedule.length - 1]?.dueDate;
                                        if (!finalDate && loan.contractDate && loan.monthsToPay) {
                                            const d = new Date(loan.contractDate);
                                            d.setMonth(d.getMonth() + parseInt(loan.monthsToPay));
                                            finalDate = d.toISOString().split('T')[0];
                                        }

                                        return [
                                            { label: "Loan Enrolled", date: loan.createdAt },
                                            { label: "1st Deduction", date: firstDeduction },
                                            { label: "Final Expected", date: finalDate }
                                        ].map((item, index) => (
                                            <div key={index} className="relative z-10 flex flex-col items-center">
                                                <div className={`w-5 h-5 rounded-full border-4 border-white shadow-md mb-3 ${new Date(item.date) <= new Date() ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                                <p className="font-black text-[10px] text-[#2A174E] whitespace-nowrap uppercase tracking-tighter">{item.label}</p>
                                                <p className="text-[10px] text-slate-400 font-bold font-mono">{formatDate(item.date)}</p>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="amortization" className="mt-4">
                            <Card className="border-0 shadow-sm overflow-hidden py-0 rounded-xl bg-white text-left">
                                <div className="bg-[#2A174E] p-4 text-white font-black text-xs uppercase tracking-widest flex justify-between items-center">
                                    <span>Full Amortization Ledger</span>
                                    <Badge className="bg-white/20 text-white border-0 text-[9px] uppercase">{loan.schedule?.length || 0} Installments</Badge>
                                </div>
                                <div className="px-4 pb-6 pt-2 text-left">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50 [&_tr]:border-0">
                                            <TableRow>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-left">#</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-left">Due Date</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-right">Principal</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-right">Total Pay</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-right pr-8">Balance</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {amortizationTable.paginated.length > 0 ? amortizationTable.paginated.map((row) => (
                                                <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-bold text-slate-300 text-xs text-left">{row.number}</TableCell>
                                                    <TableCell className="font-bold text-slate-700 text-xs text-left">{formatDate(row.dueDate)}</TableCell>
                                                    <TableCell className="text-right font-medium text-slate-500 text-xs">{formatCurrency(row.principal)}</TableCell>
                                                    <TableCell className="text-right text-emerald-600 font-black text-xs">{formatCurrency(row.total)}</TableCell>
                                                    <TableCell className="text-right pr-8 font-mono text-xs font-bold text-slate-400">{formatCurrency(row.remaining)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={row.status === 'PAID' ? "bg-emerald-100 text-emerald-700 border-0 text-[10px]" : "bg-slate-100 text-slate-400 border-0 text-[10px]"}>
                                                            {row.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-48 text-center py-12">
                                                      <div className="flex flex-col items-center gap-3">
                                                        <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center">
                                                          <FileText className="h-6 w-6 text-slate-200" />
                                                        </div>
                                                        <div className="space-y-1">
                                                          <p className="font-black text-[#2A174E] text-xs uppercase tracking-wider">No Amortization Schedule Found</p>
                                                          <p className="text-[10px] text-slate-400">The ledger for this loan has not been generated or is unavailable.</p>
                                                        </div>
                                                      </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    {amortizationTable.totalItems > 10 && (
                                        <div className="flex items-center justify-between gap-2 p-4 border-t mt-4 bg-slate-50/30 rounded-lg">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Page {amortizationTable.page} of {amortizationTable.totalPages}</div>
                                            <div className="flex gap-2">
                                              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase" onClick={() => amortizationTable.setPage(p => Math.max(p - 1, 1))} disabled={amortizationTable.page === 1}>Prev</Button>
                                              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase" onClick={() => amortizationTable.setPage(p => Math.min(p + 1, amortizationTable.totalPages))} disabled={amortizationTable.page >= amortizationTable.totalPages}>Next</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <Card className="border-0 shadow-sm overflow-hidden py-0 rounded-xl bg-white text-left">
                                <div className="bg-[#2A174E] p-4 text-white font-black text-xs uppercase tracking-widest flex justify-between items-center">
                                    <span>Payment Collection History</span>
                                    <Badge className="bg-emerald-500 text-white border-0 text-[9px] uppercase">{loan.history?.length || 0} Collected</Badge>
                                </div>
                                <div className="px-4 pb-6 pt-2 text-left">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50 [&_tr]:border-0">
                                            <TableRow>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-left">Payment Ref</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-left">Collection Date</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-right pr-8">Amount</TableHead>
                                                <TableHead className="font-black text-[#2A174E] py-4 uppercase text-[10px] tracking-wider text-center">Method</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {historyTable.paginated.length > 0 ? historyTable.paginated.map((pay) => (
                                                <TableRow key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-mono text-xs font-black text-indigo-600 text-left">COL-{String(pay.id).padStart(6, '0')}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600 text-left">{formatDate(pay.dueDate)}</TableCell>
                                                    <TableCell className="text-right pr-8 text-emerald-600 font-black text-xs">{formatCurrency(pay.total)}</TableCell>
                                                    <TableCell className="text-center"><Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0.5">Payroll Deduction</Badge></TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-48 text-center py-12">
                                                      <div className="flex flex-col items-center gap-3">
                                                        <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center">
                                                          <DollarSign className="h-6 w-6 text-slate-200" />
                                                        </div>
                                                        <div className="space-y-1">
                                                          <p className="font-black text-[#2A174E] text-xs uppercase tracking-wider">No payments collected yet</p>
                                                          <p className="text-[10px] text-slate-400">Deductions will appear here once payroll is released.</p>
                                                        </div>
                                                      </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    {historyTable.totalItems > 10 && (
                                        <div className="flex items-center justify-between gap-2 p-4 border-t mt-4 bg-slate-50/30 rounded-lg">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Page {historyTable.page} of {historyTable.totalPages}</div>
                                            <div className="flex gap-2">
                                              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase" onClick={() => historyTable.setPage(p => Math.max(p - 1, 1))} disabled={historyTable.page === 1}>Prev</Button>
                                              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase" onClick={() => historyTable.setPage(p => Math.min(p + 1, historyTable.totalPages))} disabled={historyTable.page >= historyTable.totalPages}>Next</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </Sidebar>
        </div>
    );
}
