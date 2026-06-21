/**
 * Authentication Routes
 *
 * Includes both legacy endpoints and new OTP-based flows.
 *
 * OTP Registration:
 *   POST /register/send-otp    → Send OTP to email
 *   POST /register/verify-otp  → Verify OTP + create account
 *
 * OTP Forgot Password:
 *   POST /forgot-password           → Send OTP
 *   POST /forgot-password/verify    → Verify OTP
 *   POST /forgot-password/reset     → Set new password
 *
 * Legacy (still work):
 *   POST /register        → Direct register (no OTP)
 *   POST /login
 *   POST /accept-invite
 *   POST /reset-password  → Token-based reset
 *   GET  /me
 *   POST /invite
 */

import { Router } from 'express';
import authController from '../controllers/authController.js';
import { validate } from '../validators/validate.js';
import {
    registerSchema,
    loginSchema,
    inviteSchema,
    acceptInviteSchema,
    emailSchema,
    resetPasswordSchema,
    registerSendOtpSchema,
    registerVerifyOtpSchema,
    verifyOtpSchema,
    resetPasswordOtpSchema,
} from '../validators/authValidator.js';
import { updateUserSettingsSchema } from '../validators/userSettingsValidator.js';
import { protect, authorize, blockAuditor } from '../middleware/authMiddleware.js';

const router = Router();

// =============================================================================
// OTP-BASED REGISTRATION
// =============================================================================

router.post(
    '/register/send-otp',
    validate(registerSendOtpSchema),
    authController.registerSendOTP,
);

router.post(
    '/register/verify-otp',
    validate(registerVerifyOtpSchema),
    authController.registerVerifyOTP,
);

// =============================================================================
// OTP-BASED FORGOT PASSWORD
// =============================================================================

router.post(
    '/forgot-password',
    validate(emailSchema),
    authController.forgotPasswordSendOTP,
);

router.post(
    '/forgot-password/verify',
    validate(verifyOtpSchema),
    authController.forgotPasswordVerifyOTP,
);

router.post(
    '/forgot-password/reset',
    validate(resetPasswordOtpSchema),
    authController.resetPasswordWithOTP,
);

// =============================================================================
// LEGACY / STANDARD ENDPOINTS
// =============================================================================

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/invitations/:token', authController.validateInvite);
router.get('/invite/:token', authController.validateInvite);
router.post('/invitations/:token/activity', authController.trackInviteActivity);
router.post('/accept-invite', validate(acceptInviteSchema), authController.acceptInvite);
router.post('/invite/accept', validate(acceptInviteSchema), authController.acceptInvite);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// =============================================================================
// PROTECTED ROUTES
// =============================================================================

router.get('/me', protect, authController.getMe);

router.patch(
    '/me/settings',
    protect,
    validate(updateUserSettingsSchema),
    authController.updateMySettings,
);

router.post('/activity', protect, authController.touchActivity);

router.get(
    '/email/diagnostics',
    protect,
    authorize('ADMIN'),
    authController.emailDiagnostics,
);

router.post(
    '/invite',
    protect,
    authorize('ADMIN', 'MANAGER'),
    blockAuditor,
    validate(inviteSchema),
    authController.inviteUser,
);

export default router;
