/**
 * Formatting utilities for dates, percentages, scores, etc.
 */

import { normalizeFrameworkLabel } from '@/utils/normalizeFrameworkLabel';

/**
 * Format date for display (YYYY-MM-DD or localized)
 */
export function formatDate(
  date: string | Date | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format date with time
 */
export function formatDateTime(
  date: string | Date | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Format percentage (0-100)
 */
export function formatPercentage(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

/**
 * Relative time (e.g., "2 hours ago", "in 3 days")
 */
export function timeAgo(date: string | Date | undefined | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const absSec = Math.abs(diffSec);
  const absMin = Math.abs(diffMin);
  const absHour = Math.abs(diffHour);
  const absDay = Math.abs(diffDay);

  if (absSec < 60) return diffSec >= 0 ? `in ${diffSec}s` : `${absSec}s ago`;
  if (absMin < 60)
    return diffMin >= 0 ? `in ${diffMin}m` : `${absMin}m ago`;
  if (absHour < 24)
    return diffHour >= 0 ? `in ${diffHour}h` : `${absHour}h ago`;
  if (absDay < 30)
    return diffDay >= 0 ? `in ${diffDay}d` : `${absDay}d ago`;

  return formatDate(d);
}

/**
 * Format risk score (1-25 scale) as display string
 */
export function formatScore(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—';
  return String(Math.round(value));
}

/**
 * Format framework code or API-provided framework name for display
 * (e.g., SOC2 → "SOC 2", ISO27001 → "ISO 27001", "SOC 2 Type II" → "SOC 2").
 */
export function formatFrameworkCode(code: string | undefined | null): string {
  if (!code) return '—';
  const step = code === 'ISO27001' ? 'ISO 27001' : code;
  return normalizeFrameworkLabel(step);
}

/**
 * Format domain/category for display (e.g. CLOUD_SECURITY → Cloud security)
 */
export function formatDomainLabel(value: string | undefined | null): string {
  if (!value) return '—';
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes == null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
