import { Router } from 'express';
import riskLibraryController from '../controllers/riskLibraryController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  listRiskLibraryQuerySchema,
  createRiskTemplateSchema,
  updateRiskTemplateSchema,
  riskTemplateIdParamSchema,
} from '../validators/riskLibraryValidator.js';

const router = Router();

router.use(protect);

router.get(
  '/categories',
  riskLibraryController.getCategories
);

router.get(
  '/',
  validateQuery(listRiskLibraryQuerySchema),
  riskLibraryController.listRiskTemplates
);

router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createRiskTemplateSchema),
  riskLibraryController.createRiskTemplate
);

router.get(
  '/:id',
  validateParams(riskTemplateIdParamSchema),
  riskLibraryController.getRiskTemplate
);

router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskTemplateIdParamSchema),
  validateBody(updateRiskTemplateSchema),
  riskLibraryController.updateRiskTemplate
);

router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(riskTemplateIdParamSchema),
  riskLibraryController.deleteRiskTemplate
);

router.post(
  '/:id/import',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(riskTemplateIdParamSchema),
  riskLibraryController.importToRegister
);

export default router;
