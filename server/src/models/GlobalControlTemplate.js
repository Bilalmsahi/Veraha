import mongoose from 'mongoose';
import { MANUAL_STATUS, FREQUENCY, COVERAGE } from './enums.js';

const { Schema } = mongoose;

/**
 * TemplateRequirementMap Sub-Schema
 * 
 * Embedded document for suggested framework requirement mappings.
 */
const templateRequirementMapSchema = new Schema(
  {
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: 'Requirement',
      required: true,
    },
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
      required: true,
    },
    coverage: {
      type: String,
      enum: COVERAGE,
      default: 'FULL',
    },
    justification: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * GlobalControlTemplate Model (Global Domain)
 * 
 * Master templates for seeding InternalControls when a new Organization is created.
 * This is GLOBAL data - no organizationId. Read-only for tenants.
 */
const globalControlTemplateSchema = new Schema(
  {
    identifier: {
      type: String,
      required: [true, 'Template identifier is required'],
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Template title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    /** Functional grouping for controls created from this template (not framework requirement category) */
    controlGroup: {
      type: String,
      trim: true,
    },
    defaultManualStatus: {
      type: String,
      enum: MANUAL_STATUS,
      default: 'NOT_APPLICABLE',
    },
    frequency: {
      type: String,
      enum: FREQUENCY,
      default: 'QUARTERLY',
    },
    suggestedPolicySlugs: [
      {
        type: String,
        trim: true,
      },
    ],
    suggestedRequirements: [templateRequirementMapSchema],
    implementationGuidance: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'globalcontroltemplates',
  }
);

// Indexes
globalControlTemplateSchema.index({ identifier: 1 }, { unique: true });
globalControlTemplateSchema.index({ controlGroup: 1 });
globalControlTemplateSchema.index({ isActive: 1 });

const GlobalControlTemplate = mongoose.model('GlobalControlTemplate', globalControlTemplateSchema);

export default GlobalControlTemplate;
