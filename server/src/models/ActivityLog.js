import mongoose from 'mongoose';
import { ACTION } from './enums.js';

const { Schema } = mongoose;

/**
 * ActivityLog Model (Tenant Domain)
 * 
 * Full audit trail for all significant actions in the system. Compliance
 * events must be retained indefinitely, so this collection must never have a
 * TTL index or expiring collection option added.
 *
 * Immutable log - no updates or deletes allowed.
 */
const activityLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    // Who performed the action (null for system actions)
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Denormalized actor info (in case user is deleted)
    actorSnapshot: {
      email: { type: String },
      name: { type: String },
      role: { type: String },
    },
    // What action was performed
    action: {
      type: String,
      enum: ACTION,
      required: [true, 'Action is required'],
    },
    // What type of entity was affected
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
    },
    // Which specific entity was affected
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
    },
    // Denormalized entity info for quick display
    entitySnapshot: {
      title: { type: String },
      identifier: { type: String },
    },
    // What changed (before/after state)
    changes: {
      before: {
        type: Schema.Types.Mixed,
      },
      after: {
        type: Schema.Types.Mixed,
      },
      fields: [{ type: String }], // List of fields that changed
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Request context
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
      requestId: { type: String },
      sessionId: { type: String },
      recipientEmail: { type: String },
    },
    // Optional notes
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: false,
    collection: 'activitylogs_permanent',
  }
);

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Log an activity (helper method for consistent logging)
 * @param {Object} params - Activity parameters
 * @returns {Promise<Document>} Created activity log
 */
activityLogSchema.statics.logActivity = async function ({
  organizationId,
  actorId,
  actorSnapshot,
  action,
  entityType,
  entityId,
  entitySnapshot,
  changes,
  metadata,
  notes,
}) {
  return this.create({
    organizationId,
    actorId,
    actorSnapshot,
    action,
    entityType,
    entityId,
    entitySnapshot,
    changes,
    timestamp: new Date(),
    metadata,
    notes,
  });
};

/**
 * Get activity logs for an entity
 * @param {ObjectId} organizationId
 * @param {String} entityType
 * @param {ObjectId} entityId
 * @param {Object} options - { limit, skip }
 * @returns {Promise<Array>} Activity logs
 */
activityLogSchema.statics.getEntityHistory = async function (
  organizationId,
  entityType,
  entityId,
  options = {}
) {
  const { limit = 50, skip = 0 } = options;

  return this.find({
    organizationId,
    entityType,
    entityId,
  })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get recent activity for an organization
 * @param {ObjectId} organizationId
 * @param {Object} options - { limit, skip, startDate, endDate }
 * @returns {Promise<Array>} Activity logs
 */
activityLogSchema.statics.getRecentActivity = async function (
  organizationId,
  options = {}
) {
  const { limit = 100, skip = 0, startDate, endDate } = options;

  const query = { organizationId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get activity counts by action type for analytics
 * @param {ObjectId} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>} Action counts
 */
activityLogSchema.statics.getActionCounts = async function (
  organizationId,
  startDate,
  endDate
) {
  const match = { organizationId };

  if (startDate || endDate) {
    match.timestamp = {};
    if (startDate) match.timestamp.$gte = startDate;
    if (endDate) match.timestamp.$lte = endDate;
  }

  const results = await this.aggregate([
    { $match: match },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]);

  const counts = {};
  results.forEach(({ _id, count }) => {
    counts[_id] = count;
  });

  return counts;
};

/**
 * Get user activity summary
 * @param {ObjectId} organizationId
 * @param {ObjectId} actorId
 * @param {Object} options - { limit, startDate, endDate }
 * @returns {Promise<Array>} Activity logs
 */
activityLogSchema.statics.getUserActivity = async function (
  organizationId,
  actorId,
  options = {}
) {
  const { limit = 50, startDate, endDate } = options;

  const query = { organizationId, actorId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.getAccessAudit = async function (
  organizationId,
  entityId,
  options = {}
) {
  const { startDate, endDate, limit = 100 } = options;

  const query = {
    organizationId,
    entityId,
    action: { $in: ['READ', 'VIEW', 'ACCESS'] } // If you add these actions
  };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// =============================================================================
// INDEXES
// =============================================================================

// Compound index for organization + timestamp queries
activityLogSchema.index({ organizationId: 1, timestamp: -1 });

// Single index for global recent activity and timestamp range queries
activityLogSchema.index({ timestamp: -1 });

// Compound index for entity history queries
activityLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

// Compound index for user activity queries
activityLogSchema.index({ actorId: 1, timestamp: -1 });

// Compound index for action type filtering
activityLogSchema.index({ action: 1, timestamp: -1 });



// =============================================================================
// IMMUTABILITY ENFORCEMENT
// =============================================================================

/**
 * Prevent updates; compliance audit events are append-only.
 */
activityLogSchema.pre('updateOne', function () {
  throw new Error('ActivityLog entries cannot be modified - compliance audit log is append-only');
});

activityLogSchema.pre('updateMany', function () {
  throw new Error('ActivityLog entries cannot be modified - compliance audit log is append-only');
});

activityLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('ActivityLog entries cannot be modified - compliance audit log is append-only');
});

/**
 * Prevent deletes; compliance audit events must be retained indefinitely.
 */
activityLogSchema.pre('deleteOne', function () {
  throw new Error('ActivityLog entries cannot be deleted - compliance audit log is retained indefinitely');
});

activityLogSchema.pre('deleteMany', function () {
  throw new Error('ActivityLog entries cannot be deleted - compliance audit log is retained indefinitely');
});

activityLogSchema.pre('findOneAndDelete', function () {
  throw new Error('ActivityLog entries cannot be deleted - compliance audit log is retained indefinitely');
});

// =============================================================================
// NOTE: tenantPlugin not applied
// =============================================================================
/**
 * tenantPlugin is NOT applied to ActivityLog because:
 * 1. ActivityLog is append-only and must not use soft-delete behavior
 * 2. Immutability is enforced at the schema level
 * 
 * Use the static methods above for querying activity logs.
 */


const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
