const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/sequelize"); // Import connectDB

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log requests
app.use((req, res, next) => {
  req.body = req.body || {}; // Ensure req.body is always an object
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  console.log(`[DEBUG] Content-Type: ${req.get("Content-Type")}`);
  console.log(`[DEBUG] Body:`, req.body);
  next();
});

app.use(
  cors({
    origin: "http://localhost:5173", // Your Vite/React URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Connect to the database
connectDB();

// Import the sequelize instance for raw queries
const { sequelize } = require("./config/sequelize");

// Ensure paidLeave_Days exists in the database
(async () => {
  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Payroll_Deductions' AND column_name='paidLeave_Days') THEN
          ALTER TABLE "Payroll_Deductions" ADD COLUMN "paidLeave_Days" FLOAT DEFAULT 0;
        END IF;
      END
      $$;
    `);
    console.log("[DB] Checked/Added paidLeave_Days to Payroll_Deductions");
  } catch (err) {
    console.error("[DB] Error updating Payroll_Deductions table:", err);
  }
})();

// Basic route for testing
app.get("/Machip", (req, res) => {
  res.json({ message: "Welcome to MaChip API." });
});

// New route for testing database queries
app.get("/test-query", async (req, res) => {
  try {
    const [results, metadata] = await sequelize.query("SELECT 1+1 AS result");
    res.json({ message: "Database query successful!", result: results });
  } catch (error) {
    console.error("Error during test query:", error);
    res
      .status(500)
      .json({ message: "Database query failed.", error: error.message });
  }
});

// Routes for users
const userRoutes = require("./routes/user.routes.js");
app.use("/api/users", userRoutes);

// Routes for authentication
const authRoutes = require("./routes/auth.routes.js");
app.use("/api/auth", authRoutes);

// Routes for attendance
const attendanceRoutes = require("./routes/attendance.routes.js");
app.use("/api/attendance", attendanceRoutes);

// Routes for requests
const requestRoutes = require("./routes/request.routes.js");
app.use("/api/request", requestRoutes);

// Routes for payroll
const payrollRoutes = require("./routes/payroll.routes.js");
app.use("/api/payroll", payrollRoutes);

// Routes for notifications
const notificationRoutes = require("./routes/notification.routes.js");
app.use("/api/notifications", notificationRoutes);

// Define port and start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
