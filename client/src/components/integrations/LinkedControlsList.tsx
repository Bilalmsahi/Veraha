import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import { ControlPickerModal } from '@/components/shared';
import { useControls } from '@/api/controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type LinkedControlsListProps = {
  linkedControlIds: string[];
  onLink: (controlIds: string[]) => void;
  onUnlink: (controlId: string) => void;
  isLinking?: boolean;
  isUnlinking?: boolean;
  title?: string;
  emptyMessage?: string;
  pickerTitle?: string;
  pickerDescription?: string;
};

export function LinkedControlsList({
  linkedControlIds,
  onLink,
  onUnlink,
  isLinking = false,
  isUnlinking = false,
  title = 'Linked controls',
  emptyMessage = 'No controls linked yet.',
  pickerTitle = 'Link controls',
  pickerDescription = 'Select controls to link.',
}: LinkedControlsListProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const controlsQuery = useControls({ limit: 200 });

  const controlMap = new Map<string, { identifier?: string; title?: string }>();
  for (const control of controlsQuery.data?.controls ?? []) {
    controlMap.set(control._id, {
      identifier: control.identifier,
      title: control.title,
    });
  }

  const formatLabel = (controlId: string) => {
    const control = controlMap.get(controlId);
    if (!control) return controlId.slice(0, 8) + '…';
    if (control.identifier) return control.identifier;
    if (control.title) {
      return control.title.length > 30 ? `${control.title.slice(0, 30)}…` : control.title;
    }
    return controlId.slice(0, 8) + '…';
  };

  const handleConfirmLink = (controlIds: string[]) => {
    if (controlIds.length === 0) return;
    onLink(controlIds);
    setPickerOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          disabled={isLinking}
        >
          <Link2 className="mr-2 size-4" />
          Link Controls
        </Button>
      </div>

      {linkedControlIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linkedControlIds.map((controlId) => (
            <Badge
              key={controlId}
              variant="secondary"
              className="gap-1 pr-1"
              title={controlMap.get(controlId)?.title}
            >
              <span className="text-xs">{formatLabel(controlId)}</span>
              <button
                type="button"
                onClick={() => onUnlink(controlId)}
                disabled={isUnlinking}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                aria-label={`Unlink control ${formatLabel(controlId)}`}
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
        onConfirm={handleConfirmLink}
        title={pickerTitle}
        description={pickerDescription}
      />
    </div>
  );
}
