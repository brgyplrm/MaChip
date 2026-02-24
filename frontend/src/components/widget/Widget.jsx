import "./widget.scss";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';

const Widget = ({ type }) => {
  let data;

  //temporary
  const amount = 10;
  const diff = 20;

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
          {data.isMoney && "$"} {amount}
        </span>
        <span className="link">{data?.link}</span>
      </div>
      <div className="right">
        {data.icon}
      </div>
    </div>
  );
};

export default Widget;
