import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DEVICE_SETTINGS_CHECKLIST,
  DEVICE_SETTINGS_MAX_PROOF_SIZE,
  DEVICE_SETTINGS_PROOF_ACCEPT,
  type DeviceSettingsChecklistKey,
} from '@/constants/deviceSettingsChecklist';
import type { DeviceCompliance, DeviceSettingsSubmission } from '@/api/devices';

export type DeviceSettingsChecklistState = Record<
  DeviceSettingsChecklistKey,
  { checked: boolean; file: File | null }
>;

export const emptyChecklistState = (): DeviceSettingsChecklistState =>
  Object.fromEntries(
    DEVICE_SETTINGS_CHECKLIST.map((item) => [item.key, { checked: false, file: null }])
  ) as DeviceSettingsChecklistState;

const DEFAULT_CHECKLIST_STATE = emptyChecklistState();

export function complianceToChecklistState(
  compliance?: Partial<DeviceCompliance>
): DeviceSettingsChecklistState {
  return {
    diskEncryptionEnabled: { checked: Boolean(compliance?.diskEncryptionEnabled), file: null },
    screenLockEnabled: { checked: Boolean(compliance?.screenLockEnabled), file: null },
    antivirus: { checked: Boolean(compliance?.antivirusInstalled), file: null },
    passwordManager: { checked: Boolean(compliance?.passwordManagerInstalled), file: null },
  };
}

export function checklistStateToCompliance(state: DeviceSettingsChecklistState): DeviceCompliance {
  return {
    diskEncryptionEnabled: state.diskEncryptionEnabled.checked,
    screenLockEnabled: state.screenLockEnabled.checked,
    antivirusInstalled: state.antivirus.checked,
    passwordManagerInstalled: state.passwordManager.checked,
  };
}

export function checklistStateToSubmission(state: DeviceSettingsChecklistState): DeviceSettingsSubmission {
  return {
    checklistItems: DEVICE_SETTINGS_CHECKLIST.map((item) => ({
      key: item.key,
      checked: state[item.key].checked,
    })),
    files: Object.fromEntries(
      DEVICE_SETTINGS_CHECKLIST.map((item) => [item.key, state[item.key].file]).filter(
        ([, file]) => Boolean(file)
      )
    ) as Partial<Record<DeviceSettingsChecklistKey, File>>,
  };
}

export function hasChecklistActivity(state: DeviceSettingsChecklistState) {
  return DEVICE_SETTINGS_CHECKLIST.some(
    (item) => state[item.key].checked || Boolean(state[item.key].file)
  );
}

export function useDeviceSettingsChecklistState() {
  const [state, setState] = useState<DeviceSettingsChecklistState>(DEFAULT_CHECKLIST_STATE);
  const [fileErrors, setFileErrors] = useState<Partial<Record<DeviceSettingsChecklistKey, string>>>({});

  const setChecked = (key: DeviceSettingsChecklistKey, checked: boolean) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        checked,
        file: checked ? prev[key].file : null,
      },
    }));
    if (!checked) {
      setFileErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const setFile = (key: DeviceSettingsChecklistKey, file: File | null) => {
    if (!file) {
      setState((prev) => ({ ...prev, [key]: { ...prev[key], file: null } }));
      setFileErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    if (file.size > DEVICE_SETTINGS_MAX_PROOF_SIZE) {
      setFileErrors((prev) => ({ ...prev, [key]: 'File must be 5MB or smaller.' }));
      return;
    }

    setFileErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setState((prev) => ({ ...prev, [key]: { ...prev[key], file } }));
  };

  const reset = (nextInitial?: DeviceSettingsChecklistState) => {
    setState(nextInitial ?? emptyChecklistState());
    setFileErrors({});
  };

  return {
    state,
    fileErrors,
    setChecked,
    setFile,
    reset,
    hasErrors: Object.keys(fileErrors).length > 0,
  };
}

type DeviceSettingsChecklistFieldsProps = {
  state: DeviceSettingsChecklistState;
  fileErrors: Partial<Record<DeviceSettingsChecklistKey, string>>;
  onCheckedChange: (key: DeviceSettingsChecklistKey, checked: boolean) => void;
  onFileChange: (key: DeviceSettingsChecklistKey, file: File | null) => void;
  idPrefix?: string;
};

export function DeviceSettingsChecklistFields({
  state,
  fileErrors,
  onCheckedChange,
  onFileChange,
  idPrefix = 'proof',
}: DeviceSettingsChecklistFieldsProps) {
  return (
    <div className="space-y-3">
      {DEVICE_SETTINGS_CHECKLIST.map((item) => {
        const row = state[item.key];
        return (
          <div key={item.key} className="rounded-md border p-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={row.checked}
                onCheckedChange={(checked) => onCheckedChange(item.key, checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm font-medium">{item.label}</span>
            </label>

            {row.checked && (
              <div className="mt-3 space-y-2 pl-7">
                <Label htmlFor={`${idPrefix}-${item.key}`} className="text-xs text-muted-foreground">
                  Optional screenshot or PDF (PNG, JPEG, WEBP, PDF · max 5MB)
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    id={`${idPrefix}-${item.key}`}
                    type="file"
                    accept={DEVICE_SETTINGS_PROOF_ACCEPT}
                    onChange={(event) => onFileChange(item.key, event.target.files?.[0] ?? null)}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
                  />
                  {row.file && (
                    <span className="truncate text-xs text-muted-foreground">{row.file.name}</span>
                  )}
                </div>
                {fileErrors[item.key] && (
                  <p className="text-xs text-destructive">{fileErrors[item.key]}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
