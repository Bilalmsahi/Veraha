/**
 * Dashboard Routes
 * 
 * All routes for dashboard data.
 * All routes require authentication.
 * 
 * Route Summary:
 * - GET /dashboard/summary     - Overall compliance summary
 * - GET /dashboard/frameworks  - Per-framework readiness scores
 * - GET /dashboard/activity    - Recent activity feed (paginated)
 * - GET /dashboard/alerts      - Expiring evidence, overdue assessments
 * - GET /dashboard/quick-stats - Quick stats for header/navbar
 */

import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateQuery } from '../validators/validate.js';
import { paginationSchema } from '../validators/commonValidator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// DASHBOARD ROUTES (All authenticated users)
// =============================================================================

/**
 * GET /api/v1/dashboard/summary
 * Get overall compliance summary including:
 * - Overall score
 * - Control status counts
 * - Framework readiness overview
 * - Alert counts
 */
router.get(
  '/summary',
  dashboardController.getSummary
);

/**
 * GET /api/v1/dashboard/frameworks
 * Get detailed per-framework readiness scores
 */
router.get(
  '/frameworks',
  dashboardController.getFrameworks
);

/**
 * GET /api/v1/dashboard/activity
 * Get recent activity feed (paginated)
 * Query: ?page=1&limit=20
 */
router.get(
  '/activity',
  validateQuery(paginationSchema),
  dashboardController.getActivity
);

/**
 * GET /api/v1/dashboard/alerts
 * Get alerts including:
 * - Expiring evidence (within 30 days)
 * - Overdue assessments
 * - Failing controls
 * - Warning controls
 * - Never assessed controls
 */
router.get(
  '/alerts',
  dashboardController.getAlerts
);

/**
 * GET /api/v1/dashboard/quick-stats
 * Get quick stats for header/navbar display
 */
router.get(
  '/quick-stats',
  dashboardController.getQuickStats
);

export default router;
