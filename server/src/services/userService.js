import User from '../models/User.js';
import { logCrudOperation } from './activityLogger.js';
import { latestInvitationByUserIds, resendInvitation, revokeInvitation } from './invitationService.js';

/**
 * List users for an organization
 */
export const listUsers = async (organizationId, options) => {
  const { page = 1, limit = 20, role, status, search, sortBy = 'firstName', sortOrder = 'asc' } = options;

  const query = { organizationId, isDeleted: { $ne: true } };

  if (role) query.role = role;
  if (status) query.status = status;

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('firstName lastName email role status lastLoginAt lastActivityAt createdAt invitedAt')
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const invitationByUserId = await latestInvitationByUserIds(users.map((user) => user._id));
  const now = Date.now();
  const inactivityThresholdMs = Number(process.env.MEMBER_INACTIVE_THRESHOLD_MS || 24 * 60 * 60 * 1000);
  const enrichedUsers = users.map((user) => {
    const invitation = invitationByUserId.get(user._id.toString());
    const activityAt = user.lastActivityAt || user.lastLoginAt;
    const isActiveMember = user.status === 'ACTIVE' && activityAt && now - new Date(activityAt).getTime() <= inactivityThresholdMs;
    return {
      ...user,
      invitationStatus: invitation?.status || (user.status === 'ACTIVE' ? 'COMPLETED' : null),
      invitationSentAt: invitation?.sentAt || user.invitedAt || null,
      invitationExpiresAt: invitation?.expiresAt || null,
      invitationLastActivityAt: invitation?.lastActivityAt || null,
      memberState: user.status === 'SUSPENDED' ? 'DISABLED' : user.status === 'ACTIVE' ? 'ACTIVE' : invitation?.status === 'REVOKED' ? 'REVOKED' : 'INVITED',
      activeState: isActiveMember ? 'ACTIVE' : 'INACTIVE',
    };
  });

  const pages = Math.ceil(total / limit);

  return {
    users: enrichedUsers,
    pagination: { page, limit, total, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
};

/**
 * Get a single user by ID within the same org
 */
export const getUserById = async (userId, organizationId) => {
  const user = await User.findOne({
    _id: userId,
    organizationId,
    isDeleted: { $ne: true },
  })
    .select('firstName lastName email role status lastLoginAt loginCount createdAt invitedAt invitedBy')
    .populate('invitedBy', 'firstName lastName email')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

/**
 * Update user role (Admin only, cannot change own role)
 */
export const updateRole = async (userId, newRole, actor) => {
  if (userId === actor._id.toString()) {
    const error = new Error('Cannot change your own role');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({
    _id: userId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const previousRole = user.role;
  user.role = newRole;
  await user.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user._id,
    entitySnapshot: { name: `${user.firstName} ${user.lastName}`, previousRole, newRole },
  });

  return user;
};

/**
 * Deactivate a user (soft delete)
 */
export const deactivateUser = async (userId, actor) => {
  if (userId === actor._id.toString()) {
    const error = new Error('Cannot deactivate yourself');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({
    _id: userId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.status = 'SUSPENDED';
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletedBy = actor._id;
  await user.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'DELETE',
    entityType: 'User',
    entityId: user._id,
    entitySnapshot: { name: `${user.firstName} ${user.lastName}`, action: 'deactivated' },
  });

  return { deactivated: true };
};

/**
 * Reactivate a deactivated user
 */
export const reactivateUser = async (userId, actor) => {
  const user = await User.findOne({
    _id: userId,
    organizationId: actor.organizationId,
  }).setOptions({ includeDeleted: true });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.status = 'ACTIVE';
  user.isDeleted = false;
  user.deletedAt = null;
  user.deletedBy = null;
  await user.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user._id,
    entitySnapshot: { name: `${user.firstName} ${user.lastName}`, action: 'reactivated' },
  });

  return user;
};

export const resendUserInvitation = async (userId, actor) => {
  return resendInvitation(userId, actor);
};

export const revokeUserInvitation = async (userId, actor) => {
  return revokeInvitation(userId, actor);
};

export default {
  listUsers,
  getUserById,
  updateRole,
  deactivateUser,
  reactivateUser,
  resendUserInvitation,
  revokeUserInvitation,
};
