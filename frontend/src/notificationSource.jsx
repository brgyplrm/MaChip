export const notificationColumns = [
  { field: "id", headerName: "ID", width: 70 },
  {
    field: "title",
    headerName: "Title",
    width: 150,
    renderCell: (params) => {
      if (!params.row) return "";
      return <span className="titleText">{params.row.title}</span>;
    },
  },
  { field: "message", headerName: "Notification", width: 400 },
  { 
    field: "createdAt", 
    headerName: "Date & Time", 
    width: 200,
    valueGetter: (params) => {
      if (!params.row || !params.row.createdAt) return "";
      return new Date(params.row.createdAt).toLocaleString();
    }
  },
  {
    field: "isRead",
    headerName: "Status",
    width: 120,
    renderCell: (params) => {
      if (!params.row) return "";
      // Handle potential undefined or boolean values from Postgres
      const isRead = params.row.isRead === true || params.row.isRead === 't' || params.row.isRead === 1;
      const status = isRead ? "read" : "unread";
      return (
        <div className={`cellWithStatus ${status}`}>
          {status}
        </div>
      );
    },
  },
];