import { Router } from 'express';
import auditorController from '../controllers/auditorController.js';
import { authorize, protect, requireAuditorScope } from '../middleware/authMiddleware.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { validateMultiple } from '../validators/validate.js';
import {
  auditRequestParamsSchema,
  evidenceRequestMessageSchema,
} from '../validators/auditEvidenceRequestValidator.js';
import {
  auditIdParamSchema,
  createAuditFindingSchema,
} from '../validators/auditFindingValidator.js';

const router = Router();

router.use(protect);

router.get('/engagements', authorize('AUDITOR'), auditorController.listEngagements);
router.get('/engagements/:auditId', requireAuditorScope('auditId'), auditorController.getEngagement);
router.get('/engagements/:auditId/evidence', requireAuditorScope('auditId'), auditorController.listEvidence);
router.post('/engagements/:auditId/evidence/:itemId/approve', requireAuditorScope('auditId'), auditorController.approveEvidence);
router.post('/engagements/:auditId/evidence/:itemId/flag', requireAuditorScope('auditId'), auditorController.flagEvidence);
router.post('/engagements/:auditId/evidence/:itemId/not-applicable', requireAuditorScope('auditId'), auditorController.markNotApplicable);
router.get('/engagements/:auditId/requests', requireAuditorScope('auditId'), auditorController.listRequests);
router.post('/engagements/:auditId/requests', requireAuditorScope('auditId'), auditorController.createRequest);
router.get(
  '/engagements/:auditId/findings',
  validateMultiple({ params: auditIdParamSchema }),
  requireAuditorScope('auditId'),
  auditorController.listFindings
);
router.post(
  '/engagements/:auditId/findings',
  validateMultiple({ params: auditIdParamSchema, body: createAuditFindingSchema }),
  requireAuditorScope('auditId'),
  auditorController.createFinding
);
router.get(
  '/engagements/:auditId/requests/:requestId',
  validateMultiple({ params: auditRequestParamsSchema }),
  requireAuditorScope('auditId'),
  auditorController.getRequest
);
router.post(
  '/engagements/:auditId/requests/:requestId/messages',
  validateMultiple({ params: auditRequestParamsSchema, body: evidenceRequestMessageSchema }),
  requireAuditorScope('auditId'),
  auditorController.addRequestMessage
);
router.post('/engagements/:auditId/complete', requireAuditorScope('auditId'), auditorController.completeAudit);
router.post(
  '/engagements/:auditId/report',
  requireAuditorScope('auditId'),
  upload.single('file'),
  handleUploadError,
  auditorController.uploadReport
);

export default router;
