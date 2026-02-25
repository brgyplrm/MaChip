export const logColumns = [
  {
    field: "user_Id",
    headerName: "User ID",
    width: 150,
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
  }
];