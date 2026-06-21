/**
 * OTP Service
 *
 * Orchestrates OTP generation, email delivery, verification, and rate-limiting.
 */

import OTP from '../models/OTP.js';
import { sendOtpEmail } from './emailService.js';

const RESEND_COOLDOWN_SECONDS = 60;

function logOTP(email, otp, purpose) {
  if (purpose !== 'REGISTRATION') return;
  if (process.env.EMAIL_MODE !== 'dev' && process.env.LOG_REGISTRATION_OTP !== 'true') return;
  console.log(`[OTP] ${purpose} code for ${email}: ${otp}`);
}

/**
 * Send an OTP to the given email for the specified purpose.
 * Returns { message, testOtp? } — testOtp is only included when ZeptoMail is not configured.
 */
export async function sendOTP(email, purpose) {
  const canSend = await OTP.canResend(email, purpose, RESEND_COOLDOWN_SECONDS);
  if (!canSend) {
    const err = new Error('Please wait before requesting a new code.');
    err.statusCode = 429;
    throw err;
  }

  const otp = await OTP.createOTP(email, purpose);
  logOTP(email, otp, purpose);

  const result = await sendOtpEmail(email, otp, purpose);

  const response = { message: `Verification code sent to ${email}.` };

  if (result.devMode || result.testMode) {
    response.testOtp = otp;
  }

  return response;
}

/**
 * Verify an OTP code.
 */
export async function verifyOTP(email, otp, purpose) {
  await OTP.verifyOTP(email, otp, purpose);
  return { message: 'Code verified successfully.', verified: true };
}

/**
 * Check if a verified OTP exists for an email + purpose.
 */
export async function hasVerifiedOTP(email, purpose) {
  return OTP.hasVerifiedOTP(email, purpose);
}

/**
 * Consume (delete) a verified OTP after the downstream action completes.
 */
export async function consumeVerifiedOTP(email, purpose) {
  return OTP.consumeVerifiedOTP(email, purpose);
}

export default { sendOTP, verifyOTP, hasVerifiedOTP, consumeVerifiedOTP };
