/**
 * EvidenceVersionFile Model (Tenant Domain)
 * A single file attached to an EvidenceVersion (draft or locked in active/expired).
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const evidenceVersionFileSchema = new Schema(
  {
    versionId: {
      type: Schema.Types.ObjectId,
      ref: 'EvidenceVersion',
      required: true,
      index: true,
    },
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
    s3Key: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      default: null,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'evidenceversionfiles',
  }
);

evidenceVersionFileSchema.index({ versionId: 1, sortOrder: 1 });

const EvidenceVersionFile = mongoose.model('EvidenceVersionFile', evidenceVersionFileSchema);
export default EvidenceVersionFile;
