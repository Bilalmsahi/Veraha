import { normalizeFrameworkLabel } from '@/utils/normalizeFrameworkLabel';

const FRAMEWORK_TAG_LABELS: Record<string, string> = {
  ISO27001: 'ISO 27001',
  SOC2: 'SOC 2',
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
};

export function frameworkTagLabel(tag: string): string {
  return FRAMEWORK_TAG_LABELS[tag] || normalizeFrameworkLabel(tag);
}
