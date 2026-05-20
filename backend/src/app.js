const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load .env
console.log("[DEBUG] JWT_SECRET loaded:", process.env.JWT_SECRET ? "Yes" : "No");
process.env.TZ = process.env.TZ || "Asia/Manila";

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { connectDB, sequelize } = require("./config/sequelize"); 
const { initSocket } = require("./config/socket");
const { loginLimiter, generalLimiter, pollingLimiter, HIGH_FREQ_ROUTES } = require("./middleware/rateLimiter");
const authMiddleware = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// 1. Trust proxy for correct IP handling behind nginx/lb/router
app.set("trust proxy", 1);

// 2. Parse body and cookies first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for local development to avoid protocol upgrade issues
  })
);

const fs = require('fs');
const logFile = path.join(__dirname, '../request_debug.log');
app.use((req, res, next) => {
  const logEntry = `${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}\n`;
  fs.appendFileSync(logFile, logEntry);
  next();
});

// 4. CORS — must be before rate limiters so OPTIONS preflight isn't rate-limited
const allowedOrigins = [
  "http://192.168.254.120:5173"

];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith(".trycloudflare.com")) {
        callback(null, true);
      } else {
        console.warn(`[CORS] REJECTED: origin "${origin}" is not in whitelist.`);
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  }),
);

// 5. Rate limiters (Now placed after body parsing and CORS)
app.use("/api/auth/login", loginLimiter);

HIGH_FREQ_ROUTES.forEach(route => {
  app.use(route, pollingLimiter);
});

app.use("/api", generalLimiter);

// 6. Debug middleware to log requests (after limiters to avoid logging rejected ones)
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  const bodyToLog = { ...req.body };
  if (bodyToLog.password) bodyToLog.password = "***";
  console.log(`[DEBUG] Body:`, bodyToLog);
  next();
});

// 7. Static files
app.use(express.static("public"));
app.use("/api/uploads", express.static("uploads"));
app.use("/uploads", express.static("uploads"));

// 8. Public routes
const authRoutes = require("./routes/auth.routes.js");
const rfidRoutes = require("./routes/rfid.routes.js");
const espRoutes = require("./routes/esp.routes.js");
const systemController = require("./controllers/system.controller");

app.use("/api/auth", authRoutes);
app.use("/api/rfid", rfidRoutes);
app.use("/api/esp", espRoutes);
app.get("/api/system/time", systemController.getSystemTime);
app.get("/Machip", (req, res) => res.json({ message: "Welcome to MaChip API." }));

// 9. Auth middleware gates everything below
app.use("/api", authMiddleware);

// 10. Protected Routes
const requestLogger = require("./middleware/requestLogger");
app.use("/api", requestLogger);

const userRoutes = require("./routes/user.routes.js");
const attendanceRoutes = require("./routes/attendance.routes.js");
const requestRoutes = require("./routes/request.routes.js");
const payrollRoutes = require("./routes/payroll.routes.js");
const notificationRoutes = require("./routes/notification.routes.js");
const systemRoutes = require("./routes/system.routes.js");
const positionRoutes = require("./routes/position.routes.js");

app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/positions", positionRoutes);

// New route for testing database queries (now protected)
app.get("/test-query", async (req, res) => {
  try {
    const [results] = await sequelize.query("SELECT 1+1 AS result");
    res.json({ message: "Database query successful!", result: results });
  } catch (error) {
    res.status(500).json({ message: "Database query failed.", error: error.message });
  }
});

// ── Error Handling Middleware ────────────────────────────────────────────────
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const { ensureAbsentsMarked } = require("./utils/attendanceHelper");
const { syncHolidaysService } = require("./utils/holidaySyncService");
const { checkPendingRequests } = require("./utils/requestEscalation");
const { getSystemTime } = require("./utils/systemTime");
const { checkAndTriggerArchival } = require("./utils/archiveService");
const { initializeStorageStructure } = require("./utils/fileStorage");

// ── Database Connection and Background Tasks ──────────────────────────────────
connectDB().then(async () => {
  // 1. Start Server IMMEDIATELY to avoid frontend ECONNREFUSED errors
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT} (Listening on 0.0.0.0).`);
  });

  // 2. Perform background initialization tasks
  (async () => {
    // 2.0 Initialize Storage Folders
    await initializeStorageStructure();

    // 2.1 Holiday Sync (Startup): Ensure holidays are up-to-date
    console.log("[INIT] Synchronizing Philippine holidays...");
    try {
      await syncHolidaysService();
    } catch (err) {
      console.error("[INIT] Holiday sync failed:", err.message);
    }

    // 2.2 Check for any pending monthly archives
    console.log("[INIT] Checking for pending log archives...");
    try {
      await checkAndTriggerArchival();
    } catch (err) {
      console.error("[INIT] Log archival check failed:", err.message);
    }

    // 2.3 Perform backfill for missing absences within the CURRENT PERIOD only
    console.log("[INIT] Running period-restricted backfill for absences...");
    try {
      const now = await getSystemTime();
      
      // Logic to determine current period start
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = now.getDate();
      let periodStart = (day <= 15) ? new Date(year, month, 1) : new Date(year, month, 16);

      // Backfill from period start until today
      let checkDate = new Date(periodStart);
      while (checkDate <= now) {
        await ensureAbsentsMarked(new Date(checkDate));
        checkDate.setDate(checkDate.getDate() + 1);
      }
      console.log("[INIT] Backfill complete.");
    } catch (err) {
      console.error("[INIT] Backfill failed:", err.message);
    }
  })();

  // 3. Start Scheduled Tasks
  let lastAbsentCheckDate = null;
  let lastBackfillDate = null;

  setInterval(async () => {
    try {
      const now = await getSystemTime();
      const dateStr = now.toDateString(); 
      const hour = now.getHours();
      const minute = now.getMinutes();

      // 1. Shift-End Check (Daily 5:30 PM): Mark TODAY's absences
      if (hour === 17 && minute === 30) {
        if (lastAbsentCheckDate !== dateStr) {
          console.log(`[SCHEDULED] 5:30 PM: Marking today's absences...`);
          lastAbsentCheckDate = dateStr; 
          await ensureAbsentsMarked();
        }
      }

      // 2. Start-of-Day Sync (Daily 4:00 AM): Backfill the entire CURRENT PERIOD
      if (hour === 4 && minute === 0 && lastBackfillDate !== dateStr) {
        console.log(`[SCHEDULED] 4:00 AM: Running period-restricted backfill...`);
        lastBackfillDate = dateStr;
        
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        let periodStart = (day <= 15) ? new Date(year, month, 1) : new Date(year, month, 16);

        let checkDate = new Date(periodStart);
        while (checkDate <= now) {
          await ensureAbsentsMarked(new Date(checkDate));
          checkDate.setDate(checkDate.getDate() + 1);
        }
      }

      // 3. Yearly Holiday Sync (January 1st at 12:01 AM)
      if (now.getMonth() === 0 && now.getDate() === 1 && hour === 0 && minute === 1) {
        console.log("[SCHEDULED] January 1st: Syncing holidays for the new year...");
        syncHolidaysService();
      }

      // 4. Monthly Archival Check (Run once an hour to be safe)
      if (minute === 0) {
        checkAndTriggerArchival();
      }

      checkPendingRequests();
    } catch (err) {
      console.error("[SCHEDULED] Task error:", err.message);
    }
  }, 60 * 1000); 
});