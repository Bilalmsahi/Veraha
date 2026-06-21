import { type FormEvent, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormErrorAlert } from '@/components/shared';
import { useSubmitDeviceSettings } from '@/api/devices';
import {
  DeviceSettingsChecklistFields,
  checklistStateToSubmission,
  emptyChecklistState,
  useDeviceSettingsChecklistState,
} from './DeviceSettingsChecklistFields';

type DeviceSettingsFormProps = {
  deviceId: string;
  deviceName?: string;
  onSuccess?: () => void;
};

export function DeviceSettingsForm({ deviceId, deviceName, onSuccess }: DeviceSettingsFormProps) {
  const submit = useSubmitDeviceSettings();
  const checklist = useDeviceSettingsChecklistState();

  useEffect(() => {
    checklist.reset(emptyChecklistState());
  }, [deviceId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (checklist.hasErrors) return;

    submit.mutate(
      {
        deviceId,
        submission: checklistStateToSubmission(checklist.state),
      },
      {
        onSuccess: () => {
          checklist.reset();
          onSuccess?.();
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submit.error && <FormErrorAlert message={(submit.error as Error).message} />}
      {deviceName && (
        <p className="text-sm text-muted-foreground">
          Confirm security settings for <span className="font-medium text-foreground">{deviceName}</span>.
          Screenshots are optional for each item.
        </p>
      )}

      <DeviceSettingsChecklistFields
        state={checklist.state}
        fileErrors={checklist.fileErrors}
        onCheckedChange={checklist.setChecked}
        onFileChange={checklist.setFile}
      />

      <Button type="submit" disabled={submit.isPending}>
        <Upload className="mr-2 size-4" />
        {submit.isPending ? 'Submitting...' : 'Submit device settings'}
      </Button>
    </form>
  );
}
