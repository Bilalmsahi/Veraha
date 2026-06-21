import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader } from '@/components/shared';
import { useFrameworks } from '@/api/frameworks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert } from '@/components/shared';
import { formatFrameworkCode } from '@/lib/formatters';
import { Globe, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
};

export function FrameworksPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const frameworks = useFrameworks();

  if (frameworks.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Frameworks" />
        <FormErrorAlert
          message={(frameworks.error as Error).message}
          onRetry={() => frameworks.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Frameworks"
        description="Browse compliance frameworks and their requirements"
        actions={<ContextualHelpButton moduleId="frameworks" label="Status guide" />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {frameworks.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(frameworks.data ?? []).map((fw) => {
                const isLocked = fw.isPurchased === false || fw.isAccessible === false;
                return (
                <Card
                  key={fw._id}
                  className={isLocked ? 'border-dashed' : 'cursor-pointer transition-colors hover:border-primary/30'}
                  onClick={() => !isLocked && navigate(`/frameworks/${fw.code}/controls`)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span className="truncate">
                        {formatFrameworkCode(FRAMEWORK_LABELS[fw.code] ?? fw.name ?? '')}
                      </span>
                      {isLocked ? (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <Lock className="size-3" aria-hidden />
                          Locked
                        </Badge>
                      ) : null}
                    </CardTitle>
                    {isLocked ? (
                      <Lock className="size-4 text-muted-foreground" />
                    ) : (
                      <Globe className="size-4 text-primary" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold">
                        {fw.readinessScore ?? 0}%
                      </p>
                      {isLocked ? (
                        <span className="mb-0.5 text-xs font-medium text-muted-foreground">
                          Contact admin to unlock
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(fw as { requirementCount?: number }).requirementCount ?? 0} requirements
                    </p>
                    <div className="mt-2 flex items-center text-sm font-medium text-primary">
                      {isLocked ? 'Contact admin to unlock' : 'View requirements'}
                      {isLocked ? <Lock className="ml-1 size-4" /> : <ChevronRight className="ml-1 size-4" />}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="available" className="mt-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Globe className="mb-4 size-12 text-muted-foreground" />
              <p className="text-center text-sm font-medium text-muted-foreground">
                Additional frameworks coming soon
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Contact support to add more compliance frameworks to your organization.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
