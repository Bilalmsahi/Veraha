import { useState } from 'react';
import { Download, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { openReportPdf, usePersonnelReport } from '@/api/reports';
import { FormErrorAlert } from '@/components/shared/FormErrorAlert';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartCard,
  CountBarChart,
  CountPieChart,
  MetricCard,
  ReportLoading,
  formatNumber,
  formatPercent,
  generatedLabel,
  titleCase,
  toChartRows,
} from './reportUtils';

export function PersonnelReportPage() {
  const report = usePersonnelReport();
  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | null>(null);

  const handlePdf = async (mode: 'view' | 'download') => {
    try {
      setPdfBusy(mode);
      await openReportPdf('personnel', undefined, mode === 'download' ? 'attachment' : 'inline');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate report PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  if (report.isLoading) return <ReportLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel Report"
        description={generatedLabel(report.data?.generatedAt)}
        actions={
          <>
            <Button variant="outline" onClick={() => handlePdf('view')} disabled={pdfBusy !== null}>
              <Eye className="mr-2 size-4" />
              View PDF
            </Button>
            <Button variant="outline" onClick={() => handlePdf('download')} disabled={pdfBusy !== null}>
              <Download className="mr-2 size-4" />
              Download
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" />
              Print
            </Button>
          </>
        }
      />

      {report.error ? (
        <FormErrorAlert message={(report.error as Error).message} onRetry={() => report.refetch()} />
      ) : null}

      {report.data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Personnel" value={formatNumber(report.data.totalPersonnel)} helper="Internal users" />
            <MetricCard label="Task Completion" value={formatPercent(report.data.taskCompletion.completionPercent)} helper={`${formatNumber(report.data.taskCompletion.completeTasks)} of ${formatNumber(report.data.taskCompletion.totalTasks)}`} />
            <MetricCard label="Training Modules" value={formatNumber(report.data.trainingByModule.length)} helper="With recorded attempts" />
            <MetricCard label="Device Reviews" value={formatNumber(Object.values(report.data.deviceReviewsByStatus).reduce((sum, value) => sum + value, 0))} helper="Submitted device evidence" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Roles">
              <CountPieChart rows={toChartRows(report.data.roleBreakdown)} />
            </ChartCard>
            <ChartCard title="Device Reviews">
              <CountBarChart rows={toChartRows(report.data.deviceReviewsByStatus)} />
            </ChartCard>
            <ChartCard title="Training Pass Rate">
              <CountBarChart
                rows={report.data.trainingByModule.map((module) => ({
                  name: module.title,
                  value: Math.round(module.passRate),
                }))}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">People</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.people.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell>
                          <div className="font-medium">{person.name}</div>
                          <div className="text-xs text-muted-foreground">{person.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{titleCase(person.role)}</Badge>
                        </TableCell>
                        <TableCell>{formatNumber(person.totalTasks)}</TableCell>
                        <TableCell>{formatPercent(person.completionPercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Training</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Pass Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.trainingByModule.length ? (
                      report.data.trainingByModule.map((module) => (
                        <TableRow key={module.moduleId}>
                          <TableCell className="max-w-sm truncate font-medium">{module.title}</TableCell>
                          <TableCell>{formatNumber(module.attempts)}</TableCell>
                          <TableCell>{formatNumber(module.passed)}</TableCell>
                          <TableCell>{formatPercent(module.passRate)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No training attempts recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
