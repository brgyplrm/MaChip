import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FileText, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoanDetailsPage() {
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <ArrowLeft className="cursor-pointer" />
        <div>
          <h1 className="text-2xl font-bold">Emergency Medical Advance</h1>
          <p className="text-sm text-slate-500">Loan ID: LOAN-001</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Export PDF</Button>
          <Button variant="outline">Adjust Loan</Button>
          <Button className="bg-orange-500 hover:bg-orange-600"><Pause className="mr-2 h-4 w-4" /> Pause Loan</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Loan Amount" value="₱15,000" />
        <StatCard title="Amount Paid" value="₱7,500" highlight="text-emerald-600" />
        <StatCard title="Outstanding" value="₱7,500" highlight="text-orange-600" />
        <StatCard title="Paid Installments" value="3 / 6" sub="3 Pending" />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">50%</div>
            <Progress value={50} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Info & Tabs */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <InfoCard title="Employee Information" data={{ Name: "Cydoel Tomas", Email: "cydtomas555@gmail.com", Type: "Student", ID: "1" }} />
        <InfoCard title="Loan Configuration" data={{ Principal: "₱15,000", Rate: "0% (FLAT)", Strategy: "Fixed Periods", Installment: "6 periods", Frequency: "EVERY PAYROLL" }} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Amortization Schedule</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="p-4 bg-white rounded-xl border">
          {/* Timeline and Summary Logic */}
          <h3 className="font-semibold mb-4">Loan Timeline</h3>
          {/* Add your vertical timeline component here */}
        </TabsContent>
        <TabsContent value="schedule">
            <AmortizationTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components
function StatCard({ title, value, highlight = "", sub = "" }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className={`text-2xl font-bold ${highlight}`}>{value}</p>{sub && <p className="text-xs text-slate-400">{sub}</p>}</CardContent>
    </Card>
  );
}

function InfoCard({ title, data }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-md">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="flex justify-between border-b pb-2">
            <span className="text-slate-500">{key}</span>
            <span className="font-medium">{val}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}