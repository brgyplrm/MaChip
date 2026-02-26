import { formatUserId } from "./utils/formatUserId";

export const userColumns = [
  {
    field: "user_Number",
    headerName: "No.",
    width: 70,
    renderCell: (params) => {
      return params.api.getRowIndexRelativeToVisibleRows(params.id) + 1;
    },
  },
  {
    field: "user_Id",
    headerName: "User ID",
    width: 120,
    renderCell: (params) => formatUserId(params.row.user_Id),
  },
  {
    field: "user",
    headerName: "Full Name",
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
      return <div className="cellWithImg">{fullName}</div>;
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
