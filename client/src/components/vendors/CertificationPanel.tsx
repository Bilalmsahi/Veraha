import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormErrorAlert } from '@/components/shared';
import { addCertificationSchema } from '@/schemas/vendor';
import { useAddCertification, useRemoveCertification } from '@/api/vendors';
import type { VendorDetail } from '@/api/vendors';
import { formatDate, formatFrameworkCode } from '@/lib/formatters';
import { Plus, Trash2, FileText } from 'lucide-react';

type Certification = {
  name: string;
  validUntil?: string;
  documentUrl?: string;
  documentKey?: string;
};

type CertificationPanelProps = {
  vendor: VendorDetail;
  canEdit?: boolean;
};

export function CertificationPanel({ vendor, canEdit = false }: CertificationPanelProps) {
  const [name, setName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const addCert = useAddCertification();
  const removeCert = useRemoveCertification();

  const certs: Certification[] = (vendor.certifications ?? []).map((c) => ({
    name: (c as { name?: string }).name ?? 'Unknown',
    validUntil: (c as { validUntil?: string }).validUntil,
    documentUrl: (c as { documentUrl?: string }).documentUrl,
    documentKey: (c as { documentKey?: string }).documentKey,
  }));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const result = addCertificationSchema.safeParse({
      name,
      validUntil: validUntil || undefined,
    });
    if (!result.success) return;

    addCert.mutate(
      {
        id: vendor._id,
        input: { name: result.data.name, validUntil: validUntil ? new Date(validUntil) : undefined },
        file: file ?? undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setValidUntil('');
          setFile(null);
          setFormKey((k) => k + 1);
        },
      }
    );
  };

  const handleRemove = (certIndex: number) => {
    removeCert.mutate({ id: vendor._id, certIndex });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Certifications ({certs.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {addCert.error && (
          <FormErrorAlert message={(addCert.error as Error).message} />
        )}
        {canEdit && (
          <form key={formKey} onSubmit={handleAdd} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="certName">Name</Label>
                <Input
                  id="certName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SOC 2"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certValidUntil">Valid until (optional)</Label>
                <Input
                  id="certValidUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="certFile">Document (required)</Label>
              <Input
                id="certFile"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={addCert.isPending || !name.trim() || !file}>
              <Plus className="mr-2 size-4" />
              {addCert.isPending ? 'Adding...' : 'Add certification'}
            </Button>
          </form>
        )}

        {certs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {certs.map((cert, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span>
                    {formatFrameworkCode(cert.name)}
                    {cert.validUntil && (
                      <span className="ml-2 text-muted-foreground">
                        (valid until {formatDate(cert.validUntil)})
                      </span>
                    )}
                  </span>
                  {cert.documentUrl && (
                    <a
                      href={cert.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(index)}
                    disabled={removeCert.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
