import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const faqData = [
    {
      category: "Attendance & Logging",
      questions: [
        {
          q: "How do I clock in using the MaChip system?",
          a: "You can clock in by scanning your RFID card at the designated station. Ensure the system displays a 'Success' message. If the scanner is unavailable, contact your supervisor for a manual log entry."
        },
        {
          q: "What should I do if I forgot to clock out?",
          a: "If you missed a clock-out event, you must file a 'Log Correction' request through the User Requests page. Provide the estimated time and a brief explanation for the correction."
        }
      ]
    },
    {
      category: "Requests & Leaves",
      questions: [
        {
          q: "How long does it take for a leave request to be approved?",
          a: "Standard requests are typically reviewed by Supervisors within 24-48 hours. You can track the status (Pending, Recommended, or Approved) in your Request History tab."
        },
        {
          q: "Can I cancel a request after submitting it?",
          a: "Requests can be cancelled as long as they are still in 'Pending' status. Once a request has been 'Recommended' or 'Approved', you must contact HR or Admin to revert it."
        }
      ]
    },
    {
      category: "Payroll & Deductions",
      questions: [
        {
          q: "Where can I view my payslips?",
          a: "Payslips are available in the Payroll section once the period has been 'Released' by the Accountant. You can view details online or download a PDF version for your records."
        },
        {
          q: "How is my Maxicare HMO deduction calculated?",
          a: "HMO deductions are amortized over your specific renewal cycle (usually 12 months). The amount is split between the Employer and Employee based on the company's current policy percentage."
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
                      <AccordionItem key={fIdx} value={`item-${idx}-${fIdx}`} className="border-b border-slate-100 last:border-0 px-4">
                        <AccordionTrigger className="text-left font-semibold text-[#2A174E] hover:no-underline py-4">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-600 leading-relaxed pb-4">
                          {faq.a}
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
        <div className="mt-16 text-center bg-white rounded-2xl p-8 shadow-sm border border-slate-100 max-w-3xl mx-auto w-full">
          <ContactSupportIcon className="text-[#2A174E] mb-4" fontSize="large" />
          <h3 className="text-xl font-bold text-[#2A174E] mb-2">Still have questions?</h3>
          <p className="text-slate-500 mb-6 text-sm">Our support team is here to help with any technical issues or payroll concerns.</p>
          <Button className="bg-[#2A174E] hover:bg-[#1a0e30] px-8">
            Contact Support
          </Button>
        </div>
      </div>
    </Sidebar>
  );
};

export default FAQ;