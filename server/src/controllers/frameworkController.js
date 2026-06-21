/**
 * Framework Controller
 * HTTP handlers for framework and requirement endpoints.
 * All business logic is delegated to frameworkService.
 */

import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import frameworkService from '../services/frameworkService.js';
import readinessService from '../services/readinessService.js';

/**
 * GET /api/v1/frameworks
 * List all active frameworks
 */
export const listFrameworks = async (req, res, next) => {
  try {
    const frameworks = await frameworkService.getAllFrameworks(req.user?.organizationId);
    return sendSuccess(res, frameworks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/frameworks/:code
 * Get single framework by code
 */
export const getFramework = async (req, res, next) => {
  try {
    const framework = await frameworkService.getFrameworkByCode(req.params.code);
    if (req.user?.organizationId) {
      await frameworkService.assertFrameworkAccessible(req.user.organizationId, req.params.code);
    }
    return sendSuccess(res, framework);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/frameworks/:code/categories
 * List requirement categories for a framework with requirement counts
 */
export const getFrameworkCategories = async (req, res, next) => {
  try {
    if (req.user?.organizationId) {
      await frameworkService.assertFrameworkAccessible(req.user.organizationId, req.params.code);
    }
    const categories = await frameworkService.getCategoriesByFramework(req.params.code);
    return sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/frameworks/:code/requirements
 * Get paginated requirements for a framework
 */
export const getFrameworkRequirements = async (req, res, next) => {
  try {
    // Use validatedQuery (set by validateQuery middleware) or fall back to req.query
    const queryParams = req.validatedQuery || req.query;
    
    const { requirements, pagination } = await frameworkService.getRequirementsByFramework(
      req.params.code,
      queryParams,
      req.user?.organizationId
    );
    
    return sendPaginated(res, requirements, pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/frameworks/:code/requirements/:reqId
 * Single requirement; 404 if it does not belong to the given framework code
 */
export const getFrameworkRequirement = async (req, res, next) => {
  try {
    const requirement = await frameworkService.getRequirementById(req.params.reqId);
    const code = req.params.code?.toUpperCase();
    const fwCode = requirement.framework?.code;
    if (!fwCode || fwCode !== code) {
      const err = new Error('Requirement not found');
      err.statusCode = 404;
      throw err;
    }
    if (req.user?.organizationId) {
      await frameworkService.assertFrameworkAccessible(req.user.organizationId, req.params.code);
    }
    return sendSuccess(res, requirement);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/requirements/:id
 * Get single requirement by ID
 */
export const getRequirement = async (req, res, next) => {
  try {
    const requirement = await frameworkService.getRequirementById(req.params.id);
    return sendSuccess(res, requirement);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/frameworks/:code/readiness
 * Authenticated (tenant-scoped) readiness overlay for a framework.
 */
export const getFrameworkReadiness = async (req, res, next) => {
  try {
    await frameworkService.assertFrameworkAccessible(req.user.organizationId, req.params.code);
    const result = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
      req.user.organizationId,
      req.params.code
    );
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export default {
  listFrameworks,
  getFramework,
  getFrameworkCategories,
  getFrameworkRequirements,
  getFrameworkRequirement,
  getFrameworkReadiness,
  getRequirement,
};
