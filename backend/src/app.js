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
const { QueryTypes } = require("sequelize"); 
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
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for local development to avoid protocol upgrade issues
  })
);

const fs = require('fs');
const { getClientIp, formatUserNumber } = require("./utils/logger");
const logFile = path.join(__dirname, '../request_debug.log');

const SILENT_POLLING_ROUTES = [
  "/api/esp/fingerprint/session",
  "/api/notifications/unread-count",
  "/api/system/time",
  "/api/attendance/status",
  "/api/attendance/occupancy"
];

app.use((req, res, next) => {
  const start = Date.now();
  const url = req.originalUrl || req.url;
  const isSilentPolling = SILENT_POLLING_ROUTES.some((r) => url.startsWith(r));

  res.on("finish", () => {
    const duration = Date.now() - start;
    const userNumber = req.user ? formatUserNumber(req.user.user_Id) : "ANONYMOUS";
    const userIdStr = req.user ? ` (ID: ${req.user.user_Id})` : "";
    const statusIcon = res.statusCode >= 400 ? "[FAIL]" : "[OK]";
    
    // Only output to VSCode terminal if it's not a silent 1-second heartbeat poll or if an error occurred
    if (!isSilentPolling || res.statusCode >= 400) {
      const timestamp = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      const ip = getClientIp(req);

      console.log(
        `[${timestamp}] ${statusIcon} HTTP ${res.statusCode} ${req.method} ${url} | IP: ${ip} | User: ${userNumber}${userIdStr} | ${duration}ms`
      );

      if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
        const sanitizedBody = { ...req.body };
        ["password", "user_Password", "adminPassword", "token"].forEach(p => {
          if (sanitizedBody[p]) sanitizedBody[p] = "***REDACTED***";
        });
        if (sanitizedBody.account_Number && typeof sanitizedBody.account_Number === "string") {
          const acc = sanitizedBody.account_Number;
          sanitizedBody.account_Number = acc.length > 4 ? `****${acc.slice(-4)}` : "****";
        }
        const formatted = JSON.stringify(sanitizedBody, null, 2)
          .split("\n")
          .map(line => `    ${line}`)
          .join("\n");
        console.log(` └─ Payload:\n${formatted}`);
      }
    }
  });

  next();
});

// 7. Static files
app.use(express.static("public"));

// Dynamic mapping for uploads based on System Settings
app.use("/api/uploads", async (req, res, next) => {
  try {
    const { SystemSettings } = require("./config/sequelize");
    const settings = await SystemSettings.findOne();
    const rootPath = settings?.storageRootPath || path.join(__dirname, "../uploads");
    express.static(rootPath)(req, res, next);
  } catch (err) {
    express.static("uploads")(req, res, next);
  }
});
app.use("/uploads", (req, res, next) => res.redirect(`/api/uploads${req.url}`));

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
const hardwareRoutes = require("./routes/hardware.routes.js");

app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/userRequests", requestRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/hardware", hardwareRoutes);

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
const { initializeAnnualLeaveBalances } = require("./utils/leaveBalanceHelper");
const { processEmailQueue } = require("./utils/emailService");
const { processAutoSeparations } = require("./utils/separationTask");
const { startUdpDiscovery } = require("./utils/udpDiscovery");

// ── Database Connection and Background Tasks ──────────────────────────────────
connectDB().then(async () => {
  // 1. Start Server IMMEDIATELY to avoid frontend ECONNREFUSED errors
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT} (Listening on 0.0.0.0).`);
    startUdpDiscovery();
    console.log("==========================================================");
    console.log(" [*] ESP32 SECURED WEB SERIAL CONSOLE ACCESS INFO");
    console.log(" └─ Direct URL:  http://192.168.1.86/console");
    console.log(" └─ mDNS URL:    http://machip-esp32.local/console");
    console.log(" └─ Admin User:  admin");
    console.log(" └─ Admin Pass:  machip2026");
    console.log("==========================================================");
  });

  // 2. Perform background initialization tasks
  (async () => {
    // 2.0 Initialize Storage Folders
    await initializeStorageStructure();

    // 2.0.1 Initialize Annual Leave Balances
    console.log("[INIT] Checking annual leave balances...");
    try {
      await initializeAnnualLeaveBalances();
    } catch (err) {
      console.error("[INIT] Leave balance initialization failed:", err.message);
    }

    // 2.0.2 Verify and Auto-Sync Holidays
    console.log("[INIT] Checking holiday records...");
    try {
      const now = await getSystemTime();
      const currentYear = now.getFullYear();
      const [holidayCheck] = await sequelize.query(
        `SELECT COUNT(*) as count FROM "Holiday" WHERE EXTRACT(YEAR FROM "date") = :currentYear`,
        { replacements: { currentYear }, type: QueryTypes.SELECT }
      );
      const count = parseInt(holidayCheck?.count || 0);
      if (count === 0) {
        console.log(`[INIT] No holidays found for ${currentYear}. Automatically fetching Philippine holidays...`);
        const result = await syncHolidaysService();
        console.log(`[INIT] Holiday sync complete: ${result.count} holidays processed.`);
      } else {
        console.log(`[INIT] Holidays for ${currentYear} are up to date (${count} holidays found).`);
      }
    } catch (err) {
      console.error("[INIT] Holiday check/sync failed:", err.message);
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

      // Backfill from period start until YESTERDAY (today is handled by 5:30 PM task)
      let yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      let checkDate = new Date(periodStart);
      while (checkDate <= yesterday) {
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

      // 1. Shift-End Check (Daily 5:30 PM+): Mark TODAY's absences once per day
      if ((hour > 17 || (hour === 17 && minute >= 30)) && lastAbsentCheckDate !== dateStr) {
        console.log(`[SCHEDULED] 5:30 PM: Marking today's absences...`);
        lastAbsentCheckDate = dateStr; 
        await ensureAbsentsMarked();
      }

      // 2. Start-of-Day Sync (Daily 4:00 AM): Backfill the entire CURRENT PERIOD up to yesterday
      if (hour === 4 && minute === 0 && lastBackfillDate !== dateStr) {
        console.log(`[SCHEDULED] 4:00 AM: Running period-restricted backfill...`);
        lastBackfillDate = dateStr;
        
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        let periodStart = (day <= 15) ? new Date(year, month, 1) : new Date(year, month, 16);

        let yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        let checkDate = new Date(periodStart);
        while (checkDate <= yesterday) {
          await ensureAbsentsMarked(new Date(checkDate));
          checkDate.setDate(checkDate.getDate() + 1);
        }
      }

      // 3. Yearly Holiday Sync & Periodic Auto-Check
      if ((hour === 4 && minute === 5) || (now.getMonth() === 0 && now.getDate() === 1 && hour === 0 && minute === 1)) {
        const currentYear = now.getFullYear();
        const [holidayCheck] = await sequelize.query(
          `SELECT COUNT(*) as count FROM "Holiday" WHERE EXTRACT(YEAR FROM "date") = :currentYear`,
          { replacements: { currentYear }, type: QueryTypes.SELECT }
        );
        if (parseInt(holidayCheck?.count || 0) === 0) {
          console.log(`[SCHEDULED] Missing holidays detected for ${currentYear}. Syncing now...`);
          await syncHolidaysService();
        }
      }

      // 4. Monthly Archival Check (Run once an hour to be safe)
      if (minute === 0) {
        checkAndTriggerArchival();
      }

      checkPendingRequests();
      processEmailQueue();
      processAutoSeparations();
    } catch (err) {
      console.error("[SCHEDULED] Task error:", err.message);
    }
  }, 60 * 1000); 
});