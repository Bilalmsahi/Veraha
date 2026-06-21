import mongoose from 'mongoose';
import { AUDIT_ASSIGNMENT_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const auditAssignmentSchema = new Schema(
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
    auditorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    auditorProfile: {
      type: Schema.Types.ObjectId,
      ref: 'AuditorProfile',
      index: true,
    },
    /**
     * @deprecated Use auditorProfile for global auditor identity. Kept during
     * migration for backward compatibility with existing assignments.
     */
    auditorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: AUDIT_ASSIGNMENT_STATUS,
      default: 'ACTIVE',
      index: true,
    },
    accessStartsAt: {
      type: Date,
      default: null,
    },
    accessEndsAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    collection: 'auditassignments',
  }
);

auditAssignmentSchema.index(
  { auditId: 1, auditorUserId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
auditAssignmentSchema.index(
  { auditId: 1, auditorProfile: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      auditorProfile: { $exists: true },
    },
  }
);
auditAssignmentSchema.index({ auditorUserId: 1, status: 1, isDeleted: 1 });
auditAssignmentSchema.index({ auditorProfile: 1, status: 1, isDeleted: 1 });
auditAssignmentSchema.index({ organizationId: 1, auditId: 1, status: 1, isDeleted: 1 });

auditAssignmentSchema.plugin(tenantPlugin);

const AuditAssignment = mongoose.model('AuditAssignment', auditAssignmentSchema);

export default AuditAssignment;
