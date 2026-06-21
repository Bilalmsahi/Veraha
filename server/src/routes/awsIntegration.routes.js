/**
 * AWS Integration Routes
 * API routes for AWS account and finding management
 */
import { Router } from 'express';
import awsController from '../controllers/awsIntegration.controller.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createAwsAccountSchema,
  updateAwsAccountSchema,
  linkControlsSchema,
  listAwsAccountsQuerySchema,
  awsAccountIdParamSchema,
  awsAccountControlParamSchema,
  findingControlParamSchema,
} from '../validators/awsAccount.validator.js';
import {
  createAwsFindingSchema,
  updateAwsFindingSchema,
  listFindingsQuerySchema,
  awsFindingIdParamSchema,
  awsFindingAccountParamSchema,
} from '../validators/awsFinding.validator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// STATS (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/integrations/aws/stats
 * Get AWS integration statistics
 */
router.get('/stats', authorize('ADMIN', 'MANAGER', 'AUDITOR'), awsController.getAwsStats);

// =============================================================================
// AWS ACCOUNTS
// =============================================================================

/**
 * GET /api/v1/integrations/aws/accounts
 * List AWS accounts with filters
 */
router.get(
  '/accounts',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  validateQuery(listAwsAccountsQuerySchema),
  awsController.listAccounts
);

/**
 * POST /api/v1/integrations/aws/accounts
 * Create new AWS account (Manager+ only)
 */
router.post(
  '/accounts',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createAwsAccountSchema),
  awsController.createAccount
);

/**
 * PATCH /api/v1/integrations/aws/accounts/:id
 * Update AWS account (Manager+ only)
 */
router.patch(
  '/accounts/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsAccountIdParamSchema),
  validateBody(updateAwsAccountSchema),
  awsController.updateAccount
);

/**
 * DELETE /api/v1/integrations/aws/accounts/:id
 * Delete AWS account (Admin only)
 */
router.delete(
  '/accounts/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(awsAccountIdParamSchema),
  awsController.deleteAccount
);

// =============================================================================
// ACCOUNT CONTROL LINKING
// =============================================================================

/**
 * POST /api/v1/integrations/aws/accounts/:id/controls
 * Link controls to AWS account (Manager+ only)
 */
router.post(
  '/accounts/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsAccountIdParamSchema),
  validateBody(linkControlsSchema),
  awsController.linkAccountControl
);

/**
 * DELETE /api/v1/integrations/aws/accounts/:id/controls/:controlId
 * Unlink control from AWS account (Manager+ only)
 */
router.delete(
  '/accounts/:id/controls/:controlId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsAccountControlParamSchema),
  awsController.unlinkAccountControl
);

// =============================================================================
// FINDINGS (nested under accounts)
// =============================================================================

/**
 * GET /api/v1/integrations/aws/accounts/:accountId/findings
 * List findings for an AWS account
 */
router.get(
  '/accounts/:accountId/findings',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  validateParams(awsFindingAccountParamSchema),
  validateQuery(listFindingsQuerySchema),
  awsController.listFindings
);

/**
 * POST /api/v1/integrations/aws/accounts/:accountId/findings
 * Create finding for an AWS account (Manager+ only)
 */
router.post(
  '/accounts/:accountId/findings',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsFindingAccountParamSchema),
  validateBody(createAwsFindingSchema),
  awsController.createFinding
);

// =============================================================================
// FINDINGS (top-level by finding id)
// =============================================================================

/**
 * PATCH /api/v1/integrations/aws/findings/:id
 * Update AWS finding (Manager+ only)
 */
router.patch(
  '/findings/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsFindingIdParamSchema),
  validateBody(updateAwsFindingSchema),
  awsController.updateFinding
);

/**
 * POST /api/v1/integrations/aws/findings/:id/controls
 * Link controls to AWS finding (Manager+ only)
 */
router.post(
  '/findings/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(awsFindingIdParamSchema),
  validateBody(linkControlsSchema),
  awsController.linkFindingControl
);

/**
 * DELETE /api/v1/integrations/aws/findings/:id/controls/:controlId
 * Unlink control from AWS finding (Manager+ only)
 */
router.delete(
  '/findings/:id/controls/:controlId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(findingControlParamSchema),
  awsController.unlinkFindingControl
);

export default router;
