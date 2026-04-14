const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load .env
console.log("[DEBUG] JWT_SECRET loaded:", process.env.JWT_SECRET ? "Yes" : "No");
process.env.TZ = process.env.TZ || "Asia/Manila";
const express = require("express");
const cors = require("cors");
const { connectDB, sequelize } = require("./config/sequelize"); // Import connectDB and sequelize

const app = express();

// Trust proxy for correct IP handling behind nginx/lb
app.set("trust proxy", true);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log requests
app.use((req, res, next) => {
  req.body = req.body || {};
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  console.log(`[DEBUG] Content-Type: ${req.get("Content-Type")}`);

  // Mask sensitive fields like "password"
  const bodyToLog = { ...req.body };
  if (bodyToLog.password) {
    bodyToLog.password = "***";
  }
  
  console.log(`[DEBUG] Body:`, bodyToLog);
  next();
});

app.use(
  cors({
    origin: true, // Allow any origin during development so colleagues can connect
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.static("public"));
app.use("/api/uploads", express.static("uploads")); // Move this here and add /api prefix
app.use("/uploads", express.static("uploads")); // Keep for compatibility

// Connect to the database
connectDB().then(async () => {
  console.log("[INIT] System startup: Syncing holidays...");
  const { syncHolidaysService } = require("./utils/holidaySyncService");
  syncHolidaysService().catch(err => console.error("[INIT] Initial Holiday Sync Failed:", err.message));
});

const authMiddleware = require("./middleware/auth");

// --- Public Routes ---
// Routes for authentication (includes Login and Logout)
const authRoutes = require("./routes/auth.routes.js");
app.use("/api/auth", authRoutes);

// Routes for RFID/ESP32 (Must be public for the device)
const rfidRoutes = require("./routes/rfid.routes.js");
app.use("/api/rfid", rfidRoutes);

// Make system time public (needed before login)
app.get("/api/system/time", require("./controllers/system.controller").getSystemTime);

// Basic route for testing
app.get("/Machip", (req, res) => {
  res.json({ message: "Welcome to MaChip API." });
});

// --- Protected Routes (Require Token) ---
app.use("/api", authMiddleware);

// Routes for users
const userRoutes = require("./routes/user.routes.js");
app.use("/api/users", userRoutes);

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

// Routes for system settings
const systemRoutes = require("./routes/system.routes.js");
app.use("/api/system", systemRoutes);

// New route for testing database queries (now protected)
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

// ── Error Handling Middleware ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]:", err.message);
  
  // Handle Multer errors specifically if needed
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File size too large. Maximum limit is 5MB." });
  }

  res.status(400).json({ error: err.message || "An unexpected error occurred." });
});

// ── Background Tasks ──────────────────────────────────────────────────────────
const { ensureAbsentsMarked } = require("./utils/attendanceHelper");
const { syncHolidaysService } = require("./utils/holidaySyncService");

// Run every 5 minutes
setInterval(() => {
  console.log("[BACKGROUND] Running ensureAbsentsMarked...");
  ensureAbsentsMarked();
}, 5 * 60 * 1000);

// Sync holidays automatically every 1st of the month at midnight
setInterval(() => {
  const now = new Date();
  if (now.getDate() === 1 && now.getHours() === 0) {
    console.log("[AUTO] Syncing Philippine Holidays...");
    syncHolidaysService();
  }
}, 60 * 60 * 1000); // Check every hour

// Define port and start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
