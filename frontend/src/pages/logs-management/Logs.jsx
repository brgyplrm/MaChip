import "./logs.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { logColumns } from "../../logSource";
import { useState, useEffect } from "react";

const Logs = () => {
  const [logData, setLogData] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Update this URL to your actual logging endpoint
        const response = await fetch("http://localhost:4000/api/logs/all");
        if (response.ok) {
          const logs = await response.json();
          setLogData(logs);
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="logs">
      <Sidebar />
      <div className="logsContainer">
        <Navbar />
        <div className="datatable">
          <div className="datatableTitle">
            User Logging Activity
          </div>
          <DataGrid
            className="datagrid"
            rows={logData}
            columns={logColumns}
            pageSize={10}
            rowsPerPageOptions={[10]}
            checkboxSelection
            getRowId={(row) => row.log_Id}
            getRowHeight={() => "auto"}
          />
        </div>
      </div>
    </div>
  );
};

export default Logs;