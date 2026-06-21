import cron from 'node-cron';
import { AuditEvidenceRequest } from '../models/index.js';
import { sendEmail as defaultSendEmail } from '../services/emailService.js';
import { logActivity } from '../services/activityLogger.js';

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCHEDULE = '0 8 * * *';

function formatDueDate(dueDate) {
  return dueDate instanceof Date ? dueDate.toISOString() : new Date(dueDate).toISOString();
}

function buildReminderBody(request) {
  const auditName = request.auditId?.name || 'Unknown audit';
  return `Evidence request '${request.title}' for audit '${auditName}' was due on ${formatDueDate(request.dueDate)}. Please submit the required evidence as soon as possible.`;
}

export async function runOnce({ sendEmail = defaultSendEmail, now = new Date() } = {}) {
  const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);

  const overdueRequests = await AuditEvidenceRequest.find({
    status: { $ne: 'COMPLETED' },
    dueDate: { $lt: now },
    isDeleted: { $ne: true },
    $or: [
      { lastReminderSentAt: null },
      { lastReminderSentAt: { $exists: false } },
      { lastReminderSentAt: { $lt: reminderCutoff } },
    ],
  })
    .populate('assignedTo', 'email firstName lastName')
    .populate('auditId', 'name')
    .exec();

  let remindersSent = 0;

  for (const request of overdueRequests) {
    const recipientEmail = request.assignedTo?.email;
    if (!recipientEmail) {
      continue;
    }

    const body = buildReminderBody(request);
    const result = await sendEmail({
      to: recipientEmail,
      toName: request.assignedTo.fullName,
      subject: `Overdue evidence request: ${request.title}`,
      text: body,
    });

    if (result?.success === false) {
      console.error('[evidence-reminders] email delivery failed:', {
        requestId: request._id.toString(),
        recipientEmail,
        error: result.error,
      });
      continue;
    }

    request.lastReminderSentAt = now;
    await request.save();

    await logActivity({
      organizationId: request.organizationId,
      actorId: null,
      action: 'REMINDER_SENT',
      entityType: 'AuditEvidenceRequest',
      entityId: request._id,
      entitySnapshot: {
        title: request.title,
      },
      metadata: {
        recipientEmail,
      },
    });

    remindersSent += 1;
  }

  console.log(`[evidence-reminders] Sent ${remindersSent} overdue evidence reminder(s)`);
  return { remindersSent };
}

export function startEvidenceReminderJob() {
  cron.schedule(SCHEDULE, async () => {
    try {
      await runOnce();
    } catch (error) {
      console.error('[evidence-reminders] job failed:', error);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[evidence-reminders] Registered daily scheduler at 08:00 UTC');
}

export default {
  runOnce,
  startEvidenceReminderJob,
};
