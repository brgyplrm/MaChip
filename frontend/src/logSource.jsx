import { formatUserId } from "./utils/formatUserId";

export const logColumns = [
  {
    field: "user_Id",
    headerName: "User ID",
    width: 150,
    renderCell: (params) => formatUserId(params.row.user_Id),
  },
  {
    field: "last_name",
    headerName: "Last Name",
    width: 200,
  },
  {
    field: "log_Date",
    headerName: "Date",
    width: 150,
  },
  {
    field: "time",
    headerName: "Time",
    width: 150,
  },
  {
    field: "log_type",
    headerName: "Log Type",
    width: 150,
  },
];
