import React from "react";
import "./datatable.scss";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import ActionModal from "../../components/actionModal/ActionModal";

const Datatable = () => {
  const [data, setData] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const initiateDelete = (user_Id) => {
    setUserToDelete(user_Id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const adminId = localStorage.getItem("token");
    try {
      const response = await fetch(
        `/api/users/deleteUser/${userToDelete}`,
        {
          method: "DELETE",
          headers: { "x-admin-id": adminId },
        }
      );
      
      if (response.ok) {
        setData(data.filter((item) => item.user_Id !== userToDelete));
        setToast({ message: "User deleted successfully.", type: "success" });
      } else {
        const result = await response.json();
        setToast({ message: result.error || "Failed to delete user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Could not connect to server.", type: "error" });
    } finally {
      // Always close modal and clear target after attempt
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users/all");
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
        User Management
        <Link to="/users/newUser" className="link">Add New User</Link>
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
                        className="deleteBtn" 
                        onClick={() => initiateDelete(user.user_Id)}
                      >
                        Delete
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
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        variant="danger"
        title="Confirm Deletion"
        message="Are you sure you want to permanently delete this user? This action cannot be undone."
      />
    </div>
  );
};
export default Datatable;
