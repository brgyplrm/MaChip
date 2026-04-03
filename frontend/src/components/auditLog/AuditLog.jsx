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

  const renderJsonTree = (data) => {
    if (!data) return <span>null</span>;
    return (
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
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
                      <td className="adminCell">{log.user_FirstName} {log.user_LastName} (ID: {log.user_Id})</td>
                      <td>
                        <span className={`actionBadge ${log.action.toLowerCase().replace(/_/g, "")}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="boldText">{log.target_Table || "System"} {log.target_Id ? `#${log.target_Id}` : ""}</td>
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
              <div className="diffContainer" style={{display: "flex", gap: "20px", marginTop: "15px"}}>
                <div className="diffBox" style={{flex: 1, padding: "15px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee"}}>
                  <h4 style={{color: "#d32f2f", marginBottom: "10px"}}>Previous Value</h4>
                  <div style={{fontSize: "13px", color: "#555", overflowX: "auto"}}>
                    {renderJsonTree(selectedLog.old_Value)}
                  </div>
                </div>
                <div className="diffBox" style={{flex: 1, padding: "15px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee"}}>
                  <h4 style={{color: "#2e7d32", marginBottom: "10px"}}>New Value</h4>
                  <div style={{fontSize: "13px", color: "#555", overflowX: "auto"}}>
                    {renderJsonTree(selectedLog.new_Value)}
                  </div>
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