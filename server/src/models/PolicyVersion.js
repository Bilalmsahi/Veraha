import mongoose from 'mongoose';
import { POLICY_VERSION_CONTENT_TYPE, POLICY_VERSION_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * PolicyVersion Model (Tenant Domain)
 * 
 * Stores actual policy content/files with versioning.
 * Allows drafts to exist separately from active versions.
 */
const policyVersionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: 'Policy',
      required: [true, 'Policy ID is required'],
      index: true,
    },
    versionNumber: {
      type: Number,
      required: [true, 'Version number is required'],
      min: 1,
    },
    status: {
      type: String,
      enum: POLICY_VERSION_STATUS,
      default: 'DRAFT',
    },
    approverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Content storage (can be HTML content or file reference)
    contentHtml: {
      type: String,
    },
    contentType: {
      type: String,
      enum: POLICY_VERSION_CONTENT_TYPE,
      default() {
        return this.fileKey && !(typeof this.contentHtml === 'string' && this.contentHtml.trim())
          ? 'UPLOADED_FILE'
          : 'EDITOR_HTML';
      },
      index: true,
    },
    draftSourceVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyVersion',
      default: null,
    },
    editorLastSavedAt: {
      type: Date,
      default: null,
    },
    editorLastSavedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    contentHash: {
      type: String,
      trim: true,
      default: '',
    },
    // File storage (for uploaded PDFs/documents)
    // We store both a stable storage key and a transient URL.
    // In S3 mode the URL is a short-lived signed URL and is always
    // refreshed on read using the stored key.
    fileKey: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileMimeType: {
      type: String,
      trim: true,
    },
    fileSizeBytes: {
      type: Number,
    },
    // When this version becomes/became effective
    effectiveDate: {
      type: Date,
    },
    // Who created this version
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Changelog/notes for this version
    changelog: {
      type: String,
      trim: true,
    },
    // Approval tracking
    submittedForApprovalAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    // When this version was superseded (if applicable)
    supersededAt: {
      type: Date,
    },
    supersededBy: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyVersion',
    },
  },
  {
    timestamps: true,
    collection: 'policyversions',
  }
);

// Indexes
policyVersionSchema.index({ policyId: 1, versionNumber: -1 });
policyVersionSchema.index({ policyId: 1, status: 1 });
policyVersionSchema.index({ policyId: 1, status: 1, contentType: 1 });
policyVersionSchema.index({ createdBy: 1 });

// Ensure unique version number per policy
policyVersionSchema.index({ policyId: 1, versionNumber: 1 }, { unique: true });

// Apply tenant plugin for soft delete support
policyVersionSchema.plugin(tenantPlugin);

const PolicyVersion = mongoose.model('PolicyVersion', policyVersionSchema);

export default PolicyVersion;
