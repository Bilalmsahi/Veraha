import mongoose from 'mongoose';
import { POLICY_STATUS, POLICY_WORKFLOW_STATUS, REVIEW_FREQUENCY, ROLE } from './enums.js';
import tenantPlugin, { enhancedSoftDelete } from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

/**
 * Policy Model (Tenant Domain)
 * 
 * Parent container for policy documents.
 * Actual content/files are stored in PolicyVersion.
 * currentVersionId points to the ACTIVE/PUBLISHED version.
 */
const policySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Policy title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: POLICY_STATUS,
      default: 'DRAFT',
    },
    /**
     * Latest-version approval pipeline state.
     *
     * Policy.status is the publish state (DRAFT | ACTIVE | ARCHIVED) and must
     * not be conflated with this approval workflow field.
     */
    workflowStatus: {
      type: String,
      enum: POLICY_WORKFLOW_STATUS,
      default: 'DRAFT',
    },
    // Points to the currently active/published version
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyVersion',
      default: null,
    },
    // Policy library template (if added from library)
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyTemplate',
      index: true,
    },
    // Source: VANTA = from library, CUSTOM = created manually
    source: {
      type: String,
      enum: ['VANTA', 'CUSTOM'],
      default: 'CUSTOM',
    },
    // Framework tags for filtering (ObjectIds)
    frameworkIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Framework',
      },
    ],
    // Linked controls that this policy governs
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    approverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      // @deprecated - use approverIds
    },
    approverIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    category: {
      type: String,
      trim: true,
    },
    reviewFrequency: {
      type: String,
      enum: REVIEW_FREQUENCY,
      default: 'ANNUALLY',
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
    requiresAttestation: {
      type: Boolean,
      default: true,
    },
    acknowledgementRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Assignment scope for acknowledgements
    assignmentScope: {
      type: String,
      enum: ['ALL_PERSONNEL', 'SPECIFIC_GROUPS', 'SPECIFIC_USERS', 'SPECIFIC_ROLES'],
      default: 'ALL_PERSONNEL',
      index: true,
    },
    assignmentGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
    assignmentUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    targetUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    targetRoles: [
      {
        type: String,
        enum: ROLE,
      },
    ],
    // Snooze (must match Test.snoozedUntil spelling)
    snoozedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    snoozedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    snoozeReason: {
      type: String,
      trim: true,
      default: '',
    },
    // Deactivate
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deactivationReason: {
      type: String,
      trim: true,
      default: '',
    },
    // Archive (separate from soft delete)
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
    archiveReason: {
      type: String,
      trim: true,
      default: '',
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
    collection: 'policies',
  }
);

// Indexes
policySchema.index({ organizationId: 1, isDeleted: 1, status: 1 });
policySchema.index({ organizationId: 1, category: 1 });
policySchema.index({ organizationId: 1, ownerId: 1 });
policySchema.index({ organizationId: 1, approverId: 1 });
policySchema.index({ organizationId: 1, frameworkIds: 1 });
policySchema.index({ organizationId: 1, source: 1 });
policySchema.index({ organizationId: 1, templateId: 1 });
policySchema.index({ nextReviewDue: 1 });
policySchema.index({ organizationId: 1, snoozedUntil: 1 });

// Backward compatibility alias during migration period.
policySchema
  .virtual('assignmentTarget')
  .get(function getAssignmentTarget() {
    return this.assignmentScope;
  })
  .set(function setAssignmentTarget(v) {
    this.assignmentScope = v;
  });

// Apply tenant plugin for soft delete support
policySchema.plugin(tenantPlugin);
policySchema.plugin(applyOrgScope, 'organizationId');

policySchema.plugin(enhancedSoftDelete, {
  cascadeDelete: [
    {
      model: 'PolicyVersion',
      condition: (doc) => ({ policyId: doc._id }),
      ifOrphaned: false, // Always cascade to versions
    },
  ],
});

const Policy = mongoose.model('Policy', policySchema);

export default Policy;
