/**
 * Comment Model (Tenant Domain)
 * Generic comments for policies, controls, risks, etc.
 */
import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Policy', 'Control', 'Risk', 'Vendor', 'Evidence', 'Test'],
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ organizationId: 1, entityType: 1, entityId: 1 });
commentSchema.plugin(tenantPlugin);

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
