import React from "react";
import Sidebar from "../../components/Sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// Import your existing components
import ThirteenthMonth from "./subtabs/ThirteenthMonth";
import SeparationPay from "./subtabs/SeparationPay";
import RetirementPay from "./subtabs/RetirementPay";

const LaborBenefits = () => {
  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          {/* Main Page Header */}
          <div className="group flex items-start md:items-center gap-0 mb-6 transition-all">
            {/* Back Button: Hidden by default, slides and fades in on hover */}
            <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
              <Button 
                variant="ghost" 
                size="icon" 
                asChild 
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E]"
              >
                <Link to="/payroll">
                  <ArrowBackIcon className="h-6 w-6" />
                </Link>
              </Button>
            </div>

            {/* Title: Adds left padding when hovered */}
            <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Labor Benefits Management</h1>
              <span className="text-sm text-slate-500 mt-1 block">Manage statutory benefits, separations, and retirement payouts.</span>
            </div>
          </div>

          {/* Unified Tab Structure */}
          <Tabs defaultValue="13th-month" className="w-full">
            <TabsList className="mb-2 grid w-full grid-cols-3 md:w-auto md:inline-flex">
              <TabsTrigger value="13th-month">13th Month Pay</TabsTrigger>
              <TabsTrigger value="separation">Separation Pay</TabsTrigger>
              <TabsTrigger value="retirement">Retirement Pay</TabsTrigger>
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
      </Sidebar>
    </div>
  );
};

export default LaborBenefits;