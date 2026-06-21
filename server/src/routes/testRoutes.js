/**
 * Test routes — compliance checks (Phase 1: manual evidence via linked Evidence doc)
 */
import { Router } from 'express';
import testController from '../controllers/testController.js';
import testWorkflowController from '../controllers/testWorkflowController.js';
import commentController from '../controllers/commentController.js';
import { protect, authorize, blockAuditor, requireInternalUser } from '../middleware/authMiddleware.js';
import { validateQuery, validateParams, validateBody, validateMultiple } from '../validators/validate.js';
import {
  listTestsQuerySchema,
  testIdParamSchema,
  updateTestSchema,
  testCommentBodySchema,
} from '../validators/testValidator.js';
import {
  snoozeSchema as workflowSnoozeSchema,
  workflowReasonSchema,
} from '../validators/testWorkflowValidator.js';

const router = Router();

router.use(protect, requireInternalUser);

router.get('/stats', testController.getTestStats);

router.get('/', validateQuery(listTestsQuerySchema), testController.listTests);

router.get(
  '/:id/comments',
  validateParams(testIdParamSchema),
  commentController.getTestComments
);

router.post(
  '/:id/comments',
  blockAuditor,
  validateMultiple({
    params: testIdParamSchema,
    body: testCommentBodySchema,
  }),
  commentController.createTestComment
);

router.post(
  '/:id/evidence/start',
  blockAuditor,
  validateParams(testIdParamSchema),
  testController.startTestEvidence
);

router.get(
  '/:id/evidence',
  validateParams(testIdParamSchema),
  testController.getTestEvidence
);

// =============================================================================
// WORKFLOW (Phase 4) — additional lifecycle endpoints
// =============================================================================

router.post(
  '/:id/deactivate',
  blockAuditor,
  validateMultiple({
    params: testIdParamSchema,
    body: workflowReasonSchema,
  }),
  testWorkflowController.deactivate
);

router.post(
  '/:id/snooze',
  blockAuditor,
  validateMultiple({
    params: testIdParamSchema,
    body: workflowSnoozeSchema,
  }),
  testWorkflowController.snooze
);

router.post(
  '/:id/reactivate',
  blockAuditor,
  validateParams(testIdParamSchema),
  testWorkflowController.reactivate
);

router.post(
  '/:id/unsnooze',
  blockAuditor,
  validateParams(testIdParamSchema),
  testWorkflowController.unsnooze
);

router.post(
  '/:id/archive',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({
    params: testIdParamSchema,
    body: workflowReasonSchema,
  }),
  testWorkflowController.archive
);

router.post(
  '/:id/archive-workflow',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({
    params: testIdParamSchema,
    body: workflowReasonSchema,
  }),
  testWorkflowController.archive
);

router.post(
  '/:id/unarchive',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateParams(testIdParamSchema),
  testWorkflowController.unarchive
);

router.post(
  '/:id/mark-na',
  blockAuditor,
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({
    params: testIdParamSchema,
    body: workflowReasonSchema,
  }),
  testWorkflowController.markNa
);

router.delete(
  '/:id',
  blockAuditor,
  authorize('ADMIN'),
  validateParams(testIdParamSchema),
  testController.deleteTest
);

router.patch(
  '/:id',
  blockAuditor,
  validateMultiple({
    params: testIdParamSchema,
    body: updateTestSchema,
  }),
  testController.updateTest
);

router.get('/:id', validateParams(testIdParamSchema), testController.getTestById);

export default router;
