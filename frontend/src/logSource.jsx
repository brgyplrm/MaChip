export const logColumns = [
  {
    field: "user_id",
    headerName: "User ID",
    width: 100,
  },
  {
    field: "log_Date",
    headerName: "Date",
    width: 120,
  },
  {
    field: "time_in",
    headerName: "Time In",
    width: 200,
  },
  {
    field: "time_out",
    headerName: "Time Out",
    width: 200,
  },
  {
    field: "action",
    headerName: "Action",
    width: 180,
    renderCell: (params) => {
      return (
        <span className={`status ${params.row.action.toLowerCase()}`}>
          {params.row.action}
        </span>
      );
    },
  },
  {
    field: "timestamp",
    headerName: "Date & Time",
    width: 250,
  },
  {
    field: "ip_address",
    headerName: "IP Address",
    width: 150,
  },
];