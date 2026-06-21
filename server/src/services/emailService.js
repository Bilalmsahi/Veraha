/**
 * Email Service - ZeptoMail Integration
 *
 * Sends transactional emails via ZeptoMail API.
 * This service never throws for delivery failures; callers receive
 * { success: false, ... } and the application keeps running.
 */

import dns from 'node:dns/promises';

const ZEPTOMAIL_HOST = 'api.zeptomail.com';
const ZEPTOMAIL_URL = `https://${ZEPTOMAIL_HOST}/v1.1/email`;
const AUTH_PREFIX = 'Zoho-enczapikey ';
const DEFAULT_EMAIL_TIMEOUT_MS = 10000;

function getConfig() {
  const raw = process.env.ZEPTOMAIL_API_KEY || '';
  const apiKey = raw.startsWith(AUTH_PREFIX) ? raw : raw ? `${AUTH_PREFIX}${raw}` : '';
  return {
    apiKey,
    fromEmail: process.env.ZEPTOMAIL_FROM_EMAIL || 'noreply@veraha.ai',
    fromName: process.env.ZEPTOMAIL_FROM_NAME || 'Veraha Security',
  };
}

function isTestMode() {
  return !getConfig().apiKey;
}

function isDevMode() {
  return process.env.EMAIL_MODE === 'dev';
}

function getRequestTimeoutMs() {
  const configured = Number(process.env.EMAIL_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EMAIL_TIMEOUT_MS;
}

function getErrorCode(error) {
  return error?.code || error?.cause?.code || null;
}

function classifyEmailError(error) {
  const errorCode = getErrorCode(error);

  if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
    return 'DNS resolution failed - unable to reach ZeptoMail API server. Check server DNS/network configuration.';
  }
  if (errorCode === 'ECONNREFUSED') {
    return 'Connection refused - ZeptoMail API server rejected the connection. Server may be down.';
  }
  if (errorCode === 'ECONNRESET') {
    return 'Connection reset - ZeptoMail API closed the connection unexpectedly.';
  }
  if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT') {
    return 'Connection timed out - ZeptoMail API took too long to respond.';
  }
  if (errorCode === 'CERT_HAS_EXPIRED' || errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'SSL/TLS certificate error - unable to establish secure connection with ZeptoMail.';
  }
  if (errorCode === 'ENETUNREACH') {
    return 'Network unreachable - no network connection available.';
  }
  if (error?.name === 'AbortError') {
    return 'Request timed out - ZeptoMail API did not respond before the configured timeout.';
  }
  if (error?.message?.includes('fetch')) {
    return 'Fetch API error - unable to complete the ZeptoMail request.';
  }

  return `Unexpected error: ${error?.message || 'Unknown error'}`;
}

function logCompleteEmail({ to, toName, fromEmail, fromName, subject, html, text }, logger = console.log) {
  logger('\n========================================');
  logger('COMPLETE EMAIL');
  logger('========================================');
  logger(`From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}`);
  logger(`To: ${toName ? `${toName} <${to}>` : to}`);
  logger(`Subject: ${subject}`);
  logger('----------------------------------------');
  logger('Text Body:');
  logger(text || '(none)');
  logger('----------------------------------------');
  logger('HTML Body:');
  logger(html || '(none)');
  logger('========================================\n');
}

function logEmailServiceFailure(email, reason, error = null) {
  const { to, subject } = email;
  console.error('\n============================================================');
  console.error('EMAIL SERVICE NOT WORKING');
  console.error('============================================================');
  console.error(`Reason: ${reason}`);
  console.error(`To: ${to}`);
  console.error(`Subject: ${subject}`);

  logCompleteEmail(email, console.error);

  if (error) {
    const errorCode = getErrorCode(error);
    console.error('Error Details:', error.message || error);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    if (errorCode) {
      console.error('Error Code:', errorCode);
    }
  }

  console.error('============================================================');
  console.error('Email delivery failed but application continues running.');
  console.error('Please check:');
  console.error('  1. ZEPTOMAIL_API_KEY is set correctly');
  console.error('  2. ZeptoMail service is accessible from this server');
  console.error('  3. From email is verified in ZeptoMail');
  console.error('  4. Server DNS/network connectivity is stable');
  console.error('============================================================\n');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());
  timeout.unref?.();

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send an email via ZeptoMail, or skip in dev/test mode.
 */
export async function sendEmail({ to, toName, subject, html, text }) {
  const { apiKey, fromEmail, fromName } = getConfig();
  const email = { to, toName, fromEmail, fromName, subject, html, text };

  if (isDevMode()) {
    console.log(`[DEV MODE] Skipping email to ${to} | Subject: ${subject}`);
    logCompleteEmail(email);
    return { success: true, devMode: true };
  }

  if (isTestMode()) {
    console.log('EMAIL (test mode - no ZEPTOMAIL_API_KEY)');
    logCompleteEmail(email);
    return { success: true, testMode: true };
  }

  const payload = {
    from: { address: fromEmail, name: fromName },
    to: [{ email_address: { address: to, name: toName || to } }],
    subject,
    ...(html ? { htmlbody: html } : {}),
    ...(text ? { textbody: text } : {}),
  };

  try {
    const res = await fetchWithTimeout(ZEPTOMAIL_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      const reason = `Failed to parse ZeptoMail response (HTTP ${res.status})`;
      logEmailServiceFailure(email, reason, parseError);
      return {
        success: false,
        error: reason,
        httpStatus: res.status,
        serviceUnavailable: true,
      };
    }

    if (!res.ok) {
      const errorMessage = data?.error?.message || data?.message || `ZeptoMail request failed (HTTP ${res.status})`;
      const errorCode = data?.error?.code || data?.code || null;
      const reason = `ZeptoMail API error: ${errorMessage}${errorCode ? ` [${errorCode}]` : ''}`;

      logEmailServiceFailure(email, reason);

      return {
        success: false,
        error: errorMessage,
        errorCode,
        httpStatus: res.status,
        data,
        serviceUnavailable: true,
      };
    }

    return { success: true, data };
  } catch (error) {
    const reason = classifyEmailError(error);

    logEmailServiceFailure(email, reason, error);

    return {
      success: false,
      error: reason,
      errorCode: getErrorCode(error),
      serviceUnavailable: true,
    };
  }
}

/**
 * Return safe email-provider diagnostics for admins.
 * Never includes secrets or full API keys.
 */
export async function getEmailDiagnostics({ checkConnectivity = false } = {}) {
  const { apiKey, fromEmail, fromName } = getConfig();
  const fromEmailConfigured = Boolean(process.env.ZEPTOMAIL_FROM_EMAIL);
  const diagnostics = {
    provider: 'ZeptoMail',
    host: ZEPTOMAIL_HOST,
    apiKeyConfigured: Boolean(apiKey),
    fromEmailConfigured,
    fromEmail,
    fromEmailUsesDefault: !fromEmailConfigured,
    fromName,
    emailMode: process.env.EMAIL_MODE || 'live',
    requestTimeoutMs: getRequestTimeoutMs(),
    dns: {
      ok: false,
      addresses: [],
      error: null,
      errorCode: null,
    },
  };

  try {
    const addresses = await dns.lookup(ZEPTOMAIL_HOST, { all: true });
    diagnostics.dns.ok = true;
    diagnostics.dns.addresses = addresses.map((entry) => ({
      address: entry.address,
      family: entry.family,
    }));
  } catch (error) {
    diagnostics.dns.error = classifyEmailError(error);
    diagnostics.dns.errorCode = getErrorCode(error);
  }

  if (checkConnectivity) {
    diagnostics.connectivity = {
      ok: false,
      reachedProvider: false,
      httpStatus: null,
      error: null,
      errorCode: null,
    };

    try {
      const response = await fetchWithTimeout(ZEPTOMAIL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: apiKey } : {}),
        },
        body: JSON.stringify({}),
      });

      diagnostics.connectivity.ok = true;
      diagnostics.connectivity.reachedProvider = true;
      diagnostics.connectivity.httpStatus = response.status;
    } catch (error) {
      diagnostics.connectivity.error = classifyEmailError(error);
      diagnostics.connectivity.errorCode = getErrorCode(error);
    }
  }

  return diagnostics;
}

/**
 * Send OTP verification email.
 */
export async function sendOtpEmail(to, otp, purpose = 'verification') {
  const purposeMap = {
    REGISTRATION: { subject: 'Verify your email - Veraha Security', heading: 'Verify your email address' },
    FORGOT_PASSWORD: { subject: 'Password reset code - Veraha Security', heading: 'Reset your password' },
    LOGIN: { subject: 'Login verification code - Veraha Security', heading: 'Verify your login' },
  };

  const meta = purposeMap[purpose] || purposeMap.REGISTRATION;

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="color: #1a1a1a; font-size: 22px; margin: 0;">${meta.heading}</h2>
      </div>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Use the code below to continue. This code expires in <strong>10 minutes</strong>.
      </p>
      <div style="background: #f4f6f8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a1a1a;">${otp}</span>
      </div>
      <p style="color: #999; font-size: 13px; line-height: 1.5;">
        If you didn't request this code, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">
        Veraha Security - Compliance Automation Platform
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: meta.subject,
    html,
    text: `Your Veraha Security ${purpose.toLowerCase().replace('_', ' ')} code is: ${otp}. It expires in 10 minutes.`,
  });
}

/**
 * Send a generic notification email.
 */
export async function sendNotificationEmail(to, toName, subject, body) {
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
      <p style="color: #555; font-size: 15px; line-height: 1.6;">${body}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">Veraha Security - Compliance Automation Platform</p>
    </div>
  `;

  return sendEmail({ to, toName, subject, html, text: body });
}

export default {
  sendEmail,
  sendOtpEmail,
  sendNotificationEmail,
  getEmailDiagnostics,
  isTestMode,
  isDevMode,
};
