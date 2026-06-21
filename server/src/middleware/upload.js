/**
 * Multer Upload Middleware
 * Handles multipart/form-data file uploads
 * Uses memory storage for processing before forwarding to storage service
 */
import multer from 'multer';
import { storageConfig } from '../config/storage.js';

/**
 * Memory storage configuration
 * Files are stored in buffer for processing before uploading to Local or S3
 */
const storage = multer.memoryStorage();

/**
 * File filter - validates MIME types
 */
const fileFilter = (req, file, cb) => {
  if (storageConfig.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `File type "${file.mimetype}" is not allowed. Allowed types: ${storageConfig.allowedMimeTypes.join(', ')}`
    );
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

/**
 * Multer upload configuration
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: storageConfig.maxFileSize,
    files: 1, // Single file upload
  },
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith('image/')) {
    cb(null, true);
  } else {
    const error = new Error('Only image uploads are allowed');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

export const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const DEVICE_SETTINGS_PROOF_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

const deviceSettingsProofFilter = (req, file, cb) => {
  if (DEVICE_SETTINGS_PROOF_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  const error = new Error(
    `File type "${file.mimetype}" is not allowed. Allowed types: PNG, JPEG, WEBP, PDF`
  );
  error.code = 'INVALID_FILE_TYPE';
  cb(error, false);
};

export const deviceSettingsUpload = multer({
  storage,
  fileFilter: deviceSettingsProofFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
  },
}).fields([
  { name: 'file_diskEncryptionEnabled', maxCount: 1 },
  { name: 'file_screenLockEnabled', maxCount: 1 },
  { name: 'file_antivirus', maxCount: 1 },
  { name: 'file_passwordManager', maxCount: 1 },
]);

/**
 * Error handler middleware for multer errors
 * Must be placed after the multer middleware in the route chain
 */
export const handleUploadError = (err, req, res, next) => {
  // Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        data: null,
        error: `File too large. Maximum size is ${storageConfig.maxFileSize / (1024 * 1024)}MB`,
        meta: null,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Only single file upload is allowed',
        meta: null,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Unexpected field name. Use "file" as the field name`,
        meta: null,
      });
    }
    return res.status(400).json({
      success: false,
      data: null,
      error: err.message,
      meta: null,
    });
  }

  // Handle custom file type errors
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      data: null,
      error: err.message,
      meta: null,
    });
  }

  // Pass other errors to global error handler
  next(err);
};

export default upload;
