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
    options: ["Regular", "Part-time", "Intern / OJT"], // Updated values
  },
  {
    id: "user_Role", // New ID for Role Status
    label: "Role Status",
    type: "select",
    options: ["Employee", "Supervisor", "Admin"], // Updated values
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
    id: "user_MachipId",
    label: "MaChip ID",
    type: "text",
    placeholder: "e.g. MACHIP-XXXXXX",
  },
  {
    id: "account_Number",
    label: "ATM / Account Number",
    type: "text",
    placeholder: "Enter Account Number",
  },
  {
  id: "user_FingerprintId",
  label: "Fingerprint ID",
  type: "text",
  placeholder: "Scan to register fingerprint",
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