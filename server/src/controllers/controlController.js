/**
 * Control Controller
 * HTTP handlers for internal control endpoints.
 * All business logic is delegated to controlService.
 */

import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import controlService from '../services/controlService.js';
import InternalControl from '../models/InternalControl.js';
import ActivityLog from '../models/ActivityLog.js';
import commentService from '../services/commentService.js';

async function assertControlExists(controlId, organizationId) {
  const control = await InternalControl.findOne({
    _id: controlId,
    organizationId,
    isDeleted: false,
    isActive: { $ne: false },
  }).select('_id');

  if (!control) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }
}

/**
 * GET /api/v1/controls
 * List controls with pagination and filters
 */
export const listControls = async (req, res, next) => {
  try {
    const queryParams = req.validatedQuery || req.query;
    const { controls, pagination } = await controlService.getControls(
      req.user.organizationId,
      queryParams
    );
    return sendPaginated(res, controls, pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/stats
 * Get control status counts
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await controlService.getStatusCounts(req.user.organizationId);
    return sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/categories
 * Get unique control categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await controlService.getCategories(req.user.organizationId);
    return sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/requirement-codes
 * Get unique requirement identifiers for Framework code filter dropdown
 * Query: ?frameworkCode=SOC2 (optional)
 */
export const getRequirementCodes = async (req, res, next) => {
  try {
    const codes = await controlService.getRequirementCodes(
      req.user.organizationId,
      req.query.frameworkCode
    );
    return sendSuccess(res, codes);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/gap-analysis/:frameworkCode
 * Get framework gap analysis
 */
export const getGapAnalysis = async (req, res, next) => {
  try {
    const analysis = await controlService.getFrameworkGapAnalysis(
      req.user.organizationId,
      req.params.frameworkCode
    );
    return sendSuccess(res, analysis);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/readiness/:frameworkCode
 * Get framework readiness score
 */
export const getReadiness = async (req, res, next) => {
  try {
    const readiness = await controlService.getFrameworkReadiness(
      req.user.organizationId,
      req.params.frameworkCode
    );
    return sendSuccess(res, readiness);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/:id
 * Get single control with full details
 */
export const getControl = async (req, res, next) => {
  try {
    const control = await controlService.getControlById(
      req.params.id,
      req.user.organizationId
    );
    return sendSuccess(res, control);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/:id/history
 * Get control activity history
 */
export const getControlHistory = async (req, res, next) => {
  try {
    await assertControlExists(req.params.id, req.user.organizationId);

    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 100) : 50;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      ActivityLog.getEntityHistory(req.user.organizationId, 'InternalControl', req.params.id, {
        limit,
        skip,
      }),
      ActivityLog.countDocuments({
        organizationId: req.user.organizationId,
        entityType: 'InternalControl',
        entityId: req.params.id,
      }),
    ]);

    const pages = Math.ceil(total / limit) || 1;
    return sendPaginated(res, history, {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/controls/:id/comments
 * Get control comments
 */
export const getControlComments = async (req, res, next) => {
  try {
    await assertControlExists(req.params.id, req.user.organizationId);

    const result = await commentService.getComments(
      req.user.organizationId,
      'Control',
      req.params.id,
      { page: req.query.page || 1, limit: req.query.limit || 50 }
    );

    return sendPaginated(res, result.comments, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/controls/:id/comments
 * Create a control comment
 */
export const createControlComment = async (req, res, next) => {
  try {
    await assertControlExists(req.params.id, req.user.organizationId);
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const comment = await commentService.createComment(
      req.user.organizationId,
      'Control',
      req.params.id,
      req.user._id,
      content
    );

    return sendSuccess(res, comment, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/controls/:id/requirements
 * Map control to framework requirement
 */
export const mapRequirement = async (req, res, next) => {
  try {
    const control = await controlService.mapRequirementToControl(
      req.params.id,
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, control);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/controls/:id
 * Update control
 */
export const updateControl = async (req, res, next) => {
  try {
    const control = await controlService.updateControl(
      req.params.id,
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, control);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/controls/:id/assess
 * Record manual assessment
 */
export const assessControl = async (req, res, next) => {
  try {
    const control = await controlService.assessControl(
      req.params.id,
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, control);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/controls/bulk-update
 * Bulk update multiple controls
 */
export const bulkUpdate = async (req, res, next) => {
  try {
    const result = await controlService.bulkUpdateControls(
      req.user.organizationId,
      req.user._id,
      req.body.controlIds,
      req.body.updates
    );
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createControl = async (req, res, next) => {
  try {
    const control = await controlService.createControl(
      req.user.organizationId,
      req.user._id,
      req.body
    );
    return sendSuccess(res, control, null, 201);
  } catch (error) {
    next(error);
  }
};

export const createFromTemplate = async (req, res, next) => {
  try {
    const control = await controlService.createFromTemplate(
      req.user.organizationId,
      req.user._id,
      req.params.templateId
    );
    return sendSuccess(res, control, null, 201);
  } catch (error) {
    next(error);
  }
};

export default {
  listControls,
  getStats,
  getCategories,
  getRequirementCodes,
  getGapAnalysis,
  getReadiness,
  getControl,
  getControlHistory,
  getControlComments,
  createControlComment,
  mapRequirement,
  updateControl,
  assessControl,
  bulkUpdate,
  createControl,
  createFromTemplate,
};
