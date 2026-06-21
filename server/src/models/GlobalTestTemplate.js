import mongoose from 'mongoose';
import { TEST_TYPE, TEST_CATEGORY, TEST_RENEWAL_PERIOD } from './enums.js';

const { Schema } = mongoose;

/**
 * GlobalTestTemplate Model (Global Domain)
 *
 * Shared library of control tests/documents used to provision tenant Test records.
 * This is GLOBAL data - no organizationId.
 */
const globalTestTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Test template name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    evidenceGuidance: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: TEST_TYPE,
      required: [true, 'Test template type is required'],
    },
    category: {
      type: String,
      enum: TEST_CATEGORY,
      default: 'Engineering',
    },
    renewalPeriod: {
      type: String,
      enum: TEST_RENEWAL_PERIOD,
    },
    suggestedControlIdentifiers: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'globaltesttemplates',
  }
);

globalTestTemplateSchema.index({ name: 1 }, { unique: true });
globalTestTemplateSchema.index({ type: 1 });
globalTestTemplateSchema.index({ suggestedControlIdentifiers: 1 });
globalTestTemplateSchema.index({ isActive: 1 });

const GlobalTestTemplate = mongoose.model('GlobalTestTemplate', globalTestTemplateSchema);

export default GlobalTestTemplate;
