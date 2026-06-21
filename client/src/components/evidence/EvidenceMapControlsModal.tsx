/**
 * Side panel to map controls to a document (evidence). Same UI/UX as policy "Map controls to your policy" sheet.
 */
import { MapControlsSheet } from '@/components/shared';
import { useLinkControls } from '@/api/evidence';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

type EvidenceMapControlsModalProps = {
  evidenceId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EvidenceMapControlsModal({
  evidenceId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: EvidenceMapControlsModalProps) {
  const linkControls = useLinkControls({ showSuccessToast: false });

  const handleAddControl = (controlId: string) => {
    if (!evidenceId) return;
    const nextIds = [...new Set([...existingControlIds, controlId])];
    linkControls.mutate(
      { id: evidenceId, controlIds: nextIds },
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
    if (!evidenceId) return;
    const nextIds = existingControlIds.filter((id) => id !== controlId);
    linkControls.mutate(
      { id: evidenceId, controlIds: nextIds },
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
      title="Map controls to your document"
      description="Connect your document to relevant controls so it's easier to track what's covered and identify any gaps."
      existingControlIds={existingControlIds}
      onAddControl={handleAddControl}
      onRemoveControl={handleRemoveControl}
      isPending={linkControls.isPending}
    />
  );
}
