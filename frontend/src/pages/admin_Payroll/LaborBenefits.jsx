import React from "react";
import Sidebar from "../../components/Sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Import your existing components
import ThirteenthMonth from "./subtabs/ThirteenthMonth";
import SeparationPay from "./subtabs/SeparationPay";
import RetirementPay from "./subtabs/RetirementPay";

const LaborBenefits = () => {
  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <TooltipProvider>
          <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
            {/* Main Page Header */}
            <div className="group flex items-start md:items-center gap-0 mb-6 transition-all">
              {/* Back Button: Hidden by default, slides and fades in on hover */}
              <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        asChild 
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-primary"
                      >
                        <Link to="/payroll">
                          <ChevronLeft className="h-6 w-6" />
                        </Link>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Back to Payroll Management
                  </TooltipContent>
                </Tooltip>
              </div>

            {/* Title: Adds left padding when hovered */}
            <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary leading-tight">Labor Benefits Management</h1>
              <span className="text-sm text-slate-500 mt-1 block">Manage statutory benefits, separations, and retirement payouts.</span>
            </div>
          </div>

          {/* Unified Tab Structure */}
          <Tabs defaultValue="13th-month" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-3 md:w-auto md:inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200/50">
              <TabsTrigger value="13th-month" className="font-bold text-xs uppercase px-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full h-full block">13th Month Pay</span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Manage annual statutory 13th-month bonus distributions
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>

              <TabsTrigger value="separation" className="font-bold text-xs uppercase px-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full h-full block">Separation Pay</span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Manage statutory separation payout computations
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>

              <TabsTrigger value="retirement" className="font-bold text-xs uppercase px-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full h-full block">Retirement Pay</span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                    Manage statutory retirement benefit payouts
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="13th-month">
              <ThirteenthMonth />
            </TabsContent>

            <TabsContent value="separation">
              <SeparationPay />
            </TabsContent>

            <TabsContent value="retirement">
              <RetirementPay />
            </TabsContent>
          </Tabs>
          </div>
        </TooltipProvider>
      </Sidebar>
    </div>
  );
};

export default LaborBenefits;