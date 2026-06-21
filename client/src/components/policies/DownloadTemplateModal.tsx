import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { downloadTemplateFn } from '@/api/policyLibrary';
import type { PolicyTemplate } from '@/api/policyLibrary';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

type DownloadTemplateModalProps = {
  template: PolicyTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DownloadTemplateModal({
  template,
  open,
  onOpenChange,
}: DownloadTemplateModalProps) {
  const [language, setLanguage] = useState('en');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!template) return;
    setDownloading(true);
    try {
      await downloadTemplateFn(template._id, template.filename);
      toast.success('Download started');
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  if (!template) return null;

  const isDocx = template.filename.toLowerCase().endsWith('.docx');
  const isXlsx = template.filename.toLowerCase().endsWith('.xlsx');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download template</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">1. Select language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Choose language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">2. Download</label>
            <div className="flex flex-col gap-2">
              {(isDocx || isXlsx) && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isDocx
                          ? 'Microsoft Word (.docx)'
                          : 'Microsoft Excel (.xlsx)'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download className="mr-2 size-4" />
                    {downloading ? 'Downloading...' : 'Download'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
