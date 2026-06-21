import userService from '../services/userService.js';
import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';

export const listUsers = async (req, res, next) => {
  try {
    const queryParams = req.validatedQuery || req.query;
    const { users, pagination } = await userService.listUsers(
      req.user.organizationId,
      queryParams
    );
    return sendPaginated(res, users, pagination);
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id, req.user.organizationId);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const user = await userService.updateRole(req.params.id, req.body.role, {
      _id: req.user._id,
      organizationId: req.user.organizationId,
    });
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const result = await userService.deactivateUser(req.params.id, {
      _id: req.user._id,
      organizationId: req.user.organizationId,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const reactivateUser = async (req, res, next) => {
  try {
    const user = await userService.reactivateUser(req.params.id, {
      _id: req.user._id,
      organizationId: req.user.organizationId,
    });
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const resendInvitation = async (req, res, next) => {
  try {
    const invitation = await userService.resendUserInvitation(req.params.id, req.user);
    return sendSuccess(res, { invitation, message: 'Invitation resent successfully' });
  } catch (error) {
    next(error);
  }
};

export const revokeInvitation = async (req, res, next) => {
  try {
    const invitation = await userService.revokeUserInvitation(req.params.id, req.user);
    return sendSuccess(res, { invitation, message: 'Invitation revoked successfully' });
  } catch (error) {
    next(error);
  }
};

export default {
  listUsers,
  getUser,
  updateRole,
  deactivateUser,
  reactivateUser,
  resendInvitation,
  revokeInvitation,
};
