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
    <div className="chart h-full flex flex-col !bg-transparent !shadow-none !border-none">
      <div className="title">{title}</div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" aspect={aspect}>
          <AreaChart
            width={730}
            height={250}
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
          <defs>
            <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B4E17" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3B4E17" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" stroke="gray" />
          <YAxis stroke="gray" />
          <CartesianGrid strokeDasharray="3 3" className="chartGrid" />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="OnTime"
            stroke="#3B4E17"
            fillOpacity={1}
            fill="url(#colorOnTime)"
          />
          <Area
            type="monotone"
            dataKey="Late"
            stroke="#D4AF37"
            fillOpacity={1}
            fill="url(#colorLate)"
          />
          <Area
            type="monotone"
            dataKey="Absent"
            stroke="#ff4d4f"
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
