import React, { useState, useEffect } from "react";
import "./archivedUsers.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import SearchIcon from "@mui/icons-material/Search";
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import PermanentDeleteModal from "../../components/permanentDeleteModal/PermanentDeleteModal";

const ArchivedUsers = () => {

    const [showPermDelete, setShowPermDelete] = useState(false);
    const [targetUser, setTargetUser] = useState("");

  const [archivedUsers, setArchivedUsers] = useState([
    { id: 1, name: "John Smith", email: "john.smith@example.com", type: "Employee", date: "Mar 15, 2026, 10:30 AM", by: "Admin" },
    { id: 2, name: "Lisa Anderson", email: "lisa.anderson@example.com", type: "Admin", date: "Feb 28, 2026, 02:20 PM", by: "Admin" }
  ]);

  // Summary logic based on the provided screenshot
  const stats = {
    total: archivedUsers.length,
    employees: archivedUsers.filter(u => u.type === "Employee").length,
    admins: archivedUsers.filter(u => u.type === "Admin").length,
  };

  const handleActualPermanentDelete = async () => {
  // Ensure we have a target user selected
  if (!userToDelete) return;

  const adminId = localStorage.getItem("token"); // Identify the admin performing the action
  setLoading(true);

  try {
    // 1. Call the backend permanent delete endpoint
    const response = await fetch(
      `http://localhost:4000/api/users/permanentDelete/${userToDelete.id}`,
      {
        method: "DELETE",
        headers: { 
          "x-admin-id": adminId,
          "Content-Type": "application/json"
        },
      }
    );

    if (response.ok) {
      // 2. Remove the deleted user from the local list
      setArchivedUsers((prev) => prev.filter((user) => user.id !== userToDelete.id));

      // 3. Show success feedback
      setToast({
        message: `${userToDelete.name} has been permanently removed from the system.`,
        type: "success",
      });
    } else {
      // 4. Handle backend errors (e.g., unauthorized or database constraints)
      const errorData = await response.json();
      setToast({
        message: errorData.error || "Failed to permanently delete user.",
        type: "error",
      });
    }
  } catch (err) {
    console.error("Critical Deletion Error:", err);
    setToast({
      message: "Network error. Please check your connection.",
      type: "error",
    });
  } finally {
    // 5. Cleanup: Close the modal and reset state
    setLoading(false);
    setShowPermDelete(false);
    setUserToDelete(null);
  }
};

const initiatePermanentDelete = (user) => {
  setTargetUser(user);     // Store the user object to show their name in the modal
  setShowPermDelete(true); // Open the modal
};

  return (
    <div className="archives">
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

          {/* Summary Cards at Bottom */}
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

          {/* Filter Bar matching provided screenshot */}
          <div className="filterCard">
            <div className="searchBox">
              <SearchIcon className="icon" />
              <input type="text" placeholder="Search by name, email, or guardian email..." />
            </div>
            <div className="dropdownWrapper">
               <select className="typeSelect">
                  <option>All Types</option>
                  <option>Employees</option>
                  <option>Admins</option>
               </select>
            </div>
          </div>

          {/* Archives Table */}
          <div className="tableCard">
            <table className="customArchiveTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>User Type</th>
                  <th>Archived Date</th>
                  <th>Archived By</th>
                  <th className="actionHead">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="boldText">{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="typeBadge">{user.type}</span>
                    </td>
                    <td>{user.date}</td>
                    <td>{user.by}</td>
                    <td>
                      <div className="cellAction">
                        <button className="restoreBtn"><RestoreIcon /> Restore</button>
                        <button className="deleteBtn"
                                onClick={() => initiatePermanentDelete(user)}>
                            <DeleteOutlineIcon /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <PermanentDeleteModal
        isOpen={showPermDelete}
        onClose={() => setShowPermDelete(false)}
        onConfirm={handleActualPermanentDelete}
        itemName={targetUser.name} // Passes the name for the prompt
        />
    </div>
  );
};

export default ArchivedUsers;