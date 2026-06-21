import { Router } from 'express';
import notificationController from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateParams } from '../validators/validate.js';
import { notificationIdParamSchema } from '../validators/auditEvidenceRequestValidator.js';

const router = Router();

router.use(protect);

router.get('/', notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllNotificationsRead);
router.patch('/:id/read', validateParams(notificationIdParamSchema), notificationController.markNotificationRead);

export default router;
