import mongoose from 'mongoose';
import { SUBSCRIPTION_TIER } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * Organization Model (Tenant Root)
 * 
 * Represents a tenant/company in the multi-tenant platform.
 * All other tenant entities reference this via organizationId.
 */
const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    subscriptionTier: {
      type: String,
      enum: SUBSCRIPTION_TIER,
      default: 'FREE',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: null,
    },
    setupComplete: {
      type: Boolean,
      default: true,
    },
    complianceDataSeededAt: {
      type: Date,
      default: null,
      index: true,
    },
    complianceDataSeedVersion: {
      type: String,
      default: null,
      trim: true,
    },
    settings: {
      timezone: {
        type: String,
        default: 'UTC',
      },
      dateFormat: {
        type: String,
        default: 'YYYY-MM-DD',
      },
      evidenceExpiryWarningDays: {
        type: Number,
        default: 30,
      },
      sessionTimeoutMinutes: {
        type: Number,
        enum: [30, 60, 240, 480, 1440, 2880, 4320, 10080],
        default: 1440,
      },
      archiveAutoPassesAttestation: {
        type: Boolean,
        default: true,
      },
      archiveEvidenceCountsAsSatisfied: {
        type: Boolean,
        default: true,
      },
      naCountsAsSatisfied: {
        type: Boolean,
        default: false,
      },
      snoozeBlocksReadiness: {
        type: Boolean,
        default: false,
      },
      enabledFrameworks: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Framework',
        },
      ],
    },
    billingInfo: {
      stripeCustomerId: String,
      planStartDate: Date,
      planEndDate: Date,
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
    collection: 'organizations',
  }
);

// Indexes
organizationSchema.index({ domain: 1 }, { unique: true, sparse: true });
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ subscriptionTier: 1 });

// Pre-save hook to generate unique slug from name if not provided
organizationSchema.pre('save', async function () {
  if (!this.slug && this.name) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      || 'org';

    let slug = base;
    let counter = 0;
    const OrganizationModel = mongoose.model('Organization');
    while (await OrganizationModel.exists({ slug })) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    this.slug = slug;
  }
});

// Apply tenant plugin for query helpers
organizationSchema.plugin(tenantPlugin);

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
