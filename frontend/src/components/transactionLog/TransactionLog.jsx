import React, { useState, useEffect } from "react";
import "./transactionLog.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";

const TransactionLog = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch("/api/system/transaction-logs");
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

  const filteredData = transactions.filter(t => {
    const matchesSearch = (t.emp_FirstName + " " + t.emp_LastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.event_Type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "All Actions" || t.event_Type === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = ["All Actions", ...new Set(transactions.map(t => t.event_Type))];

  // Summary Stats Logic
  const stats = {
    total: transactions.length,
    payrollReleases: transactions.filter(t => t.event_Type === "PAYROLL_RELEASE").length,
    batchRuns: transactions.filter(t => t.event_Type === "BATCH_PAYROLL_GEN").length,
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
    <div className="transactionLog">
      <Sidebar />
      <div className="logContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="titleText">
              <h1>Transaction Log</h1>
              <span>View and track all financial and system transactions</span>
            </div>
            <button className="exportBtn">
              <FileDownloadIcon className="icon" /> Export CSV
            </button>
          </div>

          {/* Top Summary Cards */}
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
          </div>

          {/* Filter Bar */}
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

          {/* Transaction Table */}
          <div className="tableCard">
            {loading ? <p>Loading transaction logs...</p> : (
              <table className="customLogTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User / Target</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((t) => (
                    <tr key={t.transId}>
                      <td className="dateCell">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="userCell">{t.emp_FirstName ? `${t.emp_FirstName} ${t.emp_LastName}` : "System / Batch"}</td>
                      <td>
                        <span className="statusPill completed">{t.event_Type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="subtleText">{t.description}</td>
                      <td>
                        <button className="viewDetailsBtn" onClick={() => setSelectedLog(t)} style={{background: "none", border: "none", cursor: "pointer", color: "#6439ff", display: "flex", alignItems: "center", gap: "5px"}}>
                          <VisibilityIcon fontSize="small"/> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr><td colSpan="5" style={{textAlign: "center", padding: "20px"}}>No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* JSON Metadata Modal */}
      {selectedLog && (
        <div className="auditModalOverlay">
          <div className="auditModalContent">
            <div className="modalHeader">
              <h3>Transaction Details: {selectedLog.event_Type.replace(/_/g, " ")}</h3>
              <CloseIcon className="closeIcon" onClick={() => setSelectedLog(null)} style={{cursor: "pointer"}}/>
            </div>
            <div className="modalBody" style={{marginTop: "15px"}}>
              <div className="diffBox" style={{padding: "15px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee"}}>
                <h4 style={{color: "#333", marginBottom: "10px"}}>Metadata</h4>
                <div style={{fontSize: "13px", color: "#555", overflowX: "auto"}}>
                  {renderJsonTree(selectedLog.metadata)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionLog;