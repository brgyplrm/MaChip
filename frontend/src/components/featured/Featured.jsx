import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";

const Featured = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="flex-[2] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] p-4 bg-white rounded-xl flex flex-col items-center justify-center min-h-[350px]">
        <p className="text-gray-500 font-medium">Loading summary...</p>
      </div>
    );
  }

  const presentCount = stats.onTimeCount + stats.lateArrivalsCount;
  const attendancePercentage = stats.totalEmployees > 0 
    ? Math.round((presentCount / stats.totalEmployees) * 100) 
    : 0;

  return (
    <div className="flex-[2] shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] p-4 bg-white rounded-xl transition-all duration-300">
      <div className="flex items-center justify-between text-gray-500 mb-4">
        <h1 className="text-base tracking-wider">Daily Attendance Summary</h1>
      </div>
      <div className="flex flex-col items-center justify-between gap-5 p-2">
        <div className="w-28 h-28">
          <CircularProgressbar 
            value={attendancePercentage} 
            text={`${attendancePercentage}%`} 
            strokeWidth={8} 
            styles={buildStyles({
                pathColor: "#BA90E9",
                textColor: "#040405",
                trailColor: "var(--color-brand-primary-light)"
            })}
          />
        </div>
        <div className="text-center">
          <p className=" text-gray-500 text-sm">Employees Present</p>
          <p className="text-4xl font-bold text-brand-primary mt-1">{presentCount}/{stats.totalEmployees}</p>
        </div>
        <p className="font-light text-xs text-gray-400 text-center px-4">
          Real-time snapshot of the workforce currently active in the system.
        </p>
        
        <div className="w-full flex items-center justify-between mt-4 border-t border-gray-100 pt-6">
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400 font-medium">Absentees</div>
            <div className="flex items-center justify-center mt-1 text-red-500 font-bold">
              <KeyboardArrowDownIcon fontSize="small"/>
              <div className="text-lg">{stats.absentCount}</div>
            </div>
          </div>
          <div className="text-center flex-1 border-x border-gray-100">
            <div className="text-sm text-gray-400 font-medium">On Leave</div>
            <div className="flex items-center justify-center mt-1 text-green-500 font-bold">
              <KeyboardArrowUpOutlinedIcon fontSize="small"/>
              <div className="text-lg">{stats.onLeaveCount}</div>
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400 font-medium">Late</div>
            <div className="flex items-center justify-center mt-1 text-orange-500 font-bold">
              <KeyboardArrowDownIcon fontSize="small"/>
              <div className="text-lg">{stats.lateArrivalsCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Featured;
