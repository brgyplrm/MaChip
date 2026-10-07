import CalendarManagement from "../../pages/admin_Calendar/CalendarManagement";
import EmployeeCalendar from "../../pages/emp_Calendar/EmployeeCalendar";
import { getStoredUser, getStoredViewMode } from "../../utils/authStorage";

const CalendarRedirect = () => {
  const userData = getStoredUser();
  const roleId = userData?.user_RoleId;
  const viewMode = getStoredViewMode("management");

  // If Management role AND in management mode, show management; otherwise show employee view
  if ((roleId === 1 || roleId === 2 || roleId === 4) && viewMode === "management") {
    return <CalendarManagement />;
  }
  
  return <EmployeeCalendar />;
};

export default CalendarRedirect;