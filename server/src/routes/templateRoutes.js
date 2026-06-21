/**
 * Template Routes
 * 
 * All routes for browsing global control templates.
 * These endpoints require authentication (protect middleware).
 * 
 * Route Summary:
 * - GET /templates              - List all templates (paginated)
 * - GET /templates/categories   - Get unique categories
 * - GET /templates/by-framework/:code - Get templates for framework
 * - GET /templates/:id          - Get single template details
 */

import { Router } from 'express';
import templateController from '../controllers/templateController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateParams, validateQuery } from '../validators/validate.js';
import {
  templateQuerySchema,
  templateIdParamSchema,
  frameworkCodeParamSchema,
} from '../validators/templateValidator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// TEMPLATE ROUTES (Protected)
// =============================================================================

/**
 * GET /api/v1/templates
 * List all templates with pagination
 * Query: ?page=1&limit=20&category=Asset%20Management&frameworkCode=SOC2&search=xxx
 */
router.get(
  '/',
  validateQuery(templateQuerySchema),
  templateController.listTemplates
);

/**
 * GET /api/v1/templates/categories
 * Get list of unique template categories with counts
 */
router.get(
  '/categories',
  templateController.getCategories
);

/**
 * GET /api/v1/templates/by-framework/:code
 * Get templates that map to a specific framework
 */
router.get(
  '/by-framework/:code',
  validateParams(frameworkCodeParamSchema),
  validateQuery(templateQuerySchema),
  templateController.getTemplatesByFramework
);

/**
 * GET /api/v1/templates/:id
 * Get single template with full requirement mappings
 */
router.get(
  '/:id',
  validateParams(templateIdParamSchema),
  templateController.getTemplate
);

export default router;
