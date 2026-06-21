import { Router } from 'express';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateParams } from '../validators/validate.js';
import { policyIdParamSchema } from '../validators/policyWorkflowValidator.js';
import policyWorkflowController from '../controllers/policyWorkflowController.js';

const router = Router();

router.use(protect);

router.post(
  '/:id/cancel-approval',
  blockAuditor,
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  validateParams(policyIdParamSchema),
  policyWorkflowController.cancelApprovalByVersion
);

export default router;
