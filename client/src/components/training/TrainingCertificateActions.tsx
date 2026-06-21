import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchTrainingCertificateFile } from '@/api/personnelTasks';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

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

export function TrainingCertificateActions({
  moduleId,
  certificateEvidenceId,
  variant = 'card',
}: {
  moduleId: string;
  certificateEvidenceId?: string | null;
  variant?: 'card' | 'inline';
}) {
  const [loadingView, setLoadingView] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleView = async () => {
    setLoadingView(true);
    let objectUrl: string | null = null;
    try {
      const { blob } = await fetchTrainingCertificateFile(moduleId, 'inline');
      objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      toast.error(getApiErrorMessage(err, 'Unable to open certificate.'));
    } finally {
      setLoadingView(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, fileName } = await fetchTrainingCertificateFile(moduleId, 'attachment');
      triggerBlobDownload(blob, fileName);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to download certificate.'));
    } finally {
      setDownloading(false);
    }
  };

  const documentPath = certificateEvidenceId ? `/documents/${certificateEvidenceId}` : null;

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleView} disabled={loadingView}>
          <ExternalLink className="mr-2 size-4" aria-hidden />
          {loadingView ? 'Opening…' : 'View certificate'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 size-4" aria-hidden />
          {downloading ? 'Downloading…' : 'Download'}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Award className="size-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">Certificate of completion</p>
          <p className="text-sm text-muted-foreground">
            Your certificate was generated when you passed the quiz. View or download it here; a
            copy is also stored in Documents for compliance evidence.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleView} disabled={loadingView}>
          <ExternalLink className="mr-2 size-4" aria-hidden />
          {loadingView ? 'Opening…' : 'View certificate'}
        </Button>
        <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 size-4" aria-hidden />
          {downloading ? 'Downloading…' : 'Download certificate'}
        </Button>
        {documentPath && (
          <Button asChild variant="ghost">
            <Link to={documentPath}>
              <FileText className="mr-2 size-4" aria-hidden />
              Evidence record
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
