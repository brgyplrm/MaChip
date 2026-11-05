#!/usr/bin/env node
/**
 * ==============================================================================
 * MAChip Safe All-in-One Dependency Updater & Build Verification Suite
 * ==============================================================================
 * 
 * Dynamically queries official Node.js release feeds and the live npm security
 * registry to audit and update dependencies across backend and frontend.
 * 
 * Usage:
 *   node scripts/safe_update_all.js
 *   OR
 *   npm run update:all
 * ==============================================================================
 */

const { execSync } = require('child_process');
const https = require('https');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'MAChip-Security-Auditor/1.0' }, timeout: 6000 },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

async function checkLiveNodeRuntime() {
  const currentVersion = process.version;
  console.log(`\n---------------------------------------------------------------`);
  console.log(` [*] Dynamic Host Node.js Security & Runtime Audit`);
  console.log(`     Current Node Runtime: ${currentVersion} (${process.platform} ${process.arch})`);
  console.log(`     Fetching latest official releases from nodejs.org...`);

  try {
    const releases = await fetchJson('https://nodejs.org/dist/index.json');
    const match = currentVersion.match(/^v(\d+)\.(\d+)\.(\d+)/);
    if (!match) return;

    const major = match[1];
    const latestInMajor = releases.find((r) => r.version.startsWith(`v${major}.`));
    const latestLts = releases.find((r) => Boolean(r.lts));

    if (latestInMajor && latestInMajor.version !== currentVersion) {
      console.log(`\n [SECURITY NOTICE] A newer release exists in your Node ${major}.x line:`);
      console.log(`   - Installed:        ${currentVersion}`);
      console.log(`   - Latest Available: ${latestInMajor.version} (includes upstream security & bug fixes)`);
      if (latestLts) {
        console.log(`   - Current LTS Line: ${latestLts.version} (${latestLts.lts})`);
      }
      console.log(`\n Recommendation: Upgrade your host Node binary to ${latestInMajor.version}:`);
      console.log(`   - Windows: winget upgrade OpenJS.NodeJS.LTS  (or download from nodejs.org)`);
      console.log(`   - Linux:   sudo dnf upgrade nodejs  (or nvm install ${latestInMajor.version})`);
    } else {
      console.log(` [OK] Node.js runtime (${currentVersion}) is on the latest release of the ${major}.x branch.`);
    }
  } catch (err) {
    console.log(` [INFO] Unable to query nodejs.org release feed (${err.message}). Skipping runtime version check.`);
  }
  console.log(`---------------------------------------------------------------\n`);
}

function runStep(cmd, cwd, stepName, isCritical = true) {
  console.log(`\n===============================================================`);
  console.log(` [*] ${stepName}`);
  console.log(`     Directory: ${path.relative(ROOT_DIR, cwd) || '.'}`);
  console.log(`     Command:   ${cmd}`);
  console.log(`===============================================================`);

  try {
    execSync(cmd, {
      cwd,
      stdio: 'inherit',
      env: process.env,
      shell: true
    });
    console.log(` [OK] ${stepName} completed successfully.\n`);
    return true;
  } catch (err) {
    console.error(`\n [FAIL] Error during "${stepName}":`, err.message);
    if (isCritical) {
      console.error(` [ABORT] Process halted to prevent repository inconsistency.`);
      process.exit(1);
    }
    return false;
  }
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(` MAChip Automated Safe Dependency Update Suite`);
  console.log(`===============================================================`);

  // 1. Dynamic host Node.js release check against nodejs.org
  await checkLiveNodeRuntime();

  // 2. Backend Safe Updates (SemVer in-range + Safe Audit)
  runStep('npm update', BACKEND_DIR, 'Updating Backend Dependencies (SemVer Safe)');
  runStep('npm audit fix', BACKEND_DIR, 'Applying Safe Backend Security Fixes', false);
  runStep('node -c src/app.js src/config/sequelize.js', BACKEND_DIR, 'Verifying Backend Syntax & Integrity');

  // 3. Frontend Safe Updates (SemVer in-range + Safe Audit + Vite Build Verification)
  runStep('npm update', FRONTEND_DIR, 'Updating Frontend Dependencies (SemVer Safe)');
  runStep('npm audit fix', FRONTEND_DIR, 'Applying Safe Frontend Security Fixes', false);
  runStep('npm run build', FRONTEND_DIR, 'Verifying Production Frontend Build (Vite)');

  // 4. Root Package Updates
  runStep('npm update', ROOT_DIR, 'Updating Root Tooling & DevDependencies');

  console.log(`\n===============================================================`);
  console.log(` [DONE] ALL PACKAGES SAFELY UPDATED & PRODUCTION BUILDS VERIFIED`);
  console.log(`===============================================================\n`);
}

main().catch((err) => {
  console.error('[UNCAUGHT ERROR]:', err);
  process.exit(1);
});
