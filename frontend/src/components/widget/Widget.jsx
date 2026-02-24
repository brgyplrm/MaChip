import "./widget.scss";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { useState, useEffect } from "react";

const Widget = ({ type }) => {
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/attendance/stats");
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
    };
    fetchStats();
  }, [type]);

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
              color: "white"
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
          <AssignmentLateIcon
            className="icon"
            style={{ color: "white" }}
          />
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
      <div className="right">
        {data?.icon}
      </div>
    </div>
  );
};

export default Widget;
