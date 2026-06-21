import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared';
import { useOrganization, useUpdateOrg } from '@/api/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  SESSION_TIMEOUT_OPTIONS,
} from '@/constants/sessionTimeout';

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Kolkata', label: 'India' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'ISO', label: 'ISO (YYYY-MM-DD)' },
  { value: 'US', label: 'US (MM/DD/YYYY)' },
  { value: 'EU', label: 'EU (DD/MM/YYYY)' },
];

export function SettingsPage() {
  const permissions = usePermissions();
  const org = useOrganization();
  const updateOrg = useUpdateOrg();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('ISO');
  const [evidenceExpiryWarningDays, setEvidenceExpiryWarningDays] = useState<number>(30);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    DEFAULT_SESSION_TIMEOUT_MINUTES,
  );

  const orgData = org.data;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (orgData) {
      setName(orgData.name);
      setTimezone(orgData.settings?.timezone ?? 'UTC');
      setDateFormat(orgData.settings?.dateFormat ?? 'ISO');
      setEvidenceExpiryWarningDays(orgData.settings?.evidenceExpiryWarningDays ?? 30);
    }
  }, [orgData]);

  useEffect(() => {
    setSessionTimeoutMinutes(
      orgData?.settings?.sessionTimeoutMinutes ?? DEFAULT_SESSION_TIMEOUT_MINUTES,
    );
  }, [orgData?.settings?.sessionTimeoutMinutes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateOrg.mutate({ name: name.trim() });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({
      settings: {
        timezone,
        dateFormat,
        evidenceExpiryWarningDays: Math.max(1, Math.min(365, evidenceExpiryWarningDays)),
      },
    });
  };

  const handleSaveSessionTimeout = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({
      settings: {
        sessionTimeoutMinutes,
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organization settings"
      />

      {updateOrg.error && (
        <FormErrorAlert
          message={(updateOrg.error as Error).message}
        />
      )}

      {org.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {permissions.canViewPeopleGroups && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">People & Groups</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage team members, invitations, roles, and personnel groups.
                </p>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/settings/people-groups">
                    <Users className="mr-2 size-4" />
                    Open People & Groups
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization name</Label>
                  <Input
                    id="name"
                    value={(name || orgData?.name) ?? ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Organization name"
                  />
                </div>
                <Button type="submit" disabled={updateOrg.isPending}>
                  {updateOrg.isPending ? 'Saving...' : 'Save'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display & notifications</CardTitle>
              <p className="text-sm text-muted-foreground">
                Timezone, date format, and evidence expiry warnings.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evidenceExpiryWarningDays">
                    Evidence expiry warning (days)
                  </Label>
                  <Input
                    id="evidenceExpiryWarningDays"
                    type="number"
                    min={1}
                    max={365}
                    value={evidenceExpiryWarningDays}
                    onChange={(e) =>
                      setEvidenceExpiryWarningDays(Number(e.target.value) || 30)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Show warning when evidence expires within this many days.
                  </p>
                </div>

                <Button type="submit" disabled={updateOrg.isPending}>
                  {updateOrg.isPending ? 'Saving...' : 'Save settings'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Session Timeout</CardTitle>
              <p className="text-sm text-muted-foreground">
                Automatically log out after a period of inactivity to keep your account secure.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSessionTimeout} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeoutMinutes">Timeout duration</Label>
                  <Select
                    value={String(sessionTimeoutMinutes)}
                    onValueChange={(value) => setSessionTimeoutMinutes(Number(value))}
                  >
                    <SelectTrigger id="sessionTimeoutMinutes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TIMEOUT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                          {option.value === DEFAULT_SESSION_TIMEOUT_MINUTES ? ' (default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    You will receive a warning 2 minutes before being logged out.
                  </p>
                </div>
                <Button type="submit" disabled={updateOrg.isPending}>
                  {updateOrg.isPending ? 'Saving...' : 'Save'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}