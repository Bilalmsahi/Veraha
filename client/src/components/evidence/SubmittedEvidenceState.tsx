/**
 * State 3: Active version exists. Renew section, Latest version card (read-only files), Prior versions.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatFileSize } from '@/lib/formatters';
import { RotateCcw, CheckCircle, History as HistoryIcon, ExternalLink } from 'lucide-react';
import type { EvidenceVersionWithFiles, EvidenceVersionFile } from '@/api/evidence';

type SubmittedEvidenceStateProps = {
  evidenceId: string;
  activeVersion: EvidenceVersionWithFiles;
  priorVersions: EvidenceVersionWithFiles[];
  onNewDraft: () => void;
  isCreatingDraft?: boolean;
  canEdit?: boolean;
};

function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toUpperCase() : '';
}

function VersionFileRow({ f }: { f: EvidenceVersionFile }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="text-muted-foreground font-mono text-xs">
        {fileExtension(f.fileName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{f.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {f.validUntil
            ? `Expires on ${formatDate(f.validUntil)}`
            : ''}
          {f.addedBy
            ? ` • Added by ${f.addedBy.firstName} ${f.addedBy.lastName}`
            : ''}
          {f.sizeBytes != null && ` • ${formatFileSize(f.sizeBytes)}`}
        </p>
      </div>
      {f.fileUrl && (
        <a
          href={f.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-primary hover:underline"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </li>
  );
}

export function SubmittedEvidenceState({
  activeVersion,
  priorVersions,
  onNewDraft,
  isCreatingDraft = false,
  canEdit = true,
}: SubmittedEvidenceStateProps) {
  const validUntil = activeVersion.validUntil;
  const completedBy = activeVersion.completedBy;
  const completedAt = activeVersion.completedAt;
  const files = activeVersion.files || [];

  return (
    <div className="space-y-6">
      {validUntil && (
        <Card className="border-border/60 bg-card">
          <CardContent className="flex flex-row items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="size-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  Renew before {formatDate(validUntil)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Submit evidence before the latest version expires in 12 months
                </p>
              </div>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                onClick={onNewDraft}
                disabled={isCreatingDraft}
              >
                + New draft
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600 dark:text-green-500" />
            Latest version
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {completedBy && completedAt && (
            <p className="text-sm text-muted-foreground">
              Completed by {completedBy.firstName} {completedBy.lastName} on{' '}
              {formatDate(completedAt)}
            </p>
          )}
          <ul className="space-y-2">
            {files.map((f: EvidenceVersionFile) => (
              <VersionFileRow key={f._id} f={f} />
            ))}
          </ul>
          {canEdit && (
            <p className="text-xs text-muted-foreground">
              Need to edit or renew these files? Start a new draft above.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="py-6">
          {priorVersions.length === 0 ? (
            <div className="flex items-center gap-3">
              <HistoryIcon className="size-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground">No prior versions</p>
                <p className="text-sm text-muted-foreground">
                  Previously completed versions will show up here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-medium text-foreground">Prior versions</p>
              <ul className="space-y-3">
                {priorVersions.map((v) => (
                  <li
                    key={v._id}
                    className="rounded-lg border border-border/60 bg-background p-4"
                  >
                    <p className="text-sm font-medium">
                      {v.completedAt
                        ? `Completed ${formatDate(v.completedAt)}`
                        : `Version ${v.status}`}
                    </p>
                    {v.files?.length ? (
                      <ul className="mt-2 space-y-2">
                        {v.files.map((f: EvidenceVersionFile) => (
                          <VersionFileRow key={f._id} f={f} />
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
