import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import Widget from "../../components/widget/Widget";
import Table from "../../components/table/Table";
import Chart from "../../components/chart/Chart";
import "./employeeHome.scss";

const EmployeeHome = () => {
  // Retrieve the logged-in user's ID from local storage
  const userData = JSON.parse(localStorage.getItem("userData"));
  const userId = userData?.user_Id;

  return (
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="widgets">
          {/* Modified Widgets focusing on the individual */}
          <div className="widget" style={{ backgroundColor: "#2A174E", color: "white", padding: "20px", borderRadius: "10px", flex: 1 }}>
            <span className="title" style={{ fontSize: "14px", fontWeight: "bold" }}>MY STATUS</span>
            <div className="counter" style={{ fontSize: "24px", marginTop: "10px" }}>
              {userData?.user_Role || "Employee"}
            </div>
            <span className="link" style={{ fontSize: "12px", borderBottom: "1px solid gray" }}>View Profile</span>
          </div>
          
          {/* Reuse your existing Widget component logic for personal stats if available */}
          <Widget type="onTime" /> 
          <Widget type="lateArrivals" />
        </div>

        <div className="charts">
          {/* Personal consistency chart */}
          <Chart title="My Attendance Activity (Last 6 Months)" aspect={2 / 1} />
        </div>

        <div className="listContainer">
          <div className="listTitle">My Recent Logs</div>
          {/* Pass the logged-in user's ID to the existing Table component */}
          <Table userId={userId} />
        </div>
      </div>
    </div>
  );
};

export default EmployeeHome;