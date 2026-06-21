import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { FrameworkCodeCombobox } from '@/components/policies/FrameworkCodeCombobox';
import { useControls, useCategories, useRequirementCodes } from '@/api/controls';
import { useFrameworks, useRequirements } from '@/api/frameworks';
import { useLinkControls, useUnlinkControls } from '@/api/risks';
import { Search, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatFrameworkCode, formatDomainLabel } from '@/lib/formatters';
import type { ControlListItem } from '@/api/controls';

const DESCRIPTION_PREVIEW_LEN = 150;

type RiskMapControlsModalProps = {
  riskId: string | null;
  existingControlIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function RiskMapControlsModal({
  riskId,
  existingControlIds,
  open,
  onOpenChange,
  onSuccess,
}: RiskMapControlsModalProps) {
  const [search, setSearch] = useState('');
  const [frameworkCode, setFrameworkCode] = useState<string>('');
  const [requirementIdentifier, setRequirementIdentifier] = useState('');
  const [controlGroup, setControlGroup] = useState<string>('');

  const controls = useControls({
    search: search || undefined,
    frameworkCode: frameworkCode || undefined,
    requirementIdentifier: requirementIdentifier || undefined,
    controlGroup: controlGroup || undefined,
    limit: 50,
    sortBy: 'identifier',
    sortOrder: 'asc',
    includeRequirements: true,
  });
  const categoriesData = useCategories(open);
  const frameworksData = useFrameworks(open);
  const requirementCodesData = useRequirementCodes(
    frameworkCode || undefined,
    open
  );
  const requirementsData = useRequirements(
    frameworkCode && open ? frameworkCode : null,
    { limit: 100, sortBy: 'identifier', sortOrder: 'asc' as const }
  );
  const linkControls = useLinkControls();
  const unlinkControls = useUnlinkControls();

  const categories = categoriesData.data ?? [];
  const frameworks = frameworksData.data ?? [];
  const requirementCodes = requirementCodesData.data ?? [];
  const frameworkRequirements = requirementsData.data?.requirements ?? [];
  const controlList = controls.data?.controls ?? [];
  const isPending = linkControls.isPending || unlinkControls.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSearch('');
      setFrameworkCode('');
      setRequirementIdentifier('');
      setControlGroup('');
    }
    onOpenChange(nextOpen);
  };

  const handleAddControl = (controlId: string) => {
    if (!riskId) return;
    linkControls.mutate(
      { id: riskId, input: { controlIds: [controlId] } },
      {
        onSuccess: () => {
          toast.success('Control added');
          onSuccess?.();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      }
    );
  };

  const handleRemoveControl = (controlId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!riskId) return;
    unlinkControls.mutate(
      { id: riskId, input: { controlIds: [controlId] } },
      {
        onSuccess: () => {
          toast.success('Control removed');
          onSuccess?.();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      }
    );
  };

  const alreadyMapped = new Set(existingControlIds);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-2xl"
        showCloseButton
      >
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>Map controls to your risk</SheetTitle>
          <SheetDescription>
            Connect mitigating controls to this risk so you can track coverage and residual score.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search controls"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={frameworkCode || '__all__'} onValueChange={(v) => setFrameworkCode(v === '__all__' ? '' : v)}>
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
            <FrameworkCodeCombobox
              value={requirementIdentifier}
              onValueChange={setRequirementIdentifier}
              requirementCodes={requirementCodes}
              requirements={frameworkCode ? frameworkRequirements : undefined}
              frameworks={frameworks}
              frameworkCode={frameworkCode}
            />
            <Select value={controlGroup || '__all__'} onValueChange={(v) => setControlGroup(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Control group" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                <SelectItem value="__all__">Control group</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.controlGroup} value={c.controlGroup}>
                    {formatDomainLabel(c.controlGroup)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 min-h-0 -mr-4 pr-4">
            <div className="space-y-2 pb-4">
              {controls.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading controls...</p>
              ) : controlList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No controls found.</p>
              ) : (
                controlList.map((c) => (
                  <RiskControlCard
                    key={c._id}
                    control={c}
                    isMapped={alreadyMapped.has(c._id)}
                    onAdd={() => handleAddControl(c._id)}
                    onRemove={(e) => handleRemoveControl(c._id, e)}
                    isAdding={isPending}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type RiskControlCardProps = {
  control: ControlListItem;
  isMapped: boolean;
  onAdd: () => void;
  onRemove: (e: React.MouseEvent) => void;
  isAdding: boolean;
};

function RiskControlCard({ control, isMapped, onAdd, onRemove, isAdding }: RiskControlCardProps) {
  const [expanded, setExpanded] = useState(false);
  const desc = control.description ?? '';
  const needsTruncate = desc.length > DESCRIPTION_PREVIEW_LEN;
  const displayDesc = needsTruncate && !expanded ? desc.slice(0, DESCRIPTION_PREVIEW_LEN) + '…' : desc;
  const frameworkCodes = control.linkedRequirements?.map((r) => r.code).filter(Boolean) ?? [];
  const hasFrameworks = frameworkCodes.length > 0;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{control.title}</p>
        {displayDesc && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {displayDesc}
            {needsTruncate && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="ml-1 text-primary hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hasFrameworks ? (
            frameworkCodes.map((code) => {
              const parts = code.trim().split(/\s+/);
              const fwCode = parts[0] ?? '';
              const reqId = parts.slice(1).join(' ');
              const display = reqId
                ? `${formatFrameworkCode(fwCode)} ${reqId}`
                : formatFrameworkCode(fwCode);
              return (
                <span
                  key={code}
                  className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
                >
                  {display}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">No frameworks linked</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isMapped ? (
          <>
            <span className="flex items-center gap-1 rounded-md bg-green-500/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              <Check className="size-3.5" />
              Mapped
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={isAdding}
              title="Remove control"
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="outline"
            className="size-9 rounded-full"
            onClick={onAdd}
            disabled={isAdding}
            title="Add control"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
