/**
 * Comment Service
 * CRUD for entity comments (Policy, Control, Risk, etc.)
 */
import Comment from '../models/Comment.js';

export const getComments = async (organizationId, entityType, entityId, { page = 1, limit = 50 } = {}) => {
  const query = {
    organizationId,
    entityType,
    entityId,
  };

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'firstName lastName email')
      .lean(),
    Comment.countDocuments(query),
  ]);

  const pages = Math.ceil(total / limit) || 1;
  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
};

export const createComment = async (organizationId, entityType, entityId, userId, content) => {
  const comment = await Comment.create({
    organizationId,
    entityType,
    entityId,
    userId,
    content: content.trim(),
  });
  await comment.populate('userId', 'firstName lastName email');
  return comment;
};

export default {
  getComments,
  createComment,
};
