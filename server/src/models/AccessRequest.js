import mongoose from 'mongoose';
import { ACCESS_REQUEST_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * AccessRequest Model (Tenant Domain)
 *
 * Minimal approval workflow for requesting access to a resource (Phase 1 schema).
 * Full workflow routes/services can be implemented in Phase 4+.
 */
const accessRequestSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ACCESS_REQUEST_STATUS,
      default: 'PENDING',
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    requestedRole: {
      type: String,
      trim: true,
      default: '',
    },
    justification: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
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
    collection: 'accessrequests',
  }
);

accessRequestSchema.index({ organizationId: 1, status: 1, isDeleted: 1 });
accessRequestSchema.index({ organizationId: 1, requesterId: 1, isDeleted: 1 });
accessRequestSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1, isDeleted: 1 });

accessRequestSchema.plugin(tenantPlugin);

const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

export default AccessRequest;
