import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * HrProfile Model (Tenant Domain)
 *
 * Tracks HR employee profiles for personnel compliance.
 * Links to InternalControls for personnel-related activities.
 */
const hrProfileSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    workEmail: {
      type: String,
      required: [true, 'Work email is required'],
      trim: true,
      lowercase: true,
    },
    employeeNumber: {
      type: String,
      trim: true,
    },
    externalId: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'HrProfile',
      default: null,
    },
    employmentStatus: {
      type: String,
      enum: ['active', 'on_leave', 'departed'],
      default: 'active',
      index: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
      default: null,
    },
    hrSource: {
      type: String,
      enum: ['manual', 'bamboohr_import', 'rippling_import'],
      default: 'manual',
    },
    backgroundCheckStatus: {
      type: String,
      enum: ['pending', 'completed', 'not_required', 'failed'],
      default: 'not_required',
    },
    lastImportedAt: {
      type: Date,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    collection: 'hrprofiles',
  }
);

// Indexes
hrProfileSchema.index({ organizationId: 1, workEmail: 1 }, { unique: true });
hrProfileSchema.index({ organizationId: 1, employmentStatus: 1 });
hrProfileSchema.index({ organizationId: 1, department: 1 });
hrProfileSchema.index({ organizationId: 1, isDeleted: 1 });

// Apply tenant plugin for soft delete support
hrProfileSchema.plugin(tenantPlugin);

const HrProfile = mongoose.model('HrProfile', hrProfileSchema);

export default HrProfile;
