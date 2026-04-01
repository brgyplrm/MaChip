import React, { useState, useEffect } from "react";
import "./auditLog.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import SecurityIcon from "@mui/icons-material/Security";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data based on provided audit log screenshots
  const mockAuditData = [
    { id: 101, timestamp: "Apr 2, 2026 09:15 AM", admin: "Super Admin", action: "User Deletion", target: "MACJ-088", details: "Deleted user account permanently", ip: "192.168.1.45" },
    { id: 102, timestamp: "Apr 1, 2026 04:30 PM", admin: "Admin Jane", action: "Rate Update", target: "MACJ-012", details: "Changed daily rate from ₱650 to ₱700", ip: "192.168.1.12" },
    { id: 103, timestamp: "Apr 1, 2026 11:00 AM", admin: "Super Admin", action: "System Config", target: "Payroll Schedule", details: "Updated cutoff dates for April", ip: "192.168.1.45" },
    { id: 104, timestamp: "Mar 31, 2026 02:20 PM", admin: "Admin Jane", action: "Login", target: "Admin Panel", details: "Successful login session", ip: "192.168.1.12" },
  ];

  useEffect(() => {
    setLogs(mockAuditData);
  }, []);

  // Summary Metrics
  const stats = {
    totalActions: logs.length,
    securityAlerts: 2, // Hardcoded for preview
    userUpdates: logs.filter(l => l.action === "Rate Update" || l.action === "User Deletion").length,
    activeAdmins: new Set(logs.map(l => l.admin)).size,
  };

  return (
    <div className="auditLogs">
      <Sidebar />
      <div className="auditContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="titleText">
              <div className="iconTitle">
                <SecurityIcon className="mainIcon" />
                <h1>System Audit Logs</h1>
              </div>
              <span>Monitor administrative activities and security events</span>
            </div>
            <button className="exportBtn">
              <FileDownloadIcon /> Export Audit Trail
            </button>
          </div>

          {/* Top Summary Cards */}
          <div className="summaryRow">
            <div className="statCard">
              <label>Total Actions</label>
              <p className="value">{stats.totalActions}</p>
            </div>
            <div className="statCard">
              <label>Security Events</label>
              <p className="value alert">{stats.securityAlerts}</p>
            </div>
            <div className="statCard">
              <label>User Management</label>
              <p className="value">{stats.userUpdates}</p>
            </div>
            <div className="statCard">
              <label>Active Admin IDs</label>
              <p className="value purple">{stats.activeAdmins}</p>
            </div>
          </div>

          {/* Filter Section */}
          <div className="filterCard">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input 
                type="text" 
                placeholder="Search by Admin, Action, or Target ID..." 
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="dropdowns">
              <div className="selectGroup">
                <FilterListIcon className="icon" />
                <select>
                  <option>All Actions</option>
                  <option>User Deletion</option>
                  <option>Rate Update</option>
                  <option>System Config</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Table */}
          <div className="tableCard">
            <table className="customAuditTable">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Administrator</th>
                  <th>Action Category</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="timeCell">{log.timestamp}</td>
                    <td className="adminCell">{log.admin}</td>
                    <td>
                      <span className={`actionBadge ${log.action.toLowerCase().replace(" ", "")}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="boldText">{log.target}</td>
                    <td className="detailsCell">{log.details}</td>
                    <td className="subtleText">{log.ip}</td>
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

export default AuditLogs;