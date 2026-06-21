import mongoose from 'mongoose';

const { Schema } = mongoose;

const organizationFrameworkReadinessSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
      required: true,
      index: true,
    },
    readinessPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'organizationframeworkreadiness',
  },
);

organizationFrameworkReadinessSchema.index({ organizationId: 1, frameworkId: 1 }, { unique: true });

const OrganizationFrameworkReadiness = mongoose.model(
  'OrganizationFrameworkReadiness',
  organizationFrameworkReadinessSchema,
);

export default OrganizationFrameworkReadiness;
