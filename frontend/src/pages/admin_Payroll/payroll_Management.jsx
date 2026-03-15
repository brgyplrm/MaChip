import "./payroll_Management.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "react-router-dom";

const Payroll = () => {
  return (
    <div className="payroll">
      <Sidebar />
      <div className="payrollContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="text">
              <h1>Payroll Management</h1>
              <span>Manage employee payroll and compensation</span>
            </div>
            <Link to="/createPayroll" style={{ textDecoration: "none", color: "inherit" }}>
            <button className="createBtn">
                  <AddIcon /> Create Payroll
            </button>
            </Link>
          </div>

          <div className="stats">
            <div className="statCard">
              <div className="left">
                <div className="icon net"><span className="symbol">$</span></div>
                <span className="title">Total Net Pay</span>
                <span className="amount">₱40,550</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon earnings"><span className="symbol">📈</span></div>
                <span className="title">Total Earnings</span>
                <span className="amount">₱43,520</span>
              </div>
            </div>
            <div className="statCard">
              <div className="left">
                <div className="icon deductions"><span className="symbol">📉</span></div>
                <span className="title">Total Deductions</span>
                <span className="amount">₱2,970</span>
              </div>
            </div>
          </div>

          <div className="filters">
            <div className="search">
              <SearchIcon className="icon" />
              <input type="text" placeholder="Search by employee name..." />
            </div>
            <div className="select">
              <CalendarTodayIcon className="icon" />
              <select>
                <option>All Periods</option>
                <option>Current Period</option>
                <option>Last Period</option>
              </select>
            </div>
            <div className="select">
              <FilterListIcon className="icon" />
              <select>
                <option>All Status</option>
                <option>Draft</option>
                <option>Processed</option>
                <option>Paid</option>
              </select>
            </div>
          </div>

          <div className="tableContainer">
            <table className="payrollTable">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>PERIOD</th>
                  <th>DAYS/HOURS</th>
                  <th>BASIC PAY</th>
                  <th>EARNINGS</th>
                  <th>DEDUCTIONS</th>
                  <th>NET PAY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="empName">Kathleen Pinto</div>
                    <div className="id">ID: 1</div>
                  </td>
                  <td>3/1/2026 to 3/15/2026</td>
                  <td>10 days / 80 hrs</td>
                  <td>₱12,000</td>
                  <td className="pos">+₱15,500</td>
                  <td className="neg">-₱1,200</td>
                  <td className="bold">₱14,300</td>
                  <td><span className="status paid">Paid</span></td>
                  <td>
                    <div className="actions">
                      <Link to="/payrollDetails"><VisibilityIcon className="view" /></Link>
                      <Link to="/editPayroll"><EditIcon className="edit" /></Link>
                      <DeleteIcon className="delete" />
                    </div>
                  </td>
                </tr>
                {/* Additional rows here */}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payroll;