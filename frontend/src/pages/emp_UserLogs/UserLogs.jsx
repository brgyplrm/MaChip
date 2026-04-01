import React from "react";
import "./UserLogs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import HistoryIcon from '@mui/icons-material/History';

const UserLogs = () => {
  // Mock data representing the table rows
  const logs = [
    { id: 1, user: "Kathleen Smith", userId: "MACJ-001", action: "Clock-In",  date: "2026-04-01", time: "08:30 AM" },
    { id: 2, user: "John Doe", userId: "MACJ-005", action: "Clock-Out", date: "2026-04-01", time: "10:15 AM" },
    { id: 3, user: "Kathleen Smith", userId: "MACJ-001", action: "Clock-Out", date: "2026-04-01", time: "05:00 PM" },
  ];

  return (
    <div className="logsListPage">
      <Sidebar />
      <div className="logsListContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="title">
              <HistoryIcon className="icon" />
              <h1>Access Logs</h1>
            </div>
            <button className="exportBtn">Export CSV</button>
          </div>

          <div className="tableWrapper">
            <table className="logsTable">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Action</th>
                  <th>Date</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="userIdCell">{log.userId}</td>
                    <td>{log.user}</td>
                    <td>
                      <span className={`actionTag ${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.date}</td>
                    <td className="timeCell">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogs;