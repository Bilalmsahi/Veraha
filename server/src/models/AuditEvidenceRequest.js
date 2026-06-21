import mongoose from 'mongoose';
import { AUDIT_EVIDENCE_REQUEST_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['AUDITOR', 'INTERNAL'],
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const auditEvidenceRequestSchema = new Schema(
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
    auditEvidenceItemId: {
      type: Schema.Types.ObjectId,
      ref: 'AuditEvidenceItem',
      default: null,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    status: {
      type: String,
      enum: AUDIT_EVIDENCE_REQUEST_STATUS,
      default: 'OPEN',
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    submittedItems: [{
      type: Schema.Types.ObjectId,
      ref: 'AuditEvidenceItem',
    }],
    submittedEvidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
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
  },
  {
    timestamps: true,
    collection: 'auditevidencerequests',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

auditEvidenceRequestSchema.index({ organizationId: 1, auditId: 1, status: 1, isDeleted: 1 });
auditEvidenceRequestSchema.virtual('isOverdue').get(function () {
  return this.status !== 'COMPLETED' && this.dueDate && this.dueDate.getTime() < Date.now();
});
auditEvidenceRequestSchema.plugin(tenantPlugin);
auditEvidenceRequestSchema.plugin(applyOrgScope, 'organizationId');

const AuditEvidenceRequest = mongoose.model('AuditEvidenceRequest', auditEvidenceRequestSchema);

export default AuditEvidenceRequest;
