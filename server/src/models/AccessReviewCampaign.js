import mongoose from 'mongoose';
import { ACCESS_REVIEW_CAMPAIGN_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const accessReviewCampaignSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ACCESS_REVIEW_CAMPAIGN_STATUS,
      default: 'DRAFT',
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    reviewerType: {
      type: String,
      enum: ['ADMIN', 'MANAGER'],
      default: 'MANAGER',
    },
    resourceType: {
      type: String,
      trim: true,
      default: 'Platform',
    },
    resourceName: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    totalTasks: {
      type: Number,
      default: 0,
    },
    completedTasks: {
      type: Number,
      default: 0,
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
    collection: 'accessreviewcampaigns',
  }
);

accessReviewCampaignSchema.index({ organizationId: 1, status: 1, dueDate: 1, isDeleted: 1 });
accessReviewCampaignSchema.plugin(tenantPlugin);
accessReviewCampaignSchema.plugin(applyOrgScope, 'organizationId');

const AccessReviewCampaign = mongoose.model('AccessReviewCampaign', accessReviewCampaignSchema);

export default AccessReviewCampaign;
