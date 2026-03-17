import "./table.scss";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useState, useEffect } from "react";
import { formatTime12h } from "../../utils/formatTime";

const List = ({ userId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchUserLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:4000/api/attendance/logs/${userId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setRows(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch user logs:", response.status);
          setRows([]);
        }
      } catch (err) {
        console.error("Error fetching user logs:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserLogs();
  }, [userId]);

  const getLogStatusClass = (logStatus) => {
    if (!logStatus) return "";
    return logStatus === "Clock In" ? "In" : "Out";
  };

  const getAttendanceClass = (attendanceStatus) => {
    if (!attendanceStatus) return "";
    return attendanceStatus.toLowerCase().replace(/[^a-z]/g, "");
  };

  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 650 }} aria-label="user activity log">
        <TableHead>
          <TableRow>
            <TableCell className="tableCell">Date</TableCell>
            <TableCell className="tableCell">Time In</TableCell>
            <TableCell className="tableCell">Time Out</TableCell>
            <TableCell className="tableCell">Status</TableCell>
            <TableCell className="tableCell">Attendance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={5}
                align="center"
                className="tableCell"
                style={{ padding: "20px", color: "gray" }}
              >
                Loading activity...
              </TableCell>
            </TableRow>
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.sessionId}>
                {/* Date */}
                <TableCell className="tableCell">
                  {row.log_Date
                    ? new Date(row.log_Date).toLocaleDateString()
                    : "—"}
                </TableCell>

                {/* First Time In — locked to the first login of the day */}
                <TableCell className="tableCell">
                  {formatTime12h(row.time_In)}
                </TableCell>

                {/* Last Time Out — updates with every logout; "—" if still inside */}
                <TableCell className="tableCell">
                  {formatTime12h(row.time_Out)}
                </TableCell>

                {/* Log Status — "Logged In" if last event was a login, "Logged Out" if last was a logout */}
                <TableCell className="tableCell">
                  <span
                    className={`status ${getLogStatusClass(row.logStatus)}`}
                  >
                    {row.logStatus ?? "—"}
                  </span>
                </TableCell>

                {/* Attendance Status — only set on the first login of the day */}
                <TableCell className="tableCell">
                  <span
                    className={`attendance ${getAttendanceClass(row.attendanceStatus)}`}
                  >
                    {row.attendanceStatus !== "—" ? row.attendanceStatus : "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                align="center"
                className="tableCell"
                style={{ padding: "20px", color: "gray" }}
              >
                No activity for this user yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default List;
