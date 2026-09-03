import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContactSupportModal from "./ContactSupportModal";

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const formatAnswer = (text) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return <strong key={i} className="font-extrabold text-[#2A174E]">{boldText}</strong>;
    }
    const subParts = part.split(/(\*.*?\*)/g);
    return subParts.map((subPart, j) => {
      if (subPart.startsWith("*") && subPart.endsWith("*")) {
        return <em key={`${i}-${j}`} className="italic font-medium text-slate-700">{subPart.slice(1, -1)}</em>;
      }
      return subPart;
    });
  });
};

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const faqData = [
    {
      category: "System Overview & Navigation",
      questions: [
        {
          q: "What are the different roles in MAChip and their permissions?",
          a: "MAChip supports four distinct roles:\n\n• **Administrator**: *Full access* to all modules including User Management, Payroll, Access Logs, Requests, Configurations, and Audit/Transaction logs.\n• **Supervisor**: Can *view users*, access *employee logs*, and *review/recommend* employee requests.\n• **Accountant**: Manages *payroll*, *government/employee loans*, *HMOs*, *labor benefits*, *reports*, and configurations.\n• **Employee**: Accesses the employee view to *check schedules*, *view personal logs*, *file requests*, and *view/download payslips*."
        },
        {
          q: "How do I switch between Management and Employee views?",
          a: "If you are an **Administrator**, **Supervisor**, or **Accountant**, you can switch views easily:\n\n1. Click your **profile picture** in the top-right corner of the header.\n2. Select **'Switch to Employee View'** or **'Switch to Management View'** from the dropdown menu."
        },
        {
          q: "How do I navigate the system sidebar?",
          a: "The sidebar organizes features into distinct functional groups:\n\n• **Main**: *Dashboard*, *Calendar*, *Users* (View All, Add New, Archived), *Access Logs* (Employee, Visitor), *Requests* (Queue/Oversight), and *Payroll* (Management, Employee List, Government Loans, Employee Loan, HMO Management, Labor Benefits, Leave Summary).\n• **System**: *Settings* (Audit Logs, Transaction Logs, configurations) and *Help & Support* (FAQ)."
        }
      ]
    },
    {
      category: "User Management Module",
      questions: [
        {
          q: "How do I register a new employee or user in the system?",
          a: "Administrators can navigate to **Users > Add New User** in the sidebar. Fill in the required fields (**First Name**, **Last Name**, **Email**, **Password**, **Daily Rate**, **Role**, and **Employment Status**) and upload a profile picture. Once submitted, the user will be added to the system and assigned a formatted **User ID**."
        },
        {
          q: "How are daily rate changes managed for audits?",
          a: "Employee daily rates are editable in their profile under the **User Management** module, which updates **User.dailyRate** and tracks history via **previousDailyRate** and **rateUpdatedAt**. However, once payroll is generated, the daily rate is locked as an **immutable snapshot** in the **Payroll** table to maintain audit integrity."
        },
        {
          q: "Can I permanently delete a user from the database?",
          a: "To preserve data integrity, MAChip uses **Paranoid Mode (Soft Delete)** for users. A user can *only* be permanently deleted if there are *zero linked records* in dependent tables: **Payroll**, **User Logs**, **Employee Requests**, and **Employee Logging Reports**. Otherwise, soft deletion (archiving) is applied."
        }
      ]
    },
    {
      category: "Attendance & Logging (User Logging)",
      questions: [
        {
          q: "How do I clock in using the MAChip hardware station?",
          a: "You can clock in by scanning your registered **RFID card** (using the **MFRC522** reader) or using the **Optical Fingerprint Sensor** at the physical **ESP32** terminal. The system displays a confirmation message and automatically logs your **time_In** or **time_Out** in the PostgreSQL database."
        },
        {
          q: "What should I do if I forgot to clock in or out?",
          a: "If you miss a log event, file a **'Log Correction'** request via the **Requests** page. Specify the date, corrected time, and explanation. Once approved by a **Supervisor** and **Admin**, the database logs will reflect the corrected hours."
        },
        {
          q: "How do administrators view visitor logs?",
          a: "For compliance (such as **CTPAT guidelines**), visitor records are tracked under **Access Logs > Visitor Access** in the sidebar, which logs visitor names, purpose of visit, and entry/exit timestamps."
        }
      ]
    },
    {
      category: "User Requests & Approvals",
      questions: [
        {
          q: "How do employees file requests for leaves, overtime, or log corrections?",
          a: "In **Employee View**, go to the **Requests** section in the sidebar. Click the **'File Request'** button, select the **Request Type** (*Vacation Leave*, *Sick Leave*, *Overtime*, *OnField Work*, or *Log Correction*), specify dates/times, add remarks, and submit. Status updates will show up in your Request history."
        },
        {
          q: "What is the approval workflow for employee requests?",
          a: "Filed requests enter a **'Pending'** queue. A **Supervisor** reviews the request and marks it as **'Recommended'**. Finally, an **Administrator** approves or rejects the request. Both supervisors and admins can manage this queue under the **Requests** menu."
        }
      ]
    },
    {
      category: "Payroll & Benefits Module",
      questions: [
        {
          q: "What is the payroll processing schedule and cutoff policy?",
          a: "Payroll is processed twice a month:\n- Processed on the **10th** for the cutoff ending on the **15th**.\n- Processed on the **25th** for the cutoff ending on the **30th/31st**."
        },
        {
          q: "How are government and employee loans managed?",
          a: "Accountants track SSS/Pag-IBIG/PhilHealth loans in **Payroll > Government Loans** and corporate cash advances in **Payroll > Employee Loan**. The system automatically computes and applies the scheduled amortization deduction during payroll calculation."
        },
        {
          q: "Where do I configure Maxicare HMO plans?",
          a: "HMO plans are managed in **Payroll > HMO Management**. Here, the Accountant sets up employee and employer contribution breakdowns and monthly premium amortizations which are deducted from payroll."
        },
        {
          q: "Where are annual 13th-Month bonuses and other benefits calculated?",
          a: "Navigate to **Payroll > Labor Benefits**. This module computes annual **13th-month bonuses** according to **Presidential Decree No. 851**, retirement pay, and separation pay based on employment duration and daily rates."
        },
        {
          q: "How do I download payslips for employees in batches?",
          a: "Administrators and Accountants can go to **Admin Reports > Payroll Report**, filter by period, and click **'Batch ZIP Payslips'**. For security, the ZIP is encrypted using a password pattern based on the payroll period."
        }
      ]
    },
    {
      category: "System Settings & Auditing",
      questions: [
        {
          q: "Where do I configure holidays in the system?",
          a: "The system fetches official Philippine holidays using the **Nager.Date REST API**, supplemented with a static list of annually proclaimed holidays. These can be adjusted in the **Configuration** settings page."
        },
        {
          q: "What is the difference between Audit Logs and Transaction Logs?",
          a: "Under settings:\n• **Audit Logs** capture user activity for security compliance, such as request actions, profile modifications, or time card adjustments.\n• **Transaction Logs** track financial transactions and ledger records generated during payroll calculations."
        }
      ]
    }
  ];

  const filteredFaqs = faqData.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen  p-4 md:p-8">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-[#2A174E]/10 text-[#2A174E] rounded-full mb-4">
            <HelpOutlineIcon fontSize="large" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2A174E] mb-2">How can we help you?</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Search our knowledge base for answers to common questions regarding attendance, payroll, and system management.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto w-full mb-12">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              className="pl-12 h-14 bg-white border-slate-200 shadow-lg text-lg rounded-2xl focus-visible:ring-[#2A174E]"
              placeholder="Search for questions (e.g. 'leaves', 'payroll')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* FAQ Content */}
        <div className="max-w-3xl mx-auto w-full space-y-8">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((section, idx) => (
              <div key={idx} className="space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {section.category}
                </h2>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <Accordion type="single" collapsible className="w-full">
                    {section.questions.map((faq, fIdx) => (
                      <AccordionItem 
                        key={fIdx} 
                        value={`item-${idx}-${fIdx}`} 
                        className="border-b border-slate-100 last:border-0 px-4 transition-all duration-300 data-[state=open]:bg-[#f5f1fc] data-[state=open]:border-l-4 data-[state=open]:border-[#2A174E] data-[state=open]:pl-6"
                      >
                        <AccordionTrigger className="text-left font-semibold text-[#2A174E] hover:no-underline py-4">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-600 leading-relaxed pb-4 whitespace-pre-line">
                          {formatAnswer(faq.a)}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Card>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 italic">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-8 text-center bg-white rounded-2xl p-8 shadow-sm border border-slate-100 max-w-3xl mx-auto w-full">
          <ContactSupportIcon className="text-[#2A174E] mb-4" fontSize="large" />
          <h3 className="text-xl font-bold text-[#2A174E] mb-2">Still have questions?</h3>
          <p className="text-slate-500 mb-6 text-sm">Our support team is here to help with any technical issues or payroll concerns.</p>
          <Button 
            className="bg-[#2A174E] hover:bg-[#1a0e30] px-8"
            onClick={() => setIsSupportModalOpen(true)}
          >
            Contact Support
          </Button>
        </div>

        <ContactSupportModal 
          isOpen={isSupportModalOpen} 
          onClose={() => setIsSupportModalOpen(false)} 
        />
      </div>
    </Sidebar>
  );
};

export default FAQ;