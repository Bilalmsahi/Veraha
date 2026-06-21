import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  getSessionTimeoutMinutes,
  SESSION_TIMEOUT_OPTIONS,
  SESSION_TIMEOUT_WARNING_MINUTES,
} from '@/constants/sessionTimeout';
import { isSessionTimeoutResponse } from '@/utils/isSessionTimeoutResponse';
import { getSessionTimeoutSchedule } from '@/utils/sessionTimeoutTimer';

describe('session timeout constants', () => {
  it('defaults to 24 hours when settings are missing', () => {
    expect(getSessionTimeoutMinutes()).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
    expect(getSessionTimeoutMinutes({})).toBe(1440);
  });

  it('exposes the configured dropdown options', () => {
    expect(SESSION_TIMEOUT_OPTIONS.map((option) => option.value)).toEqual([
      30,
      60,
      240,
      480,
      1440,
      2880,
      4320,
      10080,
    ]);
  });
});

describe('getSessionTimeoutSchedule', () => {
  const timeoutMinutes = 30;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = timeoutMs - SESSION_TIMEOUT_WARNING_MINUTES * 60 * 1000;

  it('returns waiting before the warning window', () => {
    expect(getSessionTimeoutSchedule(5 * 60 * 1000, timeoutMinutes)).toEqual({
      kind: 'waiting',
      warningInMs: warningMs - 5 * 60 * 1000,
    });
  });

  it('returns warning during the final 2 minutes', () => {
    expect(getSessionTimeoutSchedule(warningMs + 1000, timeoutMinutes)).toEqual({
      kind: 'warning',
      logoutInMs: timeoutMs - (warningMs + 1000),
    });
  });

  it('returns logout once the timeout has elapsed', () => {
    expect(getSessionTimeoutSchedule(timeoutMs, timeoutMinutes)).toEqual({ kind: 'logout' });
    expect(getSessionTimeoutSchedule(timeoutMs + 1, timeoutMinutes)).toEqual({ kind: 'logout' });
  });
});

describe('isSessionTimeoutResponse', () => {
  it('detects explicit session timeout metadata', () => {
    expect(isSessionTimeoutResponse({ meta: { reason: 'session_timeout' } })).toBe(true);
  });

  it('detects inactivity error messages', () => {
    expect(isSessionTimeoutResponse({ error: 'Session expired due to inactivity' })).toBe(true);
  });

  it('returns false for unrelated auth failures', () => {
    expect(isSessionTimeoutResponse({ error: 'Invalid token' })).toBe(false);
    expect(isSessionTimeoutResponse(null)).toBe(false);
  });
});
