/**
 * Evidence Routes
 * API routes for Evidence management
 */
import { Router } from 'express';
import evidenceController from '../controllers/evidenceController.js';
import commentController from '../controllers/commentController.js';
import evidenceVersionController from '../controllers/evidenceVersionController.js';
import { protect, authorize, blockAuditor, requireInternalUser } from '../middleware/authMiddleware.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createEvidenceSchema,
  createCustomDocumentSchema,
  updateEvidenceSchema,
  reviewEvidenceSchema,
  linkControlsSchema,
  listEvidenceQuerySchema,
  evidenceIdParamSchema,
  evidenceVersionIdParamSchema,
  evidenceVersionFileIdParamSchema,
  expiringQuerySchema,
} from '../validators/evidenceValidator.js';

const router = Router();

// All routes require authentication
router.use(protect, requireInternalUser);

// =============================================================================
// LIST & STATS ROUTES (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/evidence
 * List evidence with filters
 */
router.get(
  '/',
  validateQuery(listEvidenceQuerySchema),
  evidenceController.getEvidenceList
);

/**
 * GET /api/v1/evidence/stats
 * Get evidence statistics for dashboard
 */
router.get('/stats', evidenceController.getEvidenceStats);

/**
 * GET /api/v1/evidence/expiring
 * Get evidence expiring within N days
 */
router.get(
  '/expiring',
  validateQuery(expiringQuerySchema),
  evidenceController.getExpiringEvidence
);

// =============================================================================
// CREATE ROUTE (with file upload)
// =============================================================================

/**
 * POST /api/v1/evidence
 * Upload new evidence (Manager+ only)
 * 
 * Content-Type: multipart/form-data
 * Field: "file" (required)
 * Additional fields: title, description, category, tags, validFrom, validUntil, linkedControlIds
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  upload.single('file'),
  handleUploadError,
  validateBody(createEvidenceSchema),
  evidenceController.createEvidence
);

router.post(
  '/custom',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createCustomDocumentSchema),
  evidenceController.createCustomDocument
);

// =============================================================================
// SINGLE EVIDENCE ROUTES
// =============================================================================

/**
 * GET /api/v1/evidence/:id/versions
 * List versions (draft, active, prior) with files for Vanta-style evidence tab
 */
router.get(
  '/:id/versions',
  validateParams(evidenceIdParamSchema),
  evidenceVersionController.getVersions
);

/**
 * POST /api/v1/evidence/:id/versions/new-draft
 * Create new draft (e.g. "+ New draft" from renew) - must be before /:id/versions
 */
router.post(
  '/:id/versions/new-draft',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  evidenceVersionController.createNewDraft
);

/**
 * POST /api/v1/evidence/:id/versions
 * Create a new empty draft version
 */
router.post(
  '/:id/versions',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  evidenceVersionController.createDraft
);

/**
 * POST /api/v1/evidence/:id/versions/:versionId/files
 * Add file to draft (multipart, field: file)
 */
router.post(
  '/:id/versions/:versionId/files',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceVersionIdParamSchema),
  upload.single('file'),
  handleUploadError,
  evidenceVersionController.addFile
);

/**
 * DELETE /api/v1/evidence/:id/versions/:versionId/files/:fileId
 */
router.delete(
  '/:id/versions/:versionId/files/:fileId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceVersionFileIdParamSchema),
  evidenceVersionController.removeFile
);

/**
 * POST /api/v1/evidence/:id/versions/:versionId/submit
 * Submit draft -> active
 */
router.post(
  '/:id/versions/:versionId/submit',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceVersionIdParamSchema),
  evidenceVersionController.submitVersion
);

/**
 * GET /api/v1/evidence/:id/comments
 * Get comments for this evidence
 */
router.get(
  '/:id/comments',
  validateParams(evidenceIdParamSchema),
  commentController.getEvidenceComments
);

/**
 * POST /api/v1/evidence/:id/comments
 * Create a comment on this evidence
 */
router.post(
  '/:id/comments',
  validateParams(evidenceIdParamSchema),
  commentController.createEvidenceComment
);

/**
 * GET /api/v1/evidence/:id/file
 * Stream evidence file through API (no direct storage URL exposure)
 */
router.get(
  '/:id/file',
  validateParams(evidenceIdParamSchema),
  evidenceController.downloadEvidenceFile
);

/**
 * GET /api/v1/evidence/:id
 * Get single evidence by ID
 */
router.get(
  '/:id',
  validateParams(evidenceIdParamSchema),
  evidenceController.getEvidenceById
);

/**
 * PATCH /api/v1/evidence/:id
 * Update evidence metadata (Manager+ only)
 */
router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  validateBody(updateEvidenceSchema),
  evidenceController.updateEvidence
);

/**
 * POST /api/v1/evidence/:id/review
 * Review (approve/reject) evidence (Manager+ only)
 */
router.post(
  '/:id/review',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  validateBody(reviewEvidenceSchema),
  evidenceController.reviewEvidence
);

router.post(
  '/:id/archive',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  evidenceController.archiveEvidence
);

router.post(
  '/:id/unarchive',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  evidenceController.unarchiveEvidence
);

/**
 * POST /api/v1/evidence/:id/controls
 * Link evidence to additional controls (Manager+ only)
 */
router.post(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(evidenceIdParamSchema),
  validateBody(linkControlsSchema),
  evidenceController.linkControls
);

/**
 * DELETE /api/v1/evidence/:id
 * Soft delete evidence (Admin only)
 */
router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(evidenceIdParamSchema),
  evidenceController.deleteEvidence
);

export default router;
