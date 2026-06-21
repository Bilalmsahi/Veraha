import personnelTaskService from '../services/personnelTaskService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

export const getMyTasks = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getMyTasks(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getAdminPeople = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getAdminPeople(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getAdminTasks = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getAdminTaskSummary(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getReviewQueue = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getReviewQueue(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getUserTasks = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getUserTasksForAdmin(req.params.userId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reviewDeviceSubmission = async (req, res, next) => {
  try {
    const result = await personnelTaskService.reviewDeviceSubmission(
      req.params.evidenceId,
      req.body,
      req.user
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getTrainingModule = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getTrainingModule(req.params.moduleId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const updateTrainingProgress = async (req, res, next) => {
  try {
    const result = await personnelTaskService.updateTrainingProgress(
      req.params.moduleId,
      req.body,
      req.user
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const startTrainingQuiz = async (req, res, next) => {
  try {
    const result = await personnelTaskService.startTrainingQuizAttempt(
      req.params.moduleId,
      req.user,
      { forceNew: Boolean(req.body?.forceNew) }
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const submitTrainingQuiz = async (req, res, next) => {
  try {
    const result = await personnelTaskService.submitTrainingQuiz(
      req.params.moduleId,
      req.body,
      req.user
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getTrainingQuizResult = async (req, res, next) => {
  try {
    const result = await personnelTaskService.getTrainingQuizResultForUser(
      req.params.moduleId,
      req.user
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getTrainingCertificateFile = async (req, res, next) => {
  try {
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
    const { stream, fileName, mimeType, disposition: contentDisposition } =
      await personnelTaskService.streamTrainingCertificateFile(req.params.moduleId, req.user, {
        disposition,
      });

    const safeName = String(fileName).replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `${contentDisposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

export default {
  getMyTasks,
  getAdminPeople,
  getAdminTasks,
  getReviewQueue,
  getUserTasks,
  reviewDeviceSubmission,
  getTrainingModule,
  updateTrainingProgress,
  startTrainingQuiz,
  submitTrainingQuiz,
  getTrainingQuizResult,
  getTrainingCertificateFile,
};
