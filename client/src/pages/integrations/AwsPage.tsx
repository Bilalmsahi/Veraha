import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAwsAccounts,
  useFindings,
  useLinkAwsAccountControls,
  useUnlinkAwsAccountControl,
  useLinkFindingControls,
  useUnlinkFindingControl,
  type AwsAccount,
  type AwsFinding,
} from '@/api/integrations';
import { AddAwsAccountModal } from '@/components/integrations/aws/AddAwsAccountModal';
import { LogFindingModal } from '@/components/integrations/aws/LogFindingModal';
import { LinkedControlsList } from '@/components/integrations/LinkedControlsList';
import { ContextualHelpButton, PageHeader, FormErrorAlert, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Cloud, Plus, Shield, AlertTriangle, ChevronRight } from 'lucide-react';

const ENVIRONMENT_BADGE: Record<string, string> = {
  production: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
  staging: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  development: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
  other: 'bg-muted text-muted-foreground border-border',
};

const ACCOUNT_STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
  inactive: 'bg-muted text-muted-foreground border-border',
  unverified: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
  high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900',
  low: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
  informational: 'bg-muted text-muted-foreground border-border',
};

const FINDING_STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
  in_remediation: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900',
  resolved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
  accepted_risk: 'bg-muted text-muted-foreground border-border',
};

const FINDING_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_remediation: 'In remediation',
  resolved: 'Resolved',
  accepted_risk: 'Accepted risk',
};

function AccountCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function FindingDetailDrawer({
  finding,
  open,
  onOpenChange,
}: {
  finding: AwsFinding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const linkControls = useLinkFindingControls();
  const unlinkControl = useUnlinkFindingControl();

  if (!finding) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" aria-hidden />
            {finding.title}
          </SheetTitle>
          <SheetDescription>{finding.affectedService ?? 'AWS finding details'}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={cn('capitalize', SEVERITY_BADGE[finding.severity])}
            >
              {finding.severity}
            </Badge>
            <Badge variant="outline" className={cn(FINDING_STATUS_BADGE[finding.status])}>
              {FINDING_STATUS_LABELS[finding.status] ?? formatLabel(finding.status)}
            </Badge>
          </div>

          {finding.description && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </h4>
              <p className="whitespace-pre-line text-sm">{finding.description}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Detected on</dt>
              <dd>{finding.detectedOn ? formatDate(finding.detectedOn) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Service</dt>
              <dd>{finding.affectedService ?? '—'}</dd>
            </div>
          </dl>

          <LinkedControlsList
            linkedControlIds={finding.linkedControlIds ?? []}
            onLink={(controlIds) => linkControls.mutate({ id: finding._id, controlIds })}
            onUnlink={(controlId) => unlinkControl.mutate({ id: finding._id, controlId })}
            isLinking={linkControls.isPending}
            isUnlinking={unlinkControl.isPending}
            pickerTitle="Link controls to finding"
            pickerDescription="Select controls related to this AWS security finding."
            emptyMessage="No controls linked — link controls so this finding appears as evidence."
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AwsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [logFindingOpen, setLogFindingOpen] = useState(false);
  const [findingDrawerOpen, setFindingDrawerOpen] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAwsAccounts();
  const { data: findingsData, isLoading: findingsLoading, error: findingsError, refetch: refetchFindings } = useFindings(selectedAccountId ?? '');

  const linkAccountControls = useLinkAwsAccountControls();
  const unlinkAccountControl = useUnlinkAwsAccountControl();

  const accounts: AwsAccount[] = accountsData?.data ?? [];
  const selectedAccount = accounts.find((a) => a._id === selectedAccountId);
  const findings: AwsFinding[] = findingsData?.data ?? [];
  const selectedFinding = findings.find((f) => f._id === selectedFindingId) ?? null;

  const findingsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      open: 0,
      in_remediation: 0,
      resolved: 0,
      accepted_risk: 0,
    };
    for (const finding of findings) {
      if (finding.status in counts) {
        counts[finding.status] += 1;
      }
    }
    return counts;
  }, [findings]);

  const handleOpenFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    setFindingDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/integrations" className="hover:text-foreground transition-colors">
          Integrations
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="text-foreground">AWS</span>
      </nav>

      <PageHeader
        title="AWS Integration"
        description="Manage AWS accounts and security findings"
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="aws" current={{ status: selectedAccount?.status }} />
            <Button size="sm" onClick={() => setAddAccountOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add account
            </Button>
          </div>
        }
      />

      {accountsError && (
        <FormErrorAlert
          message={(accountsError as Error).message}
          onRetry={() => refetchAccounts()}
        />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full space-y-4 lg:w-1/3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Cloud className="size-5" />
              AWS Accounts
            </h2>
          </div>

          {accountsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <AccountCardSkeleton key={i} />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Cloud}
              title="No AWS accounts"
              description="Add an AWS account to start logging security findings."
              action={{
                label: 'Add account',
                onClick: () => setAddAccountOpen(true),
              }}
            />
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const isSelected = account._id === selectedAccountId;
                return (
                  <Card
                    key={account._id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/50',
                      isSelected && 'border-primary bg-primary/5'
                    )}
                    onClick={() => setSelectedAccountId(account._id)}
                  >
                    <CardContent className="space-y-2 p-4">
                      <p className="font-medium">{account.name}</p>
                      <Badge variant="outline" className="font-mono text-xs">
                        {account.awsAccountId}
                      </Badge>
                      <div className="flex flex-wrap gap-2">
                        {account.environmentType && (
                          <Badge
                            variant="outline"
                            className={cn('capitalize', ENVIRONMENT_BADGE[account.environmentType])}
                          >
                            {account.environmentType}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn('capitalize', ACCOUNT_STATUS_BADGE[account.status])}
                        >
                          {account.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full lg:w-2/3">
          {selectedAccount ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedAccount.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedAccount.awsAccountId}
                  </p>
                </div>
                <Button size="sm" onClick={() => setLogFindingOpen(true)}>
                  <Shield className="mr-2 size-4" />
                  Log finding
                </Button>
              </div>

              <Card>
                <CardContent className="p-4">
                  <LinkedControlsList
                    linkedControlIds={selectedAccount.linkedControlIds ?? []}
                    onLink={(controlIds) =>
                      linkAccountControls.mutate({ id: selectedAccount._id, controlIds })
                    }
                    onUnlink={(controlId) =>
                      unlinkAccountControl.mutate({ id: selectedAccount._id, controlId })
                    }
                    isLinking={linkAccountControls.isPending}
                    isUnlinking={unlinkAccountControl.isPending}
                    pickerTitle="Link controls to AWS account"
                    pickerDescription="Select controls related to this AWS account."
                    emptyMessage="No controls linked — link controls so this account appears as compliance evidence."
                  />
                </CardContent>
              </Card>

              {findingsError && (
                <FormErrorAlert
                  message={(findingsError as Error).message}
                  onRetry={() => refetchFindings()}
                />
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(findingsByStatus).map(([status, count]) => (
                  <Card key={status}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">
                        {FINDING_STATUS_LABELS[status] ?? formatLabel(status)}
                      </p>
                      <p className="text-2xl font-semibold">{count}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {findingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : findings.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No findings"
                  description="Log a security finding for this account to track remediation."
                  action={{
                    label: 'Log finding',
                    onClick: () => setLogFindingOpen(true),
                  }}
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Detected on</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {findings.map((finding) => (
                        <TableRow
                          key={finding._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenFinding(finding._id)}
                        >
                          <TableCell className="max-w-[200px] truncate font-medium">
                            {finding.title}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('capitalize', SEVERITY_BADGE[finding.severity])}
                            >
                              {finding.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(FINDING_STATUS_BADGE[finding.status])}
                            >
                              {FINDING_STATUS_LABELS[finding.status] ?? formatLabel(finding.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{finding.affectedService ?? '—'}</TableCell>
                          <TableCell>{formatDate(finding.detectedOn)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="View finding"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFinding(finding._id);
                              }}
                            >
                              <ChevronRight className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed">
              <EmptyState
                icon={Cloud}
                title="Select an account"
                description="Choose an AWS account from the list to view its security findings."
              />
            </div>
          )}
        </div>
      </div>

      <AddAwsAccountModal open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <LogFindingModal
        open={logFindingOpen}
        onOpenChange={setLogFindingOpen}
        accountId={selectedAccountId ?? ''}
        accountName={selectedAccount?.name ?? ''}
      />
      <FindingDetailDrawer
        finding={selectedFinding}
        open={findingDrawerOpen}
        onOpenChange={setFindingDrawerOpen}
      />
    </div>
  );
}
