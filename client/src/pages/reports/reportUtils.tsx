import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { cn } from '@/lib/utils';
import type { CountMap } from '@/api/reports';

export const REPORT_COLORS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#f59e0b',
  '#7c3aed',
  '#0891b2',
  '#be123c',
  '#475569',
];

export function toChartRows(map?: CountMap) {
  return Object.entries(map ?? {})
    .map(([name, value]) => ({ name: titleCase(name), value }))
    .sort((a, b) => b.value - a.value);
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPercent(value?: number) {
  return `${Math.round(value ?? 0)}%`;
}

export function formatNumber(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function generatedLabel(value?: string) {
  if (!value) return 'Updated just now';
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))}`;
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
};

export function MetricCard({ label, value, helper, className }: MetricCardProps) {
  return (
    <Card className={cn('rounded-md py-5', className)}>
      <CardContent className="space-y-1 px-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

type ChartCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function ChartCard({ title, children, className }: ChartCardProps) {
  return (
    <Card className={cn('rounded-md', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

export function ReportLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricCard key={index} label="Loading" value="..." helper="Fetching report data" />
        ))}
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

export function CountBarChart({ rows }: { rows: Array<{ name: string; value: number }> }) {
  if (!rows.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 12, right: 8, left: -16, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" angle={-22} textAnchor="end" height={52} tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={REPORT_COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CountPieChart({ rows }: { rows: Array<{ name: string; value: number }> }) {
  if (!rows.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>
          {rows.map((row, index) => (
            <Cell key={row.name} fill={REPORT_COLORS[index % REPORT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      No report data yet
    </div>
  );
}
