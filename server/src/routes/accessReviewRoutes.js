import { Router } from 'express';
import accessReviewController from '../controllers/accessReviewController.js';
import { authorize, protect, requireInternalUser } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, requireInternalUser);

router.get('/campaigns', authorize('ADMIN', 'MANAGER'), accessReviewController.listCampaigns);
router.post('/campaigns', authorize('ADMIN'), accessReviewController.createCampaign);
router.get('/campaigns/:campaignId', authorize('ADMIN', 'MANAGER'), accessReviewController.getCampaign);
router.post('/campaigns/:campaignId/activate', authorize('ADMIN'), accessReviewController.activateCampaign);
router.post('/campaigns/:campaignId/archive', authorize('ADMIN'), accessReviewController.archiveCampaign);
router.delete('/campaigns/:campaignId', authorize('ADMIN'), accessReviewController.deleteCampaign);

router.get('/tasks', authorize('ADMIN', 'MANAGER'), accessReviewController.listTasks);
router.patch('/tasks/:taskId/assign', authorize('ADMIN'), accessReviewController.reassignTask);
router.post('/tasks/:taskId/decision', authorize('ADMIN', 'MANAGER'), accessReviewController.decideTask);
router.post('/tasks/:taskId/confirm-revocation', authorize('ADMIN'), accessReviewController.confirmRevocation);

export default router;
