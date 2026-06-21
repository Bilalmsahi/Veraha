import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { runOnce } from '../src/jobs/evidenceReminders.js';
import {
  ActivityLog,
  Audit,
  AuditEvidenceRequest,
  Organization,
  User,
} from '../src/models/index.js';

let mongo;
let sequence = 0;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  sequence = 0;
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

function unique(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

async function createOrg() {
  const name = unique('Reminder Org');
  return Organization.create({
    name,
    domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example.com`,
  });
}

async function createUser({ organizationId, email }) {
  return User.create({
    organizationId,
    email,
    password: 'ValidPassword123!',
    firstName: 'Reminder',
    lastName: 'User',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
  });
}

async function createAudit({ organizationId }) {
  return Audit.create({
    organizationId,
    name: 'SOC 2 Fieldwork',
    status: 'IN_PROGRESS',
    periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
}

async function createRequest({ organizationId, auditId, requestedBy, assignedTo, title }) {
  return AuditEvidenceRequest.create({
    organizationId,
    auditId,
    requestedBy,
    assignedTo,
    title,
    description: 'Please upload evidence.',
    status: 'OPEN',
    dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
  });
}

describe('evidence reminder job', () => {
  test('emails assigned users for overdue requests and skips unassigned requests', async () => {
    const organization = await createOrg();
    const requester = await createUser({
      organizationId: organization._id,
      email: 'requester@example.com',
    });
    const assigneeA = await createUser({
      organizationId: organization._id,
      email: 'assignee-a@example.com',
    });
    const assigneeB = await createUser({
      organizationId: organization._id,
      email: 'assignee-b@example.com',
    });
    const audit = await createAudit({ organizationId: organization._id });

    const remindedA = await createRequest({
      organizationId: organization._id,
      auditId: audit._id,
      requestedBy: requester._id,
      assignedTo: assigneeA._id,
      title: 'Access review evidence',
    });
    const remindedB = await createRequest({
      organizationId: organization._id,
      auditId: audit._id,
      requestedBy: requester._id,
      assignedTo: assigneeB._id,
      title: 'Policy approval evidence',
    });
    const unassigned = await createRequest({
      organizationId: organization._id,
      auditId: audit._id,
      requestedBy: requester._id,
      assignedTo: null,
      title: 'Unassigned evidence',
    });

    const sendEmail = jest.fn().mockResolvedValue({ success: true });

    const result = await runOnce({ sendEmail });

    expect(result.remindersSent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: assigneeA.email,
      text: expect.stringContaining("Evidence request 'Access review evidence' for audit 'SOC 2 Fieldwork'"),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: assigneeB.email,
      text: expect.stringContaining("Evidence request 'Policy approval evidence' for audit 'SOC 2 Fieldwork'"),
    }));

    const updatedA = await AuditEvidenceRequest.findById(remindedA._id);
    const updatedB = await AuditEvidenceRequest.findById(remindedB._id);
    const updatedUnassigned = await AuditEvidenceRequest.findById(unassigned._id);

    expect(updatedA.lastReminderSentAt).toBeInstanceOf(Date);
    expect(updatedB.lastReminderSentAt).toBeInstanceOf(Date);
    expect(updatedUnassigned.lastReminderSentAt).toBeNull();

    const logs = await ActivityLog.find({
      action: 'REMINDER_SENT',
      entityType: 'AuditEvidenceRequest',
    }).lean();
    expect(logs).toHaveLength(2);
    expect(logs.map((log) => log.metadata.recipientEmail).sort()).toEqual([
      assigneeA.email,
      assigneeB.email,
    ].sort());
  });

  test('does not mark reminders as sent when email delivery fails', async () => {
    const organization = await createOrg();
    const requester = await createUser({
      organizationId: organization._id,
      email: 'failed-requester@example.com',
    });
    const assignee = await createUser({
      organizationId: organization._id,
      email: 'failed-assignee@example.com',
    });
    const audit = await createAudit({ organizationId: organization._id });
    const request = await createRequest({
      organizationId: organization._id,
      auditId: audit._id,
      requestedBy: requester._id,
      assignedTo: assignee._id,
      title: 'Failed delivery evidence',
    });

    const sendEmail = jest.fn().mockResolvedValue({
      success: false,
      error: 'delivery unavailable',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runOnce({ sendEmail });

    expect(result.remindersSent).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[evidence-reminders] email delivery failed:',
      expect.objectContaining({
        requestId: request._id.toString(),
        recipientEmail: assignee.email,
        error: 'delivery unavailable',
      })
    );

    const updated = await AuditEvidenceRequest.findById(request._id);
    expect(updated.lastReminderSentAt).toBeNull();

    const logs = await ActivityLog.find({
      action: 'REMINDER_SENT',
      entityType: 'AuditEvidenceRequest',
      entityId: request._id,
    }).lean();
    expect(logs).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
