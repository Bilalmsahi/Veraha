/**
 * Authentication Controller
 *
 * HTTP handlers for auth endpoints including OTP-based flows.
 */

import { sendError, sendSuccess } from '../middleware/responseHandler.js';
import authService from '../services/authService.js';
import invitationService from '../services/invitationService.js';
import { getEmailDiagnostics } from '../services/emailService.js';
import { REFRESH_TOKEN_COOKIE_NAME, getRefreshTokenCookieOptions } from '../config/auth.js';

const parseCookies = (cookieHeader = '') => {
    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const separatorIndex = cookie.indexOf('=');
        if (separatorIndex === -1) return cookies;

        const key = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);

        return cookies;
    }, {});
};

const getRefreshTokenFromRequest = (req) => {
    const cookies = parseCookies(req.get('cookie'));
    return cookies[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
};

const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
};

const clearRefreshTokenCookie = (res) => {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getRefreshTokenCookieOptions());
};

// =============================================================================
// LEGACY ENDPOINTS (kept for backward compatibility)
// =============================================================================

export const register = async (req, res, next) => {
    try {
        if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
            return sendError(res, 403, 'Sign up is by invitation only. Please check your email for an invitation link.');
        }
        const { user, organization, token, accessToken, refreshToken } = await authService.registerTenant(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken }, null, 201);
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { user, organization, token, accessToken, refreshToken } = await authService.login(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken });
    } catch (error) {
        next(error);
    }
};

export const forgotPassword = async (req, res, next) => {
    try {
        const result = await authService.forgotPasswordSendOTP(req.body);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { user, organization, token, accessToken, refreshToken } = await authService.resetPassword(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken });
    } catch (error) {
        next(error);
    }
};

export const acceptInvite = async (req, res, next) => {
    try {
        const { user, organization, token, accessToken, refreshToken } = await authService.acceptInvite(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken });
    } catch (error) {
        next(error);
    }
};

export const refresh = async (req, res) => {
    try {
        const incomingToken = getRefreshTokenFromRequest(req);
        const { accessToken, refreshToken } = await authService.rotateRefreshToken(incomingToken);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { accessToken, token: accessToken, refreshToken });
    } catch (error) {
        const meta = error.reason === 'session_timeout' ? { reason: 'session_timeout' } : null;
        return sendError(res, 401, error.message || 'Invalid refresh token', meta);
    }
};

export const logout = async (req, res, next) => {
    try {
        const incomingToken = getRefreshTokenFromRequest(req);
        await authService.revokeRefreshToken(incomingToken);
        clearRefreshTokenCookie(res);
        return res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        const { user, organization } = await authService.getCurrentUser(req.user._id);
        return sendSuccess(res, { user, organization });
    } catch (error) {
        next(error);
    }
};

export const updateMySettings = async (req, res, next) => {
    try {
        const user = await authService.updateUserSettings(req.user._id, req.body);
        return sendSuccess(res, { user });
    } catch (error) {
        next(error);
    }
};

export const touchActivity = async (req, res, next) => {
    try {
        await authService.touchUserActivity(req.user._id);
        return sendSuccess(res, { touched: true });
    } catch (error) {
        next(error);
    }
};

export const validateInvite = async (req, res, next) => {
    try {
        const invite = await invitationService.validateInvitation(req.params.token, {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        return sendSuccess(res, invite);
    } catch (error) {
        next(error);
    }
};

export const emailDiagnostics = async (req, res, next) => {
    try {
        const result = await getEmailDiagnostics({
            checkConnectivity: req.query?.connectivity === 'true',
        });
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

export const trackInviteActivity = async (req, res, next) => {
    try {
        const invite = await invitationService.touchInvitationActivity(req.params.token);
        return sendSuccess(res, { tracked: !!invite });
    } catch (error) {
        next(error);
    }
};

export const inviteUser = async (req, res, next) => {
    try {
        const { user } = await authService.inviteUser(req.body, req.user);
        return sendSuccess(res, { user, message: 'Invitation sent successfully' }, null, 201);
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// OTP-BASED REGISTRATION  (Step 1: send OTP → Step 2: verify OTP + create)
// =============================================================================

export const registerSendOTP = async (req, res, next) => {
    try {
        if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
            return sendError(res, 403, 'Sign up is by invitation only. Please check your email for an invitation link.');
        }
        const result = await authService.registerSendOTP(req.body);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

export const registerVerifyOTP = async (req, res, next) => {
    try {
        if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
            return sendError(res, 403, 'Sign up is by invitation only. Please check your email for an invitation link.');
        }
        const { user, organization, token, accessToken, refreshToken } = await authService.registerVerifyOTP(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken }, null, 201);
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// OTP-BASED FORGOT PASSWORD  (Step 1: send → Step 2: verify → Step 3: reset)
// =============================================================================

export const forgotPasswordSendOTP = async (req, res, next) => {
    try {
        const result = await authService.forgotPasswordSendOTP(req.body);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

export const forgotPasswordVerifyOTP = async (req, res, next) => {
    try {
        const result = await authService.forgotPasswordVerifyOTP(req.body);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

export const resetPasswordWithOTP = async (req, res, next) => {
    try {
        const { user, organization, token, accessToken, refreshToken } = await authService.resetPasswordWithOTP(req.body);
        setRefreshTokenCookie(res, refreshToken);
        return sendSuccess(res, { user, organization, token, accessToken, refreshToken });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    register,
    login,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
    acceptInvite,
    getMe,
    updateMySettings,
    touchActivity,
    validateInvite,
    trackInviteActivity,
    inviteUser,
    emailDiagnostics,
    registerSendOTP,
    registerVerifyOTP,
    forgotPasswordSendOTP,
    forgotPasswordVerifyOTP,
    resetPasswordWithOTP,
};
