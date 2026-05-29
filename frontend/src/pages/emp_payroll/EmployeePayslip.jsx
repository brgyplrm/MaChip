import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { fetchWithAuth } from "../../utils/api";
import { 
  FileText, 
  ChevronLeft, 
  Printer, 
  Download, 
  Info,
  Banknote,
  Calendar,
  User,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const EmployeePayslip = () => {
  const { id } = useParams();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPayslip = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/payroll/my-payslip/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch payslip details.");
        }
        const data = await response.json();
        setPayroll(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayslip();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </Sidebar>
    );
  }

  if (error || !payroll) {
    return (
      <Sidebar>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="bg-red-50 p-6 rounded-full mb-4">
            <Info className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Payslip Not Found</h2>
          <p className="text-slate-500 max-w-md mt-2">
            The payslip you are looking for might not exist or you don't have permission to view it.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/employeeHome">Return to Dashboard</Link>
          </Button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto space-y-6">
        {/* Breadcrumbs / Back button */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-slate-800">
            <Link to="/employee/payroll" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to History
            </Link>
          </Button>
          <div className="flex gap-2">
            {/* <Button variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button> */}
            <Button size="sm" className="gap-2 bg-[#2A174E] hover:bg-[#3d2270]">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Payslip Summary Card */}
          <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm py-0">
            <CardHeader className="bg-[#2A174E] text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    Payslip Summary
                  </CardTitle>
                  <CardDescription className="text-slate-200 mt-1">
                    Payroll Period: {new Date(payroll.period_Start).toLocaleDateString()} - {new Date(payroll.period_End).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-sm">
                  {payroll.PaystatusName || "Released"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Employee Details Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Employee Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Employee Name</p>
                        <p className="font-semibold text-slate-800">{payroll.user_FirstName} {payroll.user_LastName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                        <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-transparent text-slate-600 border-none shadow-none">ID</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Employee ID</p>
                        <p className="font-semibold text-slate-800">#{String(payroll.user_Id).padStart(4, '0')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Earnings Summary Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Pay Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-600">Total Earnings</span>
                      <span className="font-semibold text-green-600">{formatCurrency(payroll.totalEarnings)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 pb-2">
                      <span className="text-slate-600">Total Deductions</span>
                      <span className="font-semibold text-red-600">-{formatCurrency(payroll.totalDeductions)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-slate-800 text-lg">Net Pay</span>
                      <span className="font-bold text-[#2A174E] text-2xl">{formatCurrency(payroll.netPay)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Info className="h-4 w-4" />
                  Detailed computation is available on the next page.
                </div>
                <Button asChild variant="link" className="text-[#2A174E] font-semibold gap-1 px-0">
                  <Link to={`/employee/payroll-details/${id}`}>
                    View Full Computation
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats / Info Sidebar */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Banknote className="h-5 w-5 text-[#2A174E]" />
                  Rate Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Daily Rate</span>
                  <span className="font-medium text-slate-800">{formatCurrency(payroll.dailyRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Hourly Rate</span>
                  <span className="font-medium text-slate-800">{formatCurrency(payroll.ratePerHr)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Calendar className="h-5 w-5 text-[#2A174E]" />
                  Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Days Worked</span>
                  <span className="font-medium text-slate-800">{payroll.NoDays_Worked} / {payroll.totalScheduledDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Hours Worked</span>
                  <span className="font-medium text-slate-800">{payroll.NoHrs_Worked} hrs</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Sidebar>
  );
};

export default EmployeePayslip;
