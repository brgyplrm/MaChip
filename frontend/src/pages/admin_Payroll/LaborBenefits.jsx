import React from "react";
import Sidebar from "../../components/Sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Labor Benefits Administration</h1>
            <p className="text-sm text-slate-500 mt-1">Manage statutory benefits, separations, and retirement payouts.</p>
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