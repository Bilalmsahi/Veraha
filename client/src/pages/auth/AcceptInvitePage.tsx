import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInviteSchema, type AcceptInviteInput } from '@/schemas/auth';
import { type InvitationValidation, trackInviteActivityFn, useAcceptInvite, useValidateInvite } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormErrorAlert } from '@/components/shared';
import { cn } from '@/lib/utils';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const token = params.token ?? searchParams.get('token') ?? '';
  const invite = useValidateInvite(token);

  const acceptInvite = useAcceptInvite({
    onSuccess: (res) => {
      if (res.user.role === 'AUDITOR') {
        navigate('/auditor');
        return;
      }
      navigate('/dashboard');
    },
  });
  useEffect(() => {
    if (!token || !invite.data) return;
    const interval = window.setInterval(() => {
      trackInviteActivityFn(token).catch(() => undefined);
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [token, invite.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          {invite.data?.organization?.name
            ? `Set your password to join ${invite.data.organization.name}`
            : 'Set your password to join the organization'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invite.isLoading && (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        )}
        {!token && <FormErrorAlert message="Invitation link is missing a token." />}
        {invite.error && (
          <div className="space-y-3">
            <FormErrorAlert message={(invite.error as Error).message} />
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </div>
        )}
        {!invite.isLoading && !invite.error && token && (
          <AcceptInviteForm
            token={token}
            invite={invite.data}
            error={acceptInvite.error}
            isPending={acceptInvite.isPending}
            onSubmit={(input) => acceptInvite.mutate(input)}
          />
        )}
      </CardContent>
    </Card>
  );
}

type AcceptInviteFormProps = {
  token: string;
  invite: InvitationValidation;
  error: Error | null;
  isPending: boolean;
  onSubmit: (input: AcceptInviteInput) => void;
};

function AcceptInviteForm({ token, invite, error, isPending, onSubmit }: AcceptInviteFormProps) {
  const [form, setForm] = useState<Omit<AcceptInviteInput, 'token'>>({
    firstName: invite.firstName || '',
    lastName: invite.lastName || '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AcceptInviteInput, string>>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, token };
    const result = acceptInviteSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof AcceptInviteInput, string>> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof AcceptInviteInput;
        if (path) fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <FormErrorAlert message={error.message} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            className={cn(errors.firstName && 'border-destructive')}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            className={cn(errors.lastName && 'border-destructive')}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          className={cn(errors.password && 'border-destructive')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          className={cn(errors.confirmPassword && 'border-destructive')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword}</p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? 'Accepting...' : 'Accept & sign in'}
      </Button>
    </form>
  );
}
