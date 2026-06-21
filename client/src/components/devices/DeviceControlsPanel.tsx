import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import { ControlPickerModal } from '@/components/shared';
import { useLinkDeviceControls, useUnlinkDeviceControl } from '@/api/devices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type DeviceControlsPanelProps = {
  deviceId: string;
  linkedControlIds: string[];
  organizationId?: string;
};

function truncateControlId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function DeviceControlsPanel({
  deviceId,
  linkedControlIds,
}: DeviceControlsPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const linkControls = useLinkDeviceControls();
  const unlinkControl = useUnlinkDeviceControl();

  const handleLink = (controlIds: string[]) => {
    if (controlIds.length === 0) return;
    linkControls.mutate({ id: deviceId, controlIds });
  };

  const handleUnlink = (controlId: string) => {
    unlinkControl.mutate({ id: deviceId, controlId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Linked controls</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          disabled={linkControls.isPending}
        >
          <Link2 className="mr-2 size-4" />
          Link Controls
        </Button>
      </div>

      {linkedControlIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No controls linked — click &apos;Link Controls&apos; to connect this device to compliance
          controls
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linkedControlIds.map((controlId) => (
            <Badge key={controlId} variant="secondary" className="gap-1 pr-1 font-mono text-xs">
              {truncateControlId(controlId)}
              <button
                type="button"
                onClick={() => handleUnlink(controlId)}
                disabled={unlinkControl.isPending}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Unlink control ${controlId}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <ControlPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingControlIds={linkedControlIds}
        onConfirm={handleLink}
        title="Link controls"
        description="Select controls to link to this device."
      />
    </div>
  );
}
