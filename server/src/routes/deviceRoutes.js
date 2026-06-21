import { Router } from 'express';
import deviceController from '../controllers/deviceController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { deviceSettingsUpload, handleUploadError } from '../middleware/upload.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  createDeviceSchema,
  updateDeviceSchema,
  listDevicesQuerySchema,
  submitDeviceSettingsSchema,
  deviceIdParamSchema,
  deviceEvidenceParamSchema,
  deviceProofFileParamSchema,
  linkControlsSchema,
  deviceControlParamSchema,
} from '../validators/deviceValidator.js';

const router = Router();

router.use(protect);

router.get('/stats', validateQuery(listDevicesQuerySchema.pick({ complianceStatus: true }).partial()), deviceController.getDeviceStats);

router.get('/', validateQuery(listDevicesQuerySchema), deviceController.listDevices);

router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createDeviceSchema),
  deviceController.createDevice
);

router.get('/:id', validateParams(deviceIdParamSchema), deviceController.getDeviceById);

router.put(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceIdParamSchema),
  validateBody(updateDeviceSchema),
  deviceController.updateDevice
);

router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceIdParamSchema),
  validateBody(updateDeviceSchema),
  deviceController.updateDevice
);

router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceIdParamSchema),
  deviceController.deleteDevice
);

router.post(
  '/:id/device-settings',
  blockAuditor,
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  validateParams(deviceIdParamSchema),
  deviceSettingsUpload,
  handleUploadError,
  validateBody(submitDeviceSettingsSchema),
  deviceController.submitDeviceSettings
);

router.get(
  '/:id/evidence/:evidenceId/proof/:fileId/access-url',
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceProofFileParamSchema),
  deviceController.getDeviceProofAccessUrl
);

router.delete(
  '/:id/evidence/:evidenceId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceEvidenceParamSchema),
  deviceController.deleteDeviceEvidence
);

// =============================================================================
// LINKED CONTROLS
// =============================================================================

/**
 * POST /api/v1/devices/:id/controls
 * Link controls to a device (Manager+ only)
 */
router.post(
  '/:id/controls',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceIdParamSchema),
  validateBody(linkControlsSchema),
  deviceController.linkControls
);

/**
 * DELETE /api/v1/devices/:id/controls/:controlId
 * Unlink a control from a device (Manager+ only)
 */
router.delete(
  '/:id/controls/:controlId',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(deviceControlParamSchema),
  deviceController.unlinkControl
);

export default router;
