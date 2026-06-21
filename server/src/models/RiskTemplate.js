import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Risk Template Model (Global + Org-level)
 *
 * Reusable threat scenarios for the Risk Library.
 * Provides only title, description, and categoryNames (no default assessments).
 * Global templates (isGlobal: true) are seeded and shared across all tenants.
 * Org-level templates are created by managers/admins within their org.
 */
const riskTemplateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    categoryNames: {
      type: [String],
      default: [],
      trim: true,
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'risktemplates',
  }
);

riskTemplateSchema.index({ isGlobal: 1 });
riskTemplateSchema.index({ organizationId: 1, isActive: 1 });

const RiskTemplate = mongoose.model('RiskTemplate', riskTemplateSchema);

export default RiskTemplate;
