import mongoose from 'mongoose';
import { TREATMENT, RISK_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * Risk Model (Tenant Domain)
 *
 * Tracks organizational risks with explicit 3×3 likelihood/impact scoring (Vanta-style).
 * Inherent and residual scores are derived from top-level likelihood/impact and
 * residualLikelihood/residualImpact; riskLevel is HIGH/MED/LOW/UNKNOWN.
 */
const riskSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    identifier: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Risk title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    /**
     * Categories (Vanta-style multi-category support)
     * Used primarily for UI filtering and display
     */
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    /**
     * CIA categories (Confidentiality, Integrity, Availability)
     * Used for tagging risks with CIA impact areas
     */
    ciaCategories: [
      {
        type: String,
        enum: ['Confidentiality', 'Integrity', 'Availability'],
      },
    ],
    likelihood: {
      type: Number,
      default: null,
      validate: { validator: (v) => v === null || (v >= 1 && v <= 3), message: '{PATH} must be 1, 2, or 3' },
    },
    impact: {
      type: Number,
      default: null,
      validate: { validator: (v) => v === null || (v >= 1 && v <= 3), message: '{PATH} must be 1, 2, or 3' },
    },
    residualLikelihood: {
      type: Number,
      default: null,
      validate: { validator: (v) => v === null || (v >= 1 && v <= 3), message: '{PATH} must be 1, 2, or 3' },
    },
    residualImpact: {
      type: Number,
      default: null,
      validate: { validator: (v) => v === null || (v >= 1 && v <= 3), message: '{PATH} must be 1, 2, or 3' },
    },
    inherentScore: { type: Number, min: 1, max: 9, index: true },
    residualScore: { type: Number, min: 1, max: 9, index: true },
    riskLevel: {
      type: String,
      enum: ['HIGH', 'MED', 'LOW', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true,
    },
    /**
     * Inherent and residual risk breakdown (Vanta-style 1–3 matrix)
     * These fields are derived from likelihood/impact inputs and are
     * used for the Risk Scenario detail view and history snapshots.
     */
    inherentRisk: {
      likelihood: {
        type: Number,
        min: 1,
        max: 3,
      },
      impact: {
        type: Number,
        min: 1,
        max: 3,
      },
      score: {
        type: Number,
        min: 1,
        max: 9,
      },
      level: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
      },
    },
    residualRisk: {
      likelihood: {
        type: Number,
        min: 1,
        max: 3,
      },
      impact: {
        type: Number,
        min: 1,
        max: 3,
      },
      score: {
        type: Number,
        min: 1,
        max: 9,
      },
      level: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
      },
    },
    /**
     * Free-form notes for the current assessment
     * Shown in the Inherent risk \"Notes\" textarea.
     */
    assessmentNotes: {
      type: String,
      trim: true,
    },
    lastAssessmentId: { type: Schema.Types.ObjectId, ref: 'RiskAssessment' },
    _migration: { type: Schema.Types.Mixed, default: null },
    // Treatment approach. Null when unassessed (e.g. imported from library).
    treatment: {
      type: String,
      enum: [...TREATMENT, null],
      default: null,
    },
    treatmentPlan: {
      type: String,
      trim: true,
    },
    // Status
    status: {
      type: String,
      enum: RISK_STATUS,
      default: 'OPEN',
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
    /**
     * Assigned approvers for the current approval workflow.
     * Completed approvals are stored in approvals[].
     */
    assignedApproverIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    submittedForApprovalAt: {
      type: Date,
      default: null,
    },
    submittedForApprovalBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /**
     * Approvals and assessment history (Vanta-style)
     */
    approvals: [
      {
        approverId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        approvedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Mitigating controls (Many-to-Many)
    mitigatingControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    // Ownership
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    // Tracking dates
    identifiedAt: {
      type: Date,
      default: Date.now,
    },
    identifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastReviewedAt: {
      type: Date,
    },
    lastReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    nextReviewDue: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    closureReason: {
      type: String,
      trim: true,
    },
    /** When set, this risk was imported from the Risk Library (RiskTemplate) */
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'RiskTemplate',
      default: null,
      index: true,
    },
    /** NOT_REVIEWED = draft/unassessed; REVIEWED = assessment completed */
    reviewStatus: {
      type: String,
      enum: ['NOT_REVIEWED', 'REVIEWED'],
      default: 'NOT_REVIEWED',
      index: true,
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
    collection: 'risks',
  }
);

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Human-readable risk level label for UI display
 */
riskSchema.virtual('riskLevelLabel').get(function () {
  const labels = {
    HIGH: 'High Risk',
    MED: 'Medium Risk',
    LOW: 'Low Risk',
    UNKNOWN: 'Not Assessed',
  };
  return labels[this.riskLevel] || 'Unknown';
});

/**
 * Virtual for mitigating control count
 */
riskSchema.virtual('controlCount').get(function () {
  return this.mitigatingControlIds?.length || 0;
});

// =============================================================================
// PRE-SAVE MIDDLEWARE: Calculate Inherent Score & Risk Level
// =============================================================================

riskSchema.pre('save', function () {
  const scoreToBand = (score) => (score >= 7 ? 'High' : score >= 3 ? 'Medium' : 'Low');

  if (this.likelihood != null && this.impact != null) {
    this.inherentScore = this.likelihood * this.impact;
    this.inherentRisk = {
      likelihood: this.likelihood,
      impact: this.impact,
      score: this.inherentScore,
      level: scoreToBand(this.inherentScore),
    };
  }

  if (this.residualLikelihood != null && this.residualImpact != null) {
    this.residualScore = this.residualLikelihood * this.residualImpact;
    this.residualRisk = {
      likelihood: this.residualLikelihood,
      impact: this.residualImpact,
      score: this.residualScore,
      level: scoreToBand(this.residualScore),
    };
  }

  const effectiveScore = this.residualScore ?? this.inherentScore;
  if (effectiveScore == null) this.riskLevel = 'UNKNOWN';
  else if (effectiveScore >= 7) this.riskLevel = 'HIGH';
  else if (effectiveScore >= 3) this.riskLevel = 'MED';
  else this.riskLevel = 'LOW';
});

// =============================================================================
// STATIC METHODS
// =============================================================================

/**
 * Get top N risks by residual score (for dashboard)
 * 
 * @param {ObjectId} organizationId
 * @param {Number} limit - Number of risks to return (default 10)
 * @returns {Promise<Array>} Top risks sorted by residualScore descending
 */
riskSchema.statics.getTopRisks = async function (organizationId, limit = 10) {
  return this.find({
    organizationId,
    isDeleted: { $ne: true },
    status: 'OPEN',
  })
    .sort({ residualScore: -1, inherentScore: -1 })
    .limit(limit)
    .populate('ownerId', 'firstName lastName email')
    .lean();
};

/**
 * Get risk counts by level for dashboard
 * 
 * @param {ObjectId} organizationId
 * @returns {Promise<Object>} Risk level counts
 */
riskSchema.statics.getRiskLevelCounts = async function (organizationId) {
  const results = await this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        status: 'OPEN',
      }
    },
    { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
  ]);

  const counts = {
    HIGH: 0,
    MED: 0,
    LOW: 0,
    UNKNOWN: 0,
    total: 0,
  };

  results.forEach(({ _id, count }) => {
    if (_id && counts.hasOwnProperty(_id)) {
      counts[_id] = count;
    }
    counts.total += count;
  });

  return counts;
};

/**
 * Get risk matrix data for visualization
 * 
 * @param {ObjectId} organizationId
 * @returns {Promise<Array>} Risks grouped by likelihood/impact
 */
riskSchema.statics.getRiskMatrix = async function (organizationId) {
  return this.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        status: 'OPEN',
      }
    },
    {
      $group: {
        _id: { likelihood: '$likelihood', impact: '$impact' },
        count: { $sum: 1 },
        risks: {
          $push: {
            _id: '$_id',
            title: '$title',
            inherentScore: '$inherentScore',
            residualScore: '$residualScore',
            riskLevel: '$riskLevel',
          }
        },
      },
    },
    {
      $project: {
        _id: 0,
        likelihood: '$_id.likelihood',
        impact: '$_id.impact',
        count: 1,
        risks: 1,
      },
    },
    { $sort: { impact: -1, likelihood: -1 } },
  ]);
};
riskSchema.statics.getStaleRisks = async function (organizationId, daysStale = 30) {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - daysStale);

  return this.find({
    organizationId,
    isDeleted: { $ne: true },
    status: 'OPEN',
    $or: [
      { updatedAt: { $lt: staleDate } },
      { updatedAt: { $exists: false } },
    ],
  }).select('_id title identifier updatedAt');
};

// =============================================================================
// INDEXES
// =============================================================================

riskSchema.index({ organizationId: 1, isDeleted: 1 });
riskSchema.index({ organizationId: 1, status: 1 });
riskSchema.index({ organizationId: 1, archivedAt: 1 });
riskSchema.index({ organizationId: 1, impact: -1, likelihood: -1 });
riskSchema.index({ organizationId: 1, riskLevel: 1 });
riskSchema.index({ organizationId: 1, category: 1 });
riskSchema.index({ mitigatingControlIds: 1 });
riskSchema.index({ nextReviewDue: 1 });

// Enable virtuals in JSON
riskSchema.set('toJSON', { virtuals: true });
riskSchema.set('toObject', { virtuals: true });

// Apply tenant plugin for soft delete support
riskSchema.plugin(tenantPlugin);

const Risk = mongoose.model('Risk', riskSchema);

export default Risk;
