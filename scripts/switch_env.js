const fs = require("fs");
const path = require("path");

const target = (process.argv[2] || "status").toLowerCase();
const envPath = path.join(__dirname, "../backend/.env");

if (!fs.existsSync(envPath)) {
  console.error("[ERROR] backend/.env file not found.");
  process.exit(1);
}

let content = fs.readFileSync(envPath, "utf8");

if (target === "status") {
  const dbMatch = content.match(/^DB_DATABASE=(.*)$/m);
  const nodeEnvMatch = content.match(/^NODE_ENV=(.*)$/m);
  const activeDb = dbMatch ? dbMatch[1].trim() : "UNKNOWN";
  const activeEnv = nodeEnvMatch ? nodeEnvMatch[1].trim() : "UNKNOWN";
  console.log("==========================================================");
  console.log(" [*] CURRENT MACHIP BACKEND CONFIGURATION");
  console.log(`  +-- Active Database: ${activeDb}`);
  console.log(`  +-- Node Environment: ${activeEnv}`);
  console.log(`  \\-- Status: ${activeDb.includes("_dev") ? "DEVELOPMENT MODE" : "PRODUCTION / DEPLOY MODE"}`);
  console.log("==========================================================");
  process.exit(0);
}

if (!["dev", "development", "prod", "production", "deploy"].includes(target)) {
  console.error("Usage: node scripts/switch_env.js [dev | prod | status]");
  process.exit(1);
}

const isProd = ["prod", "production", "deploy"].includes(target);
const newDb = isProd ? "machipdb" : "machipdb_dev";
const newEnv = isProd ? "production" : "development";

if (content.match(/^DB_DATABASE=.*$/m)) {
  content = content.replace(/^DB_DATABASE=.*$/m, `DB_DATABASE=${newDb}`);
} else {
  content += `\nDB_DATABASE=${newDb}`;
}

if (content.match(/^NODE_ENV=.*$/m)) {
  content = content.replace(/^NODE_ENV=.*$/m, `NODE_ENV=${newEnv}`);
} else {
  content += `\nNODE_ENV=${newEnv}`;
}

fs.writeFileSync(envPath, content, "utf8");

console.log("==========================================================");
console.log(` [*] SWITCHED ENVIRONMENT TO: ${isProd ? "PRODUCTION / DEPLOY" : "DEVELOPMENT"}`);
console.log(`  +-- Active Database: ${newDb}`);
console.log(`  +-- Node Environment: ${newEnv}`);
console.log(`  \\-- Target File: backend/.env`);
console.log("==========================================================");
