/**
 * Risk Controller
 * HTTP handlers for Risk API endpoints
 */
import riskService from '../services/riskService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

// =============================================================================
// RISK CRUD
// =============================================================================

/**
 * POST /api/v1/risks
 * Create new risk
 */
export const createRisk = async (req, res, next) => {
  try {
    const risk = await riskService.createRisk(req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks
 * List risks with filters
 */
export const getRisks = async (req, res, next) => {
  try {
    const result = await riskService.getRisks(req.user.organizationId, {
      ...req.query,
      userId: req.user._id,
    });
    sendSuccess(res, result.risks, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks/:id
 * Get risk with full details
 */
export const getRiskById = async (req, res, next) => {
  try {
    const risk = await riskService.getRiskById(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/risks/:id
 * Update risk
 */
export const updateRisk = async (req, res, next) => {
  try {
    const risk = await riskService.updateRisk(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/risks/:id
 * Soft delete risk
 */
export const deleteRisk = async (req, res, next) => {
  try {
    const result = await riskService.deleteRisk(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// RISK LIFECYCLE
// =============================================================================

/**
 * POST /api/v1/risks/:id/close
 * Close a risk
 */
export const closeRisk = async (req, res, next) => {
  try {
    const risk = await riskService.closeRisk(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/:id/reopen
 * Reopen a closed risk
 */
export const reopenRisk = async (req, res, next) => {
  try {
    const risk = await riskService.reopenRisk(req.params.id, req.body || {}, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/:id/archive
 * Archive a risk (keep visible, mark status as ARCHIVED)
 */
export const archiveRisk = async (req, res, next) => {
  try {
    const risk = await riskService.archiveRisk(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/:id/approve
 * Approve a risk and snapshot assessment history
 */
export const approveRisk = async (req, res, next) => {
  try {
    const risk = await riskService.approveRisk(req.params.id, req.body || {}, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
      role: req.user.role,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/:id/submit-approval
 * Assign approvers and submit a risk for approval
 */
export const submitRiskApproval = async (req, res, next) => {
  try {
    const risk = await riskService.submitRiskApproval(req.params.id, req.body || {}, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/:id/review
 * Periodic review of risk
 */
export const reviewRisk = async (req, res, next) => {
  try {
    const risk = await riskService.reviewRisk(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// MITIGATING CONTROLS
// =============================================================================

/**
 * POST /api/v1/risks/:id/controls
 * Link mitigating controls to risk
 */
export const linkControls = async (req, res, next) => {
  try {
    const risk = await riskService.linkControls(
      req.params.id,
      req.body.controlIds,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/risks/:id/controls
 * Unlink mitigating controls from risk
 */
export const unlinkControls = async (req, res, next) => {
  try {
    const risk = await riskService.unlinkControls(
      req.params.id,
      req.body.controlIds,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, risk);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks/:id/assessments
 */
export const getRiskAssessments = async (req, res, next) => {
  try {
    const assessments = await riskService.getRiskAssessments(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, assessments);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// ANALYTICS & DASHBOARD
// =============================================================================

/**
 * GET /api/v1/risks/stats
 * Get risk statistics
 */
export const getRiskStats = async (req, res, next) => {
  try {
    const stats = await riskService.getRiskStats(req.user.organizationId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks/top
 * Get top risks by residual score
 */
export const getTopRisks = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const risks = await riskService.getTopRisks(req.user.organizationId, limit);
    sendSuccess(res, risks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks/matrix
 * Get risk matrix data for heat map
 */
export const getRiskMatrix = async (req, res, next) => {
  try {
    const matrix = await riskService.getRiskMatrix(req.user.organizationId);
    sendSuccess(res, matrix);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/risks/stale
 * Get stale risks (need recalculation)
 */
export const getStaleRisks = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const risks = await riskService.getStaleRisks(
      req.user.organizationId,
      days
    );
    sendSuccess(res, risks);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/risks/batch-recalculate
 * Batch recalculate all residual scores (Admin only)
 */
export const batchRecalculate = async (req, res, next) => {
  try {
    const result = await riskService.batchRecalculate(req.user.organizationId, {
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export default {
  createRisk,
  getRisks,
  getRiskById,
  updateRisk,
  deleteRisk,
  closeRisk,
  reopenRisk,
  archiveRisk,
  submitRiskApproval,
  approveRisk,
  reviewRisk,
  linkControls,
  unlinkControls,
  getRiskAssessments,
  getRiskStats,
  getTopRisks,
  getRiskMatrix,
  getStaleRisks,
  batchRecalculate,
};
