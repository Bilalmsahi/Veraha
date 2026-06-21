import { useNavigate } from 'react-router-dom';
import { Cloud, Laptop, Users } from 'lucide-react';
import { useIntegrationSummary } from '@/api/integrations';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { ContextualHelpButton, FormErrorAlert, PageHeader } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';

function IntegrationsHubSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

export function IntegrationsHubPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading, error, refetch } = useIntegrationSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your cloud, HR and device tools"
        actions={<ContextualHelpButton moduleId="integrations" label="Status guide" />}
      />

      {error && (
        <FormErrorAlert
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <IntegrationsHubSkeleton />
      ) : summary ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard
            title="AWS"
            icon={Cloud}
            connectionStatus={summary.aws.connectionStatus}
            stats={[
              { label: 'Accounts', value: summary.aws.accountCount },
              { label: 'Open Findings', value: summary.aws.openFindingsCount },
            ]}
            onView={() => navigate('/integrations/aws')}
          />

          <IntegrationCard
            title="HR Systems"
            icon={Users}
            connectionStatus={summary.hr.connectionStatus}
            stats={[
              { label: 'Profiles', value: summary.hr.profileCount },
              { label: 'Active', value: summary.hr.activeCount },
              { label: 'Departed', value: summary.hr.departedCount },
            ]}
            onView={() => navigate('/integrations/hr')}
          />

          <IntegrationCard
            title="Device Management"
            icon={Laptop}
            connectionStatus={summary.mdm.connectionStatus}
            stats={[
              { label: 'Devices', value: summary.mdm.deviceCount },
              { label: 'Compliant', value: summary.mdm.compliantCount },
              { label: 'Issues', value: summary.mdm.nonCompliantCount },
            ]}
            onView={() => navigate('/devices')}
          />
        </div>
      ) : null}
    </div>
  );
}
