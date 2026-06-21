/**
 * Test Controller
 */
import testService from '../services/testService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

const userCtx = (req) => ({
  organizationId: req.user.organizationId,
  userId: req.user._id,
});

export const listTests = async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? req.query;
    const result = await testService.listTests(req.user.organizationId, q);
    sendSuccess(res, result.tests, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const getTestStats = async (req, res, next) => {
  try {
    const stats = await testService.getTestStats(req.user.organizationId);
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
};

export const getTestById = async (req, res, next) => {
  try {
    const test = await testService.getTestById(req.params.id, req.user.organizationId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
};

export const updateTest = async (req, res, next) => {
  try {
    const test = await testService.updateTest(req.params.id, req.user.organizationId, req.body);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
};

export const deleteTest = async (req, res, next) => {
  try {
    const result = await testService.softDeleteTest(
      req.params.id,
      req.user.organizationId,
      req.user._id
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const deactivateTest = async (req, res, next) => {
  try {
    // Deprecated: workflow POST /tests/:id/deactivate is canonical.
    const test = await testService.deactivateTest(req.params.id, req.user.organizationId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
};

export const snoozeTest = async (req, res, next) => {
  try {
    // Deprecated: workflow POST /tests/:id/snooze is canonical.
    const test = await testService.snoozeTest(
      req.params.id,
      req.user.organizationId,
      req.body.snoozedUntil
    );
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
};

export const reactivateTest = async (req, res, next) => {
  try {
    // Deprecated: workflow POST /tests/:id/reactivate is canonical.
    const test = await testService.reactivateTest(req.params.id, req.user.organizationId);
    sendSuccess(res, test);
  } catch (err) {
    next(err);
  }
};

export const startTestEvidence = async (req, res, next) => {
  try {
    const result = await testService.startEvidenceForTest(
      req.params.id,
      req.user.organizationId,
      userCtx(req)
    );
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

export const getTestEvidence = async (req, res, next) => {
  try {
    const versions = await testService.getTestEvidenceVersions(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, versions);
  } catch (err) {
    next(err);
  }
};

export default {
  listTests,
  getTestStats,
  getTestById,
  updateTest,
  deleteTest,
  deactivateTest,
  snoozeTest,
  reactivateTest,
  startTestEvidence,
  getTestEvidence,
};
