/**
 * Vendor Service
 * Business logic for Vendor management
 * 
 * Uses shared enums from models/enums.js for status consistency
 */
import mongoose from 'mongoose';
import Vendor from '../models/Vendor.js';
import { storageService } from './storageService.js';
import { logCrudOperation } from './activityLogger.js';
import { VENDOR_STATUS, RISK_TIER, REVIEW_FREQUENCY } from '../models/enums.js';
import { andAccess, buildLinkedControlEntityAccessMatch } from './frameworkAccessService.js';

// Helper: Calculate next assessment date based on frequency (matches policy FREQUENCY_MONTHS)
const FREQUENCY_MONTHS = {
  WEEKLY: 0.25,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
  BIENNIALLY: 24,
  NEVER: null,
};

/**
 * Refresh certification document URLs for a vendor by regenerating
 * URLs from their stored documentKey (S3 signed URL or local static URL).
 */
const attachVendorCertificationUrls = async (vendor) => {
  if (!vendor || !vendor.certifications) return vendor;

  for (const cert of vendor.certifications) {
    if (cert.documentKey) {
      // eslint-disable-next-line no-param-reassign
      cert.documentUrl = await storageService.getFileUrl(cert.documentKey);
    }
  }

  return vendor;
};

// =============================================================================
// VENDOR CRUD
// =============================================================================

/**
 * Create a new vendor
 */
export const createVendor = async (data, user) => {
  const { organizationId, userId } = user;

  // Calculate next assessment date if not provided (NEVER = no next date)
  if (!data.nextAssessmentDate && data.assessmentFrequency) {
    const months = FREQUENCY_MONTHS[data.assessmentFrequency];
    if (months != null) {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + months);
      data.nextAssessmentDate = nextDate;
    }
  }

  const vendor = await Vendor.create({
    organizationId,
    ...data,
    ownerId: data.ownerId || userId,
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: { name: vendor.name, riskTier: vendor.riskTier },
  });

  await vendor.populate('ownerId', 'firstName lastName email');
  await vendor.populate('linkedControlIds', 'identifier title');

  return vendor;
};

/**
 * Get paginated vendor list
 */
export const getVendors = async (orgId, filters) => {
  const {
    page = 1,
    limit = 20,
    status,
    riskTier,
    category,
    ownerId,
    assessmentDue,
    contractExpiring,
    hasNda,
    hasDpa,
    dataType,
    search,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filters;

  const query = { organizationId: orgId, isDeleted: false };

  if (status) {
    const statuses = status.split(',').map((s) => s.trim().toUpperCase());
    const valid = statuses.filter((s) => VENDOR_STATUS.includes(s));
    if (valid.length > 0) query.status = { $in: valid };
  }

  if (riskTier) {
    const tiers = riskTier.split(',').map((t) => t.trim().toUpperCase());
    const valid = tiers.filter((t) => RISK_TIER.includes(t));
    if (valid.length > 0) query.riskTier = { $in: valid };
  }

  if (category) query.category = { $regex: category, $options: 'i' };
  if (ownerId) query.ownerId = ownerId;

  if (assessmentDue === 'true') {
    query.nextAssessmentDate = { $lt: new Date() };
  }

  if (contractExpiring !== undefined) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + contractExpiring);
    query.contractEndDate = { $lte: expiryDate, $gte: new Date() };
  }

  if (hasNda === 'true') query.hasNda = true;
  if (hasNda === 'false') query.hasNda = false;
  if (hasDpa === 'true') query.hasDpa = true;
  if (hasDpa === 'false') query.hasDpa = false;

  if (dataType) {
    const types = dataType.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) query.dataTypes = { $in: types };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { serviceType: { $regex: search, $options: 'i' } },
    ];
  }

  const accessQuery = andAccess(query, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds'));

  const total = await Vendor.countDocuments(accessQuery);
  const vendors = await Vendor.find(accessQuery)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('ownerId', 'firstName lastName email')
    .lean();

  return {
    vendors,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get single vendor with full details
 */
export const getVendorById = async (vendorId, orgId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds');
  const vendor = await Vendor.findOne({
    $and: [
      { _id: vendorId, organizationId: orgId, isDeleted: false },
      accessMatch,
    ],
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('lastAssessedBy', 'firstName lastName email')
    .populate('linkedControlIds', 'identifier title overallStatus');

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  await attachVendorCertificationUrls(vendor);
  return vendor;
};

/**
 * Update vendor
 */
export const updateVendor = async (vendorId, data, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  const before = vendor.toObject();
  Object.assign(vendor, data);
  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: { name: vendor.name },
    before,
    after: vendor.toObject(),
  });

  await vendor.populate('ownerId', 'firstName lastName email');
  await vendor.populate('linkedControlIds', 'identifier title');

  return vendor;
};

/**
 * Delete vendor (soft delete)
 */
export const deleteVendor = async (vendorId, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  vendor.isDeleted = true;
  vendor.deletedAt = new Date();
  vendor.deletedBy = userId;
  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'DELETE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: { name: vendor.name },
  });

  return { deleted: true, id: vendorId };
};

// =============================================================================
// VENDOR LIFECYCLE
// =============================================================================

/**
 * Update vendor status
 */
export const updateStatus = async (vendorId, data, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  const beforeStatus = vendor.status;
  vendor.status = data.status;
  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: { name: vendor.name, reason: data.reason },
    before: { status: beforeStatus },
    after: { status: data.status },
  });

  return vendor;
};

/**
 * Record vendor assessment
 */
export const recordAssessment = async (vendorId, data, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  const before = vendor.toObject();

  // Update risk tier if provided
  if (data.riskTier) {
    vendor.riskTier = data.riskTier;
  }

  // Record assessment date
  vendor.lastAssessmentDate = new Date();
  vendor.lastAssessedBy = userId;

  // Calculate next assessment date
  if (data.nextAssessmentDate) {
    vendor.nextAssessmentDate = data.nextAssessmentDate;
  } else {
    const months = FREQUENCY_MONTHS[vendor.assessmentFrequency];
    if (months != null) {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + months);
      vendor.nextAssessmentDate = nextDate;
    } else {
      vendor.nextAssessmentDate = null;
    }
  }

  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: {
      name: vendor.name,
      action: 'assessment',
      notes: data.notes,
      newRiskTier: vendor.riskTier,
    },
    before,
    after: vendor.toObject(),
  });

  await vendor.populate('ownerId', 'firstName lastName email');
  await vendor.populate('lastAssessedBy', 'firstName lastName email');

  return vendor;
};

// =============================================================================
// LINKED CONTROLS
// =============================================================================

/**
 * Link controls to vendor
 */
export const linkControls = async (vendorId, controlIds, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  // Add new controls (avoid duplicates)
  const existingIds = vendor.linkedControlIds.map((id) => id.toString());
  const newIds = controlIds.filter((id) => !existingIds.includes(id));

  if (newIds.length === 0) {
    const error = new Error('All controls are already linked');
    error.statusCode = 400;
    throw error;
  }

  vendor.linkedControlIds.push(...newIds);

  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: {
      name: vendor.name,
      action: 'link_controls',
      controlsAdded: newIds.length,
    },
  });

  await vendor.populate('linkedControlIds', 'identifier title overallStatus');

  return vendor;
};

/**
 * Unlink controls from vendor
 */
export const unlinkControls = async (vendorId, controlIds, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  const removeSet = new Set(controlIds);
  const originalCount = vendor.linkedControlIds.length;
  vendor.linkedControlIds = vendor.linkedControlIds.filter(
    (id) => !removeSet.has(id.toString())
  );

  const removedCount = originalCount - vendor.linkedControlIds.length;
  if (removedCount === 0) {
    const error = new Error('None of the specified controls were linked');
    error.statusCode = 400;
    throw error;
  }

  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: {
      name: vendor.name,
      action: 'unlink_controls',
      controlsRemoved: removedCount,
    },
  });

  await vendor.populate('linkedControlIds', 'identifier title overallStatus');

  return vendor;
};

// =============================================================================
// CERTIFICATIONS
// =============================================================================

/**
 * Add certification to vendor
 */
export const addCertification = async (vendorId, certData, file, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  if (!file) {
    const error = new Error('Certification document file is required');
    error.statusCode = 400;
    throw error;
  }

  const uploadResult = await storageService.uploadFile(
    file.buffer,
    organizationId.toString(),
    file.originalname,
    file.mimetype
  );

  vendor.certifications.push({
    name: certData.name,
    validUntil: certData.validUntil,
    documentKey: uploadResult.key,
    documentUrl: uploadResult.url,
    documentMimeType: file.mimetype,
    documentSizeBytes: uploadResult.size,
    uploadedAt: new Date(),
  });

  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: {
      name: vendor.name,
      action: 'add_certification',
      certificationName: certData.name,
    },
  });

  return vendor;
};

/**
 * Remove certification from vendor
 */
export const removeCertification = async (vendorId, certIndex, user) => {
  const { organizationId, userId } = user;

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId,
    isDeleted: false,
  });

  if (!vendor) {
    const error = new Error('Vendor not found');
    error.statusCode = 404;
    throw error;
  }

  if (certIndex < 0 || certIndex >= vendor.certifications.length) {
    const error = new Error('Certification index out of range');
    error.statusCode = 400;
    throw error;
  }

  const removed = vendor.certifications.splice(certIndex, 1)[0];
  await vendor.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Vendor',
    entityId: vendor._id,
    entitySnapshot: {
      name: vendor.name,
      action: 'remove_certification',
      certificationName: removed.name,
    },
  });

  return vendor;
};

// =============================================================================
// ANALYTICS & DASHBOARD
// =============================================================================

/**
 * Get vendor statistics
 */
export const getVendorStats = async (orgId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds');
  const baseMatch = {
    organizationId: new mongoose.Types.ObjectId(orgId),
    isDeleted: { $ne: true },
  };
  const [statusCounts, riskTierCounts, assessmentDueCount, contractExpiringCount] =
    await Promise.all([
      // By status (Vanta: ACTIVE | ARCHIVED)
      Vendor.aggregate([
        { $match: andAccess(baseMatch, accessMatch) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // By risk tier (active vendors only)
      Vendor.aggregate([
        {
          $match: andAccess({
            ...baseMatch,
            status: 'ACTIVE',
          }, accessMatch),
        },
        { $group: { _id: '$riskTier', count: { $sum: 1 } } },
      ]),
      // Overdue assessments (active only)
      Vendor.countDocuments(andAccess({
        organizationId: orgId,
        isDeleted: { $ne: true },
        status: 'ACTIVE',
        nextAssessmentDate: { $lt: new Date() },
      }, accessMatch)),
      // Contracts expiring in 30 days (active only)
      (() => {
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        return Vendor.countDocuments(andAccess({
          organizationId: orgId,
          isDeleted: { $ne: true },
          status: 'ACTIVE',
          contractEndDate: { $lte: thirtyDays, $gte: new Date() },
        }, accessMatch));
      })(),
    ]);

  const stats = {
    byStatus: {
      ACTIVE: 0,
      ARCHIVED: 0,
    },
    byRiskTier: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNSCORED: 0,
    },
    assessmentsDue: assessmentDueCount,
    contractsExpiring30Days: contractExpiringCount,
    total: 0,
  };

  statusCounts.forEach(({ _id, count }) => {
    if (_id && stats.byStatus.hasOwnProperty(_id)) {
      stats.byStatus[_id] = count;
    }
    stats.total += count;
  });

  riskTierCounts.forEach(({ _id, count }) => {
    if (_id && stats.byRiskTier.hasOwnProperty(_id)) {
      stats.byRiskTier[_id] = count;
    }
  });

  return stats;
};

/**
 * Get vendors due for assessment
 */
export const getAssessmentsDue = async (orgId, days = 30) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);

  return Vendor.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    nextAssessmentDate: { $lte: dueDate },
  })
    .sort({ nextAssessmentDate: 1 })
    .select('name riskTier nextAssessmentDate lastAssessmentDate')
    .populate('ownerId', 'firstName lastName email')
    .lean();
};

/**
 * Get vendors with expiring contracts
 */
export const getExpiringContracts = async (orgId, days = 90) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  return Vendor.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    contractEndDate: { $lte: expiryDate, $gte: new Date() },
  })
    .sort({ contractEndDate: 1 })
    .select('name contractEndDate contractStartDate')
    .lean();
};

/**
 * Get high-risk vendors (CRITICAL or HIGH)
 */
export const getHighRiskVendors = async (orgId) => {
  return Vendor.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    riskTier: { $in: ['CRITICAL', 'HIGH'] },
  })
    .sort({ riskTier: 1 })
    .populate('ownerId', 'firstName lastName email')
    .lean();
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
