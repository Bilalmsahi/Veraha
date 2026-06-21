/**
 * Policy Routes
 * API routes for Policy, PolicyVersion, and PolicyAttestation management
 */
import { Router } from 'express';
import policyController from '../controllers/policyController.js';
import { protect, authorize, blockAuditor, requireInternalUser } from '../middleware/authMiddleware.js';
import { upload, imageUpload, handleUploadError } from '../middleware/upload.js';
import { validateBody, validateQuery, validateParams, validateMultiple } from '../validators/validate.js';
import {
  createPolicySchema,
  updatePolicySchema,
  listPoliciesQuerySchema,
  createVersionSchema,
  updateVersionSchema,
  listAttestationsQuerySchema,
  policyIdParamSchema,
  versionIdParamSchema,
} from '../validators/policyValidator.js';
import policyWorkflowController from '../controllers/policyWorkflowController.js';
import {
  policyIdParamSchema as workflowPolicyIdParamSchema,
  policyWorkflowVersionParamsSchema,
  submitForApprovalSchema,
  rejectVersionSchema,
  publishWorkflowSchema,
  acknowledgeSchema,
  snoozePolicySchema,
  deactivatePolicySchema,
  archivePolicySchema,
} from '../validators/policyWorkflowValidator.js';

const router = Router();

// All routes require authentication
router.use(protect, requireInternalUser);

// =============================================================================
// POLICY LIST & STATS (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/policies
 * List policies with filters
 */
router.get(
  '/',
  validateQuery(listPoliciesQuerySchema),
  policyController.getPolicies
);

/**
 * GET /api/v1/policies/stats
 * Get policy statistics for dashboard
 */
router.get('/stats', policyController.getPolicyStats);

/**
 * GET /api/v1/policies/pending-attestations
 * Get policies pending attestation for current user
 */
router.get('/pending-attestations', policyController.getPendingAttestations);

/**
 * GET /api/v1/policies/:id/target-users
 * Resolve assignment-scope target users for this policy.
 */
router.get(
  '/:id/target-users',
  validateParams(workflowPolicyIdParamSchema),
  policyWorkflowController.targetUsers
);

// =============================================================================
// POLICY CRUD
// =============================================================================

/**
 * POST /api/v1/policies
 * Create new policy (Manager+ only)
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createPolicySchema),
  policyController.createPolicy
);

/**
 * GET /api/v1/policies/:id
 * Get policy with versions
 */
router.get(
  '/:id',
  validateParams(policyIdParamSchema),
  policyController.getPolicyById
);

/**
 * PATCH /api/v1/policies/:id
 * Update policy metadata (Manager+ only)
 */
router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  validateBody(updatePolicySchema),
  policyController.updatePolicy
);

// =============================================================================
// WORKFLOW (Phase 4) — new endpoints (keep policyController CRUD unchanged)
// =============================================================================

router.post(
  '/:id/submit-for-approval',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: workflowPolicyIdParamSchema, body: submitForApprovalSchema }),
  policyWorkflowController.submitForApproval
);

router.post(
  '/:id/versions/:versionId/approve',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyWorkflowVersionParamsSchema),
  policyWorkflowController.approve
);

router.post(
  '/:id/versions/:versionId/reject',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: policyWorkflowVersionParamsSchema, body: rejectVersionSchema }),
  policyWorkflowController.reject
);

router.post(
  '/:id/versions/:versionId/cancel-approval',
  blockAuditor,
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  validateParams(policyWorkflowVersionParamsSchema),
  policyWorkflowController.cancelApproval
);

// Legacy /:id/versions/:versionId/publish route removed; use workflow /:id/publish only.
router.post(
  '/:id/publish',
  blockAuditor,
  authorize('ADMIN'),
  validateMultiple({ params: workflowPolicyIdParamSchema, body: publishWorkflowSchema }),
  policyWorkflowController.publish
);

router.post(
  '/:id/acknowledge-workflow',
  blockAuditor,
  validateParams(workflowPolicyIdParamSchema),
  validateBody(acknowledgeSchema),
  policyWorkflowController.acknowledge
);

router.post(
  '/:id/snooze',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: workflowPolicyIdParamSchema, body: snoozePolicySchema }),
  policyWorkflowController.snooze
);

router.post(
  '/:id/unsnooze',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(workflowPolicyIdParamSchema),
  policyWorkflowController.unsnooze
);

router.post(
  '/:id/deactivate',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: workflowPolicyIdParamSchema, body: deactivatePolicySchema }),
  policyWorkflowController.deactivate
);

router.post(
  '/:id/reactivate',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(workflowPolicyIdParamSchema),
  policyWorkflowController.reactivate
);

// Legacy /:id/archive route removed; use workflow /:id/archive-workflow only.
router.post(
  '/:id/archive-workflow',
  blockAuditor,
  authorize('ADMIN'),
  validateMultiple({ params: workflowPolicyIdParamSchema, body: archivePolicySchema }),
  policyWorkflowController.archive
);

router.post(
  '/:id/unarchive',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(workflowPolicyIdParamSchema),
  policyWorkflowController.unarchive
);

/**
 * DELETE /api/v1/policies/:id
 * Soft delete policy (Admin only)
 */
router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(policyIdParamSchema),
  policyController.deletePolicy
);

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

/**
 * POST /api/v1/policies/:id/versions
 * Create new version (with optional file upload)
 * Manager+ only
 */
router.post(
  '/:id/versions',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  upload.single('file'),
  handleUploadError,
  validateBody(createVersionSchema),
  policyController.createVersion
);

router.post(
  '/:id/editor-draft',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  policyController.getOrCreateEditorDraft
);

router.post(
  '/:id/editor-draft/reset',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  policyController.resetEditorDraft
);

router.get(
  '/:id/content-document-url',
  blockAuditor,
  validateParams(policyIdParamSchema),
  policyController.getContentDocumentUrl
);

router.post(
  '/:id/editor-draft/import-source',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  policyController.importContentDocument
);

router.post(
  '/:id/images',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(policyIdParamSchema),
  imageUpload.single('file'),
  handleUploadError,
  policyController.uploadPolicyImage
);

/**
 * PATCH /api/v1/policies/:id/versions/:versionId
 * Update draft version
 * Manager+ only
 */
router.patch(
  '/:id/versions/:versionId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(versionIdParamSchema),
  validateBody(updateVersionSchema),
  policyController.updateVersion
);

// =============================================================================
// ATTESTATION
// =============================================================================

/**
 * GET /api/v1/policies/:id/attestations
 * Get attestations for policy's current version
 */
router.get(
  '/:id/attestations',
  validateParams(policyIdParamSchema),
  validateQuery(listAttestationsQuerySchema),
  policyController.getAttestations
);

// =============================================================================
// COMMENTS
// =============================================================================
import commentController from '../controllers/commentController.js';

router.get(
  '/:id/comments',
  validateParams(policyIdParamSchema),
  commentController.getPolicyComments
);

router.post(
  '/:id/comments',
  validateParams(policyIdParamSchema),
  commentController.createPolicyComment
);

export default router;
