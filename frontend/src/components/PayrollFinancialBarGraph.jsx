import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PayrollFinancialBarGraph = ({ payrolls }) => {
  // Preparing the data to show specific deduction breakdowns
  const data = payrolls.map(p => ({
    name: p.user_FirstName || p.userName,
    // HMO/Maxicare Deduction
    hmo: parseFloat(p.healthCard_Amnt || 0),
    // Consolidating all Loan types (SSS, HDMF, Calamity, Eastwest)
    loans: parseFloat(p.SSS_Loan || 0) + 
           parseFloat(p.HDMF_Loan || 0) + 
           parseFloat(p.calamityLoan_Amnt || 0) + 
           parseFloat(p.eastwest_Loan || 0),
    // Other miscellaneous deductions (Globe, Savings, Advances)
    others: parseFloat(p.advances_Amnt || 0) + 
            parseFloat(p.globe_Deduction || 0) + 
            parseFloat(p.multiPurposeSavings || 0)
  }));

  return (
    <Card className="shadow-sm border-gray-200 w-full mb-8">
      <CardHeader>
        <CardTitle className="text-brand-primary">Deductions Overview</CardTitle>
        <CardDescription>Breakdown of disbursements for HMO, Loans, and other corporate deductions</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => `₱${value.toLocaleString()}`}
            />
            <RechartsTooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              formatter={(value) => `₱${value.toLocaleString()}`}
            />
            <Legend iconType="circle" />
            
            {/* HMO/Maxicare Bar */}
            <Bar 
              dataKey="hmo" 
              name="HMO (Maxicare)" 
              fill="var(--color-brand-primary)" 
              stackId="a"
              radius={[0, 0, 0, 0]} 
              barSize={40}
            />
            
            {/* Consolidated Loans Bar */}
            <Bar 
              dataKey="loans" 
              name="Total Loans" 
              fill="var(--color-accent-gold)" 
              stackId="a"
              radius={[0, 0, 0, 0]} 
              barSize={40}
            />

            {/* Other Deductions Bar */}
            <Bar 
              dataKey="others" 
              name="Other Deductions" 
              fill="var(--color-accent-green)" 
              stackId="a"
              radius={[4, 4, 0, 0]} 
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PayrollFinancialBarGraph;