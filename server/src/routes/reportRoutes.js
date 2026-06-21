import { Router } from 'express';
import reportController from '../controllers/reportController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

const exportPdf = (type) => (req, res, next) => {
  req.params.type = type;
  return reportController.exportReportPdf(req, res, next);
};

router.get('/compliance', authorize('ADMIN', 'MANAGER', 'AUDITOR'), reportController.getComplianceReport);
router.get('/compliance/pdf', authorize('ADMIN', 'MANAGER', 'AUDITOR'), exportPdf('compliance'));
router.get('/personnel', authorize('ADMIN', 'MANAGER'), reportController.getPersonnelReport);
router.get('/personnel/pdf', authorize('ADMIN', 'MANAGER'), exportPdf('personnel'));
router.get('/risk', authorize('ADMIN', 'MANAGER', 'AUDITOR'), reportController.getRiskReport);
router.get('/risk/pdf', authorize('ADMIN', 'MANAGER', 'AUDITOR'), exportPdf('risk'));
router.get('/vendor', authorize('ADMIN', 'MANAGER', 'AUDITOR'), reportController.getVendorReport);
router.get('/vendor/pdf', authorize('ADMIN', 'MANAGER', 'AUDITOR'), exportPdf('vendor'));

export default router;
