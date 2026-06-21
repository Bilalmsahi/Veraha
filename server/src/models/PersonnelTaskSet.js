import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const personnelTaskSetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    requirementIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PersonnelTaskRequirement',
      },
    ],
    active: {
      type: Boolean,
      default: true,
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
    collection: 'personnel_task_sets',
  }
);

personnelTaskSetSchema.index({ organizationId: 1, active: 1, name: 1 });
personnelTaskSetSchema.plugin(tenantPlugin);

const PersonnelTaskSet = mongoose.model('PersonnelTaskSet', personnelTaskSetSchema);

export default PersonnelTaskSet;
