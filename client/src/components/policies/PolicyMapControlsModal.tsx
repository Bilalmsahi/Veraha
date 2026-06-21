import { MapControlsSheet } from '@/components/shared';
import { useUpdatePolicy } from '@/api/policies';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

type PolicyMapControlsModalProps = {
  policyId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function PolicyMapControlsModal({
  policyId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: PolicyMapControlsModalProps) {
  const updatePolicy = useUpdatePolicy();

  const handleAddControl = (controlId: string) => {
    if (!policyId) return;
    const nextIds = [...new Set([...existingControlIds, controlId])];
    updatePolicy.mutate(
      { id: policyId, input: { linkedControlIds: nextIds } },
      {
        onSuccess: () => {
          toast.success('Control added');
          onSuccess?.();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      }
    );
  };

  const handleRemoveControl = (controlId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!policyId) return;
    const nextIds = existingControlIds.filter((id) => id !== controlId);
    updatePolicy.mutate(
      { id: policyId, input: { linkedControlIds: nextIds } },
      {
        onSuccess: () => {
          toast.success('Control removed');
          onSuccess?.();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      }
    );
  };

  return (
    <MapControlsSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Map controls to your policy"
      description="Connect your policy to relevant controls so it's easier to track what's covered and identify any gaps."
      existingControlIds={existingControlIds}
      onAddControl={handleAddControl}
      onRemoveControl={handleRemoveControl}
      isPending={updatePolicy.isPending}
    />
  );
}
