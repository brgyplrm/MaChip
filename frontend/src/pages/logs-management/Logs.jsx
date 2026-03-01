import "./logs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { logColumns } from "../../logSource";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Toast from "../../components/toast/Toast";

const Logs = () => {
  const [logData, setLogData] = useState([]);
  const [users, setUsers] = useState([]); // State for dropdown list
  const [selectedUser, setSelectedUser] = useState(""); // State for filter
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/users"); // Adjust endpoint as needed
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

  const filteredData = logData.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      item.user_Id?.toString().toLowerCase().includes(query) ||
      item.last_name?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.log_type?.toLowerCase().includes(query);

    const matchesUser = selectedUser === "" || item.user_Id?.toString() === selectedUser;

    return matchesSearch && matchesUser;
  });

  // Fetch all logs from the backend
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:4000/api/attendance/all");
      if (response.ok) {
        const logs = await response.json();
        // Flatten the nested Sequelize response to match the column field names
        const mapped = logs.map((log) => ({
          user_loggingId: log.user_loggingId,
          user_Id: log.user_id,
          last_name: log.user?.user_LastName ?? "—",
          log_Date: log.log_Date
            ? new Date(log.log_Date).toLocaleDateString()
            : "—",
          time: log.time_Logged ?? "—",
          log_type: log.loggedStatus?.statusName ?? "—",
          action: log.attendanceStatus?.statusName ?? "—",
        }));
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

  // Load logs on mount
  useEffect(() => {
    fetchLogs();
    fetchUsers(); // Fetch users on load
  }, [fetchLogs, fetchUsers]);

  // Called when the "Generate Logs" button is clicked —
  // triggers markAttendance on the backend, then refreshes the table
  const handleGenerateLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:4000/api/attendance/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setToast({
          message: data.message || "Attendance marked successfully!",
          type: "success",
        });
        // Refresh the log table so the new entry is visible
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
      width: 200,
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

  // ... (keep all imports and logic above the return statement the same)

  return (
    <div className="logs">
      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />

      <Sidebar />
      <div className="logsContainer">
        <Navbar />
        <div className="datatable">
          <div className="datatableTitle">
            User Logging Activity

            {/* Filter Section: Groups Search and Dropdown */}
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
                    <option key={user.id} value={user.id}>
                      {user.user_LastName}, {user.user_FirstName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              className="headerButton"
              onClick={handleGenerateLogs}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Logs"}
            </button>
          </div>
          <DataGrid
            className="datagrid"
            rows={filteredData}
            columns={logColumns.concat(actionColumn)}
            pageSize={10}
            rowsPerPageOptions={[10]}
            checkboxSelection
            getRowId={(row) => row.user_loggingId}
            getRowHeight={() => "auto"}
          />
        </div>
      </div>
    </div>
  );
};

export default Logs;
