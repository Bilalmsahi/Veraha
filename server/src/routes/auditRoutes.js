import { Router } from 'express';
import auditController from '../controllers/auditController.js';
import { protect, authorize, requireInternalUser } from '../middleware/authMiddleware.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { validateMultiple } from '../validators/validate.js';
import {
  auditRequestParamsSchema,
  evidenceRequestMessageSchema,
  submitEvidenceItemSchema,
  updateEvidenceRequestSchema,
} from '../validators/auditEvidenceRequestValidator.js';
import {
  auditFindingParamsSchema,
  auditIdParamSchema,
  createAuditFindingSchema,
  listAuditFindingsQuerySchema,
  updateAuditFindingSchema,
} from '../validators/auditFindingValidator.js';

const router = Router();

router.use(protect, requireInternalUser);

router.get('/', auditController.listAudits);
router.get('/stats', auditController.getAuditStats);
router.post('/', authorize('ADMIN'), auditController.createAudit);

router.get('/:auditId/readiness', auditController.getAuditReadiness);
router.get('/:auditId/activity', auditController.getAuditActivity);
router.get('/:auditId', auditController.getAudit);
router.patch('/:auditId', authorize('ADMIN'), auditController.updateAudit);
router.post('/:auditId/transition', authorize('ADMIN'), auditController.transitionAudit);
router.post(
  '/:auditId/complete',
  authorize('ADMIN'),
  validateMultiple({ params: auditIdParamSchema }),
  auditController.completeAudit
);
router.post('/:auditId/snapshot', authorize('ADMIN'), auditController.snapshotAudit);
router.post('/:auditId/auditor-lookup', authorize('ADMIN'), auditController.lookupAuditor);
router.post('/:auditId/invite-auditor', authorize('ADMIN'), auditController.inviteAuditor);

router.get(
  '/:auditId/findings',
  validateMultiple({ params: auditIdParamSchema, query: listAuditFindingsQuerySchema }),
  auditController.listAuditFindings
);
router.post(
  '/:auditId/findings',
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: auditIdParamSchema, body: createAuditFindingSchema }),
  auditController.createAuditFinding
);
router.patch(
  '/:auditId/findings/:findingId',
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: auditFindingParamsSchema, body: updateAuditFindingSchema }),
  auditController.updateAuditFinding
);
router.delete(
  '/:auditId/findings/:findingId',
  authorize('ADMIN'),
  validateMultiple({ params: auditFindingParamsSchema }),
  auditController.deleteAuditFinding
);

router.get('/:auditId/evidence', auditController.listAuditEvidence);
router.post('/:auditId/evidence/:itemId/respond', authorize('ADMIN', 'MANAGER'), auditController.respondToEvidenceItem);

router.get('/:auditId/requests', auditController.listAuditRequests);
router.get(
  '/:auditId/requests/:requestId',
  validateMultiple({ params: auditRequestParamsSchema }),
  auditController.getAuditRequest
);
router.post(
  '/:auditId/requests/:requestId/messages',
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  validateMultiple({ params: auditRequestParamsSchema, body: evidenceRequestMessageSchema }),
  auditController.addAuditRequestMessage
);
router.patch(
  '/:auditId/requests/:requestId',
  authorize('ADMIN', 'MANAGER'),
  validateMultiple({ params: auditRequestParamsSchema, body: updateEvidenceRequestSchema }),
  auditController.updateAuditRequest
);
router.post(
  '/:auditId/requests/:requestId/submit-evidence',
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  validateMultiple({ params: auditRequestParamsSchema, body: submitEvidenceItemSchema }),
  auditController.submitEvidenceItemToRequest
);
router.post('/:auditId/requests/:requestId/submit', authorize('ADMIN', 'MANAGER'), auditController.submitAuditRequest);

router.post(
  '/:auditId/report',
  authorize('ADMIN'),
  upload.single('file'),
  handleUploadError,
  auditController.uploadAuditReport
);

export default router;
