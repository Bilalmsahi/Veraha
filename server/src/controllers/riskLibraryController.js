import riskLibraryService from '../services/riskLibraryService.js';
import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';

export const listRiskTemplates = async (req, res, next) => {
  try {
    const queryParams = req.validatedQuery || req.query;
    const { templates, pagination } = await riskLibraryService.listRiskTemplates(
      req.user.organizationId,
      queryParams
    );
    return sendPaginated(res, templates, pagination);
  } catch (error) {
    next(error);
  }
};

export const getRiskTemplate = async (req, res, next) => {
  try {
    const template = await riskLibraryService.getRiskTemplateById(
      req.params.id,
      req.user.organizationId
    );
    return sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export const createRiskTemplate = async (req, res, next) => {
  try {
    const template = await riskLibraryService.createRiskTemplate(req.body, {
      organizationId: req.user.organizationId,
      _id: req.user._id,
    });
    return sendSuccess(res, template, null, 201);
  } catch (error) {
    next(error);
  }
};

export const updateRiskTemplate = async (req, res, next) => {
  try {
    const template = await riskLibraryService.updateRiskTemplate(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      _id: req.user._id,
    });
    return sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export const deleteRiskTemplate = async (req, res, next) => {
  try {
    const result = await riskLibraryService.deleteRiskTemplate(req.params.id, {
      organizationId: req.user.organizationId,
      _id: req.user._id,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const importToRegister = async (req, res, next) => {
  try {
    const risk = await riskLibraryService.importToRegister(req.params.id, {
      organizationId: req.user.organizationId,
      _id: req.user._id,
    });
    return sendSuccess(res, risk, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const categories = await riskLibraryService.getCategories(req.user.organizationId);
    return sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
};

export default {
  listRiskTemplates,
  getRiskTemplate,
  createRiskTemplate,
  updateRiskTemplate,
  deleteRiskTemplate,
  importToRegister,
  getCategories,
};
