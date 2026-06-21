import mongoose from 'mongoose';

const { Schema } = mongoose;

const organizationFrameworkSchema = new Schema(
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
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    purchasedBy: {
      type: String,
      required: true,
      trim: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'organizationframeworks',
  },
);

organizationFrameworkSchema.index({ organizationId: 1, frameworkId: 1 }, { unique: true });
organizationFrameworkSchema.index({ organizationId: 1, revokedAt: 1 });

const OrganizationFramework = mongoose.model('OrganizationFramework', organizationFrameworkSchema);

export default OrganizationFramework;
