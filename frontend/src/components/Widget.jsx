import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import LibraryAddCheckIcon from "@mui/icons-material/LibraryAddCheck";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

const Widget = ({ type, amount, loading, description }) => {
  let data;

  switch (type) {
    case "officeOccupancy":
      data = {
        title: "Office Occupancy",
        color: "#2A174E",
        icon: (
          <PersonOutlinedIcon
            className="!text-[35px] p-1.5 rounded-md text-white"
          />
        ),
      };
      break;
    case "onTime":
      data = {
        title: "On time (8:00 AM)",
        color: "#3B4E17",
        icon: (
          <AccessTimeIcon
            className="!text-[35px] p-1.5 rounded-md text-white"
          />
        ),
      };
      break;
    case "lateArrivals":
      data = {
        title: "Late Arrivals",
        color: "#ECC04B",
        icon: (
          <AssignmentLateIcon className="!text-[35px] p-1.5 rounded-md text-white" />
        ),
      };
      break;
    case "pendingApprovals":
      data = {
        title: "Pending Approvals",
        color: "#3B4E17",
        icon: (
          <LibraryAddCheckIcon className="!text-[35px] p-1.5 rounded-md text-white" />
        ),
      };
      break;
    case "payrollPreview":
      data = {
        title: "Payroll Preview",
        color: "#D4AF37",
        icon: (
          <AccountBalanceWalletIcon className="!text-[35px] p-1.5 rounded-md text-white" />
        ),
      };
      break;
    default:
      break;
  }

  return (
    <div 
      className="flex justify-between flex-1 p-3 shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] rounded-xl h-[110px] transition-transform hover:scale-[1.02] duration-200"
      style={{ backgroundColor: data?.color || "#2A174E" }}
    >
      <div className="flex flex-col justify-between p-2">
        <span className="font-bold text-sm text-white tracking-wider">{data?.title}</span>
        <div className="flex flex-col">
          <span className="text-4xl font-bold text-white">
            {loading ? "..." : amount}
          </span>
          {description && (
            <span className="text-xs text-white/80 font-medium mt-1 italic">
              {description}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-start items-end p-2">
        <div className="bg-white/10 rounded-lg flex items-center justify-center">
          {data?.icon}
        </div>
      </div>
    </div>
  );
};

export default Widget;
