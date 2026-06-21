import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const auditFindingSchema = new Schema(
  {
    audit: {
      type: Schema.Types.ObjectId,
      ref: 'Audit',
      required: true,
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
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
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'REMEDIATED', 'ACCEPTED_RISK'],
      default: 'OPEN',
      index: true,
    },
    linkedControl: {
      type: Schema.Types.ObjectId,
      ref: 'InternalControl',
      default: null,
    },
    remediationNote: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'auditfindings',
  }
);

auditFindingSchema.index({ organization: 1, audit: 1, status: 1, severity: 1, deletedAt: 1 });
auditFindingSchema.plugin(tenantPlugin);
auditFindingSchema.plugin(applyOrgScope, 'organization');

const AuditFinding = mongoose.model('AuditFinding', auditFindingSchema);

export default AuditFinding;
