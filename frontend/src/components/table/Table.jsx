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
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";

const List = ({ userId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    if (!userId) return;

    const fetchUserLogs = async () => {
      try {
        const response = await fetchWithAuth(
          `/api/attendance/logs/${userId}`,
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
    
    // Set up polling
    const interval = setInterval(fetchUserLogs, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const getLogStatusClass = (logStatus) => {
    if (!logStatus) return "";
    return logStatus === "Clock In" ? "In" : "Out";
  };

  const getAttendanceClass = (attendanceStatus) => {
    if (!attendanceStatus) return "";
    return attendanceStatus.toLowerCase().replace(/[^a-z]/g, "");
  };

  // Pagination Logic
  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = rows.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col gap-4">
      <TableContainer component={Paper} className="table border-0 shadow-none">
        <Table sx={{ minWidth: 650 }} aria-label="user activity log">
          <TableHead>
            <TableRow>
              <TableCell className="tableCell font-bold text-slate-500 uppercase text-[10px] tracking-wider">Date</TableCell>
              <TableCell className="tableCell font-bold text-slate-500 uppercase text-[10px] tracking-wider">Time In</TableCell>
              <TableCell className="tableCell font-bold text-slate-500 uppercase text-[10px] tracking-wider">Time Out</TableCell>
              <TableCell className="tableCell font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status</TableCell>
              <TableCell className="tableCell font-bold text-slate-500 uppercase text-[10px] tracking-wider">Attendance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  className="tableCell"
                  style={{ padding: "40px", color: "gray" }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                    <span>Loading history...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : currentData.length > 0 ? (
              currentData.map((row) => (
                <TableRow key={row.sessionId} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="tableCell font-medium text-slate-700">
                    {row.log_Date
                      ? new Date(row.log_Date).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="tableCell text-slate-600">
                    {formatTime12h(row.time_In)}
                  </TableCell>
                  <TableCell className="tableCell text-slate-600">
                    {formatTime12h(row.time_Out)}
                  </TableCell>
                  <TableCell className="tableCell">
                    <span
                      className={`status ${getLogStatusClass(row.logStatus)}`}
                    >
                      {row.logStatus ?? "—"}
                    </span>
                  </TableCell>
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
                  style={{ padding: "40px", color: "gray" }}
                >
                  No activity for this user yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      {!loading && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          startIndex={startIndex}
          endIndex={endIndex}
          itemLabel="records"
          className="rounded-lg border border-slate-100"
        />
      )}
    </div>
  );
};

export default List;
