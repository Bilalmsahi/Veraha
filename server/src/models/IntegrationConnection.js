import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const INTEGRATION_TYPE = [
  'aws',
  'bamboohr',
  'rippling',
  'jamf',
  'kandji',
  'intune',
  'jumpcloud',
  'other',
];
const INTEGRATION_STATUS = ['connected', 'not_connected', 'error'];

/**
 * IntegrationConnection Model (Tenant Domain)
 *
 * Tracks which integrations are configured per organization.
 * Intentionally thin — no credential storage.
 */
const integrationConnectionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    integrationType: {
      type: String,
      enum: INTEGRATION_TYPE,
      required: [true, 'Integration type is required'],
    },
    status: {
      type: String,
      enum: INTEGRATION_STATUS,
      default: 'not_connected',
    },
    displayName: {
      type: String,
      trim: true,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
    configuredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'integrationconnections',
  }
);

// Indexes
integrationConnectionSchema.index(
  { organizationId: 1, integrationType: 1 },
  { unique: true }
);
integrationConnectionSchema.index({ organizationId: 1, status: 1 });

// Apply tenant plugin for soft delete support
integrationConnectionSchema.plugin(tenantPlugin);

const IntegrationConnection = mongoose.model(
  'IntegrationConnection',
  integrationConnectionSchema
);

export default IntegrationConnection;
