export const userInputs = [
  {
    id: "user_Id",
    label: "User ID",
    type: "text",
    placeholder: "e.g. MACJ-001",
  },
  {
    id: "user_EmploymentStatus",
    label: "Employment Status",
    type: "select",
    options: ["Regular", "Probationary"],
  },
  {
    id: "user_Role", // New ID for Role Status
    label: "System Role",
    type: "select",
    options: ["Employee", "Supervisor", "Admin Manager", "Admin Accountant"], // Updated values
  },
  {
    id: "user_Email",
    label: "Email",
    type: "text",
    placeholder: "e.g. johnsmith@gmail.com",
  },
  {
    id: "user_Password",
    label: "Password",
    type: "password",
    placeholder: "Enter new password",
  },
  {
    id: "department",
    label: "Department",
    type: "text",
    placeholder: "e.g. ADMIN, OPERATION",
  },
  {
    id: "position",
    label: "Position",
    type: "text",
    placeholder: "e.g. MESSENGER, STAFF",
  },
  {
    id: "hireDate",
    label: "Date Hired",
    type: "date",
    placeholder: "",
  },
  {
    id: "taxStatus",
    label: "Tax Status",
    type: "text",
    placeholder: "e.g. S, M",
  },
  {
    id: "account_Number",
    label: "ATM / Account Number",
    type: "text",
    placeholder: "Enter Account Number",
  },
  {
    id: "user_MachipId",
    label: "MaChip ID",
    type: "text",
    placeholder: "Click SCAN to link RFID card",
  },
  {
    id: "user_FingerprintId",
    label: "Fingerprint ID",
    type: "text",
    placeholder: "Click SCAN to enroll fingerprint",
  },
];

export const productInputs = [
  {
    id: 1,
    label: "Title",
    type: "text",
    placeholder: "Apple Macbook Pro",
  },
  {
    id: 2,
    label: "Description",
    type: "text",
    placeholder: "Description",
  },
  {
    id: 3,
    label: "Category",
    type: "text",
    placeholder: "Computers",
  },
  {
    id: 4,
    label: "Price",
    type: "text",
    placeholder: "100",
  },
  {
    id: 5,
    label: "Stock",
    type: "text",
    placeholder: "in stock",
  },
];