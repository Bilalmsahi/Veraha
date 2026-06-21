import mongoose from 'mongoose';
import { OFFBOARDING_STATUS, OFFBOARDING_TYPE } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const offboardingEventSchema = new Schema(
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
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    offboardingType: {
      type: String,
      enum: OFFBOARDING_TYPE,
      default: 'PERMANENT',
      index: true,
    },
    status: {
      type: String,
      enum: OFFBOARDING_STATUS,
      default: 'OPEN',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
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
    collection: 'offboarding_events',
  }
);

offboardingEventSchema.index({ organizationId: 1, userId: 1, status: 1 });
offboardingEventSchema.plugin(tenantPlugin);

const OffboardingEvent = mongoose.model('OffboardingEvent', offboardingEventSchema);

export default OffboardingEvent;
