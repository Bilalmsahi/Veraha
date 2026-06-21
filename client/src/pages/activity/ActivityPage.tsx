import { useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { PageHeader, Pagination, FormErrorAlert, EmptyState } from '@/components/shared';
import { ActivityFeed } from '@/components/dashboard';
import { useActivity } from '@/api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';

export function ActivityPage() {
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const activity = useActivity({
    page,
    limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
  });

  if (activity.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Activity" />
        <FormErrorAlert
          message={(activity.error as Error).message}
          onRetry={() => activity.refetch()}
        />
      </div>
    );
  }

  const pagination = activity.data?.pagination;
  const activities = activity.data?.activities ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description={
          permissions.canViewOrgActivity
            ? 'Recent changes across the organization'
            : 'Your recent actions'
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Changes to controls, evidence, policies, and other resources will appear here."
            />
          ) : (
            <>
              <ActivityFeed
                activities={activities}
                maxItems={activities.length}
                viewAllLink="/activity"
              />
              {pagination && (
                <div className="mt-6 border-t pt-4">
                  <Pagination
                    page={pagination.page}
                    limit={[10, 20, 50, 100].includes(limit) ? limit : 20}
                    total={pagination.total}
                    pages={pagination.pages}
                    hasPrevPage={pagination.hasPrevPage}
                    hasNextPage={pagination.hasNextPage}
                    onPageChange={(p) => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('page', String(p));
                        return next;
                      });
                    }}
                    onLimitChange={(l) => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('limit', String(l));
                        next.set('page', '1');
                        return next;
                      });
                    }}
                    entityLabel="activities"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
