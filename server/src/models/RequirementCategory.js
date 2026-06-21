import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * RequirementCategory Model (Global Domain)
 *
 * Level 2 of the compliance hierarchy: groups requirement sub-categories (Requirement rows)
 * under a framework (e.g. SOC 2 "CC 5.0 Control Activities").
 * Shared across all tenants — no organizationId.
 */
const requirementCategorySchema = new Schema(
  {
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
      required: [true, 'Framework ID is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Category code is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Category title is required'],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'requirementcategories',
  }
);

requirementCategorySchema.index({ frameworkId: 1, code: 1 }, { unique: true });
requirementCategorySchema.index({ frameworkId: 1, isActive: 1 });

const RequirementCategory = mongoose.model('RequirementCategory', requirementCategorySchema);

export default RequirementCategory;
