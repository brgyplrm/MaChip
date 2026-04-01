import React, { useState, useEffect } from "react";
import "./transactionLog.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";

const TransactionLog = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [actionFilter, setActionFilter] = useState("All Actions");

  // Mock data based on your screenshots
  const mockData = [
    { id: 1, date: "Apr 1, 2026 10:30 AM", user: "Cydoel Tomas", action: "Payroll Payment", details: "March 2026 Salary", amount: 12500, status: "Completed" },
    { id: 2, date: "Mar 25, 2026 2:15 PM", user: "Emily Davis", action: "Card Deposit", details: "RFID Card Balance Top-up", amount: 500, status: "Completed" },
    { id: 3, date: "Mar 23, 2026 4:00 PM", user: "Emily Davis", action: "Card Deposit", details: "RFID Card Balance Top-up", amount: 750, status: "Pending" },
    { id: 4, date: "Mar 22, 2026 10:00 AM", user: "Cydoel Tomas", action: "Purchase", details: "Printing Services", amount: 25, status: "Failed" },
  ];

  useEffect(() => {
    setTransactions(mockData);
  }, []);

  // Summary Stats Logic
  const stats = {
    total: transactions.length,
    completed: transactions.filter(t => t.status === "Completed").length,
    pending: transactions.filter(t => t.status === "Pending").length,
    failed: transactions.filter(t => t.status === "Failed").length,
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
              <span>View and track all financial transactions within the system</span>
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
              <label>Completed</label>
              <p className="value completedText">{stats.completed}</p>
            </div>
            <div className="statCard">
              <label>Pending</label>
              <p className="value pendingText">{stats.pending}</p>
            </div>
            <div className="statCard">
              <label>Failed</label>
              <p className="value failedText">{stats.failed}</p>
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
                <select onChange={(e) => setStatusFilter(e.target.value)}>
                  <option>All Statuses</option>
                  <option>Completed</option>
                  <option>Pending</option>
                  <option>Failed</option>
                </select>
              </div>
              <div className="selectGroup">
                <FilterListIcon className="icon" />
                <select onChange={(e) => setActionFilter(e.target.value)}>
                  <option>All Actions</option>
                  <option>Payroll Payment</option>
                  <option>Card Deposit</option>
                  <option>Purchase</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="tableCard">
            <table className="customLogTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="dateCell">{t.date}</td>
                    <td className="userCell">{t.user}</td>
                    <td>{t.action}</td>
                    <td className="subtleText">{t.details}</td>
                    <td className="amountCell">₱{t.amount.toLocaleString()}</td>
                    <td>
                      <span className={`statusPill ${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
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

export default TransactionLog;