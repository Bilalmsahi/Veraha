import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const auditReportSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    auditId: {
      type: Schema.Types.ObjectId,
      ref: 'Audit',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    s3Key: {
      type: String,
      trim: true,
      default: '',
    },
    fileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    fileName: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    sizeBytes: {
      type: Number,
      default: 0,
    },
    fileHash: {
      type: String,
      trim: true,
      default: '',
    },
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
    collection: 'auditreports',
  }
);

auditReportSchema.index({ auditId: 1, createdAt: -1 });
auditReportSchema.plugin(tenantPlugin);

const AuditReport = mongoose.model('AuditReport', auditReportSchema);

export default AuditReport;
