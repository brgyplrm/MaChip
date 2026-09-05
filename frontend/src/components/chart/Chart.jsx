import React, { useState, useEffect } from "react";
import "./chart.scss";
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  YAxis,
  Legend
} from "recharts";
import { fetchWithAuth } from "../../utils/api";

const Chart = ({ aspect, title, userId }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = userId 
          ? `/api/attendance/monthly-stats/${userId}`
          : "/api/attendance/monthly-stats";
          
        const response = await fetchWithAuth(url);
        if (response.ok) {
          const stats = await response.json();
          // Trim whitespace from TO_CHAR names
          const formattedStats = stats.map(s => ({
            ...s,
            name: s.name ? s.name.trim() : "Unknown"
          }));
          setData(formattedStats);
        }
      } catch (error) {
        console.error("Error fetching monthly stats:", error);
      }
    };
    fetchStats();
  }, [userId]);

  return (
    <div className="chart h-full w-full flex flex-col !bg-transparent !shadow-none !border-none overflow-hidden">
      {title && <div className="title">{title}</div>}
      <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" aspect={aspect}>
          <AreaChart
            width={730}
            height={250}
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
          <defs>
            <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7A52B5" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#7A52B5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12, fontWeight: 500 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Area
            type="monotone"
            dataKey="OnTime"
            name="On Time"
            stroke="#2A174E"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorOnTime)"
          />
          <Area
            type="monotone"
            dataKey="Late"
            name="Late"
            stroke="#f59e0b"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorLate)"
          />
          <Area
            type="monotone"
            dataKey="Absent"
            name="Absent"
            stroke="#ef4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorAbsent)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
};

export default Chart;
