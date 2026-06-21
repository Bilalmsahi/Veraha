/**
 * HR Integration Controller
 * HTTP handlers for HR profile endpoints
 */
import * as hrService from '../services/hrIntegration.service.js';
import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import HrProfile from '../models/HrProfile.js';

// =============================================================================
// HR PROFILES
// =============================================================================

/**
 * GET /api/v1/integrations/hr/profiles
 * List HR profiles for the organization
 */
export const listProfiles = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const { search, status, page = 1, limit = 20 } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (status) filter.employmentStatus = status;

    if (search) {
      const searchRegex = { $regex: String(search).trim(), $options: 'i' };
      filter.$or = [{ fullName: searchRegex }, { workEmail: searchRegex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [profiles, total] = await Promise.all([
      HrProfile.find(filter).sort({ fullName: 1 }).skip(skip).limit(limitNum),
      HrProfile.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    sendPaginated(res, profiles, {
      page: pageNum,
      limit: limitNum,
      total,
      pages,
      hasNextPage: pageNum < pages,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/hr/profiles
 * Create or upsert an HR profile
 */
export const createProfile = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const result = await hrService.upsertProfile(organizationId, userId, req.body);
    sendSuccess(res, result, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/integrations/hr/profiles/:id
 * Update an HR profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { organizationId } = req.user;

    const profile = await HrProfile.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!profile) {
      const error = new Error('HR profile not found');
      error.statusCode = 404;
      throw error;
    }

    Object.assign(profile, req.body);
    await profile.save();

    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/hr/import
 * Import HR profiles from parsed CSV rows
 */
export const importCSV = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const result = await hrService.importFromCSV(
      organizationId,
      userId,
      req.body.rows,
      req.body.hrSource
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/integrations/hr/profiles/:id/depart
 * Mark an employee as departed
 */
export const departEmployee = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const profile = await hrService.departEmployee(
      organizationId,
      req.params.id,
      req.body.endDate,
      userId
    );
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/integrations/hr/profiles/:id/policy-status
 * Get policy attestation status for a profile
 */
export const getPolicyStatus = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const status = await hrService.getPolicyStatus(organizationId, req.params.id);
    sendSuccess(res, status);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/hr/profiles/:id/controls
 * Link controls to an HR profile
 */
export const linkProfileControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const profile = await hrService.linkToControl(
      organizationId,
      req.params.id,
      req.body.controlIds
    );
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/integrations/hr/profiles/:id/controls/:controlId
 * Unlink a control from an HR profile
 */
export const unlinkProfileControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const profile = await hrService.unlinkFromControl(
      organizationId,
      req.params.id,
      req.params.controlId
    );
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * GET /api/v1/integrations/hr/stats
 * Get HR integration statistics
 */
export const getHrStats = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const stats = await hrService.getStats(organizationId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export default {
  listProfiles,
  createProfile,
  updateProfile,
  importCSV,
  departEmployee,
  getPolicyStatus,
  linkProfileControl,
  unlinkProfileControl,
  getHrStats,
};
