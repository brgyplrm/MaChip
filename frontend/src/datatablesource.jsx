export const userColumns = [
  {
    field: "user_Number",
    headerName: "No.",
    width: 70,
    renderCell: (params) => {
      return params.api.getRowIndexRelativeToVisibleRows(params.id) + 1;
    },
  },
  { field: "user_Id", headerName: "User ID", width: 120 },
  {
    field: "user",
    headerName: "User",
    width: 250,
    renderCell: (params) => {
      const { user_FirstName, user_MiddleName, user_LastName } = params.row;
      const fullName =
        `${user_FirstName || ""} ${user_MiddleName || ""} ${user_LastName || ""}`
          .replace(/\s+/g, " ")
          .trim();
      {
        fullName;
      }
      return (
        <div className="cellWithImg">
          <img
            className="cellImg"
            src={
              params.row.img ||
              "https://images.pexels.com/photos/1820770/pexels-photo-1820770.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=500"
            }
            alt="avatar"
          />
          {fullName}
        </div>
      );
    },
  },
  {
    field: "user_Email",
    headerName: "Email",
    width: 230,
  },
  {
    field: "user_MachipId",
    headerName: "MaChip ID",
    width: 150,
  },
];
