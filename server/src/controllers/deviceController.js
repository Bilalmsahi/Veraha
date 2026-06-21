import deviceService from '../services/deviceService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

export const createDevice = async (req, res, next) => {
  try {
    const device = await deviceService.createDevice(req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, device, null, 201);
  } catch (error) {
    next(error);
  }
};

export const listDevices = async (req, res, next) => {
  try {
    const result = await deviceService.listDevices(req.user.organizationId, req.query);
    sendSuccess(res, result.devices, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getDeviceById = async (req, res, next) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id, req.user.organizationId);
    sendSuccess(res, device);
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (req, res, next) => {
  try {
    const device = await deviceService.updateDevice(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, device);
  } catch (error) {
    next(error);
  }
};

export const deleteDevice = async (req, res, next) => {
  try {
    const result = await deviceService.deleteDevice(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getDeviceStats = async (req, res, next) => {
  try {
    const stats = await deviceService.getDeviceStats(req.user.organizationId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export const submitDeviceSettings = async (req, res, next) => {
  try {
    const evidence = await deviceService.submitDeviceSettings(
      req.params.id,
      req.body,
      req.files || {},
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
        role: req.user.role,
      }
    );
    sendSuccess(res, evidence, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getDeviceProofAccessUrl = async (req, res, next) => {
  try {
    const access = await deviceService.getDeviceProofAccessUrl(
      req.params.id,
      req.params.evidenceId,
      req.params.fileId,
      {
        organizationId: req.user.organizationId,
        role: req.user.role,
      }
    );
    sendSuccess(res, access);
  } catch (error) {
    next(error);
  }
};

export const deleteDeviceEvidence = async (req, res, next) => {
  try {
    const result = await deviceService.deleteDeviceEvidence(
      req.params.id,
      req.params.evidenceId,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const linkControls = async (req, res, next) => {
  try {
    const device = await deviceService.linkControls(
      req.params.id,
      req.user.organizationId,
      req.body.controlIds
    );
    sendSuccess(res, device);
  } catch (error) {
    next(error);
  }
};

export const unlinkControl = async (req, res, next) => {
  try {
    const device = await deviceService.unlinkControl(
      req.params.id,
      req.user.organizationId,
      req.params.controlId
    );
    sendSuccess(res, device);
  } catch (error) {
    next(error);
  }
};

export default {
  createDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  getDeviceStats,
  submitDeviceSettings,
  getDeviceProofAccessUrl,
  deleteDeviceEvidence,
  linkControls,
  unlinkControl,
};
