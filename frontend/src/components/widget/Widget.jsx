import "./widget.scss";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";

const Widget = ({ type, amount, loading }) => {
  let data;

  switch (type) {
    case "officeOccupancy":
      data = {
        title: "Office Occupancy",
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
          {loading ? "..." : amount}
        </span>
      </div>
      <div className="right">{data?.icon}</div>
    </div>
  );
};

export default Widget;
