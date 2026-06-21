/**
 * Policy Library Routes
 * Vanta-style policy template library
 */
import { Router } from 'express';
import policyLibraryController from '../controllers/policyLibraryController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateParams } from '../validators/validate.js';
import { z } from 'zod';

const router = Router();

router.use(protect);

/**
 * GET /api/v1/policy-library
 * List policy templates with filters
 * Query: search, frameworkCode, added (true|false), page, limit
 */
router.get('/', policyLibraryController.getPolicyLibrary);

/**
 * POST /api/v1/policy-library/:templateId/add
 * Add policy from template to org (Manager+)
 */
router.post(
  '/:templateId/add',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  policyLibraryController.addPolicyFromLibrary
);

/**
 * GET /api/v1/policy-library/:templateId/download
 * Download template file
 */
router.get(
  '/:templateId/download',
  policyLibraryController.downloadTemplate
);

export default router;
