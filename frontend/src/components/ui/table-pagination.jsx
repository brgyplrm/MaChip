import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TablePagination = ({
  currentPage = 1,
  totalPages = 1,
  setCurrentPage,
  totalItems = 0,
  itemsPerPage = 10,
  setItemsPerPage,
  startIndex,
  endIndex,
  itemLabel = "records",
  pageSizeOptions = [5, 10, 20, 50],
  className = "",
  compact = false,
}) => {
  if (totalItems <= 0) return null;

  const actualStart = startIndex !== undefined ? startIndex + 1 : Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const actualEnd = endIndex !== undefined ? endIndex : Math.min(currentPage * itemsPerPage, totalItems);
  const computedTotalPages = totalPages || Math.ceil(totalItems / itemsPerPage) || 1;

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50 gap-2 shrink-0 ${className}`}>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-800 font-semibold">{actualStart}</span>-
          <span className="text-slate-800 font-semibold">{actualEnd}</span> of{" "}
          <span className="text-slate-800 font-semibold">{totalItems}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8 px-2.5 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 text-xs"
          >
            Previous
          </Button>
          <div className="flex items-center justify-center min-w-[28px] h-8 text-xs font-semibold text-brand-primary bg-brand-primary/10 rounded-md">
            {currentPage}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, computedTotalPages))}
            disabled={currentPage === computedTotalPages || computedTotalPages === 0}
            className="h-8 px-2.5 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30 ${className}`}>
      <div className="flex items-center gap-4 text-sm text-slate-500">
        {setItemsPerPage && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page:</span>
            <Select 
              value={itemsPerPage.toString()} 
              onValueChange={(val) => {
                setItemsPerPage(Number(val));
                if (setCurrentPage) setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                <SelectValue placeholder={itemsPerPage.toString()} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt.toString()}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="font-medium">
          Showing <span className="text-slate-800">{actualStart}</span> to{" "}
          <span className="text-slate-800">{actualEnd}</span> of{" "}
          <span className="text-slate-800">{totalItems} {itemLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
        >
          Previous
        </Button>
        
        <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-brand-primary bg-brand-primary/10 rounded-md">
          {currentPage}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, computedTotalPages))}
          disabled={currentPage === computedTotalPages || computedTotalPages === 0}
          className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default TablePagination;
