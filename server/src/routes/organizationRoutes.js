/**
 * Organization Routes
 * 
 * All routes for organization management.
 * All routes require authentication.
 * 
 * Route Summary:
 * - GET    /organization              - Get current org details
 * - PATCH  /organization              - Update org settings (ADMIN)
 * - PATCH  /organization/frameworks   - Enable/disable frameworks (ADMIN)
 */

import { Router } from 'express';
import organizationController from '../controllers/organizationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateBody } from '../validators/validate.js';
import {
  updateOrgSchema,
  toggleFrameworksSchema,
} from '../validators/organizationValidator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// ORGANIZATION ROUTES
// =============================================================================

/**
 * GET /api/v1/organization
 * Get current organization details with enabled frameworks
 */
router.get(
  '/',
  organizationController.getCurrentOrg
);

/**
 * PATCH /api/v1/organization
 * Update organization settings (name, timezone, etc.)
 * Admin only
 */
router.patch(
  '/',
  authorize('ADMIN'),
  validateBody(updateOrgSchema),
  organizationController.updateOrg
);

/**
 * PATCH /api/v1/organization/frameworks
 * Enable or disable frameworks
 * Admin only
 */
router.patch(
  '/frameworks',
  authorize('ADMIN'),
  validateBody(toggleFrameworksSchema),
  organizationController.toggleFrameworks
);

export default router;
