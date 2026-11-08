const fs = require('fs');
const path = require('path');
const { SystemSettings } = require('../config/sequelize');

/**
 * Centralized File Storage Utility for MAChip.
 * Handles saving generated files (PDFs, reports, etc.) to the PC's drive.
 * Falls back to local 'backend/uploads' if no custom external storageRootPath is configured.
 */

function getResolvedRootPath(settings) {
  if (settings && settings.storageRootPath && typeof settings.storageRootPath === 'string' && settings.storageRootPath.trim() !== '') {
    return settings.storageRootPath.trim();
  }
  return path.resolve(__dirname, '../../uploads');
}

/**
 * Saves a buffer to the configured storage root path with a structured sub-folder system.
 * Hierarchy: [Root] / [Year] / [Month] / [Period or Module Folder] / [FileName]
 * 
 * @param {Buffer} buffer - The file content.
 * @param {string} fileName - The name of the file (including extension).
 * @param {Object} options - { year, month, subFolder }
 * @returns {Promise<string|null>} - The absolute path of the saved file, or null if failed.
 */
exports.saveFileToArchive = async (buffer, fileName, options = {}) => {
  try {
    const settings = await SystemSettings.findOne();
    const storageRoot = getResolvedRootPath(settings);

    const { year, month, subFolder } = options;
    
    // Build path: [Root] / [Year] / [Month] / [SubFolder]
    let targetDir = storageRoot;
    
    if (year) targetDir = path.join(targetDir, String(year));
    if (month) targetDir = path.join(targetDir, month); // e.g., "05_May"
    if (subFolder) targetDir = path.join(targetDir, subFolder); // e.g., "Period_2026-05-01_to_2026-05-15"

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, fileName);
    fs.writeFileSync(targetPath, buffer);

    console.log(`[FILE STORAGE] Successfully archived: ${targetPath}`);
    return targetPath;
  } catch (error) {
    console.error('[FILE STORAGE ERROR]:', error.message);
    return null;
  }
};

/**
 * Ensures the basic directory structure exists for the current year and month.
 * Called at server startup for debug and prep.
 */
exports.initializeStorageStructure = async () => {
  try {
    const settings = await SystemSettings.findOne();
    const storageRoot = getResolvedRootPath(settings);

    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthFolder = `${String(monthIndex + 1).padStart(2, '0')}_${months[monthIndex]}`;

    const pathsToEnsure = [
      storageRoot,
      path.join(storageRoot, String(year)),
      path.join(storageRoot, String(year), monthFolder),
      path.join(storageRoot, "requestsFiles"),
      path.join(storageRoot, "ProfilePictures")
    ];

    console.log(`[DEBUG][FILE STORAGE] Verifying archival structure at: ${storageRoot}`);
    for (const p of pathsToEnsure) {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`[DEBUG][FILE STORAGE] [CREATED]: ${p}`);
      } else {
        console.log(`[DEBUG][FILE STORAGE] [VERIFIED]: ${p}`);
      }
    }
  } catch (error) {
    console.error('[DEBUG][FILE STORAGE ERROR] Initialization failed:', error.message);
  }
};

/**
 * Validates if a path is writable.
 * @param {string} rootPath - The path to check.
 * @returns {boolean}
 */
exports.isPathWritable = (rootPath) => {
  try {
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(rootPath, { recursive: true });
    }
    const testFile = path.join(rootPath, '.machip_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
};
