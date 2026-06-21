/**
 * Group Routes (Phase 4)
 */
import { Router } from 'express';
import groupController from '../controllers/groupController.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';
import { validateBody, validateParams, validateQuery, validateMultiple } from '../validators/validate.js';
import {
  groupIdParamSchema,
  createGroupSchema,
  updateGroupSchema,
  listGroupsQuerySchema,
  membersBodySchema,
} from '../validators/groupValidator.js';

const router = Router();

router.use(protect);

router.get('/', validateQuery(listGroupsQuerySchema), groupController.listGroups);
router.get('/:id', validateParams(groupIdParamSchema), groupController.getGroup);

router.post(
  '/',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateBody(createGroupSchema),
  groupController.createGroup
);

router.patch(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: groupIdParamSchema, body: updateGroupSchema }),
  groupController.updateGroup
);

router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(groupIdParamSchema),
  groupController.deleteGroup
);

router.post(
  '/:id/members/add',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: groupIdParamSchema, body: membersBodySchema }),
  groupController.addMembers
);

router.post(
  '/:id/members/remove',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: groupIdParamSchema, body: membersBodySchema }),
  groupController.removeMembers
);

export default router;

