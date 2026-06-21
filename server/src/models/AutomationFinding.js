import mongoose from 'mongoose';
import { FINDING_STATUS } from './enums.js';

const { Schema } = mongoose;

/**
 * AutomationFinding Model (Tenant Domain)
 * 
 * Raw results from automated compliance integrations.
 * Links to InternalControl to update automation status.
 * Immutable log - no soft delete needed.
 */
const automationFindingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    controlId: {
      type: Schema.Types.ObjectId,
      ref: 'InternalControl',
      required: [true, 'Control ID is required'],
      index: true,
    },
    // Source of the finding (e.g., 'AWS_CONFIG', 'GITHUB', 'OKTA')
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true,
    },
    // External identifier from the source system
    externalId: {
      type: String,
      trim: true,
    },
    // Finding details
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Status of the finding
    status: {
      type: String,
      enum: FINDING_STATUS,
      required: true,
    },
    // Severity level
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
      default: 'MEDIUM',
    },
    // Resource that was checked
    resourceType: {
      type: String,
      trim: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    resourceName: {
      type: String,
      trim: true,
    },
    // Raw data from the integration
    rawData: {
      type: Schema.Types.Mixed,
    },
    // When the finding was detected
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // When the finding was resolved (if applicable)
    resolvedAt: {
      type: Date,
    },
    // Integration run reference
    runId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'automationfindings',
  }
);

// Indexes
automationFindingSchema.index({ organizationId: 1, controlId: 1 });
automationFindingSchema.index({ detectedAt: -1 });
automationFindingSchema.index({ organizationId: 1, source: 1 });
automationFindingSchema.index({ organizationId: 1, status: 1 });
automationFindingSchema.index({ source: 1, externalId: 1 });

const AutomationFinding = mongoose.model('AutomationFinding', automationFindingSchema);

export default AutomationFinding;
