/**
 * Dashboard Controller
 * HTTP handlers for dashboard endpoints.
 * All business logic is delegated to dashboardService.
 */

import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import dashboardService from '../services/dashboardService.js';

/**
 * GET /api/v1/dashboard/summary
 * Get overall compliance summary
 */
export const getSummary = async (req, res, next) => {
  try {
    const summary = await dashboardService.getSummary(req.user.organizationId);
    return sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/frameworks
 * Get per-framework readiness scores
 */
export const getFrameworks = async (req, res, next) => {
  try {
    const frameworks = await dashboardService.getFrameworksReadiness(req.user.organizationId);
    return sendSuccess(res, frameworks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/activity
 * Get recent activity feed
 */
export const getActivity = async (req, res, next) => {
  try {
    const { activities, pagination } = await dashboardService.getActivity(
      req.user.organizationId,
      req.query
    );
    return sendPaginated(res, activities, pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/alerts
 * Get alerts (expiring evidence, overdue assessments, etc.)
 */
export const getAlerts = async (req, res, next) => {
  try {
    const alerts = await dashboardService.getAlerts(req.user.organizationId);
    return sendSuccess(res, alerts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/quick-stats
 * Get quick stats for header/navbar
 */
export const getQuickStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getQuickStats(req.user.organizationId);
    return sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export default {
  getSummary,
  getFrameworks,
  getActivity,
  getAlerts,
  getQuickStats,
};
