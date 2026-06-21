import mongoose from 'mongoose';
import { ACCESS_REVIEW_DECISION, ACCESS_REVIEW_TASK_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const accessReviewTaskSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'AccessReviewCampaign',
      required: true,
      index: true,
    },
    subjectUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      default: 'Platform',
      trim: true,
    },
    resourceName: {
      type: String,
      default: 'Veraha Security',
      trim: true,
    },
    accessRole: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ACCESS_REVIEW_TASK_STATUS,
      default: 'PENDING',
      index: true,
    },
    decision: {
      type: String,
      enum: ACCESS_REVIEW_DECISION,
      default: null,
    },
    decisionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    revocationConfirmedAt: {
      type: Date,
      default: null,
    },
    revocationConfirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
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
    collection: 'accessreviewtasks',
  }
);

accessReviewTaskSchema.index({ organizationId: 1, reviewerId: 1, status: 1, isDeleted: 1 });
accessReviewTaskSchema.index(
  { campaignId: 1, subjectUserId: 1, resourceType: 1, resourceName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
accessReviewTaskSchema.plugin(tenantPlugin);
accessReviewTaskSchema.plugin(applyOrgScope, 'organizationId');

const AccessReviewTask = mongoose.model('AccessReviewTask', accessReviewTaskSchema);

export default AccessReviewTask;
