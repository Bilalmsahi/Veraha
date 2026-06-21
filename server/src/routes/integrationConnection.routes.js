/**
 * Integration Connection Routes
 * API routes for integration connection management
 */
import { Router } from 'express';
import integrationConnectionController from '../controllers/integrationConnection.controller.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// INTEGRATION CONNECTIONS
// =============================================================================

/**
 * GET /api/v1/integrations/connections
 * List all integration connections
 */
router.get(
  '/',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  integrationConnectionController.listConnections
);

/**
 * POST /api/v1/integrations/connections
 * Create or update integration connection (Manager+ only)
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  integrationConnectionController.upsertConnection
);

/**
 * DELETE /api/v1/integrations/connections/:type
 * Delete integration connection (Admin only)
 */
router.delete(
  '/:type',
  blockAuditor,
  authorize('ADMIN'),
  integrationConnectionController.deleteConnection
);

export default router;
