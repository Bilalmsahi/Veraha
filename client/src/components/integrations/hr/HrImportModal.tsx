import { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormErrorAlert } from '@/components/shared';
import { useImportHrCSV } from '@/api/integrations';
import { getApiErrorMessage } from '@/lib/apiError';
import { AlertCircle, CheckCircle2, Download, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type HrImportModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type Step = 'input' | 'preview' | 'result';

type ParsedRow = {
  row: Record<string, string>;
  rowNumber: number;
  errors: string[];
};

const CSV_HEADERS = ['fullName', 'workEmail', 'department', 'jobTitle', 'startDate'];

const TEMPLATE_CSV = `fullName,workEmail,department,jobTitle,startDate
Jane Doe,jane.doe@company.com,Engineering,Software Engineer,2024-01-15
"Smith, John",john.smith@company.com,HR,People Ops Manager,2023-06-01
`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * RFC 4180-compliant-ish CSV parser supporting quoted fields with embedded commas and escaped quotes.
 */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      current.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      current.push(field);
      field = '';
      if (current.some((v) => v.length > 0)) {
        result.push(current);
      }
      current = [];
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some((v) => v.length > 0)) {
      result.push(current);
    }
  }

  if (result.length === 0) return { headers: [], rows: [] };

  const headers = result[0].map((h) => h.trim());
  const rows = result.slice(1).map((cols) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cols[index] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

function validateRow(row: Record<string, string>): string[] {
  const errors: string[] = [];
  if (!row.fullName || row.fullName.trim() === '') errors.push('Missing fullName');
  if (!row.workEmail || row.workEmail.trim() === '') {
    errors.push('Missing workEmail');
  } else if (!EMAIL_RE.test(row.workEmail.trim())) {
    errors.push('Invalid email');
  }
  return errors;
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hr-profiles-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HrImportModal({ open, onOpenChange }: HrImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [hrSource, setHrSource] = useState<'manual' | 'bamboohr_import' | 'rippling_import'>('manual');
  const [step, setStep] = useState<Step>('input');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors?: Array<{ row?: Record<string, string>; reason?: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportHrCSV();

  const validCount = useMemo(
    () => parsedRows.filter((r) => r.errors.length === 0).length,
    [parsedRows]
  );
  const invalidCount = parsedRows.length - validCount;

  const resetState = () => {
    setCsvText('');
    setHrSource('manual');
    setStep('input');
    setParsedRows([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setCsvText(result);
        setStep('input');
        setParseError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    setParseError(null);
    setImportResult(null);

    if (!csvText.trim()) {
      setParseError('Paste CSV content or upload a file first.');
      return;
    }

    const { headers, rows } = parseCsv(csvText);
    if (rows.length === 0) {
      setParseError('No data rows found. Make sure the first line is the header row.');
      return;
    }

    const missingHeaders = ['fullName', 'workEmail'].filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      setParseError(
        `Missing required column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}. Download the template for the expected format.`
      );
      return;
    }

    const parsed: ParsedRow[] = rows.map((row, index) => ({
      row,
      rowNumber: index + 2,
      errors: validateRow(row),
    }));
    setParsedRows(parsed);
    setStep('preview');
  };

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => r.errors.length === 0).map((r) => r.row);
    if (validRows.length === 0) return;

    importMutation.mutate(
      { rows: validRows, hrSource },
      {
        onSuccess: (result) => {
          const importErrors = Array.isArray(result.errors)
            ? (result.errors as Array<{ row?: Record<string, string>; reason?: string }>)
            : undefined;
          setImportResult({
            imported: Number(result.imported ?? 0),
            updated: Number(result.updated ?? 0),
            skipped: Number(result.skipped ?? 0),
            errors: importErrors,
          });
          setStep('result');
        },
      }
    );
  };

  const handleImportMore = () => {
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import HR profiles</DialogTitle>
          <DialogDescription>
            Bulk import employees from BambooHR, Rippling, or any HR system using a CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {importMutation.error && (
            <FormErrorAlert
              message={getApiErrorMessage(
                importMutation.error,
                'Unable to import HR profiles. Please check your CSV and try again.'
              )}
            />
          )}

          {step === 'input' && (
            <>
              <div className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Need a CSV template?</p>
                    <p className="text-xs text-muted-foreground">
                      Required columns: <code className="rounded bg-muted px-1">fullName</code>,{' '}
                      <code className="rounded bg-muted px-1">workEmail</code>. Quoted fields supported.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 size-4" />
                  Download template
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-file">Upload CSV file</Label>
                <input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-xs text-muted-foreground">Or paste CSV content below.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-data">CSV content</Label>
                <Textarea
                  id="csv-data"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="fullName,workEmail,department,jobTitle,startDate&#10;Jane Doe,jane@company.com,Eng,SWE,2024-01-15"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hr-source">HR Source</Label>
                <Select
                  value={hrSource}
                  onValueChange={(v) =>
                    setHrSource(v as 'manual' | 'bamboohr_import' | 'rippling_import')
                  }
                >
                  <SelectTrigger id="hr-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="bamboohr_import">BambooHR import</SelectItem>
                    <SelectItem value="rippling_import">Rippling import</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-sm font-medium">
                  Parsed {parsedRows.length} row{parsedRows.length === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                    <AlertCircle className="size-3" /> {invalidCount} with errors
                  </span>
                )}
              </div>

              <div className="max-h-[320px] w-full max-w-full overflow-auto rounded-md border">
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      {CSV_HEADERS.map((header) => (
                        <TableHead key={header} className="whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((parsed) => (
                      <TableRow
                        key={parsed.rowNumber}
                        className={cn(parsed.errors.length > 0 && 'bg-destructive/5')}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {parsed.rowNumber}
                        </TableCell>
                        {CSV_HEADERS.map((header) => (
                          <TableCell
                            key={header}
                            className="max-w-[180px] truncate text-sm"
                            title={parsed.row[header] || ''}
                          >
                            {parsed.row[header] || '—'}
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap">
                          {parsed.errors.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 className="size-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="size-3" /> {parsed.errors.join(', ')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {invalidCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Rows with errors will be skipped on import. Only the {validCount} valid row
                  {validCount === 1 ? '' : 's'} will be sent.
                </p>
              )}
            </>
          )}

          {step === 'result' && importResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    Import complete
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {importResult.imported} created, {importResult.updated} updated,{' '}
                    {importResult.skipped} skipped
                  </p>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                    Skipped rows
                  </p>
                  <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
                    {importResult.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>
                        {err.row?.workEmail || err.row?.fullName || `Row ${idx + 1}`}:{' '}
                        {err.reason || 'Unknown reason'}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li className="italic">
                        …and {importResult.errors.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleParse} disabled={!csvText.trim()}>
                Parse & preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0 || importMutation.isPending}
              >
                <Upload className="mr-2 size-4" />
                {importMutation.isPending
                  ? 'Importing...'
                  : `Import ${validCount} profile${validCount === 1 ? '' : 's'}`}
              </Button>
            </>
          )}

          {step === 'result' && (
            <>
              <Button type="button" variant="outline" onClick={handleImportMore}>
                Import more
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
