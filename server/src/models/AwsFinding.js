import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const AWS_FINDING_SEVERITY = ['critical', 'high', 'medium', 'low', 'informational'];
const AWS_AFFECTED_SERVICES = [
  'EC2',
  'S3',
  'IAM',
  'RDS',
  'CloudTrail',
  'VPC',
  'GuardDuty',
  'Inspector',
  'Lambda',
  'KMS',
  'CloudWatch',
  'Other',
];
const AWS_FINDING_STATUS = ['open', 'in_remediation', 'resolved', 'accepted_risk'];

const awsFindingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    awsAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'AwsAccount',
      required: [true, 'AWS Account ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    severity: {
      type: String,
      enum: AWS_FINDING_SEVERITY,
      required: [true, 'Severity is required'],
    },
    affectedService: {
      type: String,
      enum: AWS_AFFECTED_SERVICES,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    resourceType: {
      type: String,
      trim: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    detectedOn: {
      type: Date,
      required: [true, 'Detection date is required'],
    },
    status: {
      type: String,
      enum: AWS_FINDING_STATUS,
      default: 'open',
    },
    resolvedOn: {
      type: Date,
      default: null,
    },
    remediationNotes: {
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
    collection: 'awsfindings',
  }
);

awsFindingSchema.index({ organizationId: 1, status: 1 });
awsFindingSchema.index({ awsAccountId: 1, severity: 1 });
awsFindingSchema.index({ organizationId: 1, detectedOn: -1 });
awsFindingSchema.index({ organizationId: 1, isDeleted: 1 });

awsFindingSchema.plugin(tenantPlugin);

const AwsFinding = mongoose.model('AwsFinding', awsFindingSchema);

export default AwsFinding;
