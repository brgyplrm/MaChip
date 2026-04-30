import React, { useState, useEffect } from "react";
import "./transactionLog.scss";
import Sidebar from "../../components/Sidebar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import { exportToCSV } from "../../utils/csvExport";

const TransactionLog = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [goToValue, setGoToValue] = useState("");

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetchWithAuth("/api/system/transaction-logs");
        const data = await response.json();
        if (response.ok) {
          setTransactions(data);
        }
      } catch (error) {
        console.error("Error fetching transaction logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  // Filtering Logic
  const filteredData = transactions.filter(t => {
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.event_Type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "All Actions" || t.event_Type === actionFilter;
    return matchesSearch && matchesAction;
  });

  // --- PAGINATION LOGIC ---
  const indexOfLastLog = currentPage * rowsPerPage;
  const indexOfFirstLog = indexOfLastLog - rowsPerPage;
  const currentLogs = filteredData.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  // Reset to page 1 when search or filters change[cite: 25]
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter]);

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

  const uniqueActions = ["All Actions", ...new Set(transactions.map(t => t.event_Type))];

  const stats = {
    total: transactions.length,
    payrollReleases: transactions.filter(t => t.event_Type === "PAYROLL_RELEASE").length,
    batchRuns: transactions.filter(t => t.event_Type === "BATCH_PAYROLL_GEN").length,
    unauthorizedScans: transactions.filter(t => t.event_Type === "UNAUTHORIZED_SCAN").length,
  };

  const maskDescription = (desc, type) => {
    if (type !== "UNAUTHORIZED_SCAN") return desc;
    return desc; 
  };

  const handleExport = () => {
    const headers = ["Timestamp", "Initiated By", "Event Category", "Description", "IP Address"];
    const data = filteredData.map(t => [
      new Date(t.createdAt).toLocaleString(),
      t.emp_FirstName 
        ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
        : t.event_Type === "UNAUTHORIZED_SCAN" 
          ? `Unknown Device`
          : "System",
      t.event_Type.replace(/_/g, " "),
      maskDescription(t.description, t.event_Type),
      t.ip_Address || t.metadata?.deviceIp || "Local"
    ]);
    exportToCSV(headers, data, `Transaction_Logs_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const MetadataTable = ({ data }) => {
    if (!data) return <span className="emptyText">No metadata available</span>;
    
    const sensitiveFields = ["user_Password", "password", "user_MachipId", "rfid", "uid", "adminPassword", "admin_Password"];
    const allKeys = Object.keys(data)
      .filter(key => !["createdAt", "updatedAt", "deletedAt"].includes(key))
      .sort();

    return (
      <div className="diffTableContainer">
        <table className="diffTable">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Property</th>
              <th style={{ width: "60%" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map(key => {
              const val = data[key];
              const isSensitive = sensitiveFields.includes(key);
              return (
                <tr key={key} className="unchangedRow">
                  <td className="fieldName">{key.replace(/_/g, " ")}</td>
                  <td className="newValue">
                    {isSensitive ? (
                      <span className="redacted">[REDACTED]</span>
                    ) : key === "result" ? (
                      <span className={`resultBadge ${String(val).toLowerCase()}`}>{val}</span>
                    ) : (
                      <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Sidebar>
      <div className="logContainer">
        <div className="wrapper">
          <div className="header">
            <div className="titleText">
              <h1>Transaction Log</h1>
              <span>View and track all financial and system transactions</span>
            </div>
            <button className="exportBtn" onClick={handleExport}>
              <FileDownloadIcon className="icon" /> Export CSV
            </button>
          </div>

          <div className="summaryRow">
            <div className="statCard">
              <label>Total Transactions</label>
              <p className="value">{stats.total}</p>
            </div>
            <div className="statCard">
              <label>Payroll Releases</label>
              <p className="value completedText">{stats.payrollReleases}</p>
            </div>
            <div className="statCard">
              <label>Batch Runs</label>
              <p className="value pendingText">{stats.batchRuns}</p>
            </div>
            <div className="statCard">
              <label>Unauthorized Scans</label>
              <p className="value rejectedText">{stats.unauthorizedScans}</p>
            </div>
          </div>

          <div className="filterCard">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input 
                type="text" 
                placeholder="Search by user, action, or details..." 
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="dropdowns">
              <div className="selectGroup">
                <FilterListIcon className="icon" />
                <select onChange={(e) => setActionFilter(e.target.value)}>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="tableCard">
            {loading ? <p>Loading transaction logs...</p> : (
              <table className="customLogTable">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Initiated By</th>
                    <th>Event Category</th>
                    <th>Description</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {/* CRITICAL: Mapping currentLogs for pagination[cite: 25] */}
                  {currentLogs.map((t) => (
                    <tr key={t.transId}>
                      <td className="dateCell">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="userCell">
                        {t.emp_FirstName 
                          ? `${t.emp_FirstName} ${t.emp_LastName} (${formatUserId(t.user_Id)})` 
                          : t.event_Type === "UNAUTHORIZED_SCAN" 
                            ? `Unknown Device`
                            : "System"
                        }
                      </td>
                      <td>
                        <span className={`statusPill ${t.event_Type.toLowerCase().replace(/_/g, "")}`}>
                          {t.event_Type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="subtleText">{maskDescription(t.description, t.event_Type)}</td>
                      <td className="subtleText">{t.ip_Address || t.metadata?.deviceIp || "Local"}</td>
                      <td>
                        <button className="viewDetailsBtn" onClick={() => setSelectedLog(t)} style={{background: "none", border: "none", cursor: "pointer", color: "#6439ff", display: "flex", alignItems: "center", gap: "5px"}}>
                          <VisibilityIcon fontSize="small"/> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {currentLogs.length === 0 && (
                    <tr><td colSpan="6" style={{textAlign: "center", padding: "20px"}}>No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination UI[cite: 25] */}
          <div className="paginationWrapper">
            <nav aria-label="Transaction log pagination" className="paginationNav">
              <ul className="paginationList">
                <li>
                  <button 
                    className="pageBtn prev" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    Previous
                  </button>
                </li>
                {pageNumbers.map(number => (
                  <li key={number}>
                    <button 
                      className={`pageBtn ${currentPage === number ? "active" : ""}`}
                      onClick={() => setCurrentPage(number)}
                    >
                      {number}
                    </button>
                  </li>
                ))}
                <li>
                  <button 
                    className="pageBtn next" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </button>
                </li>
              </ul>
              <form className="goToPageForm" onSubmit={handleGoToPage}>
                <div className="formGroup">
                  <label htmlFor="goToPage">Go to</label>
                  <input 
                    type="number" 
                    id="goToPage" 
                    placeholder={totalPages}
                    value={goToValue}
                    onChange={(e) => setGoToValue(e.target.value)}
                    min="1"
                    max={totalPages}
                    required 
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
              <h3>Transaction Details: {selectedLog.event_Type.replace(/_/g, " ")}</h3>
              <CloseIcon className="closeIcon" onClick={() => setSelectedLog(null)} />
            </div>
            <div className="modalBody">
              <MetadataTable data={selectedLog.metadata} />
              <div className="modalFooter" style={{marginTop: "20px", paddingTop: "15px", borderTop: "1px solid #f1f3f5", fontSize: "12px", color: "#718096"}}>
                <div style={{display: "flex", gap: "20px"}}>
                  <span><strong>Event:</strong> {selectedLog.event_Type}</span>
                  {selectedLog.user_Id && <span><strong>User ID:</strong> {formatUserId(selectedLog.user_Id)}</span>}
                  <span><strong>IP Address:</strong> {selectedLog.ip_Address || selectedLog.metadata?.deviceIp || "Local"}</span>
                </div>
                <p style={{marginTop: "10px", fontStyle: "italic"}}>"{selectedLog.description}"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
};

export default TransactionLog;