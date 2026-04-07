import React, { useState, useEffect, useCallback } from "react";
import "./archivedUsers.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PermanentDeleteModal from "../../components/permanentDeleteModal/PermanentDeleteModal";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";

const ArchivedUsers = () => {
  const [showPermDelete, setShowPermDelete] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All Types");

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const fetchArchivedUsers = async () => {
    try {
      const response = await fetch("/api/users/archived");
      if (response.ok) {
        const data = await response.json();
        setArchivedUsers(data);
      }
    } catch (err) {
      console.error("Error fetching archived users:", err);
    }
  };

  useEffect(() => {
    fetchArchivedUsers();
  }, []);

  const handleRestore = async (user) => {
    try {
      const response = await fetch(`/api/users/restoreUser/${user.user_Id}`, {
        method: "PATCH",
      });
      if (response.ok) {
        setArchivedUsers((prev) => prev.filter((u) => u.user_Id !== user.user_Id));
        setToast({ message: `${user.user_FirstName} ${user.user_LastName} restored successfully.`, type: "success" });
      } else {
        const err = await response.json();
        setToast({ message: err.message || "Failed to restore user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    }
  };

  const handleActualPermanentDelete = async () => {
    if (!targetUser) return;

    const adminId = localStorage.getItem("token");
    setLoading(true);

    try {
      const response = await fetch(
        `/api/users/forceDelete/${targetUser.user_Id}`,
        {
          method: "DELETE",
          headers: { 
            "x-admin-id": adminId,
            "Content-Type": "application/json"
          },
        }
      );

      if (response.ok) {
        setArchivedUsers((prev) => prev.filter((u) => u.user_Id !== targetUser.user_Id));
        setToast({
          message: `${targetUser.user_FirstName} ${targetUser.user_LastName} has been permanently removed.`,
          type: "success",
        });
      } else {
        const errorData = await response.json();
        setToast({
          message: errorData.error || "Failed to delete user.",
          type: "error",
        });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    } finally {
      setLoading(false);
      setShowPermDelete(false);
      setTargetUser(null);
    }
  };

  const initiatePermanentDelete = (user) => {
    setTargetUser(user);
    setShowPermDelete(true);
  };

  // Filter and Search Logic
  const filteredUsers = archivedUsers.filter(u => {
    const fullName = `${u.user_FirstName} ${u.user_LastName}`.toLowerCase();
    const email = (u.user_Email || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(query) || email.includes(query);
    const matchesFilter = filterType === "All Types" || u.user_Role === (filterType === "Employees" ? "Employee" : "Admin");

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: archivedUsers.length,
    employees: archivedUsers.filter(u => u.user_Role === "Employee").length,
    admins: archivedUsers.filter(u => u.user_Role === "Admin").length,
  };

  return (
    <div className="archives">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar />
      <div className="archivesContainer">
        <Navbar />
        <div className="wrapper">
          <div className="header">
            <div className="titleText">
              <h1>Archived Users</h1>
              <span>Manage archived user records - restore or permanently delete</span>
            </div>
          </div>

          <div className="summaryRow">
            <div className="statCard">
              <label>Total Archived</label>
              <p className="value">{stats.total}</p>
            </div>
            <div className="statCard">
              <label>Employee</label>
              <p className="value blue">{stats.employees}</p>
            </div>
            <div className="statCard">
              <label>Admin</label>
              <p className="value purple">{stats.admins}</p>
            </div>
          </div><br />

          <div className="filterCard">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="dropdownWrapper">
               <select 
                 className="typeSelect" 
                 value={filterType}
                 onChange={(e) => setFilterType(e.target.value)}
               >
                  <option>All Types</option>
                  <option>Employees</option>
                  <option>Admins</option>
               </select>
            </div>
          </div>

          <div className="tableCard">
            <table className="customArchiveTable">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>User Type</th>
                  <th>Archived Date</th>
                  <th className="actionHead">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.user_Id}>
                    <td className="boldText">{formatUserId(user.user_Id)}</td>
                    <td className="boldText">{user.user_FirstName} {user.user_LastName}</td>
                    <td>{user.user_Email || "—"}</td>
                    <td>
                      <span className="typeBadge">{user.user_Role}</span>
                    </td>
                    <td>{user.deletedAt ? new Date(user.deletedAt).toLocaleString() : "—"}</td>
                    <td>
                      <div className="cellAction">
                        <button className="restoreBtn" onClick={() => handleRestore(user)}><RestoreIcon /> Restore</button>
                        <button className="deleteBtn" onClick={() => initiatePermanentDelete(user)}>
                            <DeleteOutlineIcon /> Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No archived users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <PermanentDeleteModal
        isOpen={showPermDelete}
        onClose={() => setShowPermDelete(false)}
        onConfirm={handleActualPermanentDelete}
        itemName={targetUser ? `${targetUser.user_FirstName} ${targetUser.user_LastName}` : ""}
        loading={loading}
        />
    </div>
  );
};

export default ArchivedUsers;