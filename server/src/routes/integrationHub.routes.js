/**
 * Integration Hub Routes
 * Top-level routes for the integrations hub (e.g. summary endpoint)
 */
import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import integrationConnectionController from '../controllers/integrationConnection.controller.js';

const router = Router();

router.use(protect);

/**
 * GET /api/v1/integrations/summary
 * Get aggregated summary for all integration types (AWS, HR, MDM)
 */
router.get(
  '/summary',
  authorize('ADMIN', 'MANAGER', 'AUDITOR'),
  integrationConnectionController.getSummary
);

export default router;
