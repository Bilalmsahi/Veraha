/**
 * Requirement Routes
 * 
 * Routes for accessing individual requirements.
 * These are PUBLIC read-only endpoints (no auth required).
 * 
 * Route Summary:
 * - GET /requirements/:id - Get single requirement by ID
 */

import { Router } from 'express';
import frameworkController from '../controllers/frameworkController.js';
import { validateParams } from '../validators/validate.js';
import { requirementIdParamSchema } from '../validators/frameworkValidator.js';

const router = Router();

// =============================================================================
// REQUIREMENT ROUTES (Public)
// =============================================================================

/**
 * GET /api/v1/requirements/:id
 * Get single requirement by ObjectId
 */
router.get(
  '/:id',
  validateParams(requirementIdParamSchema),
  frameworkController.getRequirement
);

export default router;
