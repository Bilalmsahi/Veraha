import { ControlPickerModal } from '@/components/shared';
import { useLinkControls } from '@/api/risks';

type RiskLinkControlsModalProps = {
  riskId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function RiskLinkControlsModal({
  riskId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: RiskLinkControlsModalProps) {
  const linkControls = useLinkControls();

  const handleConfirm = (controlIds: string[]) => {
    if (!riskId || controlIds.length === 0) return;
    linkControls.mutate(
      { id: riskId, input: { controlIds } },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <ControlPickerModal
      open={open}
      onOpenChange={onOpenChange}
      existingControlIds={existingControlIds}
      onConfirm={handleConfirm}
      title="Link mitigating controls"
      description="Select controls that mitigate this risk."
    />
  );
}
