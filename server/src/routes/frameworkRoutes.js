/**
 * Framework Routes
 * 
 * All routes for browsing compliance frameworks and requirements.
 * These are PUBLIC read-only endpoints (no auth required).
 * 
 * Route Summary:
 * - GET /frameworks              - List all frameworks
 * - GET /frameworks/:code/categories - Requirement categories for framework
 * - GET /frameworks/:code/requirements/:reqId - Single requirement (must belong to :code)
 * - GET /frameworks/:code        - Get framework by code
 * - GET /frameworks/:code/requirements - Get requirements for framework
 */

import { Router } from 'express';
import frameworkController from '../controllers/frameworkController.js';
import { optionalAuth, protect } from '../middleware/authMiddleware.js';
import { validateParams, validateQuery } from '../validators/validate.js';
import {
  frameworkCodeParamSchema,
  frameworkRequirementParamSchema,
  requirementsQuerySchema,
} from '../validators/frameworkValidator.js';

const router = Router();

// =============================================================================
// FRAMEWORK ROUTES (Public)
// =============================================================================

/**
 * GET /api/v1/frameworks
 * List all active frameworks with requirement counts
 */
router.get('/', optionalAuth, frameworkController.listFrameworks);

/**
 * GET /api/v1/frameworks/:code/readiness
 * Tenant-scoped readiness (requires auth). Register before /:code.
 */
router.get(
  '/:code/readiness',
  protect,
  validateParams(frameworkCodeParamSchema),
  frameworkController.getFrameworkReadiness
);

/**
 * GET /api/v1/frameworks/:code/categories
 * Requirement categories (level 2) with counts — register before /:code
 */
router.get(
  '/:code/categories',
  optionalAuth,
  validateParams(frameworkCodeParamSchema),
  frameworkController.getFrameworkCategories
);

/**
 * GET /api/v1/frameworks/:code/requirements/:reqId
 * Single requirement scoped to framework (404 if requirement belongs to another framework)
 * Register before /:code/requirements (list) so the ObjectId segment is not swallowed
 */
router.get(
  '/:code/requirements/:reqId',
  optionalAuth,
  validateParams(frameworkRequirementParamSchema),
  frameworkController.getFrameworkRequirement
);

/**
 * GET /api/v1/frameworks/:code/requirements
 * Get paginated requirements for a framework
 *
 * Query params: page, limit, categoryId, search, sortBy, sortOrder
 */
router.get(
  '/:code/requirements',
  optionalAuth,
  validateParams(frameworkCodeParamSchema),
  validateQuery(requirementsQuerySchema),
  frameworkController.getFrameworkRequirements
);

/**
 * GET /api/v1/frameworks/:code
 * Get single framework by code (SOC2, ISO27001, HIPAA, GDPR)
 */
router.get(
  '/:code',
  optionalAuth,
  validateParams(frameworkCodeParamSchema),
  frameworkController.getFramework
);

export default router;
