import mongoose from 'mongoose';
import { DEVICE_EVIDENCE_REVIEW_STATUS } from './enums.js';
import { DEVICE_SETTINGS_CHECKLIST_KEYS } from '../constants/deviceSettingsChecklist.js';

const { Schema } = mongoose;

const evidenceFileSchema = new Schema(
  {
    fileKey: { type: String, required: true, trim: true },
    originalName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number },
  },
  { _id: true, timestamps: false }
);

const checklistItemSchema = new Schema(
  {
    key: {
      type: String,
      enum: DEVICE_SETTINGS_CHECKLIST_KEYS,
      required: true,
    },
    label: { type: String, required: true, trim: true },
    checked: { type: Boolean, default: false },
    evidenceFileId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: false }
);

const deviceEvidenceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device ID is required'],
      index: true,
    },
    label: {
      type: String,
      trim: true,
      default: 'Device settings submission',
    },
    evidenceFiles: {
      type: [evidenceFileSchema],
      default: [],
    },
    checklistItems: {
      type: [checklistItemSchema],
      default: [],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    reviewStatus: {
      type: String,
      enum: DEVICE_EVIDENCE_REVIEW_STATUS,
      default: 'APPROVED',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'device_evidence',
  }
);

deviceEvidenceSchema.index({ organizationId: 1, deviceId: 1, uploadedAt: -1 });
deviceEvidenceSchema.index({ organizationId: 1, reviewStatus: 1, uploadedAt: -1 });

const DeviceEvidence = mongoose.model('DeviceEvidence', deviceEvidenceSchema);

export default DeviceEvidence;
