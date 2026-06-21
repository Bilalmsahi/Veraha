/**
 * State 1: No versions exist. Show get-started dropzone and "No prior versions".
 */
import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyEvidenceStateProps = {
  evidenceId: string;
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  canEdit?: boolean;
};

export function EmptyEvidenceState({
  onFileSelect,
  isUploading = false,
  canEdit = true,
}: EmptyEvidenceStateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-4">
            {canEdit
              ? 'Add documents, screenshots, and links as supporting evidence.'
              : 'No evidence files have been added yet.'}
          </p>
          <div
            className={cn(
              'rounded-lg border-2 border-dashed border-border/80 bg-muted/20 p-10 text-center transition-colors',
              canEdit && 'hover:border-primary/50 hover:bg-muted/30 cursor-pointer'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => {
              if (canEdit) inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleChange}
              disabled={isUploading || !canEdit}
            />
            <Upload className="mx-auto size-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">
              {canEdit
                ? isUploading
                  ? 'Uploading...'
                  : 'Drop a file here or click to upload'
                : 'No evidence uploaded'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canEdit ? 'PDF, Word, Excel, images' : 'Evidence uploads are managed by Admins and Managers'}
            </p>
          </div>
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
