/**
 * Dual-Mode Storage Service
 * Supports Local filesystem (development) and AWS S3 (production)
 * 
 * Selection is based on STORAGE_MODE environment variable
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { storageConfig } from '../config/storage.js';

// For S3 (lazy-loaded only when S3 mode is active)
let S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl;

/**
 * Lazy-load AWS SDK only when S3 mode is active
 * This avoids errors when AWS credentials aren't configured
 */
const loadS3 = async () => {
  if (!S3Client) {
    const s3Module = await import('@aws-sdk/client-s3');
    const presignerModule = await import('@aws-sdk/s3-request-presigner');
    S3Client = s3Module.S3Client;
    PutObjectCommand = s3Module.PutObjectCommand;
    GetObjectCommand = s3Module.GetObjectCommand;
    DeleteObjectCommand = s3Module.DeleteObjectCommand;
    getSignedUrl = presignerModule.getSignedUrl;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate SHA256 hash of file buffer for integrity verification
 */
export const generateFileHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Generate unique storage key with organization isolation
 * Format: orgId/year/month/uuid-sanitizedFilename
 */
export const generateStorageKey = (organizationId, originalName) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  // Sanitize filename: remove special chars, keep alphanumeric, dots, hyphens
  const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 100);

  return `${organizationId}/${year}/${month}/${uuid}-${safeName}`;
};

/**
 * Generate storage key for global policy templates (no org isolation)
 * Format: policy-templates/sanitizedFilename
 */
export const generatePolicyTemplateKey = (filename) => {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 120);
  return `policy-templates/${safeName}`;
};

// =============================================================================
// LOCAL STORAGE IMPLEMENTATION
// =============================================================================

const localStorage = {
  /**
   * Upload file to local filesystem
   */
  async upload(buffer, key, mimeType) {
    const uploadDir = path.join(PROJECT_ROOT, storageConfig.local.uploadDir);
    const filePath = path.join(uploadDir, key);
    const dirPath = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.writeFile(filePath, buffer);

    // Generate URL
    const fileUrl = `${storageConfig.local.baseUrl}/uploads/${key}`;

    return {
      key,
      url: fileUrl,
      location: filePath,
    };
  },

  /**
   * Get URL for file (for local, just return static URL)
   */
  async getSignedUrl(key) {
    return `${storageConfig.local.baseUrl}/uploads/${key}`;
  },

  /**
   * Get file as readable stream (for proxying downloads to avoid CORS)
   */
  async getFileStream(key) {
    const { createReadStream } = await import('fs');
    const filePath = path.join(PROJECT_ROOT, storageConfig.local.uploadDir, key);
    return createReadStream(filePath);
  },

  /**
   * Delete file from local filesystem
   */
  async delete(key) {
    const filePath = path.join(PROJECT_ROOT, storageConfig.local.uploadDir, key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true; // File already doesn't exist
      }
      throw error;
    }
  },

  /**
   * Check if file exists
   */
  async exists(key) {
    const filePath = path.join(PROJECT_ROOT, storageConfig.local.uploadDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// =============================================================================
// S3 STORAGE IMPLEMENTATION
// =============================================================================

const s3Storage = {
  _client: null,

  /**
   * Get or create S3 client (singleton)
   */
  getClient() {
    if (!this._client) {
      this._client = new S3Client({
        region: storageConfig.s3.region,
        credentials: {
          accessKeyId: storageConfig.s3.accessKeyId,
          secretAccessKey: storageConfig.s3.secretAccessKey,
        },
      });
    }
    return this._client;
  },

  /**
   * Upload file to S3
   */
  async upload(buffer, key, mimeType) {
    await loadS3();
    const client = this.getClient();

    const command = new PutObjectCommand({
      Bucket: storageConfig.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await client.send(command);

    // Generate signed URL for immediate access
    const url = await this.getSignedUrl(key);

    return {
      key,
      url,
      location: `s3://${storageConfig.s3.bucket}/${key}`,
    };
  },

  /**
   * Generate pre-signed URL for secure access
   */
  async getSignedUrl(key, expiresIn = storageConfig.s3.urlExpiration) {
    await loadS3();
    const client = this.getClient();

    const command = new GetObjectCommand({
      Bucket: storageConfig.s3.bucket,
      Key: key,
    });

    return getSignedUrl(client, command, { expiresIn });
  },

  /**
   * Delete file from S3
   */
  async delete(key) {
    await loadS3();
    const client = this.getClient();

    const command = new DeleteObjectCommand({
      Bucket: storageConfig.s3.bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  },

  /**
   * Check if file exists in S3
   */
  async exists(key) {
    await loadS3();
    const client = this.getClient();

    try {
      const command = new GetObjectCommand({
        Bucket: storageConfig.s3.bucket,
        Key: key,
      });
      await client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  },

  /**
   * Get file as readable stream (for proxying downloads to avoid CORS)
   */
  async getFileStream(key) {
    await loadS3();
    const client = this.getClient();
    const command = new GetObjectCommand({
      Bucket: storageConfig.s3.bucket,
      Key: key,
    });
    const response = await client.send(command);
    if (!response.Body) {
      const err = new Error('Empty S3 response');
      err.code = 'EMPTY';
      throw err;
    }
    return response.Body;
  },
};

// =============================================================================
// UNIFIED STORAGE SERVICE (FACTORY PATTERN)
// =============================================================================

/**
 * Get the appropriate storage backend based on configuration
 */
const getStorage = () => {
  return storageConfig.mode === 's3' ? s3Storage : localStorage;
};

/**
 * Unified Storage Service API
 * Provides consistent interface regardless of storage backend
 */
export const storageService = {
  /**
   * Upload a file to the configured storage backend
   * @param {Buffer} buffer - File buffer
   * @param {string} organizationId - Organization ID for isolation
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @returns {Promise<{key, url, hash, size}>}
   */
  async uploadFile(buffer, organizationId, originalName, mimeType) {
    const storage = getStorage();
    const key = generateStorageKey(organizationId, originalName);
    const hash = generateFileHash(buffer);

    const result = await storage.upload(buffer, key, mimeType);

    return {
      ...result,
      hash,
      size: buffer.length,
    };
  },

  /**
   * Get a URL for accessing a file
   * For S3: generates a pre-signed URL
   * For Local: returns static URL
   */
  async getFileUrl(key) {
    const storage = getStorage();
    return storage.getSignedUrl(key);
  },

  /**
   * Get file as stream for proxying to client (avoids CORS when files are on S3)
   */
  async getFileStream(key) {
    const storage = getStorage();
    return storage.getFileStream(key);
  },

  /**
   * Delete a file from storage
   */
  async deleteFile(key) {
    const storage = getStorage();
    return storage.delete(key);
  },

  /**
   * Check if a file exists in storage
   */
  async fileExists(key) {
    const storage = getStorage();
    return storage.exists(key);
  },

  /**
   * Upload a policy template file (global, no org isolation)
   * Used during seeding to upload Vanta-Policy-Templates to S3/local
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename (e.g. access-control-policy-bsi.docx)
   * @param {string} mimeType - File MIME type
   * @returns {Promise<{key, url, hash, size}>}
   */
  async uploadPolicyTemplate(buffer, filename, mimeType) {
    const storage = getStorage();
    const key = generatePolicyTemplateKey(filename);
    const hash = generateFileHash(buffer);

    const result = await storage.upload(buffer, key, mimeType);

    return {
      ...result,
      hash,
      size: buffer.length,
    };
  },

  /**
   * Get the current storage mode
   */
  getStorageMode() {
    return storageConfig.mode;
  },
};

export default storageService;
