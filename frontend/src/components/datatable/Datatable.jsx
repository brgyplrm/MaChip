import React from "react";
import "./datatable.scss";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import ActionModal from "../../components/actionModal/ActionModal";
import { fetchWithAuth } from "../../utils/api";

const Datatable = () => {
  const [data, setData] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [userToArchive, setUserToArchive] = useState(null);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const initiateArchive = (user_Id) => {
    setUserToArchive(user_Id);
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    try {
      const response = await fetchWithAuth(
        `/api/users/deleteUser/${userToArchive}`,
        {
          method: "DELETE",
        }
      );
      
      if (response.ok) {
        setData(data.filter((item) => item.user_Id !== userToArchive));
        setToast({ message: "User archived successfully.", type: "success" });
      } else {
        const result = await response.json();
        setToast({ message: result.error || "Failed to archive user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Could not connect to server.", type: "error" });
    } finally {
      setShowArchiveModal(false);
      setUserToArchive(null);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetchWithAuth("/api/users/all");
        if (response.ok) {
          const users = await response.json();
          setData(users);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="datatable">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <div className="datatableTitle">
        <div className="title">
          <h1> User Management</h1>
          <span>Manage user accounts and roles</span>
        </div>
        <div className="titleActions">
          <Link to="/users/archived" className="link archiveLink">View Archived</Link>
          <Link to="/users/newUser" className="link">Add New User</Link>
        </div>
      </div>

      <div className="tableCard">
        <table className="customUserTable">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>MaChip ID</th>
              <th>Email</th>
              <th className="actionHead">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((user) => (
                <tr key={user.user_Id}>
                  <td className="boldText">{formatUserId(user.user_Id)}</td>
                  <td>{`${user.user_FirstName} ${user.user_LastName}`}</td>
                  <td>{user.user_Role}</td>
                  <td className="subtleText">{user.user_MachipId || "—"}</td>
                  <td className="emailCell">
                    {user.user_Email || "—"}
                  </td>
                  <td>
                    <div className="cellAction">
                      <Link to={`/users/${user.user_Id}`} className="viewBtn">View</Link>
                      <button 
                        className="deleteBtn archiveBtn" 
                        onClick={() => initiateArchive(user.user_Id)}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="noData">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ActionModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={confirmArchive}
        variant="danger"
        title="Confirm Archival"
        message="Are you sure you want to archive this user? They will be moved to the Archived Users list."
      />
    </div>
  );
};
export default Datatable;
