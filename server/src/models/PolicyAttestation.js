import mongoose from 'mongoose';
import { POLICY_ATTESTATION_SOURCE } from './enums.js';

const { Schema } = mongoose;

/**
 * PolicyAttestation Model (Tenant Domain)
 * 
 * Records employee acknowledgment/signature of a specific policy version.
 * Immutable audit record - no soft delete needed.
 */
const policyAttestationSchema = new Schema(
  {
    policyVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyVersion',
      required: [true, 'Policy Version ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    // When the user attested
    attestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Audit trail info
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    // Optional: digital signature or consent text
    signatureText: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: POLICY_ATTESTATION_SOURCE,
      default: 'USER',
      index: true,
    },
    // Optional: geographic location at time of attestation
    location: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'policyattestations',
  }
);

// Indexes
// One attestation per user per policy version
policyAttestationSchema.index(
  { policyVersionId: 1, userId: 1 },
  { unique: true }
);
policyAttestationSchema.index({ userId: 1, attestedAt: -1 });

const PolicyAttestation = mongoose.model('PolicyAttestation', policyAttestationSchema);

export default PolicyAttestation;
