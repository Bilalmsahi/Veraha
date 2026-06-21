/**
 * Vendor Routes
 * API routes for Vendor management
 */
import { Router } from 'express';
import vendorController from '../controllers/vendorController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createVendorSchema,
  updateVendorSchema,
  listVendorsQuerySchema,
  recordAssessmentSchema,
  linkControlsSchema,
  updateStatusSchema,
  addCertificationSchema,
  vendorIdParamSchema,
  certificationIndexParamSchema,
} from '../validators/vendorValidator.js';

const router = Router();

// All routes require authentication
router.use(protect);

// =============================================================================
// ANALYTICS (must be before /:id to avoid conflicts)
// =============================================================================

/**
 * GET /api/v1/vendors/stats
 * Get vendor statistics
 */
router.get('/stats', vendorController.getVendorStats);

/**
 * GET /api/v1/vendors/assessments-due
 * Get vendors due for assessment
 */
router.get('/assessments-due', vendorController.getAssessmentsDue);

/**
 * GET /api/v1/vendors/expiring-contracts
 * Get vendors with expiring contracts
 */
router.get('/expiring-contracts', vendorController.getExpiringContracts);

/**
 * GET /api/v1/vendors/high-risk
 * Get high-risk vendors (CRITICAL and HIGH)
 */
router.get('/high-risk', vendorController.getHighRiskVendors);

// =============================================================================
// VENDOR CRUD
// =============================================================================

/**
 * GET /api/v1/vendors
 * List vendors with filters
 */
router.get(
  '/',
  validateQuery(listVendorsQuerySchema),
  vendorController.getVendors
);

/**
 * POST /api/v1/vendors
 * Create new vendor (Manager+ only)
 */
router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createVendorSchema),
  vendorController.createVendor
);

/**
 * GET /api/v1/vendors/:id
 * Get vendor with full details
 */
router.get(
  '/:id',
  validateParams(vendorIdParamSchema),
  vendorController.getVendorById
);

/**
 * PATCH /api/v1/vendors/:id
 * Update vendor (Manager+ only)
 */
router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  validateBody(updateVendorSchema),
  vendorController.updateVendor
);

/**
 * DELETE /api/v1/vendors/:id
 * Soft delete vendor (Admin only)
 */
router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(vendorIdParamSchema),
  vendorController.deleteVendor
);

// =============================================================================
// VENDOR LIFECYCLE
// =============================================================================

/**
 * POST /api/v1/vendors/:id/status
 * Update vendor status (Manager+ only)
 */
router.post(
  '/:id/status',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  validateBody(updateStatusSchema),
  vendorController.updateStatus
);

/**
 * POST /api/v1/vendors/:id/assess
 * Record vendor assessment (Manager+ only)
 */
router.post(
  '/:id/assess',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  validateBody(recordAssessmentSchema),
  vendorController.recordAssessment
);

// =============================================================================
// LINKED CONTROLS
// =============================================================================

/**
 * POST /api/v1/vendors/:id/controls
 * Link controls to vendor (Manager+ only)
 */
router.post(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  validateBody(linkControlsSchema),
  vendorController.linkControls
);

/**
 * DELETE /api/v1/vendors/:id/controls
 * Unlink controls from vendor (Manager+ only)
 */
router.delete(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  validateBody(linkControlsSchema),
  vendorController.unlinkControls
);

// =============================================================================
// CERTIFICATIONS
// =============================================================================

/**
 * POST /api/v1/vendors/:id/certifications
 * Add certification to vendor (Manager+ only)
 */
router.post(
  '/:id/certifications',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(vendorIdParamSchema),
  upload.single('file'),
  handleUploadError,
  validateBody(addCertificationSchema),
  vendorController.addCertification
);

/**
 * DELETE /api/v1/vendors/:id/certifications/:certIndex
 * Remove certification from vendor (Manager+ only)
 */
router.delete(
  '/:id/certifications/:certIndex',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(certificationIndexParamSchema),
  vendorController.removeCertification
);

export default router;
