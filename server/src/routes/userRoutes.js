import { Router } from 'express';
import userController from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateBody, validateQuery, validateParams } from '../validators/validate.js';
import {
  listUsersQuerySchema,
  updateRoleSchema,
  userIdParamSchema,
} from '../validators/userValidator.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  validateQuery(listUsersQuerySchema),
  userController.listUsers
);

router.get(
  '/:id',
  validateParams(userIdParamSchema),
  userController.getUser
);

router.patch(
  '/:id/role',
  authorize('ADMIN'),
  validateParams(userIdParamSchema),
  validateBody(updateRoleSchema),
  userController.updateRole
);

router.post(
  '/:id/deactivate',
  authorize('ADMIN'),
  validateParams(userIdParamSchema),
  userController.deactivateUser
);

router.post(
  '/:id/reactivate',
  authorize('ADMIN'),
  validateParams(userIdParamSchema),
  userController.reactivateUser
);

router.post(
  '/:id/invitation/resend',
  authorize('ADMIN', 'MANAGER'),
  validateParams(userIdParamSchema),
  userController.resendInvitation
);

router.post(
  '/:id/invitation/revoke',
  authorize('ADMIN', 'MANAGER'),
  validateParams(userIdParamSchema),
  userController.revokeInvitation
);

export default router;
