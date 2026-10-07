import React, { useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ContactSupportIcon from "@mui/icons-material/ContactSupport";
import CloseIcon from "@mui/icons-material/Close";
import SecurityIcon from "@mui/icons-material/Security";
import ContactSupportModal from "./ContactSupportModal";

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const formatAnswer = (text) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return <strong key={i} className="font-extrabold text-brand-primary">{boldText}</strong>;
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
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Retrieve current user and resolve role (1: Admin, 2: Supervisor, 3: Employee, 4: Accountant)
  const userData = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userData") || "{}");
    } catch {
      return {};
    }
  }, []);

  const roleId = Number(
    userData?.user_RoleId || (
      userData?.user_Role === "Administrator" ? 1 :
      userData?.user_Role === "Supervisor" ? 2 :
      userData?.user_Role === "Accountant" ? 4 : 3
    )
  );

  const roleInfo = useMemo(() => {
    switch (roleId) {
      case 1:
        return {
          badge: "Administrator Knowledge Base",
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-400/20",
          title: "System Administration Knowledge Base",
          subtext: "Comprehensive operational manual for user administration, audit compliance, device protocols, and payroll workflows."
        };
      case 2:
        return {
          badge: "Supervisor Guidance",
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-400/20",
          title: "Supervisor Operational Knowledge Base",
          subtext: "Operational guidelines for reviewing staff requests, monitoring floor attendance, and managing team logs."
        };
      case 4:
        return {
          badge: "Finance & Accounting",
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-400/20",
          title: "Finance & Payroll Knowledge Base",
          subtext: "Reference documentation for batch payroll calculations, statutory reference brackets, loans, and HMO management."
        };
      case 3:
      default:
        return {
          badge: "Employee Self-Service",
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-400/20",
          title: "Employee Help & Support Center",
          subtext: "Find answers regarding attendance clocking, biometric terminals, leave & OT filings, and personal payslips."
        };
    }
  }, [roleId]);

  const rawFaqData = [
    {
      id: "system",
      category: (role) => (role === 3 ? "System Overview & Portal Guide" : "System Overview & Navigation"),
      roles: [1, 2, 3, 4],
      questions: [
        {
          roles: [3],
          q: "What can I access in the MAChip Employee Portal?",
          a: "As an employee, your portal provides 24/7 self-service access to:\n\n• **Attendance & Logs**: View your daily clock-in and clock-out timestamps, attendance remarks, and monthly recorded hours.\n• **Schedules & Calendar**: Check your assigned shift schedules, official company holidays, and approved time-off.\n• **Self-Service Requests**: Submit requests for Vacation/Sick Leaves, Overtime, On-Field assignments, and Time Log Corrections.\n• **My Payslips**: Review summary earnings and download official PDF payslips (both Standard summary and Detailed attendance breakdown)."
        },
        {
          roles: [3],
          q: "How do I navigate the Employee Portal sidebar?",
          a: "The sidebar gives you quick access to employee self-service tools:\n\n• **Dashboard**: High-level overview of your current attendance status, remaining leave credits, and recent request updates.\n• **My Attendance**: Chronological timeline of all your daily biometric and RFID punches.\n• **Calendar**: Company-wide holidays, work calendars, and your scheduled leaves.\n• **Requests**: Submit new requests and track approval progress in real time.\n• **My Payslips**: Access semi-monthly payslip records and download official PDF copies.\n• **Help & Support**: Answers to common questions and support contact."
        },
        {
          roles: [1, 2, 4],
          q: "What are the different roles in MAChip and their permissions?",
          a: "MAChip supports four distinct roles:\n\n• **Administrator**: *Full access* to all modules including User Management, Payroll, Access Logs, Requests, Configurations, Reference Tables, and Audit/Transaction logs.\n• **Supervisor**: Can *view users*, access *employee logs*, and *review/recommend* employee requests.\n• **Accountant**: Manages *payroll calculation*, *government/employee loans*, *HMOs*, *labor benefits*, *reports*, and configurations.\n• **Employee**: Accesses the employee self-service portal to *check schedules*, *view personal logs*, *file requests*, and *view/download payslips*."
        },
        {
          roles: [1, 2, 4],
          q: "How do I switch between Management and Employee views?",
          a: "If you are an **Administrator**, **Supervisor**, or **Accountant**, you can switch views easily:\n\n1. Click your **profile picture** in the top-right corner of the navigation bar.\n2. Select **'Switch to Employee View'** or **'Return to Management'** from the dropdown menu."
        },
        {
          roles: [1, 2, 4],
          q: "How do I navigate the management system sidebar?",
          a: "The sidebar organizes features into distinct functional groups:\n\n• **Main**: *Dashboard*, *Calendar*, *Users* (View All, Add New, Archived), *Access Logs* (Employee, Visitor), *Requests* (Queue/Oversight), and *Payroll* (Management, Employee List, Government Loans, Employee Loan, HMO Management, Labor Benefits, Leave Summary).\n• **System**: *Settings* (Audit Logs, Transaction Logs, configurations) and *Help & Support* (FAQ)."
        },
        {
          roles: [1, 2, 3, 4],
          q: "Can I access MAChip from my laptop or outside the office?",
          a: "Yes. While physical biometric and RFID time-clock stations operate locally inside the facility for security, the **Employee Request Module** is exposed via secure port forwarding. Employees can log in using any modern laptop or browser to *file leave requests*, *submit overtime slips*, *check attendance records*, and *view payslips* on the go."
        }
      ]
    },
    {
      id: "users",
      category: (role) => (role === 3 ? "Account, RFID & Biometric Security" : "User Management & Credentials"),
      roles: [1, 2, 3, 4],
      questions: [
        {
          roles: [1],
          q: "How do I register a new employee or user in the system?",
          a: "Administrators can navigate to **Users > Add New User** in the sidebar. Fill in the required fields (**First Name**, **Last Name**, **Email**, **Password**, **Daily Rate**, **Role**, and **Employment Status**) and upload a profile picture. Once submitted, the user will be added to the system and assigned a formatted **User ID**."
        },
        {
          roles: [1, 4],
          q: "How are daily rate changes managed for audits?",
          a: "Employee daily rates are editable in their profile under the **User Management** module, which updates **User.dailyRate** and tracks history via **previousDailyRate** and **rateUpdatedAt**. However, once payroll is generated, the daily rate is locked as an **immutable snapshot** in the **Payroll** table to maintain audit integrity."
        },
        {
          roles: [1],
          q: "Can I permanently delete a user from the database?",
          a: "To preserve audit integrity, MAChip enforces **Paranoid Mode (Soft Delete)** for user records. A user can *only* be permanently deleted from the database if there are *zero linked records* across dependent tables: **Payroll**, **User Logs**, **Employee Requests**, and **Employee Logging Reports**. Otherwise, soft deletion (archiving) is applied."
        },
        {
          roles: [1, 2, 3, 4],
          q: "What should an employee do if their RFID card is lost or damaged?",
          a: "If an RFID card is misplaced or damaged:\n\n1. Immediately report the loss to your **Administrator** or HR officer.\n2. In compliance with **CTPAT supply chain facility security**, the Admin will unbind the compromised RFID UID in **User Management** to deactivate it immediately.\n3. The Admin will tap a new card on the reader to bind the replacement RFID chip to your existing employee profile without affecting your past attendance logs."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How are biometric fingerprints enrolled and stored securely?",
          a: "Fingerprints are registered using the **Optical Fingerprint Sensor** at the physical hardware station. The scanner converts optical features into a mathematical template hash mapped to the employee's **User ID**. MAChip does not store raw fingerprint images, ensuring employee biometric privacy and compliance with data privacy standards."
        }
      ]
    },
    {
      id: "attendance",
      category: (role) => (role === 3 ? "Attendance & Clocking Policies" : "Attendance & Access Oversight"),
      roles: [1, 2, 3, 4],
      questions: [
        {
          roles: [1, 2, 3, 4],
          q: "How do I clock in using the MAChip hardware station?",
          a: "You can clock in by scanning your registered **RFID card** (using the **MFRC522** reader) or scanning your finger using the **Optical Fingerprint Sensor** at the physical **ESP32** terminal. The system displays a confirmation message and automatically logs your **time_In** or **time_Out** in the database."
        },
        {
          roles: [1, 2, 3, 4],
          q: "What should I do if I forgot to clock in or out?",
          a: "If you miss a clock event, file a **'Log Correction'** request via the **Requests** page. Specify the date, corrected time, and explanation. Once approved by your **Supervisor** and **Admin**, the database logs will reflect the corrected hours."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How are late arrivals (tardiness) and grace periods calculated?",
          a: "The official work shift begins at the configured **Work Start Time** (e.g., 8:00 AM). The system provides an official **Grace Period** (e.g., until 8:15 AM):\n\n• Clocking in between Work Start and Grace Period end is considered **On-Time**.\n• Punching in after the Grace Period cutoff flags the attendance record as **Tardy**, and the total late minutes are calculated and deducted from the basic pay during payroll processing based on your minute rate."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How does the flexible lunch break policy work?",
          a: "MAChip features a configurable **Flexible Lunch Window** (e.g., 12:00 PM – 1:00 PM) with a standard **60-minute duration**. For full-day attendance calculations, the 1-hour lunch break is automatically factored in without reducing paid hours. If employees punch out and in for lunch, the system monitors break duration to prevent undertime violations."
        },
        {
          roles: [1, 2, 3, 4],
          q: "Why does the terminal reject my RFID card or fingerprint right after I tap?",
          a: "To eliminate accidental double-taps, the hardware terminal enforces a **Hardware Buffer Window** (configurable between 1 to 10 minutes). Once a successful time punch is registered, subsequent scans from the same credential are automatically ignored until the buffer cooldown period finishes."
        },
        {
          roles: [1, 2],
          q: "How do administrators and supervisors view visitor access logs?",
          a: "For compliance with **CTPAT supply chain facility security guidelines**, visitor records are logged and tracked under **Access Logs > Visitor Access** in the sidebar. This records visitor full names, company affiliation, contact info, purpose of visit, host employee, and entry/exit timestamps."
        }
      ]
    },
    {
      id: "requests",
      category: (role) => (role === 3 ? "Requests & Overtime Filing" : "User Requests & Approvals"),
      roles: [1, 2, 3, 4],
      questions: [
        {
          roles: [1, 2, 3, 4],
          q: "How do employees file requests for leaves, overtime, or log corrections?",
          a: "In **Employee View**, go to the **Requests** section in the sidebar. Click the **'File Request'** button, select the **Request Type** (*Vacation Leave*, *Sick Leave*, *Overtime*, *OnField Work*, or *Log Correction*), specify dates/times, add remarks, and submit. Status updates will show up in your Request history."
        },
        {
          roles: [1, 2, 3, 4],
          q: "What is the approval workflow for employee requests?",
          a: "Filed requests enter a **'Pending'** queue. A **Supervisor** reviews the request and marks it as **'Recommended'**. Finally, an **Administrator** approves or rejects the request. Both supervisors and admins can manage this queue under the **Requests** menu."
        },
        {
          roles: [1, 2],
          q: "How do Supervisors and Admins review and take action on employee requests?",
          a: "Navigate to **Requests** in the management sidebar:\n\n• **Supervisors**: Review pending staff requests in the queue. Click a request card to inspect details, reason, and supporting attachments, then click **'Recommend'** or **'Decline'**.\n• **Administrators**: Review recommended requests for final authorization. Click **'Approve'** to commit changes to official attendance/leave balances, or **'Reject'** with notes."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How does Overtime (OT) pay calculation integrate with attendance logs?",
          a: "To receive overtime compensation, employees must file an **Overtime Request** specifying the date, expected hours, and job justification. Once approved by the Supervisor and Admin, the system verifies the request against actual physical clock-out timestamps to ensure hours were rendered, then computes overtime pay using statutory multipliers (e.g., 125% for regular days, 130% on rest days/holidays)."
        },
        {
          roles: [1, 2, 3, 4],
          q: "Can I cancel or edit a request once it has been submitted?",
          a: "While a request is still in **'Pending'** status, an employee can cancel it directly from their **Request History** in Employee View. However, once a request has been marked as **'Recommended'** by a Supervisor or **'Approved'** by an Admin, it is locked; you must contact your Administrator or Supervisor to reopen or void it."
        }
      ]
    },
    {
      id: "payroll",
      category: () => "Payroll, Payslips & Benefits",
      roles: [1, 2, 3, 4],
      questions: [
        {
          roles: [1, 2, 3, 4],
          q: "What is the payroll processing schedule and cutoff policy?",
          a: "Payroll is processed twice a month:\n- Processed on the **10th** for the cutoff ending on the **15th**.\n- Processed on the **25th** for the cutoff ending on the **30th/31st**."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How can I view and download my official payslips?",
          a: "In **Employee View**, navigate to **Payslips** from the sidebar:\n\n1. Select the payroll period you want to review from the dropdown.\n2. Click **'View Payslips'** to open an interactive preview modal with two view options: **Standard Payslip** (compact official summary) or **Detailed Payslip** (complete attendance log breakdown including daily clock-in/outs, late minutes, undertime, and overtime).\n3. Click **'Download Payslip'** to save an official PDF copy for personal records or loan requirements."
        },
        {
          roles: [1, 2, 3, 4],
          q: "What should I do if I notice a discrepancy in my payroll computation?",
          a: "If you observe any discrepancy in your recorded work hours, overtime compensation, or deductions:\n\n1. Cross-reference your time card punches in **My Attendance** and ensure any filed requests (OT, Log Corrections, Leaves) were approved before the cutoff.\n2. Submit a payroll inquiry to the HR or Finance office within the **3-day cutoff dispute window** before payout disbursement for review and manual adjustment."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How is the 13th-Month Pay calculated and when is it issued?",
          a: "In compliance with **Presidential Decree No. 851**, 13th-month pay is calculated using the statutory formula:\n\n**Total Basic Salary Earned within Calendar Year ÷ 12**\n\n• It includes all basic salary earned for actual services rendered (prorated for employees hired mid-year).\n• It excludes non-basic compensation like overtime, night shift premiums, unworked holiday pay, and discretionary bonuses.\n• Employees can track accumulated 13th-month accruals in the employee portal under payroll details."
        },
        {
          roles: [1, 2, 3, 4],
          q: "How are statutory contributions (SSS, PhilHealth, Pag-IBIG) and BIR taxes deducted?",
          a: "MAChip automatically applies statutory rates using the active Philippine government contribution schedules:\n\n• **SSS**: Deducts Regular Social Security and Mandatory Provident Fund (MPF/WISP) based on your Monthly Salary Credit bracket.\n• **PhilHealth**: Calculates statutory premium percentage (shared equally between employer and employee) within legal floor and ceiling limits.\n• **Pag-IBIG**: Applies 1-2% employee contribution and 2% employer counterpart up to statutory maximum limits.\n• **BIR Withholding Tax**: Progressive withholding tax based on semi-monthly or monthly taxable earnings."
        },
        {
          roles: [3],
          q: "How do loan amortizations (SSS, Pag-IBIG, EastWest, Cash Advance) appear on my payslip?",
          a: "Active employee cash advances and government loans (SSS, Pag-IBIG, EastWest) approved by HR/Finance have scheduled semi-monthly amortizations automatically deducted from your payroll until the remaining balance reaches zero. You can track your remaining principal balance and payment timeline directly on your Employee Payslip and Payroll Computation pages."
        },
        {
          roles: [1, 4],
          q: "How are government and employee loans managed in the system?",
          a: "Accountants track SSS, Pag-IBIG, and EastWest bank loans in **Payroll > Government Loans** and corporate cash advances in **Payroll > Employee Loan**. The system automatically computes and applies scheduled amortization deductions during payroll generation until the balance reaches zero."
        },
        {
          roles: [3],
          q: "How is Maxicare HMO premium deduction handled on my payslip?",
          a: "If enrolled in the company Maxicare healthcare plan, your monthly employee premium share is evenly split across the two payroll cutoffs each month as an authorized medical benefit deduction."
        },
        {
          roles: [1, 4],
          q: "Where do I configure Maxicare HMO plans and corporate premium sharing?",
          a: "HMO plans are managed in **Payroll > HMO Management**. Here, the Accountant sets up employee and employer contribution breakdowns and monthly premium amortizations which are deducted from payroll."
        },
        {
          roles: [1, 4],
          q: "Where are annual 13th-Month bonuses and other benefits calculated?",
          a: "Navigate to **Payroll > Labor Benefits**. This module computes annual **13th-month bonuses** according to **Presidential Decree No. 851**, retirement pay, and separation pay based on employment duration and daily rates."
        },
        {
          roles: [1, 4],
          q: "How do I download payslips for employees in batches?",
          a: "Administrators and Accountants can go to **Admin Reports > Payroll Report**, filter by period, and click **'Batch ZIP Payslips'**. For security, the ZIP is encrypted using a password pattern based on the payroll period."
        },
        {
          roles: [1, 4],
          q: "What is the password format for opening encrypted batch payslip files?",
          a: "For data security and confidentiality under privacy regulations, batch payslip archives are encrypted. The default archive password format follows company convention (such as the **Payroll Period Code** e.g., *MACJ-2026-03A* or employee birthday/ID format). Inquire with your HR or Finance department for your designated key format."
        }
      ]
    },
    {
      id: "settings",
      category: () => "System Settings & Auditing",
      roles: [1, 4],
      questions: [
        {
          roles: [1, 4],
          q: "Why are configuration fields locked in the Settings tabs?",
          a: "To prevent accidental modifications to critical operational rules, settings tabs (**System Variables**, **Attendance**, **Notifications**, **Salary Grades**, and **Reference Tables**) are locked in read-only mode by default. Authorized administrators must click the orange **'Edit Configuration'** button to make edits, then click **'Save Changes'** to persist or **'Cancel'** to revert."
        },
        {
          roles: [1],
          q: "How do administrators upload or update statutory reference tables (SSS, PhilHealth, Pag-IBIG, BIR)?",
          a: "Go to **Settings > Ref Table**:\n1. Click **'Edit Configuration'** to enable controls.\n2. Select the agency tab (**SSS**, **PhilHealth**, **Pag-IBIG**, or **BIR Tax**).\n3. Click **'Download Active CSV'** to get an Excel template pre-filled with existing brackets.\n4. Input the new rates and brackets, select the **Effective Date**, and attach your CSV.\n5. Click **'Upload & Parse CSV'** and confirm your **Admin Password** in the 2-step security modal. Calculations after the effective date will automatically adopt the new brackets."
        },
        {
          roles: [1, 4],
          q: "Where do I configure holidays in the system?",
          a: "The system fetches official Philippine holidays using the **Nager.Date REST API**, supplemented with a static list of annually proclaimed holidays. These can be adjusted in the **Configuration** settings page."
        },
        {
          roles: [1, 4],
          q: "What is the difference between Audit Logs and Transaction Logs?",
          a: "Under settings:\n• **Audit Logs** capture user activity for security compliance, such as request actions, profile modifications, or time card adjustments.\n• **Transaction Logs** track financial transactions and ledger records generated during payroll calculations."
        }
      ]
    }
  ];

  // 1. Role-based filtering: Prune categories and questions unauthorized for the active user role
  const roleFilteredFaqs = useMemo(() => {
    return rawFaqData
      .filter((section) => !section.roles || section.roles.includes(roleId))
      .map((section) => {
        const allowedQuestions = section.questions.filter((q) => q.roles.includes(roleId));
        const sectionTitle = typeof section.category === "function" ? section.category(roleId) : section.category;
        return {
          id: section.id,
          category: sectionTitle,
          questions: allowedQuestions
        };
      })
      .filter((section) => section.questions.length > 0);
  }, [roleId]);

  // Total topics available to this role
  const totalQuestions = useMemo(() => {
    return roleFilteredFaqs.reduce((acc, cat) => acc + cat.questions.length, 0);
  }, [roleFilteredFaqs]);

  // 2. Search & Category selection filtering
  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return roleFilteredFaqs
      .filter((section) => selectedCategory === "all" || section.id === selectedCategory)
      .map((section) => ({
        ...section,
        questions: section.questions.filter((q) => {
          if (!query) return true;
          return (
            q.q.toLowerCase().includes(query) ||
            q.a.toLowerCase().includes(query)
          );
        })
      }))
      .filter((section) => section.questions.length > 0);
  }, [roleFilteredFaqs, selectedCategory, searchQuery]);

  return (
    <Sidebar>
      <div className="flex flex-col w-full min-h-screen p-4 md:p-8 bg-slate-50/50">
        
        {/* Header Section */}
        <div className="text-center mb-10 max-w-3xl mx-auto">
          {/* Role Access Badge */}
          {/* <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4 shadow-sm border bg-white">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${roleInfo.badgeColor}`}>
              <SecurityIcon className="!text-[14px]" />
              {roleInfo.badge}
            </span>
            <span className="text-slate-400 font-medium">|</span>
            <span className="text-slate-500 font-medium">{totalQuestions} Topics Available</span>
          </div> */}

          <div className="flex items-center justify-center mb-3">
            <div className="inline-flex items-center justify-center p-3 bg-brand-primary/10 text-brand-primary rounded-2xl shadow-inner">
              <HelpOutlineIcon fontSize="large" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-primary tracking-tight mb-2">
            {roleInfo.title}
          </h1>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            {roleInfo.subtext}
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto w-full mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              className="pl-12 pr-10 h-14 bg-white border-slate-200 shadow-md text-base rounded-2xl focus-visible:ring-brand-primary placeholder:text-slate-400"
              placeholder="Search knowledge base (e.g. 'tardiness', 'overtime', 'payslip')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                title="Clear search"
              >
                <CloseIcon fontSize="small" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto w-full mb-10">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === "all"
                ? "bg-brand-primary text-white shadow-sm shadow-brand-primary/30"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Topics ({totalQuestions})
          </button>
          {roleFilteredFaqs.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat.id
                  ? "bg-brand-primary text-white shadow-sm shadow-brand-primary/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat.category} ({cat.questions.length})
            </button>
          ))}
        </div>

        {/* FAQ Accordion Content */}
        <div className="max-w-3xl mx-auto w-full space-y-8">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((section, idx) => (
              <div key={section.id || idx} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {section.category}
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {section.questions.length} {section.questions.length === 1 ? "article" : "articles"}
                  </span>
                </div>
                <Card className="border border-slate-200/80 shadow-sm overflow-hidden bg-white rounded-2xl">
                  <Accordion type="single" collapsible className="w-full">
                    {section.questions.map((faq, fIdx) => (
                      <AccordionItem 
                        key={fIdx} 
                        value={`item-${section.id}-${fIdx}`} 
                        className="border-b border-slate-100 last:border-0 px-4 transition-all duration-200 data-[state=open]:bg-[#f8f6fc] data-[state=open]:border-l-4 data-[state=open]:border-brand-primary data-[state=open]:pl-5"
                      >
                        <AccordionTrigger className="text-left font-bold text-slate-800 hover:text-brand-primary hover:no-underline py-4 text-sm md:text-base leading-snug">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-600 leading-relaxed pb-5 pt-1 text-sm whitespace-pre-line border-t border-slate-100/60 mt-1">
                          {formatAnswer(faq.a)}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Card>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <HelpOutlineIcon className="text-slate-300 mb-3" sx={{ fontSize: 48 }} />
              <h3 className="text-base font-bold text-slate-700 mb-1">No Matching Articles Found</h3>
              <p className="text-slate-400 text-sm mb-4">
                No results found for "{searchQuery}". Try adjusting your keywords or clearing the search query.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="text-xs font-semibold text-brand-primary border-brand-primary/30 hover:bg-brand-primary/5"
              >
                Reset Filters & Search
              </Button>
            </div>
          )}
        </div>

        {/* Support CTA */}
        <div className="mt-12 text-center bg-white rounded-2xl p-8 shadow-sm border border-slate-200 max-w-3xl mx-auto w-full">
          <div className="inline-flex items-center justify-center p-3 bg-purple-50 text-brand-primary rounded-full mb-3">
            <ContactSupportIcon fontSize="large" />
          </div>
          <h3 className="text-lg font-bold text-brand-primary mb-1">Still need assistance?</h3>
          <p className="text-slate-500 mb-5 text-sm max-w-md mx-auto">
            If you have an urgent payroll inquiry or technical issue with your biometric terminal, submit a direct inquiry to our administrative team.
          </p>
          <Button 
            className="bg-brand-primary hover:bg-brand-primary-hover px-8 text-sm font-semibold rounded-xl shadow-md shadow-brand-primary/20"
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