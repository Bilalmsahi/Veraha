/**
 * State 2: Draft version exists. List files with delete, upload more, Submit button.
 */
import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Pencil, Trash2, History as HistoryIcon } from 'lucide-react';
import { formatFileSize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EvidenceVersionWithFiles, EvidenceVersionFile } from '@/api/evidence';

type DraftEvidenceStateProps = {
  evidenceId: string;
  version: EvidenceVersionWithFiles;
  onAddFile: (file: File) => void;
  onRemoveFile: (versionId: string, fileId: string) => void;
  onSubmit: (versionId: string) => void;
  isAddingFile?: boolean;
  isSubmitting?: boolean;
  canEdit?: boolean;
};

function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toUpperCase() : '';
}

export function DraftEvidenceState(props: DraftEvidenceStateProps) {
  const {
    version,
    onAddFile,
    onRemoveFile,
    onSubmit,
    isAddingFile = false,
    isSubmitting = false,
    canEdit = true,
  } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const files = version.files || [];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onAddFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="size-4" />
            Draft
          </CardTitle>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onSubmit(version._id)}
                disabled={files.length === 0 || isSubmitting}
              >
                Submit
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </p>

          {canEdit && (
          <div className="flex flex-wrap gap-2">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-2 cursor-pointer transition-colors hover:bg-muted/40',
                isAddingFile && 'pointer-events-none opacity-70'
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleChange}
                disabled={isAddingFile}
              />
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Upload</span>
            </div>
          </div>
          )}

          <ul className="space-y-2">
            {files.map((f: EvidenceVersionFile) => (
              <li
                key={f._id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {fileExtension(f.fileName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{f.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.addedBy
                      ? `Added by ${f.addedBy.firstName} ${f.addedBy.lastName}`
                      : ''}
                    {f.sizeBytes != null && ` • ${formatFileSize(f.sizeBytes)}`}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveFile(version._id, f._id)}
                    title="Remove file"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="flex items-center gap-3 py-6">
          <HistoryIcon className="size-5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-foreground">No prior versions</p>
            <p className="text-sm text-muted-foreground">
              Previously completed versions will show up here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
