import mongoose from 'mongoose';
import {
  PERSONNEL_TASK_ASSIGNEE,
  PERSONNEL_TASK_LIFECYCLE,
  PERSONNEL_TASK_RECURRENCE_MODE,
  PERSONNEL_TASK_TYPE,
} from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const personnelTaskRequirementSchema = new Schema(
  {
    organizationId: {
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
    type: {
      type: String,
      enum: PERSONNEL_TASK_TYPE,
      required: true,
      index: true,
    },
    lifecycle: {
      type: String,
      enum: PERSONNEL_TASK_LIFECYCLE,
      default: 'ONBOARDING',
      index: true,
    },
    dueDays: {
      type: Number,
      min: 0,
      default: 14,
    },
    recurrenceMode: {
      type: String,
      enum: PERSONNEL_TASK_RECURRENCE_MODE,
      default: 'NONE',
    },
    recurrenceDays: {
      type: Number,
      min: 1,
      default: null,
    },
    assignedTo: {
      type: String,
      enum: PERSONNEL_TASK_ASSIGNEE,
      default: 'EMPLOYEE',
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
      index: true,
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
    collection: 'personnel_task_requirements',
  }
);

personnelTaskRequirementSchema.index({ organizationId: 1, active: 1, type: 1 });
personnelTaskRequirementSchema.plugin(tenantPlugin);

const PersonnelTaskRequirement = mongoose.model(
  'PersonnelTaskRequirement',
  personnelTaskRequirementSchema
);

export default PersonnelTaskRequirement;
