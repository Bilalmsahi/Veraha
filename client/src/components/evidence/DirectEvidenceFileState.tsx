/**
 * Evidence with a file stored directly on the document (no EvidenceVersion rows).
 * e.g. TRAINING_CERTIFICATE auto-generated certificates.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchEvidenceFile } from '@/api/evidence';
import { formatDate, formatFileSize } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from 'sonner';
import { Award, CheckCircle, Download, ExternalLink, FileText } from 'lucide-react';

export type DirectEvidenceFileInfo = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  source?: string;
  reviewedAt?: string;
  uploadedBy?: { firstName: string; lastName: string };
};

function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toUpperCase() : 'FILE';
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function sourceLabel(source?: string): string | null {
  if (source === 'TRAINING_CERTIFICATE') return 'Training certificate';
  if (source) return source.replace(/_/g, ' ');
  return null;
}

export function DirectEvidenceFileState({
  evidenceId,
  file,
}: {
  evidenceId: string;
  file: DirectEvidenceFileInfo;
}) {
  const [loadingView, setLoadingView] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleView = async () => {
    setLoadingView(true);
    let objectUrl: string | null = null;
    try {
      const { blob } = await fetchEvidenceFile(evidenceId, 'inline');
      objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      toast.error(getApiErrorMessage(err, 'Unable to open file.'));
    } finally {
      setLoadingView(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, fileName } = await fetchEvidenceFile(evidenceId, 'attachment');
      triggerBlobDownload(blob, fileName);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to download file.'));
    } finally {
      setDownloading(false);
    }
  };

  const isTrainingCert = file.source === 'TRAINING_CERTIFICATE';
  const label = sourceLabel(file.source);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {isTrainingCert ? (
              <Award className="size-5 text-primary" />
            ) : (
              <CheckCircle className="size-5 text-green-600 dark:text-green-500" />
            )}
            {isTrainingCert ? 'Certificate file' : 'Attached file'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {label && (
            <p className="text-sm text-muted-foreground">
              {isTrainingCert
                ? 'Automatically generated when training was completed.'
                : `Source: ${label}`}
            </p>
          )}
          {file.uploadedBy && file.reviewedAt && (
            <p className="text-sm text-muted-foreground">
              Completed by {file.uploadedBy.firstName} {file.uploadedBy.lastName} on{' '}
              {formatDate(file.reviewedAt)}
            </p>
          )}
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            <span className="font-mono text-xs text-muted-foreground">
              {fileExtension(file.fileName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.fileName}</p>
              {file.sizeBytes != null && (
                <p className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleView}
                disabled={loadingView}
              >
                <ExternalLink className="mr-1.5 size-4" aria-hidden />
                {loadingView ? 'Opening…' : 'View'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download className="mr-1.5 size-4" aria-hidden />
                {downloading ? 'Saving…' : 'Download'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="flex items-center gap-3 py-6">
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium text-foreground">System-generated evidence</p>
            <p className="text-sm text-muted-foreground">
              This file was attached directly to the evidence record. Version history is not used
              for auto-generated documents like training certificates.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
