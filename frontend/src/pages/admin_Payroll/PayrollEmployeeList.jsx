import React, { useState, useEffect, useRef } from "react";
import "./payroll_EmployeeList.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RefreshIcon from "@mui/icons-material/Refresh";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { formatUserId } from "../../utils/formatUserId";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "react-router-dom";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { fetchWithAuth } from "../../utils/api";
import EditPayrollModal from "../../components/editPayrollModal/EditPayrollModal";

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [visibleAccounts, setVisibleAccounts] = useState(new Set());

  const toggleAccountVisibility = (id) => {
    setVisibleAccounts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const maskAccountNumber = (acc) => {
    if (!acc) return "—";
    if (acc.length <= 4) return acc;
    return `**** ${acc.slice(-4)}`;
  };

  const fetchEmployees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetchWithAuth("/api/users/employees/masterlist");
      const data = await response.json();
      if (response.ok) {
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSave = async (updatedData) => {
    const newRate = parseFloat(updatedData.dailyRate);
    if (isNaN(newRate) || newRate <= 0) {
      showToast("Please enter a valid rate.", "error");
      return;
    }
    
    setSavingId(editingEmployee.user_Id);
    try {
      const response = await fetchWithAuth(
        `/api/users/employees/${editingEmployee.user_Id}/daily-rate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            newDailyRate: newRate,
            sss_Share: updatedData.SSS_Ded,
            philhealth_Share: updatedData.Philhealth_Ded,
            hdmf_Share: updatedData.HDMF_Ded,
            tax_Share: updatedData.Tax_Ded,
            healthCard_Amnt: updatedData.healthCard_Amnt,
            SSS_Loan: updatedData.SSS_Loan,
            HDMF_Loan: updatedData.HDMF_Loan,
            calamityLoan_Amnt: updatedData.calamityLoan_Amnt,
            advances_Amnt: updatedData.advances_Amnt,
            globe_Deduction: updatedData.globe_Deduction,
            eastwest_Loan: updatedData.eastwest_Loan,
            multiPurposeSavings: updatedData.multiPurposeSavings
          }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.user_Id === editingEmployee.user_Id
              ? {
                  ...e,
                  previousDailyRate: editingEmployee.dailyRate,
                  dailyRate: newRate,
                  sss_Share: updatedData.SSS_Ded,
                  philhealth_Share: updatedData.Philhealth_Ded,
                  hdmf_Share: updatedData.HDMF_Ded,
                  tax_Share: updatedData.Tax_Ded,
                  healthCard_Amnt: updatedData.healthCard_Amnt,
                  SSS_Loan: updatedData.SSS_Loan,
                  HDMF_Loan: updatedData.HDMF_Loan,
                  calamityLoan_Amnt: updatedData.calamityLoan_Amnt,
                  advances_Amnt: updatedData.advances_Amnt,
                  globe_Deduction: updatedData.globe_Deduction,
                  eastwest_Loan: updatedData.eastwest_Loan,
                  multiPurposeSavings: updatedData.multiPurposeSavings,
                  rateUpdatedAt: new Date().toISOString(),
                }
              : e
          )
        );
        showToast(`Compensation template updated for ${editingEmployee.user_FirstName} ${editingEmployee.user_LastName}.`);
        handleCloseModal();
      } else {
        showToast(result.message || "Failed to update rate.", "error");
      }
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = employees.filter((e) => {
    const fullName = `${e.user_FirstName} ${e.user_LastName}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      String(formatUserId(e.user_Id)).includes(search)
    );
  });

  const changedCount = employees.filter(
    (e) => e.previousDailyRate && e.previousDailyRate !== e.dailyRate
  ).length;

  return (
    <div className="employeeList">
      <Sidebar />
      <div className="employeeListContainer">
        <Navbar />
        <div className="wrapper">

          {/* ── Header ── */}
          <div className="pageHeader">
            <div className="titleBlock">
              <div className="titleWithBack">
                <Link to="/payroll" className="backLink">
                  <ArrowBackIcon className="backIcon" />
                </Link>
                <h1>
                  Employee Masterlist
                </h1>
              </div>
              <span>Manage employee records and daily compensation rates</span>
            </div>
            <button
              className={`refreshBtn ${refreshing ? "spinning" : ""}`}
              onClick={() => fetchEmployees(true)}
              disabled={refreshing}
            >
              <RefreshIcon />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="infoAlert">
            <div className="alertTitle">
              <InfoOutlinedIcon className="icon" /> 
              <h3>Employee Payroll Processing</h3>
            </div>
            <p>
              Provide a daily rate to automatically calculate payroll for each employee. 
              Employees without a daily rate will be excluded from payroll calculations.
            </p>
          </div>

          {/* ── Summary Chips ── */}
          <div className="summaryRow">
            <div className="chip">
              <span className="chipLabel">Total Employees</span>
              <span className="chipValue">{employees.length}</span>
            </div>
            <div className="chip changed">
              <SwapHorizIcon className="chipIcon" />
              <span className="chipLabel">Rate Changes This Session</span>
              <span className="chipValue">{changedCount}</span>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="filterBar">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input
                type="text"
                placeholder="Search by name or employee number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── Table ── */}
          <div className="tableContainer">
            {loading ? (
              <div className="loadingState">Loading employee records...</div>
            ) : (
              <table className="empTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Emp</th>
                    <th>Account Number</th>
                    <th>Position</th>
                    <th>Old Daily Rate</th>
                    <th>New Daily Rate</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? (
                    filtered.map((emp, idx) => {
                      const hasChanged =
                        emp.previousDailyRate &&
                        parseFloat(emp.previousDailyRate) !== parseFloat(emp.dailyRate);
                      const rateWentUp =
                        hasChanged &&
                        parseFloat(emp.dailyRate) > parseFloat(emp.previousDailyRate);

                      return (
                        <tr key={emp.user_Id} className={hasChanged ? "rateChanged" : ""}>
                          {/* Row number */}
                          <td className="rowNum">{idx + 1}</td>

                          {/* Combined Name and ID */}
                          <td className="empName">
                            <div className="nameBlock">
                              <div className="avatar">
                                {emp.user_FirstName?.[0]}{emp.user_LastName?.[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="name font-semibold text-[#2A174E]">
                                  {emp.user_FirstName} {emp.user_LastName}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {formatUserId(emp.user_Id)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Account Number */}
                          <td className="accountNo">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm min-w-[100px]">
                                {visibleAccounts.has(emp.user_Id) 
                                  ? (emp.account_Number || "—") 
                                  : maskAccountNumber(emp.account_Number)}
                              </span>
                              {emp.account_Number && (
                                <button 
                                  onClick={() => toggleAccountVisibility(emp.user_Id)}
                                  className="text-gray-400 hover:text-[#2A174E] transition-colors"
                                  title={visibleAccounts.has(emp.user_Id) ? "Hide Account Number" : "Show Account Number"}
                                >
                                  {visibleAccounts.has(emp.user_Id) 
                                    ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> 
                                    : <VisibilityIcon sx={{ fontSize: 16 }} />}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Position */}
                          <td className="position">{emp.user_Role || "—"}</td>

                          {/* Old Daily Rate */}
                          <td className="oldRate">
                            {hasChanged ? (
                              <span className="oldRateValue">
                                ₱{parseFloat(emp.previousDailyRate || 0).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="noChange">—</span>
                            )}
                          </td>

                          {/* New Daily Rate */}
                          <td className="newRate">
                            <div className="rateDisplay">
                              <span className={`rateValue ${hasChanged ? (rateWentUp ? "up" : "down") : ""}`}>
                                ₱{parseFloat(emp.dailyRate || 0).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                              {hasChanged && (
                                rateWentUp
                                  ? <TrendingUpIcon className="trendIcon up" />
                                  : <TrendingDownIcon className="trendIcon down" />
                              )}
                            </div>
                          </td>

                          {/* Last Updated */}
                          <td className="updatedAt">
                            {emp.rateUpdatedAt
                              ? new Date(emp.rateUpdatedAt).toLocaleDateString("en-PH", {
                                  month: "short", day: "numeric", year: "numeric",
                                })
                              : "—"}
                          </td>

                          {/* Actions */}
                          <td className="actions">
                            <button
                              className="editBtn"
                              onClick={() => handleEdit(emp)}
                              title="Edit compensation"
                            >
                              <EditIcon sx={{ fontSize: 18 }} /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="emptyState">
                        No employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <EditPayrollModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        data={editingEmployee}
        onSave={handleSave}
        isMasterlist={true}
      />

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === "success" ? <CheckIcon /> : <CloseIcon />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;