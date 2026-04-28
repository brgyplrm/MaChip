import "./logs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";
import { fetchWithAuth } from "../../utils/api";
import { useSystemTime } from "../../context/SystemTimeContext";

const formatDateStr = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

const Logs = () => {
  const { systemToday } = useSystemTime();
  const [viewMode, setViewMode] = useState("raw"); // "raw" or "day"
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const rowsPerPage = 10;

  const getCurrentPeriod = useCallback((baseDate) => {
    const today = baseDate || new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let startDate, endDate;
    if (date <= 15) {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month, 15);
    } else {
      startDate = new Date(year, month, 16);
      endDate = new Date(year, month + 1, 0);
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return {
      startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
      endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
    };
  }, []);

  const [logData, setLogData] = useState([]);
  const [dayLogsData, setDayLogsData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'log_Date', direction: 'desc' });
  
  const period = useMemo(() => getCurrentPeriod(systemToday), [systemToday, getCurrentPeriod]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Filter raw data
  const filteredData = logData.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.user_Id_formatted?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.fullName?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.log_type?.toLowerCase().includes(query) ||
      item.machip_id?.toLowerCase().includes(query);

    const matchesUser =
      selectedUser === "" || item.user_Id?.toString() === selectedUser;

    return matchesSearch && matchesUser;
  });

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;

  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/all");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  // Fetch all logs from the backend (raw)
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/attendance/all");
      if (response.ok) {
        const logs = await response.json();
        const mapped = logs.map((log) => {
          const u_Id = log.user_Id ?? log.user_id;
          const firstName = log.user_FirstName ?? "";
          const lastName = log.user_LastName ?? "";
          const fullName = `${firstName} ${lastName}`.trim();

          return {
            user_loggingId: log.user_loggingId,
            user_Id: u_Id,
            user_Id_formatted: formatUserId(u_Id),
            first_name: firstName || "—",
            last_name: lastName || "—",
            fullName: fullName || "—",
            machip_id: log.user_MachipId || "—",
            log_Date: log.log_Date
              ? new Date(log.log_Date).toLocaleDateString()
              : "—",
            time: formatTime12h(log.time_Logged),
            log_type: log.loggedStatusName ?? "—",
            action: log.attendanceStatusName ?? "—",
          };
        });
        setLogData(mapped);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, []);

  // Fetch day logs
  const fetchDayLogs = useCallback(async () => {
    try {
      let url = `/api/attendance/report?startDate=${period.startDate}&endDate=${period.endDate}`;
      if (selectedUser) url += `&user_Id=${selectedUser}`;
      else url += `&user_Id=All Employees`;

    const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setDayLogsData(data);
      }
    } catch (error) {
      console.error("Error fetching day logs:", error);
    }
  }, [period.startDate, period.endDate, selectedUser]);

  // Load logs on mount and start polling/listening
  useEffect(() => {
    fetchUsers();
    
    const handleRefresh = () => {
      if (viewMode === "raw") fetchLogs();
      else fetchDayLogs();
    };

    if (viewMode === "raw") {
      fetchLogs();
      // Increased to 5s to prevent server overload, but keep it snappy for raw logs
      const interval = setInterval(fetchLogs, 5000); 
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    } else {
      fetchDayLogs();
      const interval = setInterval(fetchDayLogs, 30000); // Day logs can be slower
      window.addEventListener("dataRefresh", handleRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener("dataRefresh", handleRefresh);
      };
    }
  }, [fetchLogs, fetchUsers, fetchDayLogs, viewMode]);

  const handleGenerateLogs = async (forcedStatus) => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        "/api/attendance/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcedStatus }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setToast({
          message: data.message || "Attendance marked successfully!",
          type: "success",
        });
        await fetchLogs();
      } else {
        setToast({
          message: data.error || "Failed to mark attendance. Please try again.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error marking attendance:", err);
      setToast({
        message: "Could not connect to the server. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedDayLogs = useMemo(() => {
    let sortableItems = [...dayLogsData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Handle dates
        if (sortConfig.key === 'log_Date') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    const query = searchQuery.toLowerCase();
    return sortableItems.filter((item) => 
      item.userName?.toLowerCase().includes(query) ||
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  }, [dayLogsData, sortConfig, searchQuery]);

  const currentDayLogs = sortedDayLogs.slice(indexOfFirstRow, indexOfLastRow);
  const dayLogsTotalPages = Math.ceil(sortedDayLogs.length / rowsPerPage) || 1;
  const currentTotalPages = viewMode === "raw" ? totalPages : dayLogsTotalPages;

  return (
    <div className="logs">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar />
      <div className="logsContainer">
        <Navbar />
        <div className="datatable">
          <div className="datatableTitle">
            <div className="title">
              <h1>User Logging Activity</h1>
              <span>{viewMode === "raw" ? "Track user logins" : `Day Logs (${period.startDate} to ${period.endDate})`}</span>
            </div>
            <div className="filterSection">
              <div className="searchWrapper">
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="dropdownWrapper">
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="userSelect"
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.user_Id} value={user.user_Id}>
                      {user.user_LastName}, {user.user_FirstName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="buttonGroup">
                <button
                  className="headerButton"
                  onClick={() => {
                    setViewMode(viewMode === "raw" ? "day" : "raw");
                    setCurrentPage(1);
                  }}
                >
                  {viewMode === "raw" ? "View in Day Logs" : "View Raw Logs"}
                </button>
                {viewMode === "raw" && (
                  <>
                    <button
                      className="headerButton"
                      onClick={() => handleGenerateLogs(1)}
                      disabled={loading}
                    >
                      {loading ? "Processing..." : "Generate Clock In"}
                    </button>
                    <button
                      className="headerButton"
                      onClick={() => handleGenerateLogs(2)}
                      disabled={loading}
                    >
                      {loading ? "Processing..." : "Generate Clock Out"}
                    </button>
                  </>
                )}
            </div>
            </div>
          </div>
          <div className="tableCard">
            <table className={`customLogsTable ${viewMode === "raw" ? "raw-mode" : "day-mode"}`}>
              {viewMode === "raw" ? (
                <>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Type</th>
                      <th className="hideOnMobile">MaChip ID</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map((row) => (
                        <tr key={row.user_loggingId}>
                          <td className="boldText">{row.user_Id_formatted}</td>
                          <td>{row.fullName}</td>
                          <td>
                            <span className={`pill ${row.log_type.toLowerCase().includes("in") ? "clock-in" : "clock-out"}`}>
                              {row.log_type}
                            </span>
                          </td>
                          <td className="subtleText hideOnMobile">{row.machip_id}</td>
                          <td>{row.log_Date}</td>
                          <td>{row.time}</td>
                          <td>
                            <div className="cellAction">
                              <Link to={`/users/${row.user_Id}`} className="viewButton">
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="noData">No logs found</td>
                      </tr>
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('user_Id')} style={{cursor: 'pointer'}}># {sortConfig.key === 'user_Id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('userName')} style={{cursor: 'pointer'}}>Name {sortConfig.key === 'userName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('log_Date')} style={{cursor: 'pointer'}}>Date {sortConfig.key === 'log_Date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th>AM In</th>
                      <th>AM Out</th>
                      <th>PM In</th>
                      <th>PM Out</th>
                      <th>OT In</th>
                      <th>OT Out</th>
                      <th onClick={() => handleSort('status')} style={{cursor: 'pointer'}}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDayLogs.length > 0 ? (
                      currentDayLogs.map((row, index) => (
                        <tr key={`${row.user_Id}-${row.log_Date}-${index}`}>
                          <td className="boldText">{formatUserId(row.user_Id)}</td>
                          <td>{row.userName}</td>
                          <td>{formatDateStr(row.log_Date)}</td>
                          <td>{row.morning_In || "—"}</td>
                          <td>{row.morning_Out || "—"}</td>
                          <td>{row.afternoon_In || "—"}</td>
                          <td>{row.afternoon_Out || "—"}</td>
                          <td>{row.ot_In || "—"}</td>
                          <td>{row.ot_Out || "—"}</td>
                          <td>
                            <span className={`pill ${row.status === "On Time" ? "clock-in" : (row.status?.toLowerCase().includes("absent") ? "clock-out" : "default")}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div className="cellAction">
                              <Link to={`/logs/edit/${row.user_Id}/${row.log_Date.split('T')[0]}?from=logs`} className="viewButton">
                                Edit
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="noData">No logs found for this period</td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </table>

            {/* Pagination Controls */}
            <div className="paginationControls">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {currentTotalPages}</span>
              <button 
                disabled={currentPage >= currentTotalPages} 
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logs;
