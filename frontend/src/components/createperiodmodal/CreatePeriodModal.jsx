import React, { useState, useEffect } from "react";
import { useSystemTime } from "../../context/SystemTimeContext";

// shadcn/ui components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const CreatePeriodModal = ({ isOpen, onClose, onCreate }) => {
  const { systemToday } = useSystemTime();
  const [selectedOption, setSelectedOption] = useState("current"); // "current" or "next"
  const [options, setOptions] = useState({ current: null, next: null });

  useEffect(() => {
    if (!systemToday) return;

    const formatLocalISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatDateRange = (start, end) => {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };

    const getLabel = (start, end) => {
      const monthName = start.toLocaleString('default', { month: 'long' });
      const dayRange = start.getDate() === 1 ? "1-15" : `16-${end.getDate()}`;
      return `${monthName} ${dayRange}, ${start.getFullYear()}`;
    };

    // Calculate Current Period
    let currentStart, currentEnd;
    const year = systemToday.getFullYear();
    const month = systemToday.getMonth();
    if (systemToday.getDate() <= 15) {
      currentStart = new Date(year, month, 1);
      currentEnd = new Date(year, month, 15);
    } else {
      currentStart = new Date(year, month, 16);
      currentEnd = new Date(year, month + 1, 0);
    }

    // Calculate Next Period
    let nextStart, nextEnd;
    if (currentStart.getDate() === 1) {
      nextStart = new Date(year, month, 16);
      nextEnd = new Date(year, month + 1, 0);
    } else {
      nextStart = new Date(year, month + 1, 1);
      nextEnd = new Date(year, month + 1, 15);
    }

    setOptions({
      current: {
        startDate: formatLocalISO(currentStart),
        endDate: formatLocalISO(currentEnd),
        periodText: formatDateRange(currentStart, currentEnd),
        label: getLabel(currentStart, currentEnd)
      },
      next: {
        startDate: formatLocalISO(nextStart),
        endDate: formatLocalISO(nextEnd),
        periodText: formatDateRange(nextStart, nextEnd),
        label: getLabel(nextStart, nextEnd)
      }
    });
  }, [systemToday]);

  const currentSelection = selectedOption === "current" ? options.current : options.next;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#2A174E]">Create Payroll Period</DialogTitle>
          <DialogDescription className="text-slate-500">
            Only the current and next periods can be scheduled manually.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div 
            className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
              selectedOption === "current" 
                ? "bg-[#f0ebfa] border-[#2A174E] ring-1 ring-[#2A174E]" 
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setSelectedOption("current")}
          >
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mr-4 ${
              selectedOption === "current" ? "border-[#2A174E]" : "border-slate-300"
            }`}>
              {selectedOption === "current" && <div className="w-2 h-2 rounded-full bg-[#2A174E]" />}
            </div>
            <div>
              <span className="block text-sm font-semibold text-slate-800">Current Period</span>
              <span className="block text-xs text-slate-500 mt-0.5">{options.current?.label}</span>
            </div>
          </div>

          <div 
            className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
              selectedOption === "next" 
                ? "bg-[#f0ebfa] border-[#2A174E] ring-1 ring-[#2A174E]" 
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setSelectedOption("next")}
          >
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mr-4 ${
              selectedOption === "next" ? "border-[#2A174E]" : "border-slate-300"
            }`}>
              {selectedOption === "next" && <div className="w-2 h-2 rounded-full bg-[#2A174E]" />}
            </div>
            <div>
              <span className="block text-sm font-semibold text-slate-800">Next Period</span>
              <span className="block text-xs text-slate-500 mt-0.5">{options.next?.label}</span>
            </div>
          </div>
        </div>

        {currentSelection && (
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-800 flex items-center justify-center mb-2">
            <strong className="mr-2">Selected Range:</strong> {currentSelection.periodText}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4 sm:space-x-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-1/2 border-slate-200 text-slate-600">
            Cancel
          </Button>
          <Button 
            className="w-full sm:w-1/2 bg-[#2A174E] text-white hover:bg-[#1a0e30]" 
            disabled={!currentSelection}
            onClick={() => onCreate(currentSelection)}
          >
            Create {selectedOption === "current" ? "Current" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePeriodModal;