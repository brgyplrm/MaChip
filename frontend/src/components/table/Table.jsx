import "./table.scss";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const List = () => {
  const rows = [
    {
      id: 1143155,
      Name: "Kathleen Smith",
      img: "https://m.media-amazon.com/images/I/81bc8mA3nKL._AC_UY327_FMwebp_QL65_.jpg",
      Designation: "Declarant",
      date: "1 March",
      time: "12:00:01 PM",
      status: "In",
    },
    {
      id: 2235235,
      Name: "Jhanna Doe",
      img: "https://m.media-amazon.com/images/I/31JaiPXYI8L._AC_UY327_FMwebp_QL65_.jpg",
      Designation: "License Broker",
      date: "1 March",
      time: "12:00:01 PM",
      status: "Out",
    },
    {
      id: 2342353,
      Name: "Cydoell Jane",
      img: "https://m.media-amazon.com/images/I/71kr3WAj1FL._AC_UY327_FMwebp_QL65_.jpg",
      Designation: "Customs Officer",
      date: "1 March",
      time: "12:00:01 PM",
      status: "In",
    },
    {
      id: 2357741,
      Name: "Borgy Dame",
      img: "https://m.media-amazon.com/images/I/71wF7YDIQkL._AC_UY327_FMwebp_QL65_.jpg",
      Designation: "Accounting Officer",
      date: "1 March",
      time: "12:00:01 PM",
      status: "Out",
    },
    {
      id: 2342355,
      Name: "Trecia Lawson",
      img: "https://m.media-amazon.com/images/I/81hH5vK-MCL._AC_UY327_FMwebp_QL65_.jpg",
      Designation: "Tracker",
      date: "1 March",
      time: "12:00:01 PM",
      status: "In",
    },
  ];
  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="tableCell">{row.id}</TableCell>
              <TableCell className="tableCell">
                <div className="cellWrapper">
                  <img src={row.img} alt="" className="image" />
                  {row.Name}
                </div>
              </TableCell>
              <TableCell className="tableCell">{row.Designation}</TableCell>
              <TableCell className="tableCell">{row.date}</TableCell>
              <TableCell className="tableCell">{row.time}</TableCell>
              <TableCell className="tableCell">
                <span className={`status ${row.status}`}>{row.status}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default List;
