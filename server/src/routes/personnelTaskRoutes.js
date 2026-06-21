import { Router } from 'express';
import personnelTaskController from '../controllers/personnelTaskController.js';
import { protect, authorize, blockAuditor, requireInternalUser } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, requireInternalUser, blockAuditor);

router.get('/my', personnelTaskController.getMyTasks);
router.get('/admin/people', authorize('ADMIN', 'MANAGER'), personnelTaskController.getAdminPeople);
router.get('/admin/tasks', authorize('ADMIN', 'MANAGER'), personnelTaskController.getAdminTasks);
router.get('/admin/review-queue', authorize('ADMIN', 'MANAGER'), personnelTaskController.getReviewQueue);
router.post(
  '/admin/device-submissions/:evidenceId/review',
  authorize('ADMIN', 'MANAGER'),
  personnelTaskController.reviewDeviceSubmission
);
router.get('/training/:moduleId', personnelTaskController.getTrainingModule);
router.post('/training/:moduleId/progress', personnelTaskController.updateTrainingProgress);
router.post('/training/:moduleId/quiz/start', personnelTaskController.startTrainingQuiz);
router.post('/training/:moduleId/quiz/submit', personnelTaskController.submitTrainingQuiz);
router.get('/training/:moduleId/quiz/result', personnelTaskController.getTrainingQuizResult);
router.get(
  '/training/:moduleId/certificate/file',
  personnelTaskController.getTrainingCertificateFile
);
/** @deprecated Use POST /training/:moduleId/quiz/submit */
router.post('/training/:moduleId/quiz', personnelTaskController.submitTrainingQuiz);
router.get('/users/:userId', authorize('ADMIN', 'MANAGER'), personnelTaskController.getUserTasks);

export default router;
