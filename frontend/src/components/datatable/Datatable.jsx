import "./datatable.scss";
import { DataGrid } from "@mui/x-data-grid";
import { userColumns } from "../../datatablesource";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const Datatable = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/users/all");
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

  const handleDelete = async (user_Id) => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/deleteUser/${user_Id}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        setData(data.filter((item) => item.user_Id !== user_Id));
      } else {
        alert("Failed to delete user.");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const actionColumn = [
    {
      field: "action",
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
            <div
              className="deleteButton"
              onClick={() => handleDelete(params.row.user_Id)}
            >
              Delete
            </div>
          </div>
        );
      },
    },
  ];
  return (
    <div className="datatable">
      <div className="datatableTitle">
        User Management
        <Link to="/users/new" className="link">
          Add New
        </Link>
      </div>
      <DataGrid
        className="datagrid"
        rows={data}
        columns={userColumns.concat(actionColumn)}
        pageSize={9}
        rowsPerPageOptions={[9]}
        checkboxSelection
        getRowHeight={() => "auto"}
        getRowId={(row) => row.user_Id}
      />
    </div>
  );
};

export default Datatable;
