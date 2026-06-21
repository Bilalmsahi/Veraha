import testWorkflowService from '../services/testWorkflowService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

const actorCtx = (req) => ({
  organizationId: req.user.organizationId,
  userId: req.user._id,
});

export const deactivate = async (req, res, next) => {
  try {
    const result = await testWorkflowService.deactivateTestWorkflow({
      testId: req.params.id,
      actor: actorCtx(req),
      reason: req.body?.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reactivate = async (req, res, next) => {
  try {
    const result = await testWorkflowService.reactivateTestWorkflow({
      testId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const snooze = async (req, res, next) => {
  try {
    const result = await testWorkflowService.snoozeTestWorkflow({
      testId: req.params.id,
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
    const result = await testWorkflowService.unsnoozeTestWorkflow({
      testId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const archive = async (req, res, next) => {
  try {
    const result = await testWorkflowService.archiveTestWorkflow({
      testId: req.params.id,
      actor: actorCtx(req),
      reason: req.body?.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const unarchive = async (req, res, next) => {
  try {
    const result = await testWorkflowService.unarchiveTestWorkflow({
      testId: req.params.id,
      actor: actorCtx(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const markNa = async (req, res, next) => {
  try {
    const result = await testWorkflowService.markNa({
      testId: req.params.id,
      actor: actorCtx(req),
      reason: req.body?.reason,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export default {
  deactivate,
  reactivate,
  snooze,
  unsnooze,
  archive,
  unarchive,
  markNa,
};

