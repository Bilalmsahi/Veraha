/**
 * HR Integration Routes
 * API routes for HR profile management
 */
import { Router } from 'express';
import hrController from '../controllers/hrIntegration.controller.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createHrProfileSchema,
  updateHrProfileSchema,
  departSchema,
  importCSVSchema,
  listHrProfilesQuerySchema,
  hrProfileIdParamSchema,
  hrProfileControlParamSchema,
} from '../validators/hrProfile.validator.js';
import { linkControlsSchema } from '../validators/awsAccount.validator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// STATS (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/integrations/hr/stats
 * Get HR integration statistics
 */
router.get(
  '/stats',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  hrController.getHrStats
);

/**
 * GET /api/v1/integrations/hr/policy-status/:id
 * Get policy status for an HR profile
 */
router.get(
  '/policy-status/:id',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  validateParams(hrProfileIdParamSchema),
  hrController.getPolicyStatus
);

// =============================================================================
// HR PROFILES CRUD
// =============================================================================

/**
 * GET /api/v1/integrations/hr
 * List HR profiles with filters
 */
router.get(
  '/',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  validateQuery(listHrProfilesQuerySchema),
  hrController.listProfiles
);

/**
 * POST /api/v1/integrations/hr
 * Create new HR profile (Manager+ only)
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createHrProfileSchema),
  hrController.createProfile
);

/**
 * PATCH /api/v1/integrations/hr/:id
 * Update HR profile (Manager+ only)
 */
router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(hrProfileIdParamSchema),
  validateBody(updateHrProfileSchema),
  hrController.updateProfile
);

// =============================================================================
// IMPORT
// =============================================================================

/**
 * POST /api/v1/integrations/hr/import
 * Import HR profiles from CSV (Manager+ only)
 */
router.post(
  '/import',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(importCSVSchema),
  hrController.importCSV
);

// =============================================================================
// LIFECYCLE
// =============================================================================

/**
 * POST /api/v1/integrations/hr/:id/depart
 * Mark employee as departed (Manager+ only)
 */
router.post(
  '/:id/depart',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(hrProfileIdParamSchema),
  validateBody(departSchema),
  hrController.departEmployee
);

// =============================================================================
// CONTROL LINKING
// =============================================================================

/**
 * POST /api/v1/integrations/hr/:id/controls
 * Link controls to HR profile (Manager+ only)
 */
router.post(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(hrProfileIdParamSchema),
  validateBody(linkControlsSchema),
  hrController.linkProfileControl
);

/**
 * DELETE /api/v1/integrations/hr/:id/controls/:controlId
 * Unlink control from HR profile (Manager+ only)
 */
router.delete(
  '/:id/controls/:controlId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(hrProfileControlParamSchema),
  hrController.unlinkProfileControl
);

export default router;
