import { ControlPickerModal } from '@/components/shared';
import { useLinkControls } from '@/api/evidence';

type EvidenceLinkControlsModalProps = {
  evidenceId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EvidenceLinkControlsModal({
  evidenceId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: EvidenceLinkControlsModalProps) {
  const linkControls = useLinkControls();

  const handleConfirm = (controlIds: string[]) => {
    if (!evidenceId || controlIds.length === 0) return;
    linkControls.mutate(
      { id: evidenceId, controlIds },
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
      title="Link controls"
      description="Select controls this evidence satisfies."
    />
  );
}
