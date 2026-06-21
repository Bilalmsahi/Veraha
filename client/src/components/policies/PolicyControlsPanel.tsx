import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useControls, useRequirementCodes } from '@/api/controls';
import { useFrameworks } from '@/api/frameworks';
import { Search, Link2 } from 'lucide-react';
import { formatFrameworkCode } from '@/lib/formatters';

type LinkedControlRef = { _id: string; identifier?: string; title?: string } | string;

type PolicyControlsPanelProps = {
  linkedControls: LinkedControlRef[];
  onMapControl: () => void;
  canMapControls?: boolean;
  /** Optional: entity name for empty state copy (e.g. "document" on document detail page). Default "policy". */
  emptyStateEntityLabel?: string;
};

const DESCRIPTION_PREVIEW = 120;

export function PolicyControlsPanel({
  linkedControls,
  onMapControl,
  canMapControls = true,
  emptyStateEntityLabel = 'policy',
}: PolicyControlsPanelProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [frameworkCode, setFrameworkCode] = useState<string>('');
  const [requirementIdentifier, setRequirementIdentifier] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');

  const controlIds = linkedControls.map((c) =>
    typeof c === 'object' && c && '_id' in c ? c._id : String(c)
  );

  const controlsQuery = useControls({
    ids: controlIds.length > 0 ? controlIds : undefined,
    search: search || undefined,
    frameworkCode: frameworkCode || undefined,
    requirementIdentifier: requirementIdentifier || undefined,
    ownerId: ownerId || undefined,
    limit: 200,
    includeRequirements: true,
  });
  const { data: frameworksData } = useFrameworks();
  const requirementCodesData = useRequirementCodes(frameworkCode || undefined);
  const frameworks = frameworksData ?? [];
  const requirementCodes = requirementCodesData.data ?? [];
  const controlList = controlsQuery.data?.controls ?? [];

  if (linkedControls.length === 0) {
    return (
      <Card className="border-border/60 bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Controls</CardTitle>
          {canMapControls && (
            <Button size="sm" variant="outline" onClick={onMapControl}>
              <Link2 className="mr-2 size-4" />
              Map control
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center">
            <p className="font-medium">No controls mapped yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Mapping your {emptyStateEntityLabel} to relevant controls helps you demonstrate compliance to
              stakeholders and auditors.
            </p>
            {canMapControls && (
              <Button size="sm" className="mt-4" onClick={onMapControl}>
                Map control
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-border/60 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Controls {controlList.length}</CardTitle>
        {canMapControls && (
          <Button size="sm" variant="outline" onClick={onMapControl}>
            <Link2 className="mr-2 size-4" />
            Map control
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Vanta-aligned: Search, Framework, Owner, Framework code (scrollable) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search controls"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={frameworkCode || '__all__'}
            onValueChange={(v) => setFrameworkCode(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Framework</SelectItem>
              {frameworks.map((f) => (
                <SelectItem key={f._id} value={f.code}>
                  {formatFrameworkCode(f.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ownerId || '__all__'} onValueChange={(v) => setOwnerId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Owner</SelectItem>
              {Array.from(
                new Map(
                  controlList
                    .filter((c) => c.owner?._id)
                    .map((c) => [c.owner!._id, c.owner!])
                ).values()
              ).map((o) => (
                <SelectItem key={o._id} value={o._id}>
                  {o.firstName} {o.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={requirementIdentifier || '__all__'}
            onValueChange={(v) => setRequirementIdentifier(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Framework code" />
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              <SelectItem value="__all__">Framework code</SelectItem>
              {requirementCodes.map((rc) => (
                <SelectItem key={`${rc.frameworkCode}-${rc.identifier}`} value={rc.identifier}>
                  {formatFrameworkCode(rc.frameworkCode)} {rc.identifier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table: Control (title+description), Frameworks (all mapped), Rationale - Vanta style */}
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="w-[45%] px-4 py-3 text-left font-medium">Control</th>
                <th className="w-[25%] px-4 py-3 text-left font-medium">Frameworks</th>
                <th className="w-[30%] px-4 py-3 text-left font-medium">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {controlsQuery.isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    Loading controls...
                  </td>
                </tr>
              ) : controlList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No controls match the filters.
                  </td>
                </tr>
              ) : (
                controlList.map((c) => {
                  const frameworkLabels =
                    c.linkedRequirements
                      ?.map((r) => {
                        const code = r.code?.trim();
                        if (!code) return '';
                        const parts = code.split(/\s+/);
                        return parts[0]
                          ? formatFrameworkCode(parts[0]) +
                              (parts.slice(1).length ? ' ' + parts.slice(1).join(' ') : '')
                          : '';
                      })
                      .filter(Boolean) ?? [];
                  const frameworksStr = frameworkLabels.length > 0 ? frameworkLabels.join(', ') : '—';
                  const rationale =
                    c.linkedRequirements
                      ?.map((r) => r.justification)
                      .filter(Boolean)
                      .join('; ') || '—';
                  const descPreview = (c.description ?? '').slice(0, DESCRIPTION_PREVIEW);
                  const hasMoreDesc = (c.description ?? '').length > DESCRIPTION_PREVIEW;
                  return (
                    <tr
                      key={c._id}
                      className="cursor-pointer border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
                      onClick={() => navigate(`/controls?highlight=${c._id}`)}
                    >
                      <td className="px-4 py-3 align-top">
                        <div>
                          <span className="font-semibold">{c.title}</span>
                          {c.identifier && (
                            <span className="ml-2 text-muted-foreground font-normal">
                              ({c.identifier})
                            </span>
                          )}
                          {(c.description || hasMoreDesc) && (
                            <p className="mt-1 text-muted-foreground font-normal leading-relaxed">
                              {descPreview}
                              {hasMoreDesc ? '…' : ''}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground align-top">
                        <span className="line-clamp-4">{frameworksStr}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground align-top" title={rationale}>
                        <span className="line-clamp-2">{rationale}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
