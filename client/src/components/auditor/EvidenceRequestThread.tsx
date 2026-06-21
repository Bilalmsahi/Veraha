import { useMemo, useState } from 'react';
import {
  type AuditRequest,
  useAddAuditRequestMessage,
  useAuditEvidence,
  useGetAuditRequest,
  useSubmitAuditEvidence,
} from '@/api/audits';
import {
  useAddAuditorRequestMessage,
  useGetAuditorRequest,
} from '@/api/auditor';
import { cn } from '@/lib/utils';
import { SEMANTIC_BADGE_SOFT, type SemanticSoftTone } from '@/components/shared/EnumBadge';

const REQUEST_STATUS_SOFT: Record<string, SemanticSoftTone> = {
  OPEN: 'warning',
  IN_REVIEW: 'info',
  SUBMITTED: 'info',
  ACCEPTED: 'success',
  COMPLETED: 'success',
  CLOSED: 'muted',
};

function formatPerson(user?: { firstName?: string; lastName?: string; email?: string }) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'Unknown user';
}

function formatDate(value?: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value)
  );
}

function formatMessageTime(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isPastDue(request: AuditRequest) {
  if (!request.dueDate || request.status === 'COMPLETED') return false;
  return new Date(request.dueDate).getTime() < Date.now();
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

type Props = {
  requestId: string;
  auditId: string;
  currentUserRole: 'INTERNAL' | 'AUDITOR';
};

export default function EvidenceRequestThread({ requestId, auditId, currentUserRole }: Props) {
  const isInternal = currentUserRole === 'INTERNAL';
  const [messageBody, setMessageBody] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');

  const internalRequest = useGetAuditRequest(isInternal ? auditId : null, isInternal ? requestId : null);
  const auditorRequest = useGetAuditorRequest(isInternal ? null : auditId, isInternal ? null : requestId);
  const requestQuery = isInternal ? internalRequest : auditorRequest;
  const request = requestQuery.data as AuditRequest | undefined;

  const addInternalMessage = useAddAuditRequestMessage(isInternal ? auditId : null);
  const addAuditorMessage = useAddAuditorRequestMessage(isInternal ? null : auditId);
  const addMessage = isInternal ? addInternalMessage : addAuditorMessage;

  const auditEvidence = useAuditEvidence(isInternal ? auditId : null);
  const submitEvidence = useSubmitAuditEvidence(isInternal ? auditId : null);

  const messages = request?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const hasUnread = lastMessage?.role && lastMessage.role !== currentUserRole;
  const messageTooShort = messageBody.trim().length > 0 && messageBody.trim().length < 3;
  const canSend = messageBody.trim().length >= 3 && messageBody.trim().length <= 2000 && !addMessage.isPending;

  const readyItems = useMemo(() => {
    const all = auditEvidence.data ?? [];
    return all.filter((item) => item.status === 'READY_FOR_AUDIT');
  }, [auditEvidence.data]);

  const filteredEvidenceItems = useMemo(() => {
    const q = evidenceFilter.trim().toLowerCase();
    if (!q) return readyItems;
    return readyItems.filter((item) => {
      const hay = `${item.title ?? ''} ${item.fileName ?? ''} ${item.controlId?.identifier ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [evidenceFilter, readyItems]);

  function handleSend() {
    if (!canSend) return;
    addMessage.mutate(
      { requestId, body: messageBody.trim() },
      {
        onSuccess: () => setMessageBody(''),
      }
    );
  }

  function handleLinkEvidence() {
    if (!selectedEvidenceId || !isInternal) return;
    submitEvidence.mutate(
      { requestId, itemId: selectedEvidenceId },
      { onSuccess: () => setSelectedEvidenceId('') }
    );
  }

  if (requestQuery.isLoading) {
    return (
      <div className="rounded-md border p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading request thread...
        </div>
      </div>
    );
  }

  if (requestQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load request thread. Please refresh.
      </div>
    );
  }

  if (!request) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        Request thread not found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-md border bg-background">
        <div className="border-b bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {hasUnread && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Unread message" />
                )}
                <h2 className="truncate text-base font-semibold">{request.title}</h2>
              </div>
              {request.description && (
                <p className="mt-1 text-sm text-muted-foreground">{request.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium',
                  SEMANTIC_BADGE_SOFT[REQUEST_STATUS_SOFT[request.status] ?? 'muted']
                )}
              >
                {request.status}
              </span>
              <span className="text-xs text-muted-foreground">Due {formatDate(request.dueDate)}</span>
              {isPastDue(request) && (
                <span className={cn('rounded-full px-2 py-1 text-xs font-medium', SEMANTIC_BADGE_SOFT.error)}>
                  Overdue
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No messages yet.
            </div>
          ) : (
            messages.map((message) => {
              const isInternalMessage = message.role === 'INTERNAL';
              return (
                <div
                  key={message._id ?? `${message.createdAt}-${message.role}`}
                  className={`flex ${isInternalMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-md border px-4 py-3 text-sm shadow-sm ${
                      isInternalMessage
                        ? 'border-primary/20 bg-primary text-primary-foreground'
                        : 'border-border bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">{formatPerson(message.author)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          isInternalMessage
                            ? 'bg-primary-foreground/15'
                            : 'bg-background text-muted-foreground'
                        }`}
                      >
                        {message.role}
                      </span>
                      <span
                        className={isInternalMessage ? 'text-primary-foreground/75' : 'text-muted-foreground'}
                      >
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-6">{message.body}</p>
                    {message.attachmentUrl && (
                      <a
                        className={`mt-2 inline-block text-xs underline ${
                          isInternalMessage ? 'text-primary-foreground' : 'text-primary'
                        }`}
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open attachment
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-4">
          <label className="text-sm font-medium" htmlFor={`request-message-${requestId}`}>
            Message
          </label>
          <textarea
            id={`request-message-${requestId}`}
            className="mt-2 min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            minLength={3}
            maxLength={2000}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Write a reply..."
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs">
              {addMessage.isError ? (
                <span className="text-destructive">{String(addMessage.error)}</span>
              ) : messageTooShort ? (
                <span className="text-destructive">Message must be at least 3 characters.</span>
              ) : (
                <span className="text-muted-foreground">{messageBody.length}/2000</span>
              )}
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSend}
              onClick={handleSend}
            >
              {addMessage.isPending && <Spinner />}
              Send
            </button>
          </div>
        </div>
      </section>

      {isInternal && (
        <section className="space-y-3 rounded-md border bg-background p-4">
          <h3 className="text-base font-semibold">Submit existing evidence</h3>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value)}
              placeholder="Filter evidence"
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={selectedEvidenceId}
              onChange={(e) => setSelectedEvidenceId(e.target.value)}
              disabled={auditEvidence.isLoading}
            >
              <option value="">
                {auditEvidence.isLoading ? 'Loading evidence...' : 'Select evidence'}
              </option>
              {filteredEvidenceItems.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedEvidenceId || submitEvidence.isPending}
              onClick={handleLinkEvidence}
            >
              {submitEvidence.isPending && <Spinner />}
              Link evidence
            </button>
          </div>

          {submitEvidence.isError && (
            <p className="text-sm text-destructive">{String(submitEvidence.error)}</p>
          )}
          {!auditEvidence.isLoading && filteredEvidenceItems.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No READY_FOR_AUDIT evidence matches this filter.
            </p>
          )}

          <div className="space-y-2">
            {(request.submittedItems ?? []).map((item) => (
              <div key={item._id} className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium">{item.title ?? 'Linked evidence'}</p>
                  {item.status && (
                    <span className="w-fit rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
