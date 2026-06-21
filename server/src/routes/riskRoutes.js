/**
 * Risk Routes
 * API routes for Risk management
 */
import { Router } from 'express';
import riskController from '../controllers/riskController.js';
import commentController from '../controllers/commentController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createRiskSchema,
  updateRiskSchema,
  listRisksQuerySchema,
  closeRiskSchema,
  reopenRiskSchema,
  linkControlsSchema,
  reviewRiskSchema,
  approveRiskSchema,
  submitRiskApprovalSchema,
  getRiskAssessmentsSchema,
  riskIdParamSchema,
} from '../validators/riskValidator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// ANALYTICS (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/risks/stats
 * Get risk statistics
 */
router.get('/stats', riskController.getRiskStats);

/**
 * GET /api/v1/risks/top
 * Get top risks by residual score
 */
router.get('/top', riskController.getTopRisks);

/**
 * GET /api/v1/risks/matrix
 * Get risk matrix data for heat map visualization
 */
router.get('/matrix', riskController.getRiskMatrix);

/**
 * GET /api/v1/risks/stale
 * Get stale risks (need recalculation)
 */
router.get('/stale', riskController.getStaleRisks);

/**
 * POST /api/v1/risks/batch-recalculate
 * Batch recalculate all residual scores (Admin only)
 */
router.post(
  '/batch-recalculate',
  blockAuditor,
  authorize('ADMIN'),
  riskController.batchRecalculate
);

// =============================================================================
// RISK CRUD
// =============================================================================

/**
 * GET /api/v1/risks
 * List risks with filters
 */
router.get(
  '/',
  validateQuery(listRisksQuerySchema),
  riskController.getRisks
);

/**
 * POST /api/v1/risks
 * Create new risk (Manager+ only)
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createRiskSchema),
  riskController.createRisk
);

/**
 * GET /api/v1/risks/:id
 * Get risk with full details
 */
router.get(
  '/:id',
  validateParams(riskIdParamSchema),
  riskController.getRiskById
);

/**
 * PATCH /api/v1/risks/:id
 * Update risk (Manager+ only)
 */
router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(updateRiskSchema),
  riskController.updateRisk
);

/**
 * DELETE /api/v1/risks/:id
 * Soft delete risk (Admin only)
 */
router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(riskIdParamSchema),
  riskController.deleteRisk
);

// =============================================================================
// RISK LIFECYCLE
// =============================================================================

/**
 * POST /api/v1/risks/:id/close
 * Close a risk (Manager+ only)
 */
router.post(
  '/:id/close',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(closeRiskSchema),
  riskController.closeRisk
);

/**
 * POST /api/v1/risks/:id/reopen
 * Reopen a closed risk (Manager+ only)
 */
router.post(
  '/:id/reopen',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(reopenRiskSchema),
  riskController.reopenRisk
);

/**
 * POST /api/v1/risks/:id/archive
 * Archive a risk (Manager+ only)
 */
router.post(
  '/:id/archive',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  riskController.archiveRisk
);

/**
 * POST /api/v1/risks/:id/approve
 * Approve a risk and snapshot assessment (Manager+ only)
 */
router.post(
  '/:id/approve',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(approveRiskSchema),
  riskController.approveRisk
);

/**
 * POST /api/v1/risks/:id/submit-approval
 * Assign approvers and submit a risk for approval (Manager+ only)
 */
router.post(
  '/:id/submit-approval',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(submitRiskApprovalSchema),
  riskController.submitRiskApproval
);

/**
 * POST /api/v1/risks/:id/review
 * Periodic review of risk (Manager+ only)
 */
router.post(
  '/:id/review',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(reviewRiskSchema),
  riskController.reviewRisk
);

// =============================================================================
// MITIGATING CONTROLS
// =============================================================================

/**
 * POST /api/v1/risks/:id/controls
 * Link mitigating controls to risk (Manager+ only)
 */
router.post(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(linkControlsSchema),
  riskController.linkControls
);

/**
 * DELETE /api/v1/risks/:id/controls
 * Unlink mitigating controls from risk (Manager+ only)
 */
router.delete(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskIdParamSchema),
  validateBody(linkControlsSchema),
  riskController.unlinkControls
);

/**
 * GET /api/v1/risks/:id/assessments
 */
router.get(
  '/:id/assessments',
  validateParams(getRiskAssessmentsSchema),
  riskController.getRiskAssessments
);

// =============================================================================
// COMMENTS
// =============================================================================

router.get(
  '/:id/comments',
  validateParams(riskIdParamSchema),
  commentController.getRiskComments
);

router.post(
  '/:id/comments',
  validateParams(riskIdParamSchema),
  commentController.createRiskComment
);

export default router;
