import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor, RawEditorOptions } from 'tinymce';
import { AlertCircle, CheckCircle2, Clock, Save, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/axios';
import { cn } from '@/lib/utils';

type PolicyEditorProps = {
  policyId: string;
  versionId: string;
  versionNumber?: number;
  policyTitle: string;
  initialContent: string;
  initialLastSavedAt?: string | null;
  readOnly?: boolean;
  onSave: (contentHtml: string) => Promise<void>;
  onClose: () => void;
  onSubmitForApproval?: () => void;
  isSaving?: boolean;
};

type TinyBlobInfo = {
  blob: () => Blob;
  filename: () => string;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

const plugins = [
  'accordion',
  'advlist',
  'anchor',
  'autolink',
  'autosave',
  'charmap',
  'code',
  'codesample',
  'fullscreen',
  'help',
  'image',
  'importcss',
  'insertdatetime',
  'link',
  'lists',
  'nonbreaking',
  'pagebreak',
  'preview',
  'quickbars',
  'searchreplace',
  'table',
  'visualblocks',
  'wordcount',
];

const contentStyle = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #111827;
    max-width: 760px;
    margin: 32px auto;
    padding: 0 32px;
  }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 16px; }
  h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
  h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  td, th { border: 1px solid #e5e7eb; padding: 8px 12px; }
  th { background: #f9fafb; font-weight: 600; }
  blockquote {
    border-left: 3px solid #6366f1;
    margin: 16px 0;
    padding: 8px 16px;
    color: #6b7280;
  }
`;

export function PolicyEditor({
  policyId,
  versionId,
  versionNumber,
  policyTitle,
  initialContent,
  initialLastSavedAt,
  readOnly = false,
  onSave,
  onClose,
  onSubmitForApproval,
  isSaving = false,
}: PolicyEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveSequenceRef = useRef(0);
  const activeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const runSaveRef = useRef<(contentHtml?: string) => Promise<boolean>>(async () => true);
  const lastSavedContentRef = useRef(initialContent || '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialLastSavedAt ? new Date(initialLastSavedAt) : null
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const getContent = useCallback(() => editorRef.current?.getContent() ?? '', []);

  const runSave = useCallback(
    async (contentHtml = getContent()): Promise<boolean> => {
      if (readOnly) return true;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        await activeSavePromiseRef.current;
        return runSaveRef.current(getContent());
      }

      if (contentHtml === lastSavedContentRef.current) {
        setSaveState(lastSavedAt ? 'saved' : 'idle');
        setSaveError(null);
        return true;
      }

      isSavingRef.current = true;
      setSaveState('saving');
      setSaveError(null);
      const sequence = ++saveSequenceRef.current;

      const savePromise = onSave(contentHtml)
        .then(() => {
          if (sequence === saveSequenceRef.current) {
            const savedAt = new Date();
            lastSavedContentRef.current = contentHtml;
            setLastSavedAt(savedAt);
            setSaveState('saved');
            setSaveError(null);
          }
          return true;
        })
        .catch((err) => {
          if (sequence === saveSequenceRef.current) {
            const message = err instanceof Error ? err.message : 'Unable to save policy content.';
            setSaveState('error');
            setSaveError(message);
          }
          return false;
        })
        .finally(() => {
          if (sequence === saveSequenceRef.current) {
            isSavingRef.current = false;
            activeSavePromiseRef.current = null;
          }
        });

      activeSavePromiseRef.current = savePromise;
      const ok = await savePromise;

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        return runSaveRef.current(getContent());
      }

      return ok;
    },
    [getContent, lastSavedAt, onSave, readOnly]
  );

  useEffect(() => {
    runSaveRef.current = runSave;
  }, [runSave]);

  const saveContent = useCallback(
    (contentHtml?: string) => runSaveRef.current(contentHtml),
    []
  );

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    const contentHtml = getContent();
    if (contentHtml === lastSavedContentRef.current) {
      setSaveState(lastSavedAt ? 'saved' : 'idle');
      return;
    }

    setSaveState((current) => (current === 'saving' ? current : 'dirty'));
    setSaveError(null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveContent(getContent());
    }, 2000);
  }, [getContent, lastSavedAt, readOnly, saveContent]);

  const handleManualSave = useCallback(() => {
    void saveContent();
  }, [saveContent]);

  const handleSaveAndClose = useCallback(async () => {
    const ok = await saveContent();
    if (ok) onClose();
  }, [onClose, saveContent]);

  const handleSubmitForApproval = useCallback(async () => {
    if (!onSubmitForApproval) return;
    const ok = await saveContent();
    if (ok) onSubmitForApproval();
  }, [onSubmitForApproval, saveContent]);

  const handleClose = useCallback(() => {
    if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') {
      const confirmed = window.confirm('You have unsaved policy changes. Leave the editor anyway?');
      if (!confirmed) return;
    }
    onClose();
  }, [onClose, saveState]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState !== 'dirty' && saveState !== 'saving' && saveState !== 'error') return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const editorConfig = useMemo<RawEditorOptions>(
    () => ({
      base_url: '/tinymce',
      suffix: '.min',
      plugins,
      toolbar:
        'undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | ' +
        'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
        'link image table | searchreplace | fullscreen preview | charmap insertdatetime | code',
      toolbar_sticky: true,
      toolbar_sticky_offset: 0,
      menubar: 'edit view insert format tools table',
      height: '100%',
      min_height: 0,
      autosave_ask_before_unload: true,
      autosave_interval: '30s',
      autosave_prefix: `policy-${policyId}-version-${versionId}-`,
      autosave_restore_when_empty: false,
      autosave_retention: '2h',
      quickbars_selection_toolbar: 'bold italic underline | link | blocks',
      quickbars_insert_toolbar: false,
      paste_data_images: false,
      images_upload_handler: async (blobInfo: TinyBlobInfo, progress?: (percent: number) => void) => {
        const formData = new FormData();
        formData.append('file', blobInfo.blob(), blobInfo.filename());
        const { data } = await api.post<{ location: string }>(
          `/policies/${policyId}/images`,
          formData,
          {
            onUploadProgress: (event) => {
              if (event.total && progress) {
                progress(Math.round((event.loaded / event.total) * 100));
              }
            },
          }
        );
        if (!data.location) throw new Error('Image upload did not return a location.');
        return data.location;
      },
      link_default_target: '_blank',
      link_default_protocol: 'https',
      link_assume_external_targets: true,
      table_default_attributes: { border: '1' },
      table_default_styles: {
        'border-collapse': 'collapse',
        width: '100%',
      },
      skin: 'oxide',
      content_css: 'default',
      statusbar: false,
      body_class: 'policy-content',
      content_style: contentStyle,
      wordcount_countcharacters: true,
      insertdatetime_formats: ['%Y-%m-%d', '%B %d, %Y', '%d %B %Y'],
      resize: false,
      readonly: readOnly,
      setup: (editor) => {
        editor.on('Change Input Undo Redo SetContent Paste', scheduleSave);
      },
    }),
    [policyId, readOnly, scheduleSave, versionId]
  );

  const saveMessage = useMemo(() => {
    if (readOnly) return 'Read-only';
    if (saveState === 'saving' || isSaving) return 'Saving...';
    if (saveState === 'dirty') return 'Unsaved changes';
    if (saveState === 'error') return saveError || 'Save failed';
    if (saveState === 'conflict') return 'Save conflict';
    if (lastSavedAt) return `Saved ${lastSavedAt.toLocaleTimeString()}`;
    return 'Draft ready';
  }, [isSaving, lastSavedAt, readOnly, saveError, saveState]);

  const SaveIcon =
    saveState === 'error' || saveState === 'conflict'
      ? AlertCircle
      : saveState === 'dirty' || saveState === 'saving'
        ? Clock
        : CheckCircle2;
  const saveIsBusy = saveState === 'saving' || isSaving;
  const submitDisabled = readOnly || saveIsBusy || saveState === 'error' || saveState === 'conflict';

  return (
    <div className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center justify-between border-b bg-background px-6 py-3 shadow-sm">
        <div className="min-w-0 text-sm">
          <button
            type="button"
            className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={handleClose}
          >
            Policies
          </button>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">{policyTitle}</span>
          {versionNumber != null && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              v{versionNumber}
            </span>
          )}
          <span
            className={cn(
              'ml-3 inline-flex items-center gap-1 text-xs',
              saveState === 'error' || saveState === 'conflict'
                ? 'text-destructive'
                : saveState === 'dirty'
                  ? 'text-amber-600'
                  : 'text-muted-foreground'
            )}
          >
            <SaveIcon className="size-3.5" />
            {saveMessage}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleManualSave} disabled={saveIsBusy || readOnly}>
            <Save className="mr-2 size-4" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAndClose} disabled={saveIsBusy || readOnly}>
            <X className="mr-2 size-4" />
            Save and close
          </Button>
          {onSubmitForApproval && (
            <Button size="sm" onClick={handleSubmitForApproval} disabled={submitDisabled}>
              <Send className="mr-2 size-4" />
              Submit for approval
            </Button>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden bg-muted/30">
        <div className="policy-editor-tinymce h-full min-h-0">
          <Editor
            key={versionId}
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            licenseKey="gpl"
            onInit={(_event, editor) => {
              editorRef.current = editor;
              lastSavedContentRef.current = editor.getContent();
            }}
            initialValue={initialContent}
            disabled={readOnly}
            init={editorConfig}
          />
        </div>
      </main>
    </div>
  );
}
