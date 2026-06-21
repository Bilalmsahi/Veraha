/**
 * Storage Configuration
 * Dual-mode support: Local filesystem (development) and S3 (production)
 */
import dotenv from 'dotenv';
dotenv.config();

export const storageConfig = {
  // Storage mode: 'local' | 's3'
  mode: process.env.STORAGE_MODE || 'local',

  // Local Storage Configuration (Development)
  local: {
    uploadDir: process.env.LOCAL_UPLOAD_DIR || 'uploads',
    baseUrl: process.env.LOCAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  },

  // S3 Storage Configuration (Production)
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET_NAME,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    urlExpiration: parseInt(process.env.S3_URL_EXPIRATION || '3600', 10), // seconds
  },

  // Allowed MIME types for evidence uploads
  allowedMimeTypes: [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Images
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Text
    'text/plain',
    'text/csv',
    'text/markdown',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
  ],

  // Max file size: 25MB
  maxFileSize: 25 * 1024 * 1024,
};

export default storageConfig;
