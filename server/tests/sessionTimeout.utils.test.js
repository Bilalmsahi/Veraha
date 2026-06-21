import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  getSessionTimeoutMinutes,
  getLastActivityTimestamp,
  isSessionExpired,
} from '../src/utils/sessionTimeout.js';

describe('sessionTimeout utils', () => {
  test('defaults to 24 hours when user settings are missing', () => {
    expect(getSessionTimeoutMinutes({})).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
    expect(getSessionTimeoutMinutes({ settings: {} })).toBe(1440);
  });

  test('uses configured timeout minutes when present', () => {
    expect(getSessionTimeoutMinutes({ settings: { sessionTimeoutMinutes: 30 } })).toBe(30);
  });

  test('prefers lastActivityAt over lastLoginAt', () => {
    const activity = new Date('2026-05-25T10:00:00.000Z');
    const login = new Date('2026-05-25T09:00:00.000Z');

    expect(getLastActivityTimestamp({ lastActivityAt: activity, lastLoginAt: login })).toBe(
      activity.getTime(),
    );
  });

  test('treats missing activity timestamps as active', () => {
    expect(isSessionExpired({})).toBe(false);
  });

  test('expires sessions after configured inactivity', () => {
    const now = Date.parse('2026-05-25T12:00:00.000Z');
    const user = {
      settings: { sessionTimeoutMinutes: 30 },
      lastActivityAt: new Date(now - 31 * 60 * 1000),
    };

    expect(isSessionExpired(user, now)).toBe(true);
  });

  test('keeps sessions active inside the configured window', () => {
    const now = Date.parse('2026-05-25T12:00:00.000Z');
    const user = {
      settings: { sessionTimeoutMinutes: 30 },
      lastActivityAt: new Date(now - 29 * 60 * 1000),
    };

    expect(isSessionExpired(user, now)).toBe(false);
  });
});
