const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure dynamic storage
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      // Lazy load SystemSettings to avoid circular dependency or premature access
      const { SystemSettings } = require('../config/sequelize');
      const settings = await SystemSettings.findOne();
      
      // Default to local 'uploads' if no storageRootPath is configured
      let rootPath = settings?.storageRootPath 
        ? settings.storageRootPath 
        : path.join(__dirname, '../../uploads');

      let finalPath = rootPath;

      // Determine subfolder based on fieldname or URL context
      if (file.fieldname === 'user_ProfilePic' || file.fieldname === 'avatar' || req.originalUrl.includes('/users')) {
        finalPath = path.join(rootPath, 'ProfilePictures');
      } else if (file.fieldname === 'proofFile' || file.fieldname === 'proof_File' || file.fieldname === 'damageProofFile' || req.originalUrl.includes('/request')) {
        finalPath = path.join(rootPath, 'requestsFiles');
      } else if (file.fieldname === 'image' || req.originalUrl.includes('/contact-support')) {
        finalPath = path.join(rootPath, 'supportFiles');
      }

      // Ensure the directory exists
      if (!fs.existsSync(finalPath)) {
        fs.mkdirSync(finalPath, { recursive: true });
      }

      cb(null, finalPath);
    } catch (err) {
      console.error('[UPLOAD DESTINATION ERROR]:', err.message);
      // Fallback to a safe local directory
      const fallback = 'uploads/';
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
      cb(null, fallback);
    }
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: fieldname-date-random.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (strictly allow png, jpeg, gif for profile pictures; images, pdf, and csv for general uploads)
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'user_ProfilePic' || file.fieldname === 'avatar' || file.fieldname === 'profilePic') {
    const allowedProfileTypes = /jpeg|jpg|png|gif/;
    const extname = allowedProfileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error('File type is not accepted. Only PNG, JPEG, and GIF files are allowed for profile photos!'), false);
    }
  }

  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
                   file.mimetype === 'text/csv' || 
                   file.mimetype === 'application/vnd.ms-excel';

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only images (jpeg, jpg, png, gif, webp), PDF, and CSV are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB limit
  fileFilter: fileFilter
});

/**
 * Validates the magic byte signature (header) of a file written to disk.
 * Defends against MIME type spoofing and executable/script renaming.
 */
function verifyFileMagicBytes(filePath) {
  if (!fs.existsSync(filePath)) return { valid: false, reason: "File not found" };

  let fd = null;
  try {
    fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);

    if (bytesRead < 4) {
      return { valid: false, reason: "File is empty or corrupted" };
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. PDF signature (%PDF-)
    if (ext === ".pdf") {
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return { valid: true, detectedType: "pdf" };
      }
      return { valid: false, reason: "Invalid PDF signature (magic bytes mismatch)" };
    }

    // 2. PNG signature (89 50 4E 47 0D 0A 1A 0A)
    if (ext === ".png") {
      if (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
      ) {
        return { valid: true, detectedType: "png" };
      }
      return { valid: false, reason: "Invalid PNG signature (magic bytes mismatch)" };
    }

    // 3. JPEG / JPG signature (FF D8 FF)
    if (ext === ".jpg" || ext === ".jpeg") {
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { valid: true, detectedType: "jpeg" };
      }
      return { valid: false, reason: "Invalid JPEG signature (magic bytes mismatch)" };
    }

    // 4. GIF signature (GIF87a or GIF89a)
    if (ext === ".gif") {
      const header = buffer.toString("ascii", 0, 6);
      if (header === "GIF87a" || header === "GIF89a") {
        return { valid: true, detectedType: "gif" };
      }
      return { valid: false, reason: "Invalid GIF signature (magic bytes mismatch)" };
    }

    // 5. WEBP signature (RIFF .... WEBP)
    if (ext === ".webp") {
      const riff = buffer.toString("ascii", 0, 4);
      const webp = buffer.toString("ascii", 8, 12);
      if (riff === "RIFF" && webp === "WEBP") {
        return { valid: true, detectedType: "webp" };
      }
      return { valid: false, reason: "Invalid WEBP signature (magic bytes mismatch)" };
    }

    // 6. CSV validation (Plaintext / UTF-8, reject binaries)
    if (ext === ".csv") {
      // Reject Windows PE / Executable (MZ)
      if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return { valid: false, reason: "Executable binary disguised as CSV (MZ header detected)" };
      }
      // Reject Linux ELF (7F 45 4C 46)
      if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        return { valid: false, reason: "Executable binary disguised as CSV (ELF header detected)" };
      }
      // Reject Mach-O binary signatures
      if (
        (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA) ||
        (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED)
      ) {
        return { valid: false, reason: "Binary disguised as CSV (Mach-O header detected)" };
      }
      // Check for null bytes indicating binary content
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0x00) {
          return { valid: false, reason: "Binary content detected in CSV file (null byte present)" };
        }
      }
      return { valid: true, detectedType: "csv" };
    }

    return { valid: false, reason: `Unsupported file extension: ${ext}` };
  } catch (err) {
    return { valid: false, reason: `Header read error: ${err.message}` };
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (e) {}
    }
  }
}

/**
 * Express middleware to validate all uploaded files' magic bytes.
 * Immediately unlinks any invalid file and responds with HTTP 400.
 */
function validateUploadedFiles(req, res, next) {
  const filesToValidate = [];
  if (req.file) {
    filesToValidate.push(req.file);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToValidate.push(...req.files);
    } else if (typeof req.files === "object") {
      for (const field of Object.keys(req.files)) {
        if (Array.isArray(req.files[field])) {
          filesToValidate.push(...req.files[field]);
        }
      }
    }
  }

  for (const file of filesToValidate) {
    const result = verifyFileMagicBytes(file.path);
    if (!result.valid) {
      // Security violation: unlink all uploaded files for this request
      filesToValidate.forEach((f) => {
        if (f.path && fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {}
        }
      });
      return res.status(400).json({
        error: `Security verification failed: ${result.reason} on file "${file.originalname}".`
      });
    }
  }

  next();
}

upload.verifyFileMagicBytes = verifyFileMagicBytes;
upload.validateUploadedFiles = validateUploadedFiles;

module.exports = upload;
