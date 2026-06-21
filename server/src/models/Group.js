import mongoose from 'mongoose';
import { GROUP_TYPE } from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

/**
 * Group Model (Tenant Domain)
 *
 * Used for group-based assignments (policy acknowledgements, ownership, etc.).
 */
const groupSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: GROUP_TYPE,
      default: 'CUSTOM',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Group slug is required'],
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    memberUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    personnelTaskSetId: {
      type: Schema.Types.ObjectId,
      ref: 'PersonnelTaskSet',
      default: null,
      index: true,
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
    collection: 'groups',
  }
);

groupSchema.index(
  { organizationId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
groupSchema.index({ organizationId: 1, isDeleted: 1, type: 1 });
groupSchema.index({ organizationId: 1, memberUserIds: 1 });

groupSchema.plugin(tenantPlugin);

const Group = mongoose.model('Group', groupSchema);

export default Group;
