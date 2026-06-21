import mongoose from 'mongoose';
import { PERSONNEL_TASK_STATUS } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const personnelTaskStateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: 'PersonnelTaskRequirement',
      required: true,
      index: true,
    },
    cycleKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    cycleIndex: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: PERSONNEL_TASK_STATUS,
      default: 'PENDING',
      index: true,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    evidenceVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'EvidenceVersion',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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
    collection: 'personnel_task_states',
  }
);

personnelTaskStateSchema.index(
  { organizationId: 1, userId: 1, requirementId: 1, cycleKey: 1 },
  { unique: true }
);
personnelTaskStateSchema.plugin(tenantPlugin);

const PersonnelTaskState = mongoose.model('PersonnelTaskState', personnelTaskStateSchema);

export default PersonnelTaskState;
