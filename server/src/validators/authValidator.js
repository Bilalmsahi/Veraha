/**
 * Authentication Validators (Zod Schemas)
 * 
 * All validation schemas for auth-related endpoints.
 * Synced with frontend validators for consistency.
 */

import { z } from 'zod';
import { ROLE } from '../models/enums.js';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Email validation
 * Reused across multiple schemas
 */
const emailField = z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim();

/**
 * Password validation
 * Must be 12+ chars with uppercase, lowercase, number, special char
 */
const passwordField = z
    .string({ required_error: 'Password is required' })
    .min(12, 'Password must be at least 12 characters')
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        'Password must contain: uppercase, lowercase, number, and special character (@$!%*?&)'
    );

/**
 * Name fields
 */
const firstNameField = z
    .string({ required_error: 'First name is required' })
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .trim();

const lastNameField = z
    .string({ required_error: 'Last name is required' })
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .trim();

/**
 * Token validation (for invite/reset tokens)
 */
const tokenField = z
    .string({ required_error: 'Token is required' })
    .min(1, 'Token is required');

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

/**
 * Register new tenant schema
 * Creates Organization + Admin User
 */
export const registerSchema = z.object({
    companyName: z
        .string({ required_error: 'Company name is required' })
        .min(2, 'Company name must be at least 2 characters')
        .max(100, 'Company name too long')
        .trim(),
    email: emailField,
    password: passwordField,
    firstName: firstNameField,
    lastName: lastNameField,
});

/**
 * Login schema
 */
export const loginSchema = z.object({
    email: emailField,
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

/**
 * Invite user schema
 * Role must be one of the allowed values (not ADMIN - only for registration)
 */
const INVITABLE_ROLES = ROLE.filter((r) => r !== 'ADMIN');

export const inviteSchema = z.object({
    email: emailField,
    role: z.enum(INVITABLE_ROLES, {
        errorMap: () => ({ message: `Role must be one of: ${INVITABLE_ROLES.join(', ')}` }),
    }),
    firstName: firstNameField,
    lastName: lastNameField,
});

/**
 * Accept invite schema
 * firstName and lastName are optional (may already be set by inviter)
 */
export const acceptInviteSchema = z.object({
    token: tokenField,
    password: passwordField,
    confirmPassword: passwordField.optional(),
    firstName: firstNameField.optional(),
    lastName: lastNameField.optional(),
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
});

/**
 * Email-only schema (for forgot password)
 */
export const emailSchema = z.object({
    email: emailField,
});

/**
 * Reset password schema (legacy token-based)
 */
export const resetPasswordSchema = z.object({
    token: tokenField,
    password: passwordField,
});

// =============================================================================
// OTP SCHEMAS
// =============================================================================

const otpField = z
    .string({ required_error: 'Verification code is required' })
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits');

/**
 * Send OTP for registration (email only — account doesn't exist yet)
 */
export const registerSendOtpSchema = z.object({
    email: emailField,
});

/**
 * Verify OTP and complete registration
 */
export const registerVerifyOtpSchema = z.object({
    companyName: z
        .string({ required_error: 'Company name is required' })
        .min(2, 'Company name must be at least 2 characters')
        .max(100, 'Company name too long')
        .trim(),
    email: emailField,
    password: passwordField,
    firstName: firstNameField,
    lastName: lastNameField,
    otp: otpField,
});

/**
 * Verify OTP (generic — email + otp + purpose)
 */
export const verifyOtpSchema = z.object({
    email: emailField,
    otp: otpField,
});

/**
 * OTP-based password reset (final step)
 */
export const resetPasswordOtpSchema = z.object({
    email: emailField,
    password: passwordField,
});

// =============================================================================
// EXPORTS
// =============================================================================

export default {
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
};
