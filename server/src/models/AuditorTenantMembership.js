import mongoose from 'mongoose';

const { Schema } = mongoose;

export const AUDITOR_TENANT_MEMBERSHIP_STATUS = ['ACTIVE', 'SUSPENDED'];

const auditorTenantMembershipSchema = new Schema(
  {
    auditorProfile: {
      type: Schema.Types.ObjectId,
      ref: 'AuditorProfile',
      required: true,
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: AUDITOR_TENANT_MEMBERSHIP_STATUS,
      default: 'ACTIVE',
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'auditortenantmemberships',
  }
);

auditorTenantMembershipSchema.index(
  { auditorProfile: 1, organization: 1 },
  { unique: true }
);

auditorTenantMembershipSchema.virtual('isActive').get(function () {
  return this.status === 'ACTIVE';
});

const AuditorTenantMembership = mongoose.model(
  'AuditorTenantMembership',
  auditorTenantMembershipSchema
);

export default AuditorTenantMembership;
