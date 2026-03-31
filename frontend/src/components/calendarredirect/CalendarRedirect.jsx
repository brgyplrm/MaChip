import CalendarManagement from "../../pages/admin_Calendar/CalendarManagement";
import EmployeeCalendar from "../../pages/emp_Calendar/EmployeeCalendar";

const CalendarRedirect = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const roleId = userData?.user_RoleId; //

  // If Admin (Role 1), show management; otherwise show view-only
  return roleId === 1 ? <CalendarManagement /> : <EmployeeCalendar />;
};

export default CalendarRedirect;