/**
 * Vendor Controller
 * HTTP handlers for Vendor API endpoints
 */
import vendorService from '../services/vendorService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

// =============================================================================
// VENDOR CRUD
// =============================================================================

/**
 * POST /api/v1/vendors
 * Create new vendor
 */
export const createVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.createVendor(req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, vendor, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vendors
 * List vendors with filters
 */
export const getVendors = async (req, res, next) => {
  try {
    const result = await vendorService.getVendors(
      req.user.organizationId,
      req.query
    );
    sendSuccess(res, result.vendors, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vendors/:id
 * Get vendor with full details
 */
export const getVendorById = async (req, res, next) => {
  try {
    const vendor = await vendorService.getVendorById(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/vendors/:id
 * Update vendor
 */
export const updateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.updateVendor(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/vendors/:id
 * Soft delete vendor
 */
export const deleteVendor = async (req, res, next) => {
  try {
    const result = await vendorService.deleteVendor(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// VENDOR LIFECYCLE
// =============================================================================

/**
 * POST /api/v1/vendors/:id/status
 * Update vendor status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const vendor = await vendorService.updateStatus(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/vendors/:id/assess
 * Record vendor assessment
 */
export const recordAssessment = async (req, res, next) => {
  try {
    const vendor = await vendorService.recordAssessment(
      req.params.id,
      req.body,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// LINKED CONTROLS
// =============================================================================

/**
 * POST /api/v1/vendors/:id/controls
 * Link controls to vendor
 */
export const linkControls = async (req, res, next) => {
  try {
    const vendor = await vendorService.linkControls(
      req.params.id,
      req.body.controlIds,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/vendors/:id/controls
 * Unlink controls from vendor
 */
export const unlinkControls = async (req, res, next) => {
  try {
    const vendor = await vendorService.unlinkControls(
      req.params.id,
      req.body.controlIds,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// CERTIFICATIONS
// =============================================================================

/**
 * POST /api/v1/vendors/:id/certifications
 * Add certification to vendor
 */
export const addCertification = async (req, res, next) => {
  try {
    const vendor = await vendorService.addCertification(
      req.params.id,
      req.body,
      req.file || null,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, vendor, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/vendors/:id/certifications/:certIndex
 * Remove certification from vendor
 */
export const removeCertification = async (req, res, next) => {
  try {
    const vendor = await vendorService.removeCertification(
      req.params.id,
      parseInt(req.params.certIndex),
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, vendor);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// ANALYTICS & DASHBOARD
// =============================================================================

/**
 * GET /api/v1/vendors/stats
 * Get vendor statistics
 */
export const getVendorStats = async (req, res, next) => {
  try {
    const stats = await vendorService.getVendorStats(req.user.organizationId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vendors/assessments-due
 * Get vendors due for assessment
 */
export const getAssessmentsDue = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const vendors = await vendorService.getAssessmentsDue(
      req.user.organizationId,
      days
    );
    sendSuccess(res, vendors);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vendors/expiring-contracts
 * Get vendors with expiring contracts
 */
export const getExpiringContracts = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const vendors = await vendorService.getExpiringContracts(
      req.user.organizationId,
      days
    );
    sendSuccess(res, vendors);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vendors/high-risk
 * Get high-risk vendors (CRITICAL and HIGH)
 */
export const getHighRiskVendors = async (req, res, next) => {
  try {
    const vendors = await vendorService.getHighRiskVendors(
      req.user.organizationId
    );
    sendSuccess(res, vendors);
  } catch (error) {
    next(error);
  }
};

export default {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  updateStatus,
  recordAssessment,
  linkControls,
  unlinkControls,
  addCertification,
  removeCertification,
  getVendorStats,
  getAssessmentsDue,
  getExpiringContracts,
  getHighRiskVendors,
};
