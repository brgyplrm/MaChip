import React from "react";

const EmptyState = ({ 
  icon, 
  title = "No data found", 
  description = "There is currently no data to display here.",
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[150px] p-8 md:p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 transition-all hover:bg-slate-50">
      
      {/* Icon Container */}
      {icon && (
        <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-slate-100 shadow-sm border border-slate-200">
          {icon}
        </div>
      )}
      
      {/* Text Content */}
      <h3 className="text-lg font-bold text-[#2A174E] mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      
      {/* Optional Action Button Container */}
      {action && (
        <div className="mt-2 flex justify-center">
          {action}
        </div>
      )}
      
    </div>
  );
};

export default EmptyState;