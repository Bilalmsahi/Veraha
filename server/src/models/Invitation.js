import mongoose from 'mongoose';
import { ROLE, INVITATION_STATUS } from './enums.js';

const { Schema } = mongoose;

const invitationSchema = new Schema(
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
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ROLE,
      required: true,
    },
    status: {
      type: String,
      enum: INVITATION_STATUS,
      default: 'PENDING',
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    firstAccessedAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    lastResentAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true,
    collection: 'invitations',
  },
);

invitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { partialFilterExpression: { status: { $in: ['PENDING', 'ACCESSED'] } } },
);
invitationSchema.index({ organizationId: 1, status: 1, expiresAt: 1 });
invitationSchema.index({ userId: 1, createdAt: -1 });

invitationSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.tokenHash;
    return ret;
  },
});

invitationSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.tokenHash;
    return ret;
  },
});

const Invitation = mongoose.model('Invitation', invitationSchema);

export default Invitation;
