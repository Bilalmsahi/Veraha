import Notification from '../models/Notification.js';

export async function notifyEvidenceRequestMessage({ requestId, auditId, fromRole, recipientUserId }) {
  if (!recipientUserId) return null;

  return Notification.create({
    user: recipientUserId,
    type: 'AUDIT_EVIDENCE_REQUEST_MESSAGE',
    title: 'New evidence request message',
    body: `${fromRole === 'AUDITOR' ? 'An auditor' : 'An internal user'} added a message to an audit evidence request.`,
    resourceType: 'AuditEvidenceRequest',
    resourceId: requestId,
    auditId,
  });
}

export async function getUnreadCount(userId) {
  return Notification.countDocuments({ user: userId, read: false });
}

export async function listNotifications(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 100);
  const filter = { user: userId };
  if (options.unreadOnly === true || options.unreadOnly === 'true') {
    filter.read = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    getUnreadCount(userId),
  ]);

  return { notifications, unreadCount };
}

export async function markAllNotificationsRead(userId) {
  await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
  return { unreadCount: 0 };
}

export async function markNotificationRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { read: true } },
    { new: true }
  ).lean();

  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }

  return notification;
}

export default {
  notifyEvidenceRequestMessage,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
