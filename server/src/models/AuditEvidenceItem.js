import mongoose from 'mongoose';
import { AUDIT_EVIDENCE_REVIEW_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const auditEvidenceItemSchema = new Schema(
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
    controlId: {
      type: Schema.Types.ObjectId,
      ref: 'InternalControl',
      required: true,
      index: true,
    },
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
      index: true,
    },
    snapshotId: {
      type: Schema.Types.ObjectId,
      ref: 'AuditControlSnapshot',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    fileName: {
      type: String,
      trim: true,
      default: '',
    },
    fileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: AUDIT_EVIDENCE_REVIEW_STATUS,
      default: 'NOT_STARTED',
      index: true,
    },
    flagReason: {
      type: String,
      trim: true,
      default: '',
    },
    auditorComment: {
      type: String,
      trim: true,
      default: '',
    },
    internalNote: {
      type: String,
      trim: true,
      default: '',
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
    customerResponse: {
      type: String,
      trim: true,
      default: '',
    },
    customerRespondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    customerRespondedAt: {
      type: Date,
      default: null,
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
    lockedAt: {
      type: Date,
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'auditevidenceitems',
  }
);

auditEvidenceItemSchema.index(
  { auditId: 1, controlId: 1, evidenceId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
auditEvidenceItemSchema.index({ organizationId: 1, auditId: 1, status: 1, isDeleted: 1 });

auditEvidenceItemSchema.pre('save', function () {
  if (!this.isNew && this.lockedAt) {
    const allowedLockedFields = new Set([
      'status',
      'auditorComment',
      'flagReason',
      'internalNote',
      'reviewedBy',
      'reviewedAt',
      'version',
      'updatedAt',
    ]);
    const disallowedModifiedFields = this.modifiedPaths().filter((field) => {
      const topLevelField = field.split('.')[0];
      return !allowedLockedFields.has(topLevelField);
    });

    if (disallowedModifiedFields.length > 0) {
      throw new Error('Evidence item is locked and cannot be modified');
    }
  }

  this.version = (this.version || 0) + 1;
});

auditEvidenceItemSchema.plugin(tenantPlugin);
auditEvidenceItemSchema.plugin(applyOrgScope, 'organizationId');

const AuditEvidenceItem = mongoose.model('AuditEvidenceItem', auditEvidenceItemSchema);

export default AuditEvidenceItem;
