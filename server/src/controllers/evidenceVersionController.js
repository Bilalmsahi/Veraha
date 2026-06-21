/**
 * Evidence Version Controller
 * Vanta-style versioned evidence endpoints
 */
import evidenceVersionService from '../services/evidenceVersionService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

/**
 * GET /api/v1/evidence/:id/versions
 */
export const getVersions = async (req, res, next) => {
  try {
    const versions = await evidenceVersionService.getVersionsByEvidenceId(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, versions);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/versions
 * Create a new empty draft version
 */
export const createDraft = async (req, res, next) => {
  try {
    const version = await evidenceVersionService.createDraft(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, version, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/versions/new-draft
 * Create new draft (e.g. from "Renew" / "+ New draft"). Same as createDraft but semantic.
 */
export const createNewDraft = async (req, res, next) => {
  try {
    const version = await evidenceVersionService.createNewDraft(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, version, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/versions/:versionId/files
 * Add file to draft (multipart)
 */
export const addFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'File is required. Use "file" as the field name.',
        meta: null,
      });
    }
    const file = await evidenceVersionService.addFileToVersion(
      req.params.versionId,
      req.params.id,
      req.file,
      { organizationId: req.user.organizationId, userId: req.user._id }
    );
    sendSuccess(res, file, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/evidence/:id/versions/:versionId/files/:fileId
 */
export const removeFile = async (req, res, next) => {
  try {
    await evidenceVersionService.removeFileFromVersion(
      req.params.versionId,
      req.params.fileId,
      req.params.id,
      { organizationId: req.user.organizationId }
    );
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/versions/:versionId/submit
 */
export const submitVersion = async (req, res, next) => {
  try {
    const version = await evidenceVersionService.submitVersion(
      req.params.versionId,
      req.params.id,
      { organizationId: req.user.organizationId, userId: req.user._id }
    );
    sendSuccess(res, version);
  } catch (error) {
    next(error);
  }
};

export default {
  getVersions,
  createDraft,
  createNewDraft,
  addFile,
  removeFile,
  submitVersion,
};
