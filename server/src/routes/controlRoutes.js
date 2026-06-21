/**
 * Control Routes
 * 
 * All routes for internal control management.
 * All routes require authentication.
 * 
 * Route Summary:
 * - GET    /controls                    - List controls (paginated, filtered)
 * - GET    /controls/stats              - Get status counts
 * - GET    /controls/categories         - Get unique categories
 * - GET    /controls/gap-analysis/:code - Framework gap analysis
 * - GET    /controls/readiness/:code    - Framework readiness score
 * - GET    /controls/:id                - Get single control
 * - PATCH  /controls/:id                - Update control (Manager+)
 * - POST   /controls/:id/assess         - Record assessment (Manager+)
 * - POST   /controls/bulk-update        - Bulk update (Manager+)
 */

import { Router } from 'express';
import controlController from '../controllers/controlController.js';
import evidenceController from '../controllers/evidenceController.js';
import { protect, requireMinRole, requireInternalUser } from '../middleware/authMiddleware.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';
import {
  controlQuerySchema,
  controlIdParamSchema,
  frameworkCodeParamSchema,
  updateControlSchema,
  assessControlSchema,
  bulkUpdateSchema,
  createControlSchema,
  templateIdParamSchema,
  mapRequirementSchema,
} from '../validators/controlValidator.js';
import { controlIdParamSchema as evidenceControlIdParamSchema } from '../validators/evidenceValidator.js';

const router = Router();

// All routes require authentication
router.use(protect, requireInternalUser);

// =============================================================================
// READ ROUTES (All authenticated users)
// =============================================================================

/**
 * GET /api/v1/controls
 * List controls with pagination and filters
 * Query: ?page=1&limit=20&status=PASS,FAIL&controlGroup=xxx&frameworkCode=SOC2&categoryId=...&search=xxx
 */
router.get(
  '/',
  validateQuery(controlQuerySchema),
  controlController.listControls
);

/**
 * GET /api/v1/controls/stats
 * Get control status counts for dashboard
 */
router.get(
  '/stats',
  controlController.getStats
);

/**
 * GET /api/v1/controls/categories
 * Get unique categories with counts
 */
router.get(
  '/categories',
  controlController.getCategories
);

/**
 * GET /api/v1/controls/requirement-codes
 * Get requirement identifiers for Framework code filter
 */
router.get(
  '/requirement-codes',
  controlController.getRequirementCodes
);

/**
 * GET /api/v1/controls/gap-analysis/:frameworkCode
 * Get framework gap analysis
 */
router.get(
  '/gap-analysis/:frameworkCode',
  validateParams(frameworkCodeParamSchema),
  controlController.getGapAnalysis
);

/**
 * GET /api/v1/controls/readiness/:frameworkCode
 * Get framework readiness score
 */
router.get(
  '/readiness/:frameworkCode',
  validateParams(frameworkCodeParamSchema),
  controlController.getReadiness
);

/**
 * GET /api/v1/controls/:id
 * Get single control with full details
 */
router.get(
  '/:id',
  validateParams(controlIdParamSchema),
  controlController.getControl
);

router.get(
  '/:id/history',
  validateParams(controlIdParamSchema),
  controlController.getControlHistory
);

router.get(
  '/:id/comments',
  validateParams(controlIdParamSchema),
  controlController.getControlComments
);

/**
 * GET /api/v1/controls/:controlId/evidence
 * Get evidence linked to a specific control
 */
router.get(
  '/:controlId/evidence',
  validateParams(evidenceControlIdParamSchema),
  evidenceController.getEvidenceByControl
);

// =============================================================================
// WRITE ROUTES (Manager+ only)
// =============================================================================

/**
 * POST /api/v1/controls
 * Create a custom control
 * Manager or Admin only
 */
router.post(
  '/',
  requireMinRole('MANAGER'),
  validateBody(createControlSchema),
  controlController.createControl
);

/**
 * POST /api/v1/controls/from-template/:templateId
 * Create a control from a GlobalControlTemplate
 * Manager or Admin only
 */
router.post(
  '/from-template/:templateId',
  requireMinRole('MANAGER'),
  validateParams(templateIdParamSchema),
  controlController.createFromTemplate
);

/**
 * PATCH /api/v1/controls/:id
 * Update control (status, owner, notes)
 * Manager or Admin only
 */
router.post(
  '/:id/requirements',
  requireMinRole('MANAGER'),
  validateParams(controlIdParamSchema),
  validateBody(mapRequirementSchema),
  controlController.mapRequirement
);

router.post(
  '/:id/comments',
  validateParams(controlIdParamSchema),
  controlController.createControlComment
);

router.patch(
  '/:id',
  requireMinRole('MANAGER'),
  validateParams(controlIdParamSchema),
  validateBody(updateControlSchema),
  controlController.updateControl
);

/**
 * POST /api/v1/controls/:id/assess
 * Record manual assessment
 * Manager or Admin only
 */
router.post(
  '/:id/assess',
  requireMinRole('MANAGER'),
  validateParams(controlIdParamSchema),
  validateBody(assessControlSchema),
  controlController.assessControl
);

/**
 * POST /api/v1/controls/bulk-update
 * Bulk update multiple controls
 * Manager or Admin only
 */
router.post(
  '/bulk-update',
  requireMinRole('MANAGER'),
  validateBody(bulkUpdateSchema),
  controlController.bulkUpdate
);

export default router;
