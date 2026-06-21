/**
 * Authentication Service
 *
 * Business logic for authentication and user management.
 * Handles registration (with OTP email verification), login,
 * invites, and OTP-based password reset.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import OrganizationFramework from '../models/OrganizationFramework.js';
import RefreshToken from '../models/RefreshToken.js';
import {
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    expiryToMilliseconds,
    getJwtSecret,
} from '../config/auth.js';
import { sendOTP, verifyOTP, hasVerifiedOTP, consumeVerifiedOTP } from './otpService.js';
import { sendNotificationEmail } from './emailService.js';
import { createInvitation, acceptInvitation } from './invitationService.js';
import { getSessionTimeoutMinutes, isSessionExpired } from '../utils/sessionTimeout.js';
import { seedTrainingModulesForOrganization } from '../seeds/seedTrainingModules.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const expiryToDate = (expiry) => {
    return new Date(Date.now() + expiryToMilliseconds(expiry));
};

async function getPurchasedFrameworkIds(organizationId) {
    const [org, grants] = await Promise.all([
        Organization.findById(organizationId).select('settings.enabledFrameworks').lean(),
        OrganizationFramework.find({ organizationId, revokedAt: null }).select('frameworkId').lean(),
    ]);

    const ids = new Set([
        ...((org?.settings?.enabledFrameworks || []).map((id) => id.toString())),
        ...(grants.map((grant) => grant.frameworkId.toString())),
    ]);

    return [...ids];
}

const generateToken = async (user) => {
    const purchasedFrameworkIds = await getPurchasedFrameworkIds(user.organizationId);
    return jwt.sign(
        { userId: user._id, orgId: user.organizationId, role: user.role, purchasedFrameworkIds },
        getJwtSecret(),
        { expiresIn: ACCESS_TOKEN_EXPIRY },
    );
};

export const generateTokenPair = async (user) => {
    const accessToken = await generateToken(user);
    const refreshToken = crypto.randomBytes(64).toString('hex');

    await RefreshToken.create({
        token: refreshToken,
        user: user._id,
        expiresAt: expiryToDate(REFRESH_TOKEN_EXPIRY),
    });

    return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (incomingToken) => {
    if (!incomingToken) {
        const err = new Error('Refresh token is required');
        err.statusCode = 401;
        throw err;
    }

    const existingToken = await RefreshToken.findOne({ token: incomingToken }).populate('user');
    if (!existingToken) {
        const err = new Error('Invalid refresh token');
        err.statusCode = 401;
        throw err;
    }

    if (existingToken.revokedAt) {
        await RefreshToken.updateMany(
            { user: existingToken.user._id, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        );

        const err = new Error('Refresh token reuse detected');
        err.statusCode = 401;
        throw err;
    }

    if (!existingToken.isValid()) {
        const err = new Error('Invalid refresh token');
        err.statusCode = 401;
        throw err;
    }

    const user = existingToken.user;
    if (!user || user.isDeleted || user.status === 'SUSPENDED') {
        const err = new Error('User is not authorized');
        err.statusCode = 401;
        throw err;
    }

    const organization = await Organization.findById(user.organizationId)
        .select('settings.sessionTimeoutMinutes status')
        .lean();
    if (organization?.status === 'suspended') {
        const err = new Error('Organization is suspended. Please contact support.');
        err.statusCode = 403;
        throw err;
    }
    if (isSessionExpired(user, Date.now(), getSessionTimeoutMinutes(organization))) {
        existingToken.revokedAt = new Date();
        await existingToken.save();

        const err = new Error('Session expired due to inactivity');
        err.statusCode = 401;
        err.reason = 'session_timeout';
        throw err;
    }

    existingToken.revokedAt = new Date();
    const tokenPair = await generateTokenPair(user);
    existingToken.replacedByToken = tokenPair.refreshToken;
    await existingToken.save();
    user.lastActivityAt = new Date();
    await user.save();

    return tokenPair;
};

export const revokeRefreshToken = async (incomingToken) => {
    if (!incomingToken) return;

    await RefreshToken.updateOne(
        { token: incomingToken, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );
};

// =============================================================================
// REGISTRATION  (Step 1 → send OTP,  Step 2 → verify OTP & create account)
// =============================================================================

/**
 * Step 1: Validate registration data and send OTP to the email.
 * No account is created yet.
 */
export const registerSendOTP = async ({ email }) => {
    const existing = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (existing) {
        const err = new Error('Email is already registered');
        err.statusCode = 409;
        throw err;
    }

    const result = await sendOTP(email, 'REGISTRATION');
    return result;
};

/**
 * Step 2: Verify OTP, then create Organization + Admin User.
 */
export const registerVerifyOTP = async ({ companyName, email, password, firstName, lastName, otp }) => {
    await verifyOTP(email, otp, 'REGISTRATION');

    const existing = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (existing) {
        const err = new Error('Email is already registered');
        err.statusCode = 409;
        throw err;
    }

    const organization = await Organization.create({
        name: companyName,
        subscriptionTier: 'FREE',
        setupComplete: true,
    });

    let user;
    try {
        user = await User.create({
            organizationId: organization._id,
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: 'ADMIN',
            status: 'ACTIVE',
            isEmailVerified: true,
        });
    } catch (userError) {
        await Organization.findByIdAndDelete(organization._id);
        throw userError;
    }

    await seedTrainingModulesForOrganization(organization._id);
    await consumeVerifiedOTP(email, 'REGISTRATION');

    const tokenPair = await generateTokenPair(user);

    await sendNotificationEmail(
        user.email,
        user.fullName,
        'Welcome to Veraha Security',
        `Hi ${user.firstName}, your organization "${organization.name}" has been created. You're all set!`,
    );

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

/**
 * Legacy register (no OTP) — kept for backward compatibility / testing.
 */
export const registerTenant = async ({ companyName, email, password, firstName, lastName }) => {
    const existing = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (existing) {
        const err = new Error('Email is already registered');
        err.statusCode = 409;
        throw err;
    }

    const organization = await Organization.create({
        name: companyName,
        subscriptionTier: 'FREE',
        setupComplete: true,
    });

    let user;
    try {
        user = await User.create({
            organizationId: organization._id,
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: 'ADMIN',
            status: 'ACTIVE',
        });
    } catch (userError) {
        await Organization.findByIdAndDelete(organization._id);
        throw userError;
    }

    await seedTrainingModulesForOrganization(organization._id);
    const tokenPair = await generateTokenPair(user);

    await sendNotificationEmail(
        user.email,
        user.fullName,
        'Welcome to Veraha Security',
        `Hi ${user.firstName}, your organization "${organization.name}" has been created.`,
    );

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

// =============================================================================
// LOGIN
// =============================================================================

export const login = async ({ email, password }) => {
    const user = await User.findByEmail(email);

    if (!user) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    if (user.isDeleted) {
        const err = new Error('Account has been disabled');
        err.statusCode = 401;
        throw err;
    }

    if (user.status === 'SUSPENDED') {
        const err = new Error('Account is suspended. Please contact support.');
        err.statusCode = 403;
        throw err;
    }

    const organizationStatus = await Organization.findById(user.organizationId).select('status').lean();
    if (organizationStatus?.status === 'suspended') {
        const err = new Error('Organization is suspended. Please contact support.');
        err.statusCode = 403;
        throw err;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    await user.recordLogin();

    const tokenPair = await generateTokenPair(user);
    const organization = await Organization.findById(user.organizationId);

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

// =============================================================================
// USER INVITATION
// =============================================================================

export const inviteUser = async ({ email, role, firstName, lastName }, inviter) => {
    return createInvitation({ email, role, firstName, lastName }, inviter);
};

// =============================================================================
// ACCEPT INVITATION
// =============================================================================

export const acceptInvite = async ({ token, password, firstName, lastName }) => {
    const { user, organization } = await acceptInvitation({ token, password, firstName, lastName });
    const tokenPair = await generateTokenPair(user);

    await sendNotificationEmail(
        user.email,
        user.fullName,
        'Welcome to Veraha Security',
        `Hi ${user.firstName}, your account has been activated. You can now log in.`,
    );

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

// =============================================================================
// FORGOT PASSWORD  (OTP-based)
// =============================================================================

/**
 * Step 1: Send OTP for password reset.
 * Always returns success to prevent email enumeration.
 */
export const forgotPasswordSendOTP = async ({ email }) => {
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });

    if (!user || user.status === 'SUSPENDED') {
        return { message: 'If your email is registered, you will receive a verification code.' };
    }

    const result = await sendOTP(email, 'FORGOT_PASSWORD');
    return {
        message: 'If your email is registered, you will receive a verification code.',
        ...(result.testOtp ? { testOtp: result.testOtp } : {}),
    };
};

/**
 * Step 2: Verify the OTP. Returns { verified: true } on success.
 */
export const forgotPasswordVerifyOTP = async ({ email, otp }) => {
    return verifyOTP(email, otp, 'FORGOT_PASSWORD');
};

/**
 * Step 3: Reset password after OTP was verified.
 */
export const resetPasswordWithOTP = async ({ email, password }) => {
    const verified = await hasVerifiedOTP(email, 'FORGOT_PASSWORD');
    if (!verified) {
        const err = new Error('OTP not verified. Please verify your code first.');
        err.statusCode = 400;
        throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    await consumeVerifiedOTP(email, 'FORGOT_PASSWORD');

    const tokenPair = await generateTokenPair(user);
    const organization = await Organization.findById(user.organizationId);

    await sendNotificationEmail(
        user.email,
        user.fullName,
        'Password Changed Successfully',
        `Hi ${user.firstName}, your password has been changed successfully.`,
    );

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

/**
 * Legacy forgot-password (token-based) — kept for backward compatibility.
 */
export const forgotPassword = async ({ email }) => {
    return forgotPasswordSendOTP({ email });
};

/**
 * Legacy reset-password (token-based) — kept for backward compatibility.
 */
export const resetPassword = async ({ token, password }) => {
    const user = await User.findByResetToken(token);

    if (!user) {
        const err = new Error('Invalid or expired reset token');
        err.statusCode = 400;
        throw err;
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    const tokenPair = await generateTokenPair(user);
    const organization = await Organization.findById(user.organizationId);

    await sendNotificationEmail(
        user.email,
        user.fullName,
        'Password Changed Successfully',
        `Hi ${user.firstName}, your password has been changed successfully.`,
    );

    return { user, organization, token: tokenPair.accessToken, ...tokenPair };
};

// =============================================================================
// USER PROFILE
// =============================================================================

export const getCurrentUser = async (userId) => {
    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    const organization = await Organization.findById(user.organizationId);
    const purchasedFrameworkIds = await getPurchasedFrameworkIds(user.organizationId);
    return {
        user: user.toObject ? { ...user.toObject(), purchasedFrameworkIds } : { ...user, purchasedFrameworkIds },
        organization,
    };
};

export const updateUserSettings = async (userId, settings) => {
    const user = await User.findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { $set: { 'settings.sessionTimeoutMinutes': settings.sessionTimeoutMinutes } },
        { new: true, runValidators: true },
    );

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    return user;
};

export const touchUserActivity = async (userId) => {
    await User.updateOne({ _id: userId }, { $set: { lastActivityAt: new Date() } });
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    registerTenant,
    registerSendOTP,
    registerVerifyOTP,
    login,
    inviteUser,
    acceptInvite,
    forgotPassword,
    forgotPasswordSendOTP,
    forgotPasswordVerifyOTP,
    resetPasswordWithOTP,
    resetPassword,
    getCurrentUser,
    updateUserSettings,
    touchUserActivity,
    generateTokenPair,
    rotateRefreshToken,
    revokeRefreshToken,
    getPurchasedFrameworkIds,
};
