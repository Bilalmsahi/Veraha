import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert } from '@/components/shared';
import { inviteSchema } from '@/schemas/auth';
import { useInviteUser } from '@/api/auth';
import { ROLE_LABELS } from '@/lib/constants';
import type { Role } from '@/types/enums';

type InviteUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (invited?: { email: string; role?: string; firstName?: string; lastName?: string }) => void;
};

const INVITABLE_ROLES: Role[] = ['MANAGER', 'EMPLOYEE', 'AUDITOR'];

export function InviteUserModal({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const invite = useInviteUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = inviteSchema.safeParse({
      email,
      role,
      firstName,
      lastName,
    });
    if (!result.success) return;

    invite.mutate(result.data, {
      onSuccess: () => {
        onOpenChange(false);
        setEmail('');
        setRole('EMPLOYEE');
        setFirstName('');
        setLastName('');
        onSuccess?.({
          email: result.data.email,
          role: result.data.role,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
        });
      },
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmail('');
      setRole('EMPLOYEE');
      setFirstName('');
      setLastName('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They will receive an email with a link to set their password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {invite.error && (
            <FormErrorAlert message={(invite.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending...' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
