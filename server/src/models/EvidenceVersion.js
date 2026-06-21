/**
 * EvidenceVersion Model (Tenant Domain)
 * Vanta-style version lifecycle: draft -> active (submitted) -> expired.
 * One Evidence (document) has many EvidenceVersions.
 */
import mongoose from 'mongoose';
import { EVIDENCE_VERSION_STATUS } from './enums.js';

const { Schema } = mongoose;

const evidenceVersionSchema = new Schema(
  {
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: EVIDENCE_VERSION_STATUS,
      default: 'draft',
      index: true,
    },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    validUntil: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'evidenceversions' }
);

evidenceVersionSchema.index({ evidenceId: 1, status: 1 });
evidenceVersionSchema.index({ evidenceId: 1, createdAt: -1 });

const EvidenceVersion = mongoose.model('EvidenceVersion', evidenceVersionSchema);
export default EvidenceVersion;
