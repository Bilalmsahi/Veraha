import mongoose from 'mongoose';
import { AUDIT_STATUS } from './enums.js';
import tenantPlugin, { enhancedSoftDelete } from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

/**
 * Audit Model (Tenant Domain)
 * 
 * Represents an audit period (e.g., SOC 2 Type II audit for Q1-Q4 2025).
 * Contains snapshots of control status at specific points in time.
 */
const auditSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Audit name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Audit type/framework
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
    },
    auditType: {
      type: String,
      enum: ['TYPE_I', 'TYPE_II', 'CERTIFICATION', 'INTERNAL', 'EXTERNAL'],
      default: 'EXTERNAL',
    },
    // Auditor information
    auditorName: {
      type: String,
      trim: true,
    },
    auditorFirm: {
      type: String,
      trim: true,
    },
    auditorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    // Audit period
    periodStart: {
      type: Date,
      required: [true, 'Audit period start is required'],
    },
    periodEnd: {
      type: Date,
      required: [true, 'Audit period end is required'],
    },
    // Status tracking
    status: {
      type: String,
      enum: AUDIT_STATUS,
      default: 'DRAFT',
    },
    // Key dates
    kickoffDate: {
      type: Date,
    },
    fieldworkStartDate: {
      type: Date,
    },
    fieldworkEndDate: {
      type: Date,
    },
    reportReceivedDate: {
      type: Date,
    },
    // Outcome
    outcome: {
      type: String,
      enum: ['PENDING', 'PASSED', 'PASSED_WITH_EXCEPTIONS', 'FAILED'],
      default: 'PENDING',
    },
    exceptions: [
      {
        description: { type: String, trim: true },
        controlId: { type: Schema.Types.ObjectId, ref: 'InternalControl' },
        severity: { type: String, enum: ['CRITICAL', 'MAJOR', 'MINOR'] },
        remediation: { type: String, trim: true },
      },
    ],
    // Report storage
    reportUrl: {
      type: String,
      trim: true,
    },
    reportFileName: {
      type: String,
      trim: true,
    },
    earlyAccessDate: {
      type: Date,
    },
    scopedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    // Internal notes
    notes: {
      type: String,
      trim: true,
    },
    // Ownership
    leaderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Soft Delete Fields
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
    collection: 'audits',
  }
);

// Indexes
auditSchema.index({ organizationId: 1, status: 1 });
auditSchema.index({ organizationId: 1, frameworkId: 1 });
auditSchema.index({ periodStart: 1, periodEnd: 1 });
// ✅ Add compound index for filtering by org + status + date range
auditSchema.index({
  organizationId: 1,
  status: 1,
  periodEnd: -1
});

// ✅ Add index for audit timeline queries
auditSchema.index({
  organizationId: 1,
  periodStart: 1,
  periodEnd: 1
});
// Apply tenant plugin for query helpers
auditSchema.plugin(tenantPlugin);
auditSchema.plugin(applyOrgScope, 'organizationId');

// Apply enhanced soft delete with cascade to snapshots
auditSchema.plugin(enhancedSoftDelete, {
  cascadeDelete: [
    {
      model: 'AuditControlSnapshot',
      condition: (doc) => ({ auditId: doc._id }),
      ifOrphaned: false, // Always cascade to snapshots
    },
  ],
});

const Audit = mongoose.model('Audit', auditSchema);

export default Audit;
