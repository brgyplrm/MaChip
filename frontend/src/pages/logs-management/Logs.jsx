import "./logs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { formatTime12h } from "../../utils/formatTime";

const Logs = () => {

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const rowsPerPage = 10;

  const [logData, setLogData] = useState([]);
  const [users, setUsers] = useState([]); // State for dropdown list
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

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
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);  

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/users/all");
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

  

  // Fetch all logs from the backend
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/attendance/all");
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
      } else {
        setToast({
          message: "Failed to fetch logs. Please try again.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
      setToast({
        message: "Could not connect to the server while loading logs.",
        type: "error",
      });
    }
  }, []);

  // Load logs on mount and start polling
  useEffect(() => {
    fetchLogs();
    fetchUsers();

    // Set up polling every 5 seconds for real-time RFID updates
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, [fetchLogs, fetchUsers]);

  const handleGenerateLogs = async (forcedStatus) => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:4000/api/attendance/mark",
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

  const actionColumn = [
    {
      field: "view",
      headerName: "Action",
      width: 100,
      renderCell: (params) => {
        return (
          <div className="cellAction">
            <Link
              to={`/users/${params.row.user_Id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="viewButton">View</div>
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="logs">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar />
      <div className="logsContainer">
        <Navbar />
        <div className="datatable">
          <div className="datatableTitle">
            User Logging Activity
            <div className="filterSection">
              <div className="searchWrapper">
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="dropdownWrapper">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
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
            </div>
            <div className="buttonGroup">
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
                style={{ marginLeft: "10px" }}
              >
                {loading ? "Processing..." : "Generate Clock Out"}
              </button>
            </div>
          </div>
          <div className="tableCard">
            <table className="customLogsTable">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Action</th>
                  <th>MaChip ID</th>
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
                      <td className="subtleText">{row.machip_id}</td>
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
            </table>

            {/* NEW: Pagination Controls */}
            <div className="paginationControls">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages} 
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
