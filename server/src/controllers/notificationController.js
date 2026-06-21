import notificationService from '../services/notificationService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

/**
 * List notifications for the authenticated user, including unread count.
 */
export const listNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark one notification as read for the authenticated user.
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationRead(req.params.id, req.user._id);
    return sendSuccess(res, notification);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for the authenticated user.
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user._id);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export default {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
