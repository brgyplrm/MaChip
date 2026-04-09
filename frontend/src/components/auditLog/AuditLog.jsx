import React, { useState, useEffect } from "react";
import "./auditLog.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import SecurityIcon from "@mui/icons-material/Security";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { formatUserId } from "../../utils/formatUserId";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/system/audit-logs");
        const data = await response.json();
        if (response.ok) {
          setLogs(data);
        }
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(log.target_Id).includes(searchQuery);
    const matchesAction = filterAction === "All Actions" || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = ["All Actions", ...new Set(logs.map(l => l.action))];

  const stats = {
    totalActions: logs.length,
    securityAlerts: logs.filter(l => l.action.includes("DELETE")).length,
    userUpdates: logs.filter(l => l.action.includes("USER") || l.action.includes("RATE")).length,
    activeAdmins: new Set(logs.map(l => l.user_Id)).size,
  };

  const DiffViewer = ({ oldVal, newVal }) => {
    const oldObj = oldVal || {};
    const newObj = newVal || {};
    
    // Get all unique keys from both objects
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key)) // Filter noisy fields
      .sort();

    const sensitiveFields = ["user_Password", "password", "user_MachipId", "rfid", "uid", "adminPassword", "admin_Password"];

    const formatValue = (key, val) => {
      if (val === undefined || val === null) return <span className="empty">—</span>;
      if (sensitiveFields.includes(key)) return <span className="redacted">[REDACTED]</span>;
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    };

    return (
      <div className="diffTableContainer">
        <table className="diffTable">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Previous Value</th>
              <th>New Value</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map(key => {
              const prev = oldObj[key];
              const current = newObj[key];
              const isChanged = JSON.stringify(prev) !== JSON.stringify(current);
              
              return (
                <tr key={key} className={isChanged ? "changedRow" : "unchangedRow"}>
                  <td className="fieldName">{key.replace(/_/g, " ")}</td>
                  <td className="oldValue">
                    <span className={isChanged ? "strikethrough" : ""}>
                      {formatValue(key, prev)}
                    </span>
                  </td>
                  <td className="newValue">
                    <span className={isChanged ? "highlight" : ""}>
                      {formatValue(key, current)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {allKeys.length === 0 && (
              <tr>
                <td colSpan="3" style={{textAlign: "center", padding: "20px", color: "#888"}}>
                  No field data available for this action.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
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
              <label>Security / Deletions</label>
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
                <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Audit Table */}
          <div className="tableCard">
            {loading ? <p>Loading audit logs...</p> : (
              <table className="customAuditTable">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Module</th>
                    <th>Administrator</th>
                    <th>Action Category</th>
                    <th>Target</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.auditId}>
                      <td className="timeCell">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="moduleCell">
                        <span className={`moduleBadge ${(log.module || "System").toLowerCase().replace(/ /g, "")}`}>
                          {log.module || "System"}
                        </span>
                      </td>
                      <td className="adminCell">{log.user_FirstName} {log.user_LastName} ({formatUserId(log.user_Id)})</td>
                      <td>
                        <span className={`actionBadge ${log.action.toLowerCase().replace(/_/g, "")}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="boldText">
                        {log.target_Table || "System"} {log.target_Id ? `#${log.target_Table === "User" ? formatUserId(log.target_Id) : log.target_Id}` : ""}
                      </td>
                      <td className="subtleText">{log.ip_Address || "Local"}</td>
                      <td>
                        <button className="viewDetailsBtn" onClick={() => setSelectedLog(log)} style={{background: "none", border: "none", cursor: "pointer", color: "#6439ff", display: "flex", alignItems: "center", gap: "5px"}}>
                          <VisibilityIcon fontSize="small"/> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr><td colSpan="6" style={{textAlign: "center", padding: "20px"}}>No logs found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* JSON Diff Modal */}
      {selectedLog && (
        <div className="auditModalOverlay">
          <div className="auditModalContent">
            <div className="modalHeader">
              <h3>Action Details: {selectedLog.action.replace(/_/g, " ")}</h3>
              <CloseIcon className="closeIcon" onClick={() => setSelectedLog(null)} />
            </div>
            <div className="modalBody">
              <DiffViewer 
                oldVal={selectedLog.old_Value} 
                newVal={selectedLog.new_Value} 
              />
              <div className="modalFooter">
                <div className="metaInfo">
                  <span><strong>Target:</strong> {selectedLog.target_Table} #{selectedLog.target_Table === "User" ? formatUserId(selectedLog.target_Id) : selectedLog.target_Id}</span>
                  <span><strong>IP:</strong> {selectedLog.ip_Address || "Local"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;