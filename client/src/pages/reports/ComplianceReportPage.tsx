import { useMemo, useState } from 'react';
import { Download, Eye, Printer, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useFrameworks as useDashboardFrameworks } from '@/api/dashboard';
import { openReportPdf, useComplianceReport, type ComplianceReportParams } from '@/api/reports';
import { FormErrorAlert } from '@/components/shared/FormErrorAlert';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const TIMEFRAMES: Array<{ label: string; value: NonNullable<ComplianceReportParams['timeframe']> }> = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 180 days', value: '180d' },
  { label: 'Last year', value: '1y' },
  { label: 'All time', value: 'all' },
];

export function ComplianceReportPage() {
  const [timeframe, setTimeframe] = useState<NonNullable<ComplianceReportParams['timeframe']>>('90d');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | null>(null);
  const frameworks = useDashboardFrameworks();
  const reportParams = useMemo<ComplianceReportParams>(
    () => ({
      timeframe,
      frameworks: selectedFrameworks,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [endDate, selectedFrameworks, startDate, timeframe],
  );
  const report = useComplianceReport(reportParams);

  const toggleFramework = (code: string) => {
    setSelectedFrameworks((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const clearFilters = () => {
    setTimeframe('90d');
    setSelectedFrameworks([]);
    setStartDate('');
    setEndDate('');
  };

  const handlePdf = async (mode: 'view' | 'download') => {
    try {
      setPdfBusy(mode);
      await openReportPdf('compliance', reportParams, mode === 'download' ? 'attachment' : 'inline');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate report PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  if (report.isLoading) return <ReportLoading />;
  const totalRequirements = report.data?.overall.totalRequirements ?? report.data?.overall.totalControls ?? 0;
  const passingRequirements =
    report.data?.overall.passingRequirements ?? report.data?.overall.passingControls ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Report"
        description={generatedLabel(report.data?.generatedAt)}
        actions={
          <>
            <Select value={timeframe} onValueChange={(value) => setTimeframe(value as typeof timeframe)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-base">Report Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label htmlFor="report-start-date">Start date</Label>
                  <Input
                    id="report-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-end-date">End date</Label>
                  <Input
                    id="report-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                <Button variant="ghost" onClick={clearFilters}>
                  <RotateCcw className="mr-2 size-4" />
                  Reset
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Frameworks</Label>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {(frameworks.data ?? []).map((framework) => (
                    <label
                      key={framework.code}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedFrameworks.includes(framework.code)}
                        onCheckedChange={() => toggleFramework(framework.code)}
                      />
                      <span className="truncate">{framework.code}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave frameworks empty to include all enabled frameworks. Custom dates override the shortcut period.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Compliance" value={formatPercent(report.data.overall.compliancePercent)} helper="Average framework readiness" />
            <MetricCard label="Requirements" value={formatNumber(totalRequirements)} helper={`${formatNumber(passingRequirements)} passing`} />
            <MetricCard label="Evidence Items" value={formatNumber(Object.values(report.data.evidenceByStatus).reduce((sum, value) => sum + value, 0))} helper="All evidence statuses" />
            <MetricCard label="Policy Acknowledgement" value={formatPercent(report.data.policyAcknowledgement.percentAcknowledged)} helper={`${formatNumber(report.data.policyAcknowledgement.acknowledged)} of ${formatNumber(report.data.policyAcknowledgement.totalAssignments)}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Controls by Status" className="xl:col-span-2">
              <CountBarChart rows={toChartRows(report.data.controlsByStatus)} />
            </ChartCard>
            <ChartCard title="Evidence by Status">
              <CountPieChart rows={toChartRows(report.data.evidenceByStatus)} />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Framework Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Framework</TableHead>
                      <TableHead>Requirements</TableHead>
                      <TableHead>Passing</TableHead>
                      <TableHead>Readiness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.frameworkBreakdown.map((framework) => (
                      <TableRow key={framework.code}>
                        <TableCell>
                          <div className="font-medium">{framework.code}</div>
                          <div className="text-xs text-muted-foreground">{framework.name}</div>
                        </TableCell>
                        <TableCell>{formatNumber(framework.totalRequirements ?? framework.totalControls)}</TableCell>
                        <TableCell>{formatNumber(framework.passingRequirements ?? framework.passingControls)}</TableCell>
                        <TableCell>{formatPercent(framework.readinessScore ?? framework.compliancePercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Top Failing Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Control</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.topFailingControls.length ? (
                      report.data.topFailingControls.map((control) => (
                        <TableRow key={control._id}>
                          <TableCell>
                            <div className="font-medium">{control.controlId ?? 'Control'}</div>
                            <div className="max-w-md truncate text-xs text-muted-foreground">{control.title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{titleCase(control.status)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                          No failing controls found.
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
