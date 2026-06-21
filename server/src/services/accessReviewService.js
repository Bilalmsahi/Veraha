import AccessReviewCampaign from '../models/AccessReviewCampaign.js';
import AccessReviewTask from '../models/AccessReviewTask.js';
import User from '../models/User.js';
import { logCrudOperation } from './activityLogger.js';
import { sendNotificationEmail } from './emailService.js';

function makeError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function buildTaskSummary(tasks) {
  const summary = {
    PENDING: 0,
    APPROVED: 0,
    REVOKE_REQUESTED: 0,
    ESCALATED: 0,
    REVOKED: 0,
  };
  for (const task of tasks) {
    if (summary[task.status] !== undefined) {
      summary[task.status] += 1;
    }
  }
  return summary;
}

async function refreshCampaignCounts(campaignId, organizationId) {
  const [totalTasks, completedTasks] = await Promise.all([
    AccessReviewTask.countDocuments({ campaignId, organizationId, isDeleted: { $ne: true } }),
    AccessReviewTask.countDocuments({
      campaignId,
      organizationId,
      isDeleted: { $ne: true },
      status: { $ne: 'PENDING' },
    }),
  ]);

  const campaign = await AccessReviewCampaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) return null;
  campaign.totalTasks = totalTasks;
  campaign.completedTasks = completedTasks;
  if (totalTasks > 0 && completedTasks === totalTasks && campaign.status === 'ACTIVE') {
    campaign.status = 'COMPLETED';
    campaign.completedAt = new Date();
  }
  await campaign.save();
  return campaign;
}

export async function listCampaigns(organizationId) {
  return AccessReviewCampaign.find({ organizationId, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'firstName lastName email')
    .lean();
}

export async function createCampaign(data, actor) {
  const campaign = await AccessReviewCampaign.create({
    organizationId: actor.organizationId,
    name: data.name,
    description: data.description || '',
    dueDate: data.dueDate,
    reviewerType: data.reviewerType || 'MANAGER',
    resourceType: data.resourceType || 'Platform',
    resourceName: data.resourceName || '',
    createdBy: actor._id,
    status: 'DRAFT',
  });

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'AccessReviewCampaign',
    entityId: campaign._id,
    entitySnapshot: { title: campaign.name },
  });

  return campaign;
}

export async function getCampaign(campaignId, organizationId) {
  const campaign = await AccessReviewCampaign.findOne({
    _id: campaignId,
    organizationId,
    isDeleted: { $ne: true },
  })
    .populate('createdBy', 'firstName lastName email')
    .lean();
  if (!campaign) throw makeError('Access review campaign not found', 404);

  const tasks = await AccessReviewTask.find({ campaignId, organizationId, isDeleted: { $ne: true } })
    .sort({ status: 1, createdAt: 1 })
    .populate('subjectUserId', 'firstName lastName email role status')
    .populate('reviewerId', 'firstName lastName email role')
    .populate('revocationConfirmedBy', 'firstName lastName email')
    .lean();

  const taskSummary = buildTaskSummary(tasks);

  return { ...campaign, tasks, taskSummary };
}

export async function activateCampaign(campaignId, actor) {
  const campaign = await AccessReviewCampaign.findOne({
    _id: campaignId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!campaign) throw makeError('Access review campaign not found', 404);
  if (campaign.status !== 'DRAFT') throw makeError('Only draft campaigns can be activated', 400);

  const resourceType = campaign.resourceType || 'Platform';
  const resourceName = campaign.resourceName || 'Platform access';

  const [subjects, reviewers] = await Promise.all([
    User.find({
      organizationId: actor.organizationId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: { $ne: 'AUDITOR' },
    }).lean(),
    User.find({
      organizationId: actor.organizationId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: campaign.reviewerType === 'ADMIN' ? 'ADMIN' : { $in: ['ADMIN', 'MANAGER'] },
    }).lean(),
  ]);

  const fallbackReviewer = reviewers.find((user) => String(user._id) === String(actor._id)) || reviewers[0];
  if (!fallbackReviewer) throw makeError('No eligible reviewers found', 400);

  const tasks = subjects.map((subject) => ({
    organizationId: actor.organizationId,
    campaignId: campaign._id,
    subjectUserId: subject._id,
    reviewerId: fallbackReviewer._id,
    resourceType,
    resourceName,
    accessRole: subject.role,
  }));

  if (tasks.length > 0) {
    await AccessReviewTask.insertMany(tasks, { ordered: false }).catch((error) => {
      if (error.code !== 11000) throw error;
    });
  }

  campaign.status = 'ACTIVE';
  campaign.activatedAt = new Date();
  await campaign.save();
  await refreshCampaignCounts(campaign._id, actor.organizationId);

  await sendNotificationEmail(
    fallbackReviewer.email,
    `${fallbackReviewer.firstName} ${fallbackReviewer.lastName}`,
    `Access review started: ${campaign.name}`,
    `An access review campaign "${campaign.name}" is ready for your review.`
  );

  return getCampaign(campaign._id, actor.organizationId);
}

export async function archiveCampaign(campaignId, actor) {
  const campaign = await AccessReviewCampaign.findOne({
    _id: campaignId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!campaign) throw makeError('Access review campaign not found', 404);
  if (campaign.status !== 'COMPLETED') {
    throw makeError('Only completed campaigns can be archived', 400);
  }

  campaign.status = 'ARCHIVED';
  await campaign.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'STATUS_CHANGE',
    entityType: 'AccessReviewCampaign',
    entityId: campaign._id,
    entitySnapshot: { title: campaign.name },
    after: { status: 'ARCHIVED' },
    changedFields: ['status'],
  });

  return campaign;
}

export async function deleteCampaign(campaignId, actor) {
  const campaign = await AccessReviewCampaign.findOne({
    _id: campaignId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!campaign) throw makeError('Access review campaign not found', 404);
  if (campaign.status !== 'DRAFT') {
    throw makeError('Only draft campaigns can be deleted', 400);
  }

  campaign.isDeleted = true;
  campaign.deletedAt = new Date();
  campaign.deletedBy = actor._id;
  await campaign.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'DELETE',
    entityType: 'AccessReviewCampaign',
    entityId: campaign._id,
    entitySnapshot: { title: campaign.name },
  });

  return { deleted: true };
}

export async function listMyTasks(actor, query = {}) {
  const filter = {
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  };
  if (actor.role !== 'ADMIN') filter.reviewerId = actor._id;
  if (query.status) filter.status = query.status;
  if (query.campaignId) filter.campaignId = query.campaignId;

  return AccessReviewTask.find(filter)
    .sort({ createdAt: -1 })
    .populate('campaignId', 'name dueDate status')
    .populate('subjectUserId', 'firstName lastName email role status')
    .populate('reviewerId', 'firstName lastName email role')
    .lean();
}

export async function decideTask(taskId, data, actor) {
  const task = await AccessReviewTask.findOne({
    _id: taskId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!task) throw makeError('Access review task not found', 404);
  if (actor.role !== 'ADMIN' && String(task.reviewerId) !== String(actor._id)) {
    throw makeError('You are not the reviewer for this task', 403);
  }

  const canDecidePending = task.status === 'PENDING';
  const canResolveEscalated = task.status === 'ESCALATED' && actor.role === 'ADMIN';
  if (!canDecidePending && !canResolveEscalated) {
    throw makeError('This task cannot be decided in its current state', 400);
  }

  const decision = data.decision;
  if (decision === 'APPROVE') task.status = 'APPROVED';
  else if (decision === 'REVOKE') task.status = 'REVOKE_REQUESTED';
  else if (decision === 'ESCALATE') task.status = 'ESCALATED';
  else throw makeError('Invalid access review decision', 400);

  task.decision = decision;
  task.decisionNotes = data.notes || '';
  task.decidedAt = new Date();
  await task.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'STATUS_CHANGE',
    entityType: 'AccessReviewTask',
    entityId: task._id,
    entitySnapshot: { title: task.resourceName, identifier: task.accessRole },
    after: { status: task.status, decision },
    changedFields: ['status', 'decision', 'decisionNotes', 'decidedAt'],
  });

  await refreshCampaignCounts(task.campaignId, actor.organizationId);
  return task;
}

export async function reassignTask(taskId, reviewerId, actor) {
  const task = await AccessReviewTask.findOne({
    _id: taskId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!task) throw makeError('Access review task not found', 404);

  const reviewer = await User.findOne({
    _id: reviewerId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    role: { $ne: 'AUDITOR' },
  }).lean();
  if (!reviewer) throw makeError('Reviewer must be an active internal user', 400);

  const previousReviewerId = task.reviewerId;
  task.reviewerId = reviewer._id;
  await task.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AccessReviewTask',
    entityId: task._id,
    entitySnapshot: { title: task.resourceName, identifier: task.accessRole },
    after: { reviewerId: reviewer._id },
    changedFields: ['reviewerId'],
  });

  return AccessReviewTask.findById(task._id)
    .populate('subjectUserId', 'firstName lastName email role status')
    .populate('reviewerId', 'firstName lastName email role')
    .lean();
}

export async function confirmRevocation(taskId, actor) {
  const task = await AccessReviewTask.findOne({
    _id: taskId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!task) throw makeError('Access review task not found', 404);
  if (task.status !== 'REVOKE_REQUESTED') {
    throw makeError('Only revoke-requested tasks can be confirmed', 400);
  }

  task.revocationConfirmedAt = new Date();
  task.revocationConfirmedBy = actor._id;
  task.status = 'REVOKED';
  await task.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AccessReviewTask',
    entityId: task._id,
    entitySnapshot: { title: task.resourceName, identifier: task.accessRole },
    after: { revocationConfirmedAt: task.revocationConfirmedAt, status: 'REVOKED' },
    changedFields: ['revocationConfirmedAt', 'revocationConfirmedBy', 'status'],
  });

  await refreshCampaignCounts(task.campaignId, actor.organizationId);
  return task;
}

export default {
  listCampaigns,
  createCampaign,
  getCampaign,
  activateCampaign,
  archiveCampaign,
  deleteCampaign,
  listMyTasks,
  decideTask,
  reassignTask,
  confirmRevocation,
};
