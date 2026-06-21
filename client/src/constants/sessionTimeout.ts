export const DEFAULT_SESSION_TIMEOUT_MINUTES = 1440;

export const SESSION_TIMEOUT_WARNING_MINUTES = 2;

export const LAST_ACTIVITY_STORAGE_KEY = 'veraha-last-activity';

export const SESSION_TIMEOUT_OPTIONS = [
  { label: '30 Minutes', value: 30 },
  { label: '1 Hour', value: 60 },
  { label: '4 Hours', value: 240 },
  { label: '8 Hours', value: 480 },
  { label: '24 Hours', value: 1440 },
  { label: '2 Days', value: 2880 },
  { label: '3 Days', value: 4320 },
  { label: '7 Days', value: 10080 },
] as const;

export type SessionTimeoutMinutes = (typeof SESSION_TIMEOUT_OPTIONS)[number]['value'];

export function getSessionTimeoutMinutes(settings?: { sessionTimeoutMinutes?: number }): number {
  return SESSION_TIMEOUT_OPTIONS.some((option) => option.value === settings?.sessionTimeoutMinutes)
    ? settings!.sessionTimeoutMinutes!
    : DEFAULT_SESSION_TIMEOUT_MINUTES;
}

export function getSessionTimeoutLabel(minutes: number): string {
  return SESSION_TIMEOUT_OPTIONS.find((option) => option.value === minutes)?.label ?? `${minutes} Minutes`;
}
