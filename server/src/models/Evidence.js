import mongoose from 'mongoose';
import { EVIDENCE_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

/**
 * Evidence Model (Tenant Domain)
 * 
 * Stores proof of compliance controls - files, screenshots, documents.
 * Linked to one or more InternalControls.
 * Includes expiration tracking for time-based compliance.
 */
const evidenceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Evidence title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // File storage info
    s3Key: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
    },
    fileHash: {
      type: String,
      trim: true,
    },
    // Validity period
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      index: true,
    },
    // Status tracking
    status: {
      type: String,
      enum: EVIDENCE_STATUS,
      default: 'PENDING',
    },
    // Archive (separate from soft delete) for readiness overlays
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Linked controls (Many-to-Many - one evidence can satisfy multiple controls)
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    // Upload tracking
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Approval workflow
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    // Categorization
    category: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // External reference (if evidence comes from automation)
    source: {
      type: String,
      trim: true,
    },
    externalId: {
      type: String,
      trim: true,
    },
    // Soft Delete Fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'evidence',
  }
);

// Virtual for expiration status check
evidenceSchema.virtual('isExpired').get(function () {
  if (!this.validUntil) return false;
  return new Date() > this.validUntil;
});

evidenceSchema.virtual('isExpiringSoon').get(function () {
  if (!this.validUntil) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return new Date() <= this.validUntil && this.validUntil <= thirtyDaysFromNow;
});

// Evidence validation
/**
 * Validate evidence data before saving
 * Mongoose 9.x: Use async function without next callback
 */
evidenceSchema.pre('save', async function () {
  // 1. Validate date ranges
  if (this.validUntil && this.validFrom && this.validUntil <= this.validFrom) {
    throw new Error('validUntil must be after validFrom');
  }

  // 2. Validate that linkedControlIds belong to same organization
  if (this.isModified('linkedControlIds') && this.linkedControlIds.length > 0) {
    const InternalControl = mongoose.model('InternalControl');

    const controls = await InternalControl.find({
      _id: { $in: this.linkedControlIds },
      organizationId: this.organizationId,
      isDeleted: { $ne: true },
    }).select('_id');

    if (controls.length !== this.linkedControlIds.length) {
      throw new Error('One or more linked controls do not exist or belong to a different organization');
    }
  }

  // 3. Validate file metadata consistency
  if (this.fileUrl && !this.fileName) {
    throw new Error('fileName is required when fileUrl is provided');
  }

  if (this.fileName && !this.fileUrl) {
    throw new Error('fileUrl is required when fileName is provided');
  }

  // 4. Auto-expire evidence if validUntil is in the past
  if (this.validUntil && new Date() > this.validUntil && this.status !== 'EXPIRED') {
    const oldStatus = this.status;
    this.status = 'EXPIRED';

    // Log the auto-expiration (only for existing docs)
    if (!this.isNew) {
      setImmediate(async () => {
        try {
          const { logCrudOperation } = await import('../services/activityLogger.js');
          await logCrudOperation({
            organizationId: this.organizationId,
            actorId: null, // System action
            actorSnapshot: { email: 'system@auto', name: 'System', role: 'SYSTEM' },
            action: 'STATUS_CHANGE',
            entityType: 'Evidence',
            entityId: this._id,
            entitySnapshot: { title: this.title },
            before: { status: oldStatus },
            after: { status: 'EXPIRED' },
            changedFields: ['status'],
          });
        } catch (error) {
          console.error('[Evidence] Failed to log auto-expiration:', error.message);
        }
      });
    }
  }
});

/**
 * Validate linked controls on update
 * Mongoose 9.x: Use async function without next callback
 */
evidenceSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const linkedControlIds = update.linkedControlIds || update.$set?.linkedControlIds || update.$push?.linkedControlIds;

  if (linkedControlIds) {
    const filter = this.getFilter();
    const evidence = await this.model.findOne(filter);

    if (!evidence) {
      throw new Error('Evidence not found');
    }

    const InternalControl = mongoose.model('InternalControl');
    const controlIds = Array.isArray(linkedControlIds) ? linkedControlIds : [linkedControlIds];

    const controls = await InternalControl.find({
      _id: { $in: controlIds },
      organizationId: evidence.organizationId,
      isDeleted: { $ne: true },
    }).select('_id');

    if (controls.length !== controlIds.length) {
      throw new Error('One or more linked controls do not exist or belong to a different organization');
    }
  }
});

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Get expiring evidence for an organization
 * @param {ObjectId} organizationId
 * @param {Number} daysThreshold - Days until expiration (default 30)
 * @returns {Promise<Array>} Expiring evidence
 */
evidenceSchema.statics.getExpiring = async function (organizationId, daysThreshold = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  return this.find({
    organizationId,
    isDeleted: { $ne: true },
    status: { $in: ['PENDING', 'APPROVED'] },
    validUntil: {
      $gte: now,
      $lte: futureDate,
    },
  })
    .populate('linkedControlIds', 'identifier title')
    .populate('uploadedBy', 'firstName lastName email')
    .sort({ validUntil: 1 })
    .lean();
};

/**
 * Get expired evidence for an organization
 * @param {ObjectId} organizationId
 * @returns {Promise<Array>} Expired evidence
 */
evidenceSchema.statics.getExpired = async function (organizationId) {
  const now = new Date();

  return this.find({
    organizationId,
    isDeleted: { $ne: true },
    validUntil: { $lt: now },
    status: { $ne: 'EXPIRED' }, // Not yet marked as expired
  })
    .populate('linkedControlIds', 'identifier title')
    .sort({ validUntil: 1 })
    .lean();
};

/**
 * Auto-expire evidence based on validUntil date
 * Should be run as a cron job
 * @param {ObjectId} organizationId
 * @returns {Promise<Object>} Update result
 */
evidenceSchema.statics.autoExpireEvidence = async function (organizationId) {
  const now = new Date();

  return this.updateMany(
    {
      organizationId,
      isDeleted: { $ne: true },
      validUntil: { $lt: now },
      status: { $ne: 'EXPIRED' },
    },
    {
      status: 'EXPIRED',
    }
  );
};

/**
 * Get evidence statistics for dashboard
 * @param {ObjectId} organizationId
 * @returns {Promise<Object>} Evidence statistics
 */
evidenceSchema.statics.getStatistics = async function (organizationId) {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const results = await this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
        expirationBreakdown: [
          {
            $project: {
              isExpired: {
                $cond: [
                  { $and: [{ $ne: ['$validUntil', null] }, { $lt: ['$validUntil', now] }] },
                  'expired',
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$validUntil', null] },
                          { $gte: ['$validUntil', now] },
                          { $lte: ['$validUntil', thirtyDaysFromNow] },
                        ],
                      },
                      'expiring_soon',
                      'valid',
                    ],
                  },
                ],
              },
            },
          },
          { $group: { _id: '$isExpired', count: { $sum: 1 } } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const stats = {
    total: results[0].total[0]?.count || 0,
    byStatus: {},
    expirationBreakdown: {
      expired: 0,
      expiring_soon: 0,
      valid: 0,
    },
  };

  results[0].byStatus.forEach(({ _id, count }) => {
    stats.byStatus[_id] = count;
  });

  results[0].expirationBreakdown.forEach(({ _id, count }) => {
    stats.expirationBreakdown[_id] = count;
  });

  return stats;
};

// Indexes
evidenceSchema.index({ organizationId: 1, isDeleted: 1 });
evidenceSchema.index({ organizationId: 1, status: 1 });
evidenceSchema.index({ organizationId: 1, archivedAt: 1 });
evidenceSchema.index({ validUntil: 1, status: 1 });
evidenceSchema.index({ linkedControlIds: 1 });
evidenceSchema.index({ uploadedBy: 1 });
evidenceSchema.index({ organizationId: 1, category: 1 });
evidenceSchema.index({ tags: 1 });

// Enable virtuals in JSON
evidenceSchema.set('toJSON', { virtuals: true });
evidenceSchema.set('toObject', { virtuals: true });

// Apply tenant plugin for soft delete support
evidenceSchema.plugin(tenantPlugin);
evidenceSchema.plugin(applyOrgScope, 'organizationId');

const Evidence = mongoose.model('Evidence', evidenceSchema);

export default Evidence;
