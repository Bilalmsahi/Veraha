import policyWorkflowService from '../services/policyWorkflowService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

const actorCtx = (req) => ({
  organizationId: req.user.organizationId,
  userId: req.user._id,
});

export const submitForApproval = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.submitForApproval({
      policyId: req.params.id,
      policyVersionId: req.body.policyVersionId,
      approverId: req.body.approverId,
      actor: actorCtx(req),
    });
    sendSuccess(res, result, null, 200);
  } catch (err) {
    next(err);
  }
};

export const approve = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.approveVersion({
      policyId: req.params.id,
      policyVersionId: req.params.versionId,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reject = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.rejectVersion({
      policyId: req.params.id,
      policyVersionId: req.params.versionId,
      actor: actorCtx(req),
      reason: req.body.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const cancelApproval = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.cancelApproval({
      policyId: req.params.id,
      policyVersionId: req.params.versionId,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const cancelApprovalByVersion = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.cancelApprovalByVersion({
      policyVersionId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const publish = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.publishVersionWorkflow({
      policyId: req.params.id,
      policyVersionId: req.body.policyVersionId,
      recipientType: req.body.recipientType,
      userIds: req.body.userIds,
      groupIds: req.body.groupIds,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const acknowledge = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.acknowledgePolicy({
      policyId: req.params.id,
      userId: req.user._id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

export const targetUsers = async (req, res, next) => {
  try {
    const policy = await policyWorkflowService.findPolicyOrThrow({
      policyId: req.params.id,
      organizationId: req.user.organizationId,
    });
    const users = await policyWorkflowService.getTargetUsers(policy);
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

export const snooze = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.snoozePolicy({
      policyId: req.params.id,
      actor: actorCtx(req),
      snoozedUntil: req.body.snoozedUntil,
      reason: req.body.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const unsnooze = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.unsnoozePolicy({
      policyId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const deactivate = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.deactivatePolicy({
      policyId: req.params.id,
      actor: actorCtx(req),
      reason: req.body.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reactivate = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.reactivatePolicy({
      policyId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const archive = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.archivePolicyWorkflow({
      policyId: req.params.id,
      actor: actorCtx(req),
      reason: req.body.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const unarchive = async (req, res, next) => {
  try {
    const result = await policyWorkflowService.unarchivePolicyWorkflow({
      policyId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export default {
  submitForApproval,
  approve,
  reject,
  cancelApproval,
  cancelApprovalByVersion,
  publish,
  acknowledge,
  targetUsers,
  snooze,
  unsnooze,
  deactivate,
  reactivate,
  archive,
  unarchive,
};

