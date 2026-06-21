import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFrameworks, useRequirements } from '@/api/frameworks';
import { useMapControlRequirement } from '@/api/controls';
import { ExternalLink, Search } from 'lucide-react';
import { formatFrameworkCode } from '@/lib/formatters';

type MapControlRequirementsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
};

export function MapControlRequirementsModal({
  open,
  onOpenChange,
  controlId,
}: MapControlRequirementsModalProps) {
  const navigate = useNavigate();
  const frameworksQuery = useFrameworks(open);
  const frameworks = useMemo(() => frameworksQuery.data ?? [], [frameworksQuery.data]);

  const [frameworkCode, setFrameworkCode] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveFrameworkCode = frameworkCode || frameworks[0]?.code || '';

  const requirementsQuery = useRequirements(
    effectiveFrameworkCode || null,
    {
      search: search || undefined,
      limit: 200,
      sortBy: 'identifier',
      sortOrder: 'asc',
    }
  );

  const requirements = useMemo(
    () => requirementsQuery.data?.requirements ?? [],
    [requirementsQuery.data?.requirements]
  );
  const selected = useMemo(
    () => requirements.find((r) => r._id === selectedId) ?? null,
    [requirements, selectedId]
  );

  const selectedFramework = useMemo(
    () => frameworks.find((f) => f.code === effectiveFrameworkCode) ?? null,
    [frameworks, effectiveFrameworkCode]
  );

  const mapRequirement = useMapControlRequirement();

  const handleAdd = async () => {
    if (!selectedFramework || !selected) return;
    await mapRequirement.mutateAsync({
      id: controlId,
      input: {
        frameworkId: selectedFramework._id,
        requirementId: selected._id,
        coverage: 'FULL',
      },
    });
    onOpenChange(false);
  };

  const openFramework = () => {
    if (!effectiveFrameworkCode) return;
    navigate(`/frameworks/${effectiveFrameworkCode}/controls?controlId=${controlId}`);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSearch('');
          setSelectedId(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Map control to framework requirements</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={effectiveFrameworkCode} onValueChange={setFrameworkCode}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map((framework) => (
                    <SelectItem key={framework._id} value={framework.code}>
                      {formatFrameworkCode(framework.code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by code, name, description"
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-[360px] rounded-md border">
              <div className="divide-y">
                {requirementsQuery.isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading requirements...</p>
                ) : requirements.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No requirements found.</p>
                ) : (
                  requirements.map((req) => (
                    <button
                      key={req._id}
                      type="button"
                      onClick={() => setSelectedId(req._id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${selectedId === req._id ? 'bg-muted' : ''}`}
                    >
                      {req.identifier} {req.title}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            {selected ? (
              <>
                <h3 className="font-medium">{selected.identifier}</h3>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAdd} disabled={mapRequirement.isPending}>Add</Button>
                  <Button variant="outline" size="icon" onClick={openFramework} title="Open framework section">
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description || selected.title}</p>
                <div className="text-xs text-muted-foreground">
                  <div>Framework: {selectedFramework ? formatFrameworkCode(selectedFramework.code) : '—'}</div>
                  <div>Domain: {selected.domain || '—'}</div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a requirement to preview.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}