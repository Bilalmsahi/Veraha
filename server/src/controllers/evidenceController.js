/**
 * Evidence Controller
 * HTTP handlers for Evidence API endpoints
 */
import evidenceService from '../services/evidenceService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

/**
 * POST /api/v1/evidence
 * Upload new evidence with file
 */
export const createEvidence = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'File is required. Use "file" as the field name.',
        meta: null,
      });
    }

    const evidence = await evidenceService.createEvidence(req.body, req.file, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });

    sendSuccess(res, evidence, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/custom
 * Create custom document metadata (no file upload)
 */
export const createCustomDocument = async (req, res, next) => {
  try {
    const document = await evidenceService.createCustomDocument(req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });

    sendSuccess(res, document, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/evidence
 * List evidence with filters
 */
export const getEvidenceList = async (req, res, next) => {
  try {
    const filters = { ...req.query, userId: req.user?._id?.toString() };
    const result = await evidenceService.getEvidenceList(
      req.user.organizationId,
      filters
    );

    sendSuccess(res, result.evidence, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/evidence/stats
 * Get evidence statistics
 */
export const getEvidenceStats = async (req, res, next) => {
  try {
    const stats = await evidenceService.getEvidenceStats(
      req.user.organizationId,
      req.user?._id?.toString()
    );
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/evidence/expiring
 * Get expiring evidence
 */
export const getExpiringEvidence = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const evidence = await evidenceService.getExpiringEvidence(
      req.user.organizationId,
      days
    );
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/evidence/:id
 * Get single evidence
 */
export const getEvidenceById = async (req, res, next) => {
  try {
    const evidence = await evidenceService.getEvidenceById(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/:controlId/evidence
 * Get evidence for a control
 */
export const getEvidenceByControl = async (req, res, next) => {
  try {
    const result = await evidenceService.getEvidenceByControl(
      req.params.controlId,
      req.user.organizationId,
      req.query
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/evidence/:id
 * Update evidence metadata
 */
export const updateEvidence = async (req, res, next) => {
  try {
    const evidence = await evidenceService.updateEvidence(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/review
 * Review (approve/reject) evidence
 */
export const reviewEvidence = async (req, res, next) => {
  try {
    const evidence = await evidenceService.reviewEvidence(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

export const archiveEvidence = async (req, res, next) => {
  try {
    const evidence = await evidenceService.archiveEvidence(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

export const unarchiveEvidence = async (req, res, next) => {
  try {
    const evidence = await evidenceService.unarchiveEvidence(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/evidence/:id
 * Soft delete evidence
 */
export const deleteEvidence = async (req, res, next) => {
  try {
    const result = await evidenceService.deleteEvidence(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/evidence/:id/controls
 * Link evidence to additional controls
 */
export const linkControls = async (req, res, next) => {
  try {
    const { controlIds } = req.body;

    if (!controlIds || !Array.isArray(controlIds)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'controlIds array is required',
        meta: null,
      });
    }

    const evidence = await evidenceService.linkEvidenceToControls(
      req.params.id,
      controlIds,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

export const downloadEvidenceFile = async (req, res, next) => {
  try {
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
    const { stream, fileName, mimeType } = await evidenceService.streamEvidenceFile(
      req.params.id,
      req.user.organizationId
    );

    const safeName = String(fileName).replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export default {
  createEvidence,
  createCustomDocument,
  getEvidenceList,
  getEvidenceStats,
  getExpiringEvidence,
  getEvidenceById,
  getEvidenceByControl,
  updateEvidence,
  reviewEvidence,
  archiveEvidence,
  unarchiveEvidence,
  deleteEvidence,
  linkControls,
  downloadEvidenceFile,
};
