import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Framework Model (Global Domain)
 * 
 * Represents compliance frameworks like SOC 2, ISO 27001, HIPAA, GDPR.
 * This is GLOBAL data - no organizationId. Shared across all tenants.
 */
const frameworkSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Framework code is required'],
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Framework name is required'],
      trim: true,
    },
    version: {
      type: String,
      required: [true, 'Framework version is required'],
      trim: true,
    },
    description: {
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
    collection: 'frameworks',
  }
);

// Indexes
frameworkSchema.index({ code: 1 }, { unique: true });
frameworkSchema.index({ isActive: 1 });

const Framework = mongoose.model('Framework', frameworkSchema);

export default Framework;
