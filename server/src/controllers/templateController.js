/**
 * Template Controller
 * HTTP handlers for global control template endpoints.
 * All business logic is delegated to templateService.
 */

import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import templateService from '../services/templateService.js';

/**
 * GET /api/v1/templates
 * List all templates with pagination and filters
 */
export const listTemplates = async (req, res, next) => {
  try {
    const { templates, pagination } = await templateService.getTemplates(req.query);
    return sendPaginated(res, templates, pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/templates/categories
 * Get list of unique template categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await templateService.getCategories();
    return sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/templates/by-framework/:code
 * Get templates filtered by framework code
 */
export const getTemplatesByFramework = async (req, res, next) => {
  try {
    const { templates, framework, pagination } = await templateService.getTemplatesByFramework(
      req.params.code,
      req.query
    );
    return sendPaginated(res, templates, pagination, { framework });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/templates/:id
 * Get single template with full details
 */
export const getTemplate = async (req, res, next) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    return sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export default {
  listTemplates,
  getCategories,
  getTemplatesByFramework,
  getTemplate,
};
