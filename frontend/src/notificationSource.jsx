export const notificationColumns = [
  { field: "id", headerName: "ID", width: 70 },
  {
    field: "type",
    headerName: "Type",
    width: 150,
    renderCell: (params) => {
      return <span className={`type ${params.row.type.toLowerCase()}`}>{params.row.type}</span>;
    },
  },
  { field: "message", headerName: "Notification", width: 400 },
  { field: "timestamp", headerName: "Date & Time", width: 200 },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => {
      return (
        <div className={`cellWithStatus ${params.row.status.toLowerCase()}`}>
          {params.row.status}
        </div>
      );
    },
  },
];