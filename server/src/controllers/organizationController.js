/**
 * Organization Controller
 * HTTP handlers for organization management endpoints.
 * All business logic is delegated to organizationService.
 */

import { sendSuccess } from '../middleware/responseHandler.js';
import organizationService from '../services/organizationService.js';

/**
 * GET /api/v1/organization
 * Get current organization details
 */
export const getCurrentOrg = async (req, res, next) => {
  try {
    const org = await organizationService.getOrganization(req.user.organizationId);
    return sendSuccess(res, org);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/organization
 * Update organization settings
 */
export const updateOrg = async (req, res, next) => {
  try {
    const org = await organizationService.updateOrganization(
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, org);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/organization/frameworks
 * Toggle frameworks (enable/disable)
 */
export const toggleFrameworks = async (req, res, next) => {
  try {
    const result = await organizationService.toggleFrameworks(
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export default {
  getCurrentOrg,
  updateOrg,
  toggleFrameworks,
};
