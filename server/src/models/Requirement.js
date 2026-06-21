import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Requirement Model (Global Domain)
 *
 * Level 3 of the compliance hierarchy: a requirement sub-category (e.g. SOC 2 "CC 5.1")
 * under a RequirementCategory, within a Framework.
 * This is GLOBAL data — no organizationId. Shared across all tenants.
 */
const requirementSchema = new Schema(
  {
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
      required: [true, 'Framework ID is required'],
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'RequirementCategory',
      required: [true, 'Requirement category ID is required'],
      index: true,
    },
    identifier: {
      type: String,
      required: [true, 'Requirement identifier is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Requirement title is required'],
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
    collection: 'requirements',
  }
);

// Unique requirement identifier per framework
requirementSchema.index({ frameworkId: 1, identifier: 1 }, { unique: true });
requirementSchema.index({ frameworkId: 1, categoryId: 1 });

const Requirement = mongoose.model('Requirement', requirementSchema);

export default Requirement;
