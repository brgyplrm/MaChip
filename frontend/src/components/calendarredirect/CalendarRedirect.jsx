import CalendarManagement from "../../pages/admin_Calendar/CalendarManagement";
import EmployeeCalendar from "../../pages/emp_Calendar/EmployeeCalendar";

const CalendarRedirect = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const roleId = userData?.user_RoleId;
  const viewMode = localStorage.getItem("viewMode") || "management";

  // If Management role AND in management mode, show management; otherwise show employee view
  if ((roleId === 1 || roleId === 2) && viewMode === "management") {
    return <CalendarManagement />;
  }
  
  return <EmployeeCalendar />;
};

export default CalendarRedirect;