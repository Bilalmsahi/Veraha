import { useState } from 'react';
import { Download, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { openReportPdf, useVendorReport } from '@/api/reports';
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

export function VendorReportPage() {
  const report = useVendorReport();
  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | null>(null);

  const handlePdf = async (mode: 'view' | 'download') => {
    try {
      setPdfBusy(mode);
      await openReportPdf('vendor', undefined, mode === 'download' ? 'attachment' : 'inline');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate report PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  if (report.isLoading) return <ReportLoading />;

  const totalVendors = report.data?.total ?? report.data?.certificationCoverage.totalVendors ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Report"
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
            <MetricCard label="Vendors" value={formatNumber(totalVendors)} helper="Tracked third parties" />
            <MetricCard label="Certification Coverage" value={formatPercent(report.data.certificationCoverage.coveragePercent)} helper={`${formatNumber(report.data.certificationCoverage.vendorsWithCertifications)} with certifications`} />
            <MetricCard label="High Risk Vendors" value={formatNumber(report.data.highRiskVendors.length)} helper="Critical or high tier" />
            <MetricCard label="Certification Types" value={formatNumber(Object.keys(report.data.certificationCoverage.certificationsByName).length)} helper="Unique certification names" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Risk Tiers">
              <CountPieChart rows={toChartRows(report.data.byRiskTier)} />
            </ChartCard>
            <ChartCard title="Vendor Status">
              <CountBarChart rows={toChartRows(report.data.byStatus)} />
            </ChartCard>
            <ChartCard title="Certifications">
              <CountBarChart rows={toChartRows(report.data.certificationCoverage.certificationsByName)} />
            </ChartCard>
          </div>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-base">High Risk Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Risk Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.highRiskVendors.length ? (
                    report.data.highRiskVendors.map((vendor) => (
                      <TableRow key={vendor._id}>
                        <TableCell className="font-medium">{vendor.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{vendor.riskTier ? titleCase(vendor.riskTier) : 'Unscored'}</Badge>
                        </TableCell>
                        <TableCell>{vendor.status ? titleCase(vendor.status) : 'Unknown'}</TableCell>
                        <TableCell>{vendor.category ? titleCase(vendor.category) : 'Uncategorized'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No high risk vendors found.
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
