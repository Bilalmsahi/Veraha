import { ControlPickerModal } from '@/components/shared';
import { useLinkControls } from '@/api/vendors';

type VendorLinkControlsModalProps = {
  vendorId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function VendorLinkControlsModal({
  vendorId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: VendorLinkControlsModalProps) {
  const linkControls = useLinkControls();

  const handleConfirm = (controlIds: string[]) => {
    if (!vendorId || controlIds.length === 0) return;
    linkControls.mutate(
      { id: vendorId, controlIds },
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
      description="Select controls related to this vendor."
    />
  );
}
