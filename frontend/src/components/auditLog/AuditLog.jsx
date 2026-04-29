import React, { useState, useEffect } from "react";
import "./auditLog.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [goToValue, setGoToValue] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetchWithAuth("/api/system/audit-logs");
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

  // Filter Logic
  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_FirstName + " " + log.user_LastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(log.target_Id).includes(searchQuery);
    const matchesAction = filterAction === "All Actions" || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  // --- PAGINATION LOGIC ---
  const indexOfLastLog = currentPage * rowsPerPage;
  const indexOfFirstLog = indexOfLastLog - rowsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterAction]);

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(goToValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setGoToValue("");
    }
  };

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const uniqueActions = ["All Actions", ...new Set(logs.map(l => l.action))];

  const stats = {
    totalActions: logs.length,
    securityAlerts: logs.filter(l => l.action.includes("DELETE")).length,
    userUpdates: logs.filter(l => l.action.includes("USER") || l.action.includes("RATE")).length,
    activeAdmins: new Set(logs.map(l => l.user_Id)).size,
  };

  // DiffViewer remains a pure UI component
  const DiffViewer = ({ oldVal, newVal }) => {
    const oldObj = oldVal || {};
    const newObj = newVal || {};
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key))
      .sort();

    const formatValue = (key, val) => {
      if (val === undefined || val === null) return <span className="empty">—</span>;
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    };

    return (
      <div className="diffTableContainer">
        <table className="diffTable">
          <thead>
            <tr><th>Field Name</th><th>Previous</th><th>New</th></tr>
          </thead>
          <tbody>
            {allKeys.map(key => {
              const isChanged = JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]);
              return (
                <tr key={key} className={isChanged ? "changedRow" : "unchangedRow"}>
                  <td className="fieldName">{key.replace(/_/g, " ")}</td>
                  <td>{formatValue(key, oldObj[key])}</td>
                  <td>{formatValue(key, newObj[key])}</td>
                </tr>
              );
            })}
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
              <h1>System Audit Logs</h1>
              <span>Monitor administrative activities</span>
            </div>
            <button className="exportBtn"><FileDownloadIcon /> Export</button>
          </div>

          <div className="summaryRow">
             {/* Stat Cards remain same */}
             <div className="statCard"><label>Total Actions</label><p className="value">{stats.totalActions}</p></div>
             <div className="statCard"><label>Security Alerts</label><p className="value alert">{stats.securityAlerts}</p></div>
             <div className="statCard"><label>Updates</label><p className="value">{stats.userUpdates}</p></div>
             <div className="statCard"><label>Admins</label><p className="value purple">{stats.activeAdmins}</p></div>
          </div>

          <div className="filterCard">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input type="text" placeholder="Search..." onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="selectGroup">
              <FilterListIcon className="icon" />
              <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="tableCard">
            {loading ? <p>Loading...</p> : (
              <table className="customAuditTable">
                <thead>
                  <tr>
                    <th>Timestamp</th><th>Module</th><th>Administrator</th><th>Action</th><th>Target</th><th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {/* CRITICAL: Use currentLogs here for pagination to work */}
                  {currentLogs.map((log) => (
                    <tr key={log.auditId}>
                      <td className="timeCell">{new Date(log.createdAt).toLocaleString()}</td>
                      <td><span className="moduleBadge">{log.module || "System"}</span></td>
                      <td className="adminCell">{log.user_FirstName} {log.user_LastName}</td>
                      <td><span className="actionBadge">{log.action}</span></td>
                      <td className="boldText">{log.target_Table} #{log.target_Id}</td>
                      <td>
                        <button className="viewDetailsBtn" onClick={() => setSelectedLog(log)}>
                          <VisibilityIcon fontSize="small"/> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION UI */}
          <div className="paginationWrapper">
            <nav className="paginationNav">
              <ul className="paginationList">
                <li>
                  <button 
                    className="pageBtn" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >Previous</button>
                </li>
                {pageNumbers.map(n => (
                  <li key={n}>
                    <button 
                      className={`pageBtn ${currentPage === n ? "active" : ""}`}
                      onClick={() => setCurrentPage(n)}
                    >{n}</button>
                  </li>
                ))}
                <li>
                  <button 
                    className="pageBtn" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >Next</button>
                </li>
              </ul>
              <form className="goToPageForm" onSubmit={handleGoToPage}>
                <div className="formGroup">
                  <label>Go to</label>
                  <input 
                    type="number" 
                    value={goToValue}
                    onChange={(e) => setGoToValue(e.target.value)}
                    placeholder={totalPages}
                  />
                  <span>page</span>
                </div>
              </form>
            </nav>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="auditModalOverlay">
          <div className="auditModalContent">
            <div className="modalHeader">
              <h3>{selectedLog.action} Details</h3>
              <CloseIcon className="closeIcon" onClick={() => setSelectedLog(null)} />
            </div>
            <div className="modalBody">
              <DiffViewer oldVal={selectedLog.old_Value} newVal={selectedLog.new_Value} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;