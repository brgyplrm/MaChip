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
        },
        {
          q: "Can employees access MAChip from their mobile phones or outside the office?",
          a: "Yes. While physical biometric and RFID time-clock stations operate locally inside the facility for security, the **Employee Request Module** is exposed via secure port forwarding. Employees can log in using any modern smartphone or browser to *file leave requests*, *submit overtime slips*, *check attendance records*, and *view payslips* on the go."
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
        },
        {
          q: "What should an employee do if their RFID card is lost or damaged?",
          a: "If an RFID card is misplaced or damaged:\n\n1. Immediately report the loss to your **Administrator** or HR officer.\n2. In compliance with **CTPAT supply chain facility security**, the Admin will unbind the compromised RFID UID in **User Management** to deactivate it immediately.\n3. The Admin will tap a new card on the reader to bind the replacement RFID chip to your existing employee profile without affecting your past attendance logs."
        },
        {
          q: "How are biometric fingerprints enrolled and stored securely?",
          a: "Fingerprints are registered using the **Optical Fingerprint Sensor** at the physical hardware station. The scanner converts optical features into a mathematical template hash mapped to the employee's **User ID**. MAChip does not store raw fingerprint images, ensuring employee biometric privacy and compliance with data privacy standards."
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
          q: "How are late arrivals (tardiness) and grace periods calculated?",
          a: "The official work shift begins at the configured **Work Start Time** (e.g., 8:00 AM). The system provides an official **Grace Period** (e.g., until 8:15 AM):\n\n• Clocking in between Work Start and Grace Period end is considered **On-Time**.\n• Punching in after the Grace Period cutoff flags the attendance record as **Tardy**, and the total late minutes are calculated and deducted from the basic pay during payroll processing based on your hourly/minute rate."
        },
        {
          q: "How does the flexible lunch break policy work?",
          a: "MAChip features a configurable **Flexible Lunch Window** (e.g., 12:00 PM – 1:00 PM) with a standard **60-minute duration**. For full-day attendance calculations, the 1-hour lunch break is automatically factored in without reducing paid hours. If employees punch out and in for lunch, the system monitors break duration to prevent undertime violations."
        },
        {
          q: "Why does the terminal reject my RFID card or fingerprint right after I tap?",
          a: "To eliminate accidental double-taps, the hardware terminal enforces a **Hardware Buffer Window** (configurable between 1 to 10 minutes). Once a successful time punch is registered, subsequent scans from the same credential are automatically ignored until the buffer cooldown period finishes."
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
        },
        {
          q: "How does Overtime (OT) pay calculation integrate with attendance logs?",
          a: "To receive overtime compensation, employees must file an **Overtime Request** specifying the date, expected hours, and job justification. Once approved by the Supervisor and Admin, the system verifies the request against actual physical clock-out timestamps to ensure hours were rendered, then computes overtime pay using statutory multipliers (e.g., 125% for regular days, 130% on rest days/holidays)."
        },
        {
          q: "Can I cancel or edit a request once it has been submitted?",
          a: "While a request is still in **'Pending'** status, an employee can cancel it directly from their **Request History** in Employee View. However, once a request has been marked as **'Recommended'** by a Supervisor or **'Approved'** by an Admin, it is locked; you must contact your Administrator or Supervisor to reopen or void it."
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
          q: "How is the 13th-Month Pay calculated and when is it issued?",
          a: "In compliance with **Presidential Decree No. 851**, 13th-month pay is calculated using the statutory formula:\n\n**Total Basic Salary Earned within Calendar Year ÷ 12**\n\n• It includes all basic salary earned for actual services rendered (prorated for employees hired mid-year).\n• It excludes non-basic compensation like overtime, night shift premiums, unworked holiday pay, and discretionary bonuses.\n• A detailed monthly earnings breakdown is available in **Payroll > Labor Benefits**."
        },
        {
          q: "How are statutory contributions (SSS, PhilHealth, Pag-IBIG) and BIR taxes deducted?",
          a: "MAChip automatically applies statutory rates using the active brackets configured in **Settings > Ref Table**:\n\n• **SSS**: Deducts Regular Social Security, Mandatory Provident Fund (MPF/WISP), and Employer EC based on Monthly Salary Credit brackets.\n• **PhilHealth**: Calculates statutory percentage premiums (split equally between employer and employee) within legal floor and ceiling limits.\n• **Pag-IBIG**: Applies 1-2% employee contribution and 2% employer share up to statutory ceilings.\n• **BIR Withholding Tax**: Automatically calculates progressive withholding tax based on semi-monthly or monthly taxable earnings."
        },
        {
          q: "How are government and employee loans managed?",
          a: "Accountants track SSS/Pag-IBIG/PhilHealth loans in **Payroll > Government Loans** and corporate cash advances in **Payroll > Employee Loan**. The system automatically computes and applies the scheduled amortization deduction during payroll calculation until the balance reaches zero."
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
        },
        {
          q: "What is the password format for opening encrypted batch payslip files?",
          a: "For data security and confidentiality under privacy regulations, batch payslip archives are encrypted. The default archive password format follows company convention (such as the **Payroll Period Code** e.g., *MACJ-2026-03A* or employee birthday/ID format). Inquire with your HR or Finance department for your designated key format."
        }
      ]
    },
    {
      category: "System Settings & Auditing",
      questions: [
        {
          q: "Why are configuration fields locked in the Settings tabs?",
          a: "To prevent accidental modifications to critical operational rules, settings tabs (**System Variables**, **Attendance**, **Notifications**, **Salary Grades**, and **Reference Tables**) are locked in read-only mode by default. Authorized administrators must click the orange **'Edit Configuration'** button to make edits, then click **'Save Changes'** to persist or **'Cancel'** to revert."
        },
        {
          q: "How do administrators upload or update statutory reference tables (SSS, PhilHealth, Pag-IBIG, BIR)?",
          a: "Go to **Settings > Ref Table**:\n1. Click **'Edit Configuration'** to enable controls.\n2. Select the agency tab (**SSS**, **PhilHealth**, **Pag-IBIG**, or **BIR Tax**).\n3. Click **'Download Active CSV'** to get an Excel template pre-filled with existing brackets.\n4. Input the new rates and brackets, select the **Effective Date**, and attach your CSV.\n5. Click **'Upload & Parse CSV'** and confirm your **Admin Password** in the 2-step security modal. Calculations after the effective date will automatically adopt the new brackets."
        },
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