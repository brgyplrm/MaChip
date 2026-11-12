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
  
  let label = "CUSTOM";
  if (activeDb === "machipdb") label = "PRODUCTION / DEPLOY MODE";
  else if (activeDb === "machipdb_dev") label = "ACTIVE DEVELOPMENT MODE";
  else if (activeDb === "machipdb_uat") label = "ISOLATED UAT / TESTING MODE";

  console.log("==========================================================");
  console.log(" [*] CURRENT MACHIP BACKEND CONFIGURATION");
  console.log(`  +-- Active Database: ${activeDb}`);
  console.log(`  +-- Node Environment: ${activeEnv}`);
  console.log(`  \\-- Status: ${label}`);
  console.log("==========================================================");
  process.exit(0);
}

const validTargets = ["dev", "development", "uat", "test", "testing", "prod", "production", "deploy"];
if (!validTargets.includes(target)) {
  console.error("Usage: node scripts/switch_env.js [dev | uat | prod | status]");
  process.exit(1);
}

let newDb = "machipdb_dev";
let newEnv = "development";
let targetLabel = "DEVELOPMENT";

if (["prod", "production", "deploy"].includes(target)) {
  newDb = "machipdb";
  newEnv = "production";
  targetLabel = "PRODUCTION / DEPLOY";
} else if (["uat", "test", "testing"].includes(target)) {
  newDb = "machipdb_uat";
  newEnv = "test";
  targetLabel = "ISOLATED UAT / TESTING";
}

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
console.log(` [*] SWITCHED ENVIRONMENT TO: ${targetLabel}`);
console.log(`  +-- Active Database: ${newDb}`);
console.log(`  +-- Node Environment: ${newEnv}`);
console.log(`  \\-- Target File: backend/.env`);
console.log("==========================================================");
