import "./widget.scss";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import { useState, useEffect, useCallback } from "react";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";

// Returns milliseconds from current time until the next 12:00 AM (midnight)
const msUntilMidnight = (currentTime) => {
  const midnight = new Date(currentTime);
  midnight.setHours(24, 0, 0, 0); 
  return midnight - currentTime;
};

const Widget = ({ type }) => {
  const { systemToday } = useSystemTime();
  const [amount, setAmount] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetchWithAuth(
        "/api/attendance/stats",
      );
      if (response.ok) {
        const stats = await response.json();
        switch (type) {
          case "officeOccupancy":
            setAmount(stats.officeOccupancy || 0);
            break;
          case "onTime":
            setAmount(stats.onTimeCount || 0);
            break;
          case "lateArrivals":
            setAmount(stats.lateArrivalsCount || 0);
            break;
          default:
            break;
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  }, [type]);

  useEffect(() => {
    // 1. Fetch immediately on mount
    fetchStats();

    // 2. Poll every 5 seconds so the counts stay live throughout the day
    const pollInterval = setInterval(fetchStats, 5000);

    // 3. Listen for socket/real-time refresh
    window.addEventListener("dataRefresh", fetchStats);

    // 4. At exactly midnight, reset to 0 then re-fetch
    const midnightTimeout = setTimeout(() => {
      setAmount(0); // instant visual reset at 12:00 AM
      fetchStats(); // confirm with the backend (should return 0)
    }, msUntilMidnight(systemToday));

    return () => {
      clearInterval(pollInterval);
      clearTimeout(midnightTimeout);
      window.removeEventListener("dataRefresh", fetchStats);
    };
  }, [fetchStats]);

  let data;

  switch (type) {
    case "officeOccupancy":
      data = {
        title: "Office Occupancy",
        isMoney: false,
        icon: (
          <PersonOutlinedIcon
            className="icon"
            style={{
              color: "white",
            }}
          />
        ),
      };
      break;
    case "onTime":
      data = {
        title: "On time (8:00 AM)",
        isMoney: false,
        icon: (
          <AccessTimeIcon
            className="icon"
            style={{
              color: "white",
            }}
          />
        ),
      };
      break;
    case "lateArrivals":
      data = {
        title: "Late Arrivals",
        isMoney: false,
        icon: (
          <AssignmentLateIcon className="icon" style={{ color: "white" }} />
        ),
      };
      break;
    default:
      break;
  }

  return (
    <div className="widget">
      <div className="left">
        <span className="title">{data?.title}</span>
        <span className="counter">
          {data?.isMoney && "$"} {amount}
        </span>
        <span className="link">{data?.link}</span>
      </div>
      <div className="right">{data?.icon}</div>
    </div>
  );
};

export default Widget;
