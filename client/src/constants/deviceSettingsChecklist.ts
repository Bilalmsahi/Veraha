export const DEVICE_SETTINGS_CHECKLIST = [
  { key: 'diskEncryptionEnabled', label: 'Disk Encryption' },
  { key: 'screenLockEnabled', label: 'Screen Lock' },
  { key: 'antivirus', label: 'Antivirus' },
  { key: 'passwordManager', label: 'Password Manager' },
] as const;

export type DeviceSettingsChecklistKey = (typeof DEVICE_SETTINGS_CHECKLIST)[number]['key'];

export const DEVICE_SETTINGS_PROOF_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf';
export const DEVICE_SETTINGS_MAX_PROOF_SIZE = 5 * 1024 * 1024;

export type DeviceSettingsChecklistItem = {
  key: DeviceSettingsChecklistKey;
  label: string;
  checked: boolean;
  evidenceFileId: string | null;
};

export type ChecklistItemReviewStatus = 'checked_with_proof' | 'checked_no_proof' | 'unchecked';

export function getChecklistItemStatus(item: Pick<DeviceSettingsChecklistItem, 'checked' | 'evidenceFileId'>): ChecklistItemReviewStatus {
  if (!item.checked) return 'unchecked';
  if (item.evidenceFileId) return 'checked_with_proof';
  return 'checked_no_proof';
}

export function formatChecklistItemStatus(status: ChecklistItemReviewStatus): string {
  if (status === 'checked_with_proof') return 'Checked + proof';
  if (status === 'checked_no_proof') return 'Checked, no proof';
  return 'Unchecked';
}
