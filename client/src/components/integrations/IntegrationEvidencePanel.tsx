import { useMemo } from 'react';
import {
  useIntegrationEvidence,
  type CompanionEvidence,
  type CompanionEvidenceSource,
} from '@/api/integrations';
import { EnumBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plug } from 'lucide-react';

type IntegrationEvidencePanelProps = {
  controlId: string;
};

const SOURCE_META: Record<
  CompanionEvidenceSource,
  { title: string; emptyLabel: string }
> = {
  aws_account: { title: 'AWS Accounts', emptyLabel: 'None' },
  aws_finding: { title: 'AWS Findings', emptyLabel: 'None' },
  hr_profile: { title: 'HR Profiles', emptyLabel: 'None' },
  device: { title: 'Devices', emptyLabel: 'None' },
};

const STATUS_TONE: Record<
  CompanionEvidence['status'],
  { label: string; tone: 'success' | 'warning' | 'error' | 'muted' }
> = {
  APPROVED: { label: 'Approved', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  REJECTED: { label: 'Rejected', tone: 'error' },
  EXPIRED: { label: 'Expired', tone: 'error' },
};

function StatusBadge({ status }: { status: CompanionEvidence['status'] }) {
  const config = STATUS_TONE[status] ?? { label: status, tone: 'muted' as const };
  return <EnumBadge label={config.label} softTone={config.tone} />;
}

function IntegrationSection({
  title,
  items,
}: {
  title: string;
  items: CompanionEvidence[];
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item._id}
              className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                {item.description && (
                  <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                )}
              </div>
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IntegrationEvidencePanel({ controlId }: IntegrationEvidencePanelProps) {
  const evidenceQuery = useIntegrationEvidence(controlId);

  const grouped = useMemo(() => {
    const buckets: Record<CompanionEvidenceSource, CompanionEvidence[]> = {
      aws_account: [],
      aws_finding: [],
      hr_profile: [],
      device: [],
    };
    for (const item of evidenceQuery.data ?? []) {
      if (buckets[item.source]) {
        buckets[item.source].push(item);
      }
    }
    return buckets;
  }, [evidenceQuery.data]);

  const isLoading = evidenceQuery.isLoading;
  const isEmpty =
    !isLoading &&
    grouped.aws_account.length === 0 &&
    grouped.aws_finding.length === 0 &&
    grouped.hr_profile.length === 0 &&
    grouped.device.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="size-4" aria-hidden />
          Integration Evidence
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading integration evidence…</p>
        ) : evidenceQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load integration evidence.</p>
        ) : isEmpty ? (
          <p className="text-sm italic text-muted-foreground">
            No integration items linked to this control
          </p>
        ) : (
          <div className="space-y-4">
            <IntegrationSection
              title={SOURCE_META.aws_account.title}
              items={grouped.aws_account}
            />
            <IntegrationSection
              title={SOURCE_META.aws_finding.title}
              items={grouped.aws_finding}
            />
            <IntegrationSection
              title={SOURCE_META.hr_profile.title}
              items={grouped.hr_profile}
            />
            <IntegrationSection
              title={SOURCE_META.device.title}
              items={grouped.device}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
