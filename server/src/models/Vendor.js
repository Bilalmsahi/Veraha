import mongoose from 'mongoose';
import { RISK_TIER, VENDOR_STATUS, REVIEW_FREQUENCY } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * Vendor Model (Tenant Domain)
 * 
 * Tracks third-party vendors and their security posture.
 * Links to InternalControls for vendor management activities.
 */
const vendorSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    // Risk Assessment (Vanta: CRITICAL, HIGH, MEDIUM, LOW, UNSCORED)
    riskTier: {
      type: String,
      enum: RISK_TIER,
      default: 'UNSCORED',
    },
    // Status (Vanta: ACTIVE | ARCHIVED)
    status: {
      type: String,
      enum: VENDOR_STATUS,
      default: 'ACTIVE',
    },
    // Linked controls (vendor-related compliance activities)
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    // Contact Information
    primaryContact: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
    },
    securityContact: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
    },
    // Contract/Agreement Info
    contractStartDate: {
      type: Date,
    },
    contractEndDate: {
      type: Date,
    },
    hasNda: {
      type: Boolean,
      default: false,
    },
    hasDpa: {
      type: Boolean,
      default: false,
    },
    hasSla: {
      type: Boolean,
      default: false,
    },
    // Assessment Tracking
    lastAssessmentDate: {
      type: Date,
    },
    lastAssessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    nextAssessmentDate: {
      type: Date,
    },
    assessmentFrequency: {
      type: String,
      enum: REVIEW_FREQUENCY,
      default: 'ANNUALLY',
    },
    // Security Certifications
    // When documents are stored in S3/local via storageService we persist
    // a stable storage key and refresh documentUrl on read.
    certifications: [
      {
        name: { type: String, trim: true },
        validUntil: { type: Date },
        documentKey: { type: String, trim: true },
        documentUrl: { type: String, trim: true },
        documentMimeType: { type: String, trim: true },
        documentSizeBytes: { type: Number },
        uploadedAt: { type: Date },
      },
    ],
    // Data Processing (free-text tags like Vanta)
    dataTypes: [{ type: String, trim: true }],
    dataShared: [{ type: String, trim: true }],
    dataLocation: {
      type: String,
      trim: true,
    },
    // Notes
    notes: {
      type: String,
      trim: true,
    },
    // Ownership
    ownerId: {
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
    collection: 'vendors',
  }
);

// Indexes
vendorSchema.index({ organizationId: 1, isDeleted: 1, riskTier: 1 });
vendorSchema.index({ organizationId: 1, status: 1 });
vendorSchema.index({ organizationId: 1, category: 1 });
vendorSchema.index({ linkedControlIds: 1 });
vendorSchema.index({ nextAssessmentDate: 1 });
vendorSchema.index({ contractEndDate: 1 });

// Apply tenant plugin for soft delete support
vendorSchema.plugin(tenantPlugin);

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;
