import { useState } from 'react';
import { Download, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { openReportPdf, useRiskReport } from '@/api/reports';
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
  generatedLabel,
  titleCase,
  toChartRows,
} from './reportUtils';

export function RiskReportPage() {
  const report = useRiskReport();
  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | null>(null);

  const handlePdf = async (mode: 'view' | 'download') => {
    try {
      setPdfBusy(mode);
      await openReportPdf('risk', undefined, mode === 'download' ? 'attachment' : 'inline');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate report PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  if (report.isLoading) return <ReportLoading />;

  const highResidual = report.data?.residualByBand?.High ?? report.data?.residualByBand?.HIGH ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Report"
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
            <MetricCard label="Open Risks" value={formatNumber(report.data.totalOpen)} helper="Active risk register" />
            <MetricCard label="High Residual" value={formatNumber(highResidual)} helper="Residual band" />
            <MetricCard label="Treatments" value={formatNumber(Object.keys(report.data.byTreatment).length)} helper="Treatment categories" />
            <MetricCard label="Top Risks" value={formatNumber(report.data.topRisks.length)} helper="Prioritized by score" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Residual Risk">
              <CountPieChart rows={toChartRows(report.data.residualByBand)} />
            </ChartCard>
            <ChartCard title="Treatment Plans">
              <CountBarChart rows={toChartRows(report.data.byTreatment)} />
            </ChartCard>
            <ChartCard title="Risk Status">
              <CountBarChart rows={toChartRows(report.data.byStatus)} />
            </ChartCard>
          </div>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-base">Top Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Residual</TableHead>
                    <TableHead>Treatment</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.topRisks.length ? (
                    report.data.topRisks.map((risk) => (
                      <TableRow key={risk._id}>
                        <TableCell className="max-w-lg truncate font-medium">{risk.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{titleCase(risk.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          {risk.residualBand ? `${risk.residualBand} (${risk.residualScore ?? 0})` : risk.residualScore ?? 'Unscored'}
                        </TableCell>
                        <TableCell>{risk.treatmentType ? titleCase(risk.treatmentType) : 'Unset'}</TableCell>
                        <TableCell>{risk.ownerName ?? 'Unassigned'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No active risks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
