import "./table.scss";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useState, useEffect } from "react";

const List = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/attendance/all");
        if (response.ok) {
          const data = await response.json();
          setRows(data);
        }
      } catch (err) {
        console.error("Error fetching attendance logs:", err);
      }
    };
    fetchAttendance();
  }, []);

  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell className="tableCell">User ID</TableCell>
            <TableCell className="tableCell">Name</TableCell>
            <TableCell className="tableCell">Date</TableCell>
            <TableCell className="tableCell">Time In</TableCell>
            <TableCell className="tableCell">Time Out</TableCell>
            <TableCell className="tableCell">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.user_loggingId}>
                <TableCell className="tableCell">{row.user_id}</TableCell>
                <TableCell className="tableCell">
                  <div className="cellWrapper">
                    <img src="/avatar.webp" alt="" className="image" />
                    {row.user ? `${row.user.user_LastName}` : "N/A"}
                  </div>
                </TableCell>
                <TableCell className="tableCell">{row.log_Date}</TableCell>
                <TableCell className="tableCell">{row.time_Logged_in}</TableCell>
                <TableCell className="tableCell">{row.time_Logged_out || "---"}</TableCell>
                <TableCell className="tableCell">
                  <span className={`status ${row.status}`}>{row.status}</span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} align="center" className="tableCell" style={{ padding: "20px", color: "gray" }}>
                No activity for now
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default List;
