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
import { useRisks, useLinkControls as useLinkRiskControls } from '@/api/risks';
import { ExternalLink, Search } from 'lucide-react';

type MapRiskScenarioModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
};

export function MapRiskScenarioModal({
  open,
  onOpenChange,
  controlId,
}: MapRiskScenarioModalProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const risksQuery = useRisks({
    search: search || undefined,
    limit: 100,
    sortBy: 'residualScore',
    sortOrder: 'desc',
  });

  const linkControls = useLinkRiskControls();
  const risks = useMemo(() => risksQuery.data?.risks ?? [], [risksQuery.data?.risks]);
  const selected = useMemo(
    () => risks.find((risk) => risk._id === selectedId) ?? null,
    [risks, selectedId]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSearch('');
      setSelectedId(null);
    }
    onOpenChange(nextOpen);
  };

  const handleAdd = async () => {
    if (!selected) return;
    await linkControls.mutateAsync({
      id: selected._id,
      input: { controlIds: [controlId] },
    });
    onOpenChange(false);
  };

  const openRisk = () => {
    if (!selected) return;
    navigate(`/risks/${selected._id}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Map risk scenario to control</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search risk scenarios"
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[360px] rounded-md border">
              <div className="divide-y">
                {risksQuery.isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading risk scenarios...</p>
                ) : risks.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No risk scenarios found.</p>
                ) : (
                  risks.map((risk) => (
                    <button
                      key={risk._id}
                      type="button"
                      onClick={() => setSelectedId(risk._id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${selectedId === risk._id ? 'bg-muted' : ''}`}
                    >
                      {risk.title}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            {selected ? (
              <>
                <h3 className="font-medium">{selected.title}</h3>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAdd} disabled={linkControls.isPending}>Add</Button>
                  <Button variant="outline" size="icon" onClick={openRisk} title="Open risk scenario">
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description || 'No description available.'}</p>
                <div className="text-xs text-muted-foreground">
                  <div>Risk level: {selected.riskLevel || '—'}</div>
                  <div>Status: {selected.status || '—'}</div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a risk scenario to preview.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}