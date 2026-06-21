import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const DEVICE_OS = ['macOS', 'Windows', 'Linux', 'Other'];

const deviceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
    },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
      index: true,
    },
    os: {
      type: String,
      enum: DEVICE_OS,
      required: [true, 'Operating system is required'],
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['laptop', 'desktop', 'mobile', 'server', 'other'],
    },
    osVersion: {
      type: String,
      trim: true,
    },
    mdmSource: {
      type: String,
      enum: ['manual', 'jamf', 'kandji', 'intune', 'jumpcloud', 'ninjaone', 'other'],
      default: 'manual',
    },
    mdmEnrollmentStatus: {
      type: String,
      enum: ['enrolled', 'not_enrolled', 'unknown'],
      default: 'unknown',
    },
    overallComplianceStatus: {
      type: String,
      enum: ['compliant', 'non_compliant', 'needs_review'],
      default: 'needs_review',
    },
    linkedControlIds: [{ type: Schema.Types.ObjectId, ref: 'InternalControl' }],
    compliance: {
      antivirusInstalled: { type: Boolean, default: false },
      antivirusName: { type: String, trim: true },
      diskEncryptionEnabled: { type: Boolean, default: false },
      screenLockEnabled: { type: Boolean, default: false },
      passwordManagerInstalled: { type: Boolean, default: false },
      osUpToDate: { type: Boolean },
      lastVerifiedDate: { type: Date, default: null },
    },
    notes: {
      type: String,
      trim: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
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
    collection: 'devices',
  }
);

deviceSchema.index({ organizationId: 1, isDeleted: 1, name: 1 });
deviceSchema.index({ organizationId: 1, assignedUserId: 1 });
deviceSchema.index({ organizationId: 1, serialNumber: 1 }, { unique: true, sparse: true });

deviceSchema.pre('save', function setLastUpdatedAndCompliance() {
  if (!this.isNew && this.isModified()) {
    this.lastUpdated = new Date();
  }

  const {
    diskEncryptionEnabled,
    screenLockEnabled,
    antivirusInstalled,
    osUpToDate,
    lastVerifiedDate,
  } = this.compliance || {};

  const booleans = [diskEncryptionEnabled, screenLockEnabled, antivirusInstalled, osUpToDate];

  if (booleans.some((value) => value === false)) {
    this.overallComplianceStatus = 'non_compliant';
    return;
  }

  const allTrue = booleans.every((value) => value === true);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const verifiedRecently =
    lastVerifiedDate instanceof Date &&
    !Number.isNaN(lastVerifiedDate.getTime()) &&
    lastVerifiedDate >= thirtyDaysAgo;

  if (allTrue && verifiedRecently) {
    this.overallComplianceStatus = 'compliant';
    return;
  }

  this.overallComplianceStatus = 'needs_review';
});

deviceSchema.plugin(tenantPlugin);

const Device = mongoose.model('Device', deviceSchema);

export default Device;
