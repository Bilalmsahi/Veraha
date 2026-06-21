import { Link } from 'react-router-dom';
import { AlertTriangle, FileWarning, CalendarClock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import type { DashboardAlerts } from '@/api/dashboard';

type AlertsPanelProps = {
  alerts: DashboardAlerts;
  className?: string;
};

export function AlertsPanel({ alerts, className }: AlertsPanelProps) {
  const hasAlerts =
    alerts.expiringEvidence.length > 0 ||
    alerts.overdueAssessments.length > 0 ||
    alerts.failingControls.length > 0 ||
    alerts.warningControls.length > 0 ||
    alerts.neverAssessed.length > 0;

  if (!hasAlerts) {
    return (
      <Card id="alerts" className={className}>
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No alerts at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="alerts" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-[var(--color-warning)]" />
          Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.expiringEvidence.length > 0 && (
          <AlertSection
            title="Expiring documents"
            icon={FileWarning}
            items={alerts.expiringEvidence.map((e) => ({
              id: e._id,
              label: e.title,
              sub: `Expires ${formatDate(e.validUntil)} (${e.daysUntilExpiry}d)`,
              to: `/documents?highlight=${e._id}`,
            }))}
          />
        )}
        {alerts.overdueAssessments.length > 0 && (
          <AlertSection
            title="Overdue assessments"
            icon={CalendarClock}
            items={alerts.overdueAssessments.map((c) => ({
              id: c._id,
              label: `${c.identifier}: ${c.title}`,
              sub: `${c.daysOverdue} days overdue`,
              to: `/controls?highlight=${c._id}`,
            }))}
          />
        )}
        {alerts.failingControls.length > 0 && (
          <AlertSection
            title="Failing controls"
            icon={XCircle}
            items={alerts.failingControls.map((c) => ({
              id: c._id,
              label: `${c.identifier ?? ''}: ${c.title ?? 'Control'}`,
              sub: c.controlGroup ?? '',
              to: `/controls?highlight=${c._id}`,
            }))}
          />
        )}
        {alerts.warningControls.length > 0 && (
          <AlertSection
            title="Warning controls"
            icon={AlertTriangle}
            items={alerts.warningControls.map((c) => ({
              id: c._id,
              label: `${c.identifier ?? ''}: ${c.title ?? 'Control'}`,
              sub: c.controlGroup ?? '',
              to: `/controls?highlight=${c._id}`,
            }))}
          />
        )}
        {alerts.neverAssessed.length > 0 && (
          <AlertSection
            title="Never assessed"
            icon={CalendarClock}
            items={alerts.neverAssessed.map((c) => ({
              id: c._id,
              label: `${c.identifier}: ${c.title}`,
              sub: `Created ${c.daysSinceCreation}d ago`,
              to: `/controls?highlight=${c._id}`,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AlertSection({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ id: string; label: string; sub: string; to: string }>;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </h4>
      <ul className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <span className="font-medium">{item.label}</span>
              {item.sub && (
                <span className="ml-2 text-muted-foreground">— {item.sub}</span>
              )}
            </Link>
          </li>
        ))}
        {items.length > 5 && (
          <li className="px-2 text-xs text-muted-foreground">
            +{items.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
