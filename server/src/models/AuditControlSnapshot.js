import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * EvidenceSnapshot Sub-Schema (Embedded)
 * 
 * Frozen copy of evidence at time of snapshot.
 */
const evidenceSnapshotSchema = new Schema(
  {
    originalEvidenceId: {
      type: Schema.Types.ObjectId,
    },
    title: {
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
    validFrom: {
      type: Date,
    },
    validUntil: {
      type: Date,
    },
    status: {
      type: String,
    },
  },
  { _id: false }
);

/**
 * RequirementSnapshot Sub-Schema (Embedded)
 * 
 * Frozen copy of linked requirements at time of snapshot.
 */
const requirementSnapshotSchema = new Schema(
  {
    requirementId: {
      type: Schema.Types.ObjectId,
    },
    frameworkId: {
      type: Schema.Types.ObjectId,
    },
    frameworkCode: {
      type: String,
    },
    requirementIdentifier: {
      type: String,
    },
    coverage: {
      type: String,
    },
    justification: {
      type: String,
    },
  },
  { _id: false }
);

/**
 * AuditControlSnapshot Model (Tenant Domain)
 * 
 * Immutable snapshot of an InternalControl at a specific point in time.
 * Used to prove historical compliance to auditors.
 * "Time Machine" capability - prevents history from being changed.
 */
const auditControlSnapshotSchema = new Schema(
  {
    auditId: {
      type: Schema.Types.ObjectId,
      ref: 'Audit',
      required: [true, 'Audit ID is required'],
      index: true,
    },
    // Reference to the original control (may have changed since)
    originalControlId: {
      type: Schema.Types.ObjectId,
      ref: 'InternalControl',
      required: true,
    },
    // Frozen control data at time of snapshot
    controlIdentifier: {
      type: String,
      required: true,
      trim: true,
    },
    controlTitle: {
      type: String,
      required: true,
      trim: true,
    },
    controlDescription: {
      type: String,
      trim: true,
    },
    controlCategory: {
      type: String,
      trim: true,
    },
    // Status at time of snapshot
    manualStatusAtSnapshot: {
      type: String,
    },
    automationStatusAtSnapshot: {
      type: String,
    },
    overallStatusAtSnapshot: {
      type: String,
      required: true,
    },
    // Owner at time of snapshot
    ownerAtSnapshot: {
      userId: { type: Schema.Types.ObjectId },
      name: { type: String },
      email: { type: String },
    },
    // Linked requirements at time of snapshot
    linkedRequirementsAtSnapshot: [requirementSnapshotSchema],
    // Evidence at time of snapshot
    evidenceSnapshots: [evidenceSnapshotSchema],
    // When the snapshot was taken
    snapshottedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    snapshottedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Notes added during snapshot
    auditorNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'auditcontrolsnapshots',
  }
);

// AuditControlSnapshot.js - ADD THIS
auditControlSnapshotSchema.pre('updateOne', function () {
  throw new Error('AuditControlSnapshot entries are immutable');
});
auditControlSnapshotSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditControlSnapshot entries are immutable');
});
auditControlSnapshotSchema.pre('deleteOne', function () {
  throw new Error('AuditControlSnapshot entries cannot be deleted');
});
auditControlSnapshotSchema.pre('findOneAndDelete', function () {
  throw new Error('AuditControlSnapshot entries cannot be deleted');
});
auditControlSnapshotSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('AuditControlSnapshot entries are immutable');
  }
});

// Indexes
// Unique compound index prevents duplicate snapshots for same control in an audit
auditControlSnapshotSchema.index(
  { auditId: 1, originalControlId: 1 },
  { unique: true }
);
auditControlSnapshotSchema.index({ originalControlId: 1 });
auditControlSnapshotSchema.index({ snapshottedAt: -1 });

const AuditControlSnapshot = mongoose.model('AuditControlSnapshot', auditControlSnapshotSchema);

export default AuditControlSnapshot;
