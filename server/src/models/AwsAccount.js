import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const ENVIRONMENT_TYPE = ['production', 'staging', 'development', 'other'];
const AWS_ACCOUNT_STATUS = ['active', 'inactive', 'unverified'];

const awsAccountSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    awsAccountId: {
      type: String,
      required: [true, 'AWS Account ID is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{12}$/.test(v);
        },
        message: 'AWS Account ID must be exactly 12 digits',
      },
    },
    regions: {
      type: [String],
      default: [],
    },
    environmentType: {
      type: String,
      enum: ENVIRONMENT_TYPE,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: AWS_ACCOUNT_STATUS,
      default: 'active',
    },
    notes: {
      type: String,
      trim: true,
    },
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    collection: 'awsaccounts',
  }
);

awsAccountSchema.index({ organizationId: 1, awsAccountId: 1 }, { unique: true });
awsAccountSchema.index({ organizationId: 1, status: 1 });
awsAccountSchema.index({ organizationId: 1, isDeleted: 1 });

awsAccountSchema.plugin(tenantPlugin);

const AwsAccount = mongoose.model('AwsAccount', awsAccountSchema);

export default AwsAccount;
