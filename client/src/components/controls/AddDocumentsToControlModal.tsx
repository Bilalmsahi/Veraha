import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCustomDocument, useEvidenceList, useLinkControls } from '@/api/evidence';
import { ExternalLink, Plus, Search } from 'lucide-react';

type AddDocumentsToControlModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
};

export function AddDocumentsToControlModal({
  open,
  onOpenChange,
  controlId,
}: AddDocumentsToControlModalProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSensitive, setNewSensitive] = useState(false);
  const [newRecurrence, setNewRecurrence] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'NEVER'>('ANNUALLY');

  const documentsQuery = useEvidenceList({
    search: search || undefined,
    limit: 100,
    sortBy: 'title',
    sortOrder: 'asc',
  });
  const linkControls = useLinkControls();
  const createCustomDocument = useCreateCustomDocument();

  const documents = useMemo(() => documentsQuery.data?.evidence ?? [], [documentsQuery.data?.evidence]);
  const selected = useMemo(
    () => documents.find((item) => item._id === selectedId) ?? null,
    [documents, selectedId]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Reset state on open (avoid setState-in-effect lint rule)
      setSearch('');
      setSelectedId(null);
      setRecommendedOnly(false);
    }
    onOpenChange(nextOpen);
  };

  const handleAdd = async () => {
    if (!selected) return;
    await linkControls.mutateAsync({ id: selected._id, controlIds: [controlId] });
    onOpenChange(false);
  };

  const openDocument = () => {
    if (!selected) return;
    navigate(`/documents?open=${selected._id}`);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Add documents</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <Checkbox
                  id="recommended-only"
                  checked={recommendedOnly}
                  onCheckedChange={(checked) => setRecommendedOnly(checked === true)}
                />
                <Label htmlFor="recommended-only" className="text-xs text-muted-foreground">
                  Recommended only
                </Label>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 size-4" />
                New custom document
              </Button>
            </div>
            <ScrollArea className="h-[360px] rounded-md border">
              <div className="divide-y">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Document
                </div>
                {documentsQuery.isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading documents...</p>
                ) : documents.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No documents found.</p>
                ) : (
                  documents.map((doc) => (
                    <button
                      key={doc._id}
                      type="button"
                      onClick={() => setSelectedId(doc._id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${selectedId === doc._id ? 'bg-muted' : ''}`}
                    >
                      {doc.title}
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
                  <Button variant="outline" size="icon" onClick={openDocument} title="Open document">
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description || 'No description available.'}</p>
                <div className="text-xs text-muted-foreground">
                  <div>Category: {selected.category || '—'}</div>
                  <div>Status: {selected.status}</div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a document to preview.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog
      open={createOpen}
      onOpenChange={(nextOpen) => {
        setCreateOpen(nextOpen);
        if (!nextOpen) {
          setNewTitle('');
          setNewDescription('');
          setNewSensitive(false);
          setNewRecurrence('ANNUALLY');
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New custom document</DialogTitle>
          <DialogDescription>Create a document template to map against controls.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-doc-title">Document name</Label>
            <Input
              id="new-doc-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder='e.g. "Clear Desk Policy Enforced"'
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-doc-description">Description</Label>
            <Textarea
              id="new-doc-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder='e.g. "Image of office space showing clear desk policy..."'
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-doc-sensitive"
              checked={newSensitive}
              onCheckedChange={(checked) => setNewSensitive(checked === true)}
            />
            <Label htmlFor="new-doc-sensitive">This is a sensitive document</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-doc-recurrence">Recurrence</Label>
            <Select
              value={newRecurrence}
              onValueChange={(value) => setNewRecurrence(value as typeof newRecurrence)}
            >
              <SelectTrigger id="new-doc-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="SEMI_ANNUALLY">Semi-annually</SelectItem>
                <SelectItem value="ANNUALLY">Annually</SelectItem>
                <SelectItem value="NEVER">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={createCustomDocument.isPending || newTitle.trim().length < 3}
            onClick={() => {
              const title = newTitle.trim();
              if (title.length < 3) return;
              createCustomDocument.mutate(
                {
                  title,
                  description: newDescription.trim() || undefined,
                  isSensitive: newSensitive,
                  recurrence: newRecurrence,
                  linkedControlIds: [controlId],
                },
                {
                  onSuccess: (created) => {
                    setCreateOpen(false);
                    documentsQuery.refetch();
                    if (created?._id) setSelectedId(created._id);
                  },
                }
              );
            }}
          >
            {createCustomDocument.isPending ? 'Creating...' : 'Create document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}