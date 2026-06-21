import mongoose from 'mongoose';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Policy from '../models/Policy.js';
import PolicyAttestation from '../models/PolicyAttestation.js';
import Device from '../models/Device.js';
import DeviceEvidence from '../models/DeviceEvidence.js';
import PersonnelTaskRequirement from '../models/PersonnelTaskRequirement.js';
import PersonnelTaskSet from '../models/PersonnelTaskSet.js';
import PersonnelTaskState from '../models/PersonnelTaskState.js';
import TrainingModule from '../models/TrainingModule.js';
import TrainingAttempt from '../models/TrainingAttempt.js';
import Evidence from '../models/Evidence.js';
import { storageService } from './storageService.js';
import Organization from '../models/Organization.js';
import Framework from '../models/Framework.js';
import {
  normalizeChecklistItems,
  getChecklistItemStatus,
} from '../constants/deviceSettingsChecklist.js';
import { sanitizeDeviceEvidence } from './deviceService.js';
import { logCrudOperation } from './activityLogger.js';
import { getTargetUsers } from './policyWorkflowService.js';
import {
  getOrCreateTrainingAttempt,
  getTrainingQuizResult,
  prepareNewQuizRetake,
  serializeAttemptSummary,
  startTrainingQuiz,
  submitTrainingQuiz as submitTrainingQuizSession,
} from './trainingQuizService.js';

const PERSONNEL_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
const ADMIN_ROLES = ['ADMIN', 'MANAGER'];

function isOverdue(dueDate, status) {
  return Boolean(dueDate && new Date(dueDate) < new Date() && !['COMPLETE', 'REJECTED'].includes(status));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + Number(hours || 0));
  return next;
}

async function getOrgTimezone(organizationId) {
  const org = await Organization.findById(organizationId).select('settings.timezone').lean();
  return org?.settings?.timezone || 'UTC';
}

async function getEnabledFrameworkCodes(organizationId) {
  const org = await Organization.findById(organizationId).select('settings.enabledFrameworks').lean();
  const frameworkIds = org?.settings?.enabledFrameworks || [];
  if (frameworkIds.length === 0) return null;
  const frameworks = await Framework.find({ _id: { $in: frameworkIds }, isActive: true }).select('code').lean();
  return new Set(frameworks.map((framework) => String(framework.code).toUpperCase()));
}

function moduleMatchesEnabledFrameworks(module, enabledFrameworkCodes) {
  if (!enabledFrameworkCodes) return true;
  const tags = module.frameworkTags || [];
  return tags.some((tag) => enabledFrameworkCodes.has(String(tag).toUpperCase()));
}

function getFixedAnnualCycleKey(timezone) {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(new Date());
  return `year:${year}`;
}

function serializeUser(user) {
  return {
    _id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function serializeTask(task) {
  const status = isOverdue(task.dueDate, task.status) ? 'OVERDUE' : task.status;
  return { ...task, status };
}

async function getAssignedRequirements(userId, organizationId) {
  const groups = await Group.find({
    organizationId,
    isDeleted: { $ne: true },
    memberUserIds: userId,
    personnelTaskSetId: { $ne: null },
  })
    .select('personnelTaskSetId')
    .lean();

  const taskSetIds = [...new Set(groups.map((g) => String(g.personnelTaskSetId)).filter(Boolean))];
  if (!taskSetIds.length) return [];

  const taskSets = await PersonnelTaskSet.find({
    organizationId,
    active: true,
    isDeleted: { $ne: true },
    _id: { $in: taskSetIds },
  })
    .select('requirementIds')
    .lean();

  const requirementIds = [
    ...new Set(taskSets.flatMap((set) => set.requirementIds || []).map(String).filter(Boolean)),
  ];
  if (!requirementIds.length) return [];

  return PersonnelTaskRequirement.find({
    organizationId,
    active: true,
    isDeleted: { $ne: true },
    _id: { $in: requirementIds },
  }).lean();
}

async function getStateByRequirement(userId, organizationId, requirements, timezone) {
  const keys = requirements.map((requirement) => {
    if (requirement.recurrenceMode === 'FIXED_ANNUAL') return getFixedAnnualCycleKey(timezone);
    if (requirement.recurrenceMode === 'ROLLING') {
      return null;
    }
    return `onboarding:${userId}:${requirement._id}`;
  });

  const query = {
    organizationId,
    userId,
    requirementId: { $in: requirements.map((r) => r._id) },
    isDeleted: { $ne: true },
  };

  const states = await PersonnelTaskState.find(query).lean();
  const byRequirement = new Map();
  for (const state of states) {
    const key = String(state.requirementId);
    const requirement = requirements.find((r) => String(r._id) === key);
    const expectedKey = requirement?.recurrenceMode === 'ROLLING'
      ? state.cycleKey
      : keys[requirements.findIndex((r) => String(r._id) === key)];
    if (state.cycleKey !== expectedKey && requirement?.recurrenceMode !== 'ROLLING') continue;
    const existing = byRequirement.get(key);
    if (!existing || Number(state.cycleIndex || 0) > Number(existing.cycleIndex || 0)) {
      byRequirement.set(key, state);
    }
  }
  return byRequirement;
}

async function buildRequirementTasks(user, organizationId) {
  const timezone = await getOrgTimezone(organizationId);
  const requirements = await getAssignedRequirements(user._id, organizationId);
  if (!requirements.length) return [];

  const stateByRequirement = await getStateByRequirement(user._id, organizationId, requirements, timezone);
  const trainingModuleIds = requirements
    .filter((r) => r.type === 'TRAINING' && r.config?.moduleId)
    .map((r) => r.config.moduleId);
  const trainingModules = trainingModuleIds.length
    ? await TrainingModule.find({ organizationId, _id: { $in: trainingModuleIds }, active: true }).lean()
    : [];
  const trainingById = new Map(trainingModules.map((m) => [String(m._id), m]));

  const attempts = trainingModules.length
    ? await TrainingAttempt.find({
        organizationId,
        userId: user._id,
        moduleId: { $in: trainingModules.map((m) => m._id) },
      }).lean()
    : [];
  const attemptByModule = new Map(attempts.map((a) => [String(a.moduleId), a]));

  return requirements.map((requirement) => {
    const state = stateByRequirement.get(String(requirement._id));
    const cycleKey = requirement.recurrenceMode === 'FIXED_ANNUAL'
      ? getFixedAnnualCycleKey(timezone)
      : requirement.recurrenceMode === 'ROLLING'
        ? state?.cycleKey || `rolling:${user._id}:${requirement._id}:0`
        : `onboarding:${user._id}:${requirement._id}`;

    let status = state?.status || 'PENDING';
    let completedAt = state?.completedAt || null;
    const metadata = {};

    if (requirement.type === 'TRAINING' && requirement.config?.moduleId) {
      const module = trainingById.get(String(requirement.config.moduleId));
      const attempt = attemptByModule.get(String(requirement.config.moduleId));
      metadata.module = module
        ? { _id: String(module._id), title: module.title, version: module.version }
        : null;
      metadata.readProgressPercent = attempt?.readProgressPercent || 0;
      metadata.quizScore = attempt?.quizScore ?? null;
      metadata.attempts = attempt?.attempts || 0;
      if (attempt?.passedAt) {
        status = 'COMPLETE';
        completedAt = attempt.passedAt;
      } else if ((attempt?.readProgressPercent || 0) > 0) {
        status = 'IN_PROGRESS';
      }
    }

    const assignedAt = user.createdAt || requirement.createdAt;
    const dueDate = requirement.dueDays != null ? addDays(assignedAt, requirement.dueDays) : null;

    return serializeTask({
      id: `requirement:${requirement._id}:${cycleKey}`,
      source: 'REQUIREMENT',
      requirementId: String(requirement._id),
      title: requirement.title,
      description: requirement.description || '',
      type: requirement.type,
      lifecycle: requirement.lifecycle,
      assignedTo: requirement.assignedTo,
      cycleKey,
      status,
      dueDate,
      completedAt,
      metadata,
    });
  });
}

async function buildPolicyTasks(user, organizationId) {
  const policies = await Policy.find({
    organizationId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    requiresAttestation: true,
    currentVersionId: { $ne: null },
  })
    .populate('currentVersionId', 'versionNumber effectiveDate contentHash')
    .lean();

  const targeted = [];
  for (const policy of policies) {
    const targets = await getTargetUsers(policy);
    if (targets.some((target) => String(target._id) === String(user._id))) {
      targeted.push(policy);
    }
  }
  if (!targeted.length) return [];

  const attestations = await PolicyAttestation.find({
    userId: user._id,
    policyVersionId: { $in: targeted.map((p) => p.currentVersionId?._id).filter(Boolean) },
  }).lean();
  const attestedByVersion = new Map(attestations.map((a) => [String(a.policyVersionId), a]));

  return targeted.map((policy) => {
    const version = policy.currentVersionId;
    const attestation = attestedByVersion.get(String(version._id));
    const cycleKey = `policyVersion:${version._id}`;
    return serializeTask({
      id: `policy:${policy._id}:${cycleKey}`,
      source: 'POLICY',
      policyId: String(policy._id),
      policyVersionId: String(version._id),
      title: policy.title,
      description: policy.description || '',
      type: 'POLICY_ACK',
      lifecycle: 'RECURRING',
      assignedTo: 'EMPLOYEE',
      cycleKey,
      status: attestation ? 'COMPLETE' : 'PENDING',
      dueDate: null,
      completedAt: attestation?.attestedAt || null,
      metadata: {
        versionNumber: version.versionNumber,
        attestationId: attestation ? String(attestation._id) : null,
      },
    });
  });
}

async function buildDeviceTasks(user, organizationId) {
  const devices = await Device.find({
    organizationId,
    isDeleted: { $ne: true },
    assignedUserId: user._id,
  }).lean();
  if (!devices.length) return [];

  const evidence = await DeviceEvidence.find({
    organizationId,
    deviceId: { $in: devices.map((d) => d._id) },
  })
    .sort({ uploadedAt: -1 })
    .lean();
  const latestEvidenceByDevice = new Map();
  for (const item of evidence) {
    const key = String(item.deviceId);
    if (!latestEvidenceByDevice.has(key)) latestEvidenceByDevice.set(key, item);
  }

  return devices.map((device) => {
    const item = latestEvidenceByDevice.get(String(device._id));
    const checklistItems = normalizeChecklistItems(item);
    const status =
      item?.reviewStatus === 'SUBMITTED'
        ? 'AWAITING_REVIEW'
        : item?.reviewStatus === 'REJECTED'
          ? 'REJECTED'
          : item?.reviewStatus === 'APPROVED'
            ? 'COMPLETE'
            : 'PENDING';
    return serializeTask({
      id: `device:${device._id}`,
      source: 'DEVICE',
      deviceId: String(device._id),
      title: `Device settings: ${device.name}`,
      description:
        'Confirm disk encryption, screen lock, antivirus, and password manager settings. Optional screenshots can be attached per item.',
      type: 'DEVICE_SETTINGS',
      lifecycle: 'RECURRING',
      assignedTo: 'EMPLOYEE',
      cycleKey: `device:${device._id}`,
      status,
      dueDate: null,
      completedAt: status === 'COMPLETE' ? item?.reviewedAt || item?.uploadedAt : null,
      metadata: {
        os: device.os,
        compliance: device.compliance,
        reviewStatus: item?.reviewStatus || null,
        evidenceId: item ? String(item._id) : null,
        checklistItems,
      },
    });
  });
}

async function buildTrainingModuleTasks(user, organizationId) {
  const modules = await TrainingModule.find({
    organizationId,
    active: true,
    isDeleted: { $ne: true },
  })
    .sort({ moduleKey: 1, version: -1 })
    .lean();

  const latestByKey = new Map();
  for (const module of modules) {
    if (!latestByKey.has(module.moduleKey)) latestByKey.set(module.moduleKey, module);
  }
  const activeModules = [...latestByKey.values()];
  const enabledFrameworkCodes = await getEnabledFrameworkCodes(organizationId);
  const scopedModules = activeModules.filter((module) => moduleMatchesEnabledFrameworks(module, enabledFrameworkCodes));
  if (!scopedModules.length) return [];

  const timezone = await getOrgTimezone(organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const attempts = await TrainingAttempt.find({
    organizationId,
    userId: user._id,
    moduleId: { $in: scopedModules.map((module) => module._id) },
    cycleKey,
    isDeleted: { $ne: true },
  }).lean();
  const attemptByModule = new Map(attempts.map((attempt) => [String(attempt.moduleId), attempt]));

  return scopedModules.map((module) => {
    const attempt = attemptByModule.get(String(module._id));
    let status = 'PENDING';
    if (attempt?.passedAt) status = 'COMPLETE';
    else if ((attempt?.readProgressPercent || 0) > 0 || attempt?.attempts > 0) status = 'IN_PROGRESS';

    return serializeTask({
      id: `training:${module._id}:${cycleKey}`,
      source: 'TRAINING',
      trainingModuleId: String(module._id),
      title: module.title,
      description: module.description || '',
      type: 'TRAINING',
      lifecycle: 'RECURRING',
      assignedTo: 'EMPLOYEE',
      cycleKey,
      status,
      dueDate: null,
      completedAt: attempt?.passedAt || null,
      metadata: {
        moduleKey: module.moduleKey,
        version: module.version,
        estimatedReadMinutes: module.estimatedReadMinutes || null,
        readProgressPercent: attempt?.readProgressPercent || 0,
        quizScore: attempt?.quizScore ?? null,
        attempts: attempt?.attempts || 0,
        nextRetryAt: attempt?.nextRetryAt || null,
        passingScore: module.quiz?.passingScore ?? 0.8,
      },
    });
  });
}

export async function getUserPersonnelTasks(user, organizationId, { includePrivate = false } = {}) {
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const [policyTasks, deviceTasks, requirementTasks, trainingTasks] = await Promise.all([
    buildPolicyTasks(user, organizationId),
    buildDeviceTasks(user, organizationId),
    buildRequirementTasks(user, organizationId),
    buildTrainingModuleTasks(user, organizationId),
  ]);

  const requirementTrainingModuleIds = new Set(
    requirementTasks
      .filter((task) => task.type === 'TRAINING' && task.metadata?.module?._id)
      .map((task) => String(task.metadata.module._id))
  );
  const dedupedTrainingTasks = trainingTasks.filter(
    (task) => !requirementTrainingModuleIds.has(String(task.trainingModuleId))
  );

  const tasks = [...policyTasks, ...deviceTasks, ...requirementTasks, ...dedupedTrainingTasks].map((task) => {
    if (!includePrivate && task.type === 'BACKGROUND_CHECK') {
      const { metadata, ...rest } = task;
      return { ...rest, metadata: { private: true } };
    }
    return task;
  });

  const summary = tasks.reduce(
    (acc, task) => {
      acc.total += 1;
      acc[task.status] = (acc[task.status] || 0) + 1;
      if (task.status === 'COMPLETE') acc.complete += 1;
      if (task.status === 'OVERDUE') acc.overdue += 1;
      if (task.status === 'AWAITING_REVIEW') acc.awaitingReview += 1;
      return acc;
    },
    { total: 0, complete: 0, overdue: 0, awaitingReview: 0 }
  );

  return { user: serializeUser(user), tasks, summary };
}

export async function getMyTasks(currentUser) {
  const user = await User.findOne({
    _id: currentUser._id,
    organizationId: currentUser.organizationId,
    isDeleted: { $ne: true },
  }).lean();
  return getUserPersonnelTasks(user, currentUser.organizationId, { includePrivate: false });
}

async function getAdminPersonnelDetails(currentUser) {
  const users = await User.find({
    organizationId: currentUser.organizationId,
    isDeleted: { $ne: true },
    role: { $in: PERSONNEL_ROLES },
  })
    .sort({ firstName: 1, lastName: 1 })
    .limit(200)
    .lean();

  return Promise.all(
    users.map((user) => getUserPersonnelTasks(user, currentUser.organizationId, { includePrivate: false }))
  );
}

export async function getAdminPeople(currentUser) {
  const details = await getAdminPersonnelDetails(currentUser);
  return details.map((result) => ({
      user: result.user,
      summary: result.summary,
      percentComplete: result.summary.total
        ? Math.round((result.summary.complete / result.summary.total) * 100)
        : 100,
    }));
}

export async function getAdminTaskSummary(currentUser) {
  const details = await getAdminPersonnelDetails(currentUser);
  const taskMap = new Map();
  for (const detail of details) {
    for (const task of detail.tasks) {
      const key = `${task.source}:${task.policyId || task.requirementId || task.deviceId || task.trainingModuleId || task.type}`;
      const row = taskMap.get(key) || {
        key,
        title: task.title,
        type: task.type,
        assigned: 0,
        complete: 0,
        overdue: 0,
        awaitingReview: 0,
      };
      row.assigned += 1;
      if (task.status === 'COMPLETE') row.complete += 1;
      if (task.status === 'OVERDUE') row.overdue += 1;
      if (task.status === 'AWAITING_REVIEW') row.awaitingReview += 1;
      taskMap.set(key, row);
    }
  }
  return [...taskMap.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export async function getUserTasksForAdmin(userId, currentUser) {
  if (!ADMIN_ROLES.includes(currentUser.role)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
  const user = await User.findOne({
    _id: userId,
    organizationId: currentUser.organizationId,
    isDeleted: { $ne: true },
  }).lean();
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return getUserPersonnelTasks(user, currentUser.organizationId, { includePrivate: true });
}

export async function getReviewQueue(currentUser) {
  if (!ADMIN_ROLES.includes(currentUser.role)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const submittedDeviceEvidence = await DeviceEvidence.find({
    organizationId: currentUser.organizationId,
    reviewStatus: 'SUBMITTED',
  })
    .populate({
      path: 'deviceId',
      select: 'name assignedUserId os',
      populate: { path: 'assignedUserId', select: 'firstName lastName email role status' },
    })
    .sort({ uploadedAt: -1 })
    .limit(100)
    .lean();

  return submittedDeviceEvidence.map((item) => {
    const sanitized = sanitizeDeviceEvidence(item);
    const checklistItems = sanitized.checklistItems.map((entry) => ({
      ...entry,
      status: getChecklistItemStatus(entry),
    }));

    return {
      id: String(item._id),
      type: 'DEVICE_SETTINGS',
      title: item.label || `Device settings: ${item.deviceId?.name || 'Device'}`,
      submittedAt: item.uploadedAt,
      user: item.deviceId?.assignedUserId ? serializeUser(item.deviceId.assignedUserId) : null,
      evidence: {
        id: String(item._id),
        deviceId: item.deviceId?._id ? String(item.deviceId._id) : null,
        checklistItems,
      },
      metadata: {
        deviceId: item.deviceId?._id ? String(item.deviceId._id) : null,
        deviceName: item.deviceId?.name || '',
        os: item.deviceId?.os || '',
      },
    };
  });
}

export async function reviewDeviceSubmission(evidenceId, { status, note = '' }, currentUser) {
  if (!ADMIN_ROLES.includes(currentUser.role)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    const err = new Error('Review status must be APPROVED or REJECTED');
    err.statusCode = 400;
    throw err;
  }

  const evidence = await DeviceEvidence.findOne({
    _id: evidenceId,
    organizationId: currentUser.organizationId,
  });
  if (!evidence) {
    const err = new Error('Device evidence not found');
    err.statusCode = 404;
    throw err;
  }

  const before = evidence.toObject();
  evidence.reviewStatus = status;
  evidence.reviewedBy = currentUser._id;
  evidence.reviewedAt = new Date();
  evidence.reviewNote = note || '';
  await evidence.save();

  await logCrudOperation({
    organizationId: currentUser.organizationId,
    actorId: currentUser._id,
    action: 'STATUS_CHANGE',
    entityType: 'DeviceEvidence',
    entityId: evidence._id,
    entitySnapshot: { label: evidence.label, reviewStatus: status },
    before,
    after: evidence.toObject(),
  });

  return sanitizeDeviceEvidence(evidence);
}

async function loadTrainingModuleForUser(moduleId, currentUser) {
  const module = await TrainingModule.findOne({
    _id: moduleId,
    organizationId: currentUser.organizationId,
    active: true,
    isDeleted: { $ne: true },
  });
  if (!module) {
    const err = new Error('Training module not found');
    err.statusCode = 404;
    throw err;
  }
  const enabledFrameworkCodes = await getEnabledFrameworkCodes(currentUser.organizationId);
  if (!moduleMatchesEnabledFrameworks(module, enabledFrameworkCodes)) {
    const err = new Error('Training module is not enabled for this organization');
    err.statusCode = 403;
    throw err;
  }
  return module;
}

export async function getTrainingModule(moduleId, currentUser) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const attempt = await TrainingAttempt.findOne({
    organizationId: currentUser.organizationId,
    userId: currentUser._id,
    moduleId: module._id,
    cycleKey,
    isDeleted: { $ne: true },
  }).lean();

  const attemptSummary = attempt
    ? serializeAttemptSummary(attempt, module)
    : {
        cycleKey,
        readProgressPercent: 0,
        readCompletedAt: null,
        quizScore: null,
        attempts: 0,
        nextRetryAt: null,
        passedAt: null,
        certificateEvidenceId: null,
        quizSession: { status: 'not_started', selectedQuestionIds: [] },
        quizMeta: serializeAttemptSummary({ cycleKey }, module).quizMeta,
      };

  return {
    _id: String(module._id),
    moduleKey: module.moduleKey,
    version: module.version,
    title: module.title,
    description: module.description,
    frameworkTags: module.frameworkTags || [],
    estimatedReadMinutes: module.estimatedReadMinutes || null,
    contentMarkdown: module.contentMarkdown,
    attempt: attemptSummary,
  };
}

export async function updateTrainingProgress(moduleId, { readProgressPercent }, currentUser) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const progress = Math.max(0, Math.min(100, Number(readProgressPercent || 0)));
  const attempt = await getOrCreateTrainingAttempt(module, currentUser, cycleKey);
  attempt.readProgressPercent = Math.max(attempt.readProgressPercent || 0, progress);
  if (attempt.readProgressPercent >= 100 && !attempt.readCompletedAt) {
    attempt.readCompletedAt = new Date();
  }
  await attempt.save();
  return getTrainingModule(moduleId, currentUser);
}

export async function startTrainingQuizAttempt(moduleId, currentUser, { forceNew = false } = {}) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  let attempt = await getOrCreateTrainingAttempt(module, currentUser, cycleKey);

  if (forceNew && attempt.quizSession?.status === 'submitted' && !attempt.passedAt) {
    attempt = await prepareNewQuizRetake(attempt);
  }

  return startTrainingQuiz(module, attempt, { forceNew });
}

export async function submitTrainingQuiz(moduleId, { answers }, currentUser) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const attempt = await getOrCreateTrainingAttempt(module, currentUser, cycleKey);
  return submitTrainingQuizSession(module, attempt, answers, currentUser);
}

export async function streamTrainingCertificateFile(
  moduleId,
  currentUser,
  { disposition = 'attachment' } = {}
) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const attempt = await TrainingAttempt.findOne({
    organizationId: currentUser.organizationId,
    userId: currentUser._id,
    moduleId: module._id,
    cycleKey,
    isDeleted: { $ne: true },
    passedAt: { $ne: null },
    certificateEvidenceId: { $ne: null },
  });

  if (!attempt?.certificateEvidenceId) {
    const err = new Error('Training certificate not found');
    err.statusCode = 404;
    throw err;
  }

  const evidence = await Evidence.findOne({
    _id: attempt.certificateEvidenceId,
    organizationId: currentUser.organizationId,
    isDeleted: false,
  });

  if (!evidence?.s3Key) {
    const err = new Error('Certificate file not found');
    err.statusCode = 404;
    throw err;
  }

  const stream = await storageService.getFileStream(evidence.s3Key);
  return {
    stream,
    fileName: evidence.fileName || `training-certificate-${module.moduleKey}.pdf`,
    mimeType: evidence.mimeType || 'application/pdf',
    disposition: disposition === 'inline' ? 'inline' : 'attachment',
  };
}

export async function getTrainingQuizResultForUser(moduleId, currentUser) {
  const module = await loadTrainingModuleForUser(moduleId, currentUser);
  const timezone = await getOrgTimezone(currentUser.organizationId);
  const cycleKey = getFixedAnnualCycleKey(timezone);
  const attempt = await TrainingAttempt.findOne({
    organizationId: currentUser.organizationId,
    userId: currentUser._id,
    moduleId: module._id,
    cycleKey,
    isDeleted: { $ne: true },
  });
  if (!attempt || attempt.quizSession?.status !== 'submitted') {
    const err = new Error('No submitted quiz result found');
    err.statusCode = 404;
    throw err;
  }
  return getTrainingQuizResult(module, attempt);
}

export default {
  getMyTasks,
  getAdminPeople,
  getAdminTaskSummary,
  getUserTasksForAdmin,
  getReviewQueue,
  reviewDeviceSubmission,
  getTrainingModule,
  updateTrainingProgress,
  startTrainingQuizAttempt,
  submitTrainingQuiz,
  getTrainingQuizResultForUser,
  streamTrainingCertificateFile,
};
