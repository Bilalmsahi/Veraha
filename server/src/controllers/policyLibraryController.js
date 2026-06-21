/**
 * Policy Library Controller
 */
import policyLibraryService from '../services/policyLibraryService.js';
import PolicyTemplate from '../models/PolicyTemplate.js';
import { storageService } from '../services/storageService.js';
import { sendSuccess } from '../middleware/responseHandler.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'seeds', 'raw', 'Vanta-Policy-Templates');

export const getPolicyLibrary = async (req, res, next) => {
  try {
    const result = await policyLibraryService.getPolicyLibrary(
      req.user.organizationId,
      req.query
    );
    sendSuccess(res, result.templates, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const addPolicyFromLibrary = async (req, res, next) => {
  try {
    const policy = await policyLibraryService.addPolicyFromLibrary(
      req.params.templateId,
      req.user.organizationId,
      req.user._id
    );
    sendSuccess(res, policy, null, 201);
  } catch (error) {
    next(error);
  }
};

export const downloadTemplate = async (req, res, next) => {
  try {
    const template = await PolicyTemplate.findById(req.params.templateId);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    const ext = template.filename.toLowerCase().split('.').pop();
    const mime = ext === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    res.setHeader('Content-Type', mime);

    // Prefer storage (S3 or local) when fileKey is set - stream through backend to avoid CORS
    if (template.fileKey) {
      try {
        const stream = await storageService.getFileStream(template.fileKey);
        stream.pipe(res);
        return;
      } catch (storageErr) {
        // Fall through to seeds/raw if storage fails
      }
    }

    // Fallback: serve from seeds/raw (e.g. before first seed with uploads)
    const filePath = path.join(TEMPLATES_DIR, template.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Template file not found' });
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export default {
  getPolicyLibrary,
  addPolicyFromLibrary,
  downloadTemplate,
};
