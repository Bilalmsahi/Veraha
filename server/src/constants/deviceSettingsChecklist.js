export const DEVICE_SETTINGS_CHECKLIST = [
  { key: 'diskEncryptionEnabled', label: 'Disk Encryption' },
  { key: 'screenLockEnabled', label: 'Screen Lock' },
  { key: 'antivirus', label: 'Antivirus' },
  { key: 'passwordManager', label: 'Password Manager' },
];

export const DEVICE_SETTINGS_CHECKLIST_KEYS = DEVICE_SETTINGS_CHECKLIST.map((item) => item.key);

export const DEVICE_SETTINGS_PROOF_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

export const DEVICE_SETTINGS_MAX_PROOF_SIZE = 5 * 1024 * 1024;

export function buildDefaultChecklistItems() {
  return DEVICE_SETTINGS_CHECKLIST.map((item) => ({
    key: item.key,
    label: item.label,
    checked: false,
    evidenceFileId: null,
  }));
}

export function normalizeChecklistItems(evidence) {
  if (Array.isArray(evidence?.checklistItems) && evidence.checklistItems.length) {
    return evidence.checklistItems.map((item) => ({
      key: item.key,
      label: item.label,
      checked: Boolean(item.checked),
      evidenceFileId: item.evidenceFileId ? String(item.evidenceFileId) : null,
    }));
  }

  return buildDefaultChecklistItems();
}

export function getChecklistItemStatus(item) {
  if (!item.checked) return 'unchecked';
  if (item.evidenceFileId) return 'checked_with_proof';
  return 'checked_no_proof';
}
