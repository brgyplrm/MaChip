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

// File filter (only allow images, pdf, and csv)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
                   file.mimetype === 'text/csv' || 
                   file.mimetype === 'application/vnd.ms-excel';

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only images (jpeg, jpg, png), PDF, and CSV are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB limit
  fileFilter: fileFilter
});

module.exports = upload;
