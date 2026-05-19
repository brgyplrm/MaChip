import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";

export default function LoanAdjustmentDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-xl border-none">
        {/* Header Section */}
        <div className="bg-[#4a2b6d] p-6 text-white relative">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Ad-Hoc Loan Adjustments
            </DialogTitle>
            <DialogDescription className="text-purple-100 text-lg opacity-90">
              Emergency Medical Advance - Cydoel Tomas
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-8 bg-white">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500 font-medium">Principal</p>
              <p className="text-xl font-bold text-slate-900">₱15,000</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Amount Paid</p>
              <p className="text-xl font-bold text-emerald-600">₱7,500</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Outstanding</p>
              <p className="text-xl font-bold text-orange-600">₱7,500</p>
            </div>
          </div>

          {/* Lump-Sum Payment */}
          <div className="space-y-2">
            <Label className="text-[15px] font-semibold text-slate-700">
              Lump-Sum Payment (₱)
            </Label>
            <Input
              type="number"
              placeholder="Enter cash payment amount"
              className="h-12 border-slate-200 focus-visible:ring-emerald-500"
            />
            <p className="text-xs text-slate-400">Manual payment outside payroll cycle</p>
          </div>

          {/* Pause Switch */}
          <div className="flex items-center justify-between py-4 border-y border-slate-100">
            <div>
              <Label className="text-[15px] font-semibold text-slate-700">
                Pause Loan Deductions
              </Label>
              <p className="text-xs text-slate-400">Skip upcoming payroll run</p>
            </div>
            <Switch className="data-[state=checked]:bg-emerald-500" />
          </div>

          {/* Modify Installment */}
          <div className="space-y-2">
            <Label className="text-[15px] font-semibold text-slate-700">
              Modify Installment Amount (₱)
            </Label>
            <Input
              type="number"
              placeholder="New installment amount"
              className="h-12 border-slate-200 focus-visible:ring-emerald-500"
            />
            <p className="text-xs text-slate-400">Adjust remaining installment amounts</p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 bg-slate-50 flex gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="px-8 h-11 border-slate-300 text-slate-600"
          >
            Cancel
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 px-8 h-11 gap-2">
            <Save className="h-4 w-4" />
            Apply Adjustments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}