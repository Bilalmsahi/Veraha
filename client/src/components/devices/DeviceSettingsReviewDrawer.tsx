import { useEffect, useState } from 'react';
import { ChevronDown, Download, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { getDeviceProofAccessUrl } from '@/api/devices';
import { useReviewDeviceSubmission, type ReviewQueueItem } from '@/api/personnelTasks';
import {
  formatChecklistItemStatus,
  type ChecklistItemReviewStatus,
} from '@/constants/deviceSettingsChecklist';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type DeviceSettingsReviewDrawerProps = {
  item: ReviewQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isImageMimeType(mimeType?: string) {
  return Boolean(mimeType?.startsWith('image/'));
}

export function ChecklistItemPanel({
  deviceId,
  evidenceId,
  label,
  status,
  evidenceFileId,
  evidenceFile,
}: {
  deviceId: string;
  evidenceId: string;
  label: string;
  status: ChecklistItemReviewStatus;
  evidenceFileId: string | null;
  evidenceFile?: { _id: string; originalName?: string; mimeType?: string } | null;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadingProof, setLoadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (status !== 'checked_with_proof' || !evidenceFileId || !isImageMimeType(evidenceFile?.mimeType)) {
      return undefined;
    }

    (async () => {
      setLoadingProof(true);
      setProofError(null);
      try {
        const access = await getDeviceProofAccessUrl(deviceId, evidenceId, evidenceFileId);
        if (!cancelled) setPreviewUrl(access.url);
      } catch (error) {
        if (!cancelled) setProofError((error as Error).message);
      } finally {
        if (!cancelled) setLoadingProof(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, evidenceId, evidenceFileId, evidenceFile?.mimeType, status]);

  const loadProofUrl = async () => {
    if (!evidenceFileId || !deviceId) return null;
    setLoadingProof(true);
    setProofError(null);
    try {
      const access = await getDeviceProofAccessUrl(deviceId, evidenceId, evidenceFileId);
      return access.url;
    } catch (error) {
      setProofError((error as Error).message);
      return null;
    } finally {
      setLoadingProof(false);
    }
  };

  const handleDownload = async () => {
    const url = previewUrl || (await loadProofUrl());
    if (!url) return;

    const mimeType = evidenceFile?.mimeType || '';
    if (isImageMimeType(mimeType)) {
      setPreviewUrl(url);
    }

    if (mimeType === 'application/pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = evidenceFile?.originalName || 'proof';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Collapsible defaultOpen={status !== 'unchecked'} className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{formatChecklistItemStatus(status)}</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">
        {status === 'unchecked' && (
          <p className="text-sm text-muted-foreground">Not completed.</p>
        )}
        {status === 'checked_no_proof' && (
          <p className="text-sm text-muted-foreground">Self-certified, no screenshot provided.</p>
        )}
        {status === 'checked_with_proof' && evidenceFileId && (
          <div className="space-y-3">
            {proofError && <p className="text-xs text-destructive">{proofError}</p>}
            {isImageMimeType(evidenceFile?.mimeType) ? (
              <>
                <button
                  type="button"
                  onClick={() => previewUrl && setLightboxOpen(true)}
                  disabled={loadingProof || !previewUrl}
                  className="block overflow-hidden rounded-md border bg-muted/20"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`${label} proof`}
                      className="max-h-48 w-full cursor-zoom-in object-contain"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                      {loadingProof ? 'Loading preview...' : 'Preview unavailable'}
                    </div>
                  )}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={loadingProof}
                >
                  <Download className="mr-2 size-4" />
                  Download proof
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={loadingProof}
              >
                <ExternalLink className="mr-2 size-4" />
                Download PDF
              </Button>
            )}
          </div>
        )}
      </CollapsibleContent>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{label} proof</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt={`${label} proof full size`} className="max-h-[80vh] w-full object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}

export function DeviceSettingsReviewDrawer({
  item,
  open,
  onOpenChange,
}: DeviceSettingsReviewDrawerProps) {
  const deviceId = item?.evidence?.deviceId || (item?.metadata?.deviceId as string | undefined) || '';
  const evidenceId = item?.evidence?.id || item?.id || '';
  const checklistItems = item?.evidence?.checklistItems ?? [];
  const reviewDeviceSubmission = useReviewDeviceSubmission();
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    if (open) setReviewNote('');
  }, [open, item?.id]);

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!evidenceId) return;
    await reviewDeviceSubmission.mutateAsync({ evidenceId, status, note: reviewNote });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Device settings review</SheetTitle>
          <SheetDescription>
            {item?.metadata?.deviceName
              ? `${item.metadata.deviceName}${item.metadata.os ? ` · ${item.metadata.os}` : ''}`
              : 'Review submitted checklist items and optional proof.'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pb-6">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                {item?.user
                  ? `${item.user.firstName} ${item.user.lastName}`
                  : 'Unknown user'}
              </p>
              <p className="text-xs text-muted-foreground">
                {item?.user?.email}
                {item?.submittedAt ? ` · Submitted ${formatDate(item.submittedAt)}` : ''}
              </p>
            </div>

            <div className="space-y-2">
              {checklistItems.map((entry) => (
                <ChecklistItemPanel
                  key={entry.key}
                  deviceId={deviceId}
                  evidenceId={evidenceId}
                  label={entry.label}
                  status={entry.status}
                  evidenceFileId={entry.evidenceFileId}
                  evidenceFile={entry.evidenceFile}
                />
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="device-review-note">
                Review note
              </label>
              <Textarea
                id="device-review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional note for the audit trail"
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleReview('REJECTED')}
            disabled={!evidenceId || reviewDeviceSubmission.isPending}
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => handleReview('APPROVED')}
            disabled={!evidenceId || reviewDeviceSubmission.isPending}
          >
            Approve
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ChecklistStatusCell({ status }: { status: ChecklistItemReviewStatus }) {
  return (
    <span
      className={cn(
        'text-xs font-medium',
        status === 'unchecked' && 'text-muted-foreground',
        status === 'checked_no_proof' && 'text-amber-700 dark:text-amber-400',
        status === 'checked_with_proof' && 'text-green-700 dark:text-green-400'
      )}
    >
      {formatChecklistItemStatus(status)}
    </span>
  );
}
