import accessReviewService from '../services/accessReviewService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

export const listCampaigns = async (req, res, next) => {
  try {
    const campaigns = await accessReviewService.listCampaigns(req.user.organizationId);
    return sendSuccess(res, campaigns);
  } catch (error) {
    next(error);
  }
};

export const createCampaign = async (req, res, next) => {
  try {
    const campaign = await accessReviewService.createCampaign(req.body, req.user);
    return sendSuccess(res, campaign, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getCampaign = async (req, res, next) => {
  try {
    const campaign = await accessReviewService.getCampaign(req.params.campaignId, req.user.organizationId);
    return sendSuccess(res, campaign);
  } catch (error) {
    next(error);
  }
};

export const activateCampaign = async (req, res, next) => {
  try {
    const campaign = await accessReviewService.activateCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, campaign);
  } catch (error) {
    next(error);
  }
};

export const archiveCampaign = async (req, res, next) => {
  try {
    const campaign = await accessReviewService.archiveCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, campaign);
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign = async (req, res, next) => {
  try {
    const result = await accessReviewService.deleteCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (req, res, next) => {
  try {
    const tasks = await accessReviewService.listMyTasks(req.user, req.query);
    return sendSuccess(res, tasks);
  } catch (error) {
    next(error);
  }
};

export const decideTask = async (req, res, next) => {
  try {
    const task = await accessReviewService.decideTask(req.params.taskId, req.body, req.user);
    return sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
};

export const reassignTask = async (req, res, next) => {
  try {
    const task = await accessReviewService.reassignTask(
      req.params.taskId,
      req.body.reviewerId,
      req.user
    );
    return sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
};

export const confirmRevocation = async (req, res, next) => {
  try {
    const task = await accessReviewService.confirmRevocation(req.params.taskId, req.user);
    return sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
};

export default {
  listCampaigns,
  createCampaign,
  getCampaign,
  activateCampaign,
  archiveCampaign,
  deleteCampaign,
  listTasks,
  decideTask,
  reassignTask,
  confirmRevocation,
};
