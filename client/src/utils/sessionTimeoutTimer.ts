import { SESSION_TIMEOUT_WARNING_MINUTES } from '@/constants/sessionTimeout';

export type SessionTimeoutSchedule =
  | { kind: 'logout' }
  | { kind: 'warning'; logoutInMs: number }
  | { kind: 'waiting'; warningInMs: number };

export function getSessionTimeoutSchedule(
  elapsedMs: number,
  timeoutMinutes: number,
  warningMinutes = SESSION_TIMEOUT_WARNING_MINUTES,
): SessionTimeoutSchedule {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = Math.max(timeoutMs - warningMinutes * 60 * 1000, 0);

  if (elapsedMs >= timeoutMs) {
    return { kind: 'logout' };
  }

  if (elapsedMs >= warningMs) {
    return { kind: 'warning', logoutInMs: timeoutMs - elapsedMs };
  }

  return { kind: 'waiting', warningInMs: warningMs - elapsedMs };
}
