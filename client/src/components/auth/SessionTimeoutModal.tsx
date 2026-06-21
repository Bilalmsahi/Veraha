import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SESSION_TIMEOUT_WARNING_MINUTES } from '@/constants/sessionTimeout';

type SessionTimeoutModalProps = {
  open: boolean;
  onStayLoggedIn: () => void;
  onLogOutNow: () => void;
};

export function SessionTimeoutModal({
  open,
  onStayLoggedIn,
  onLogOutNow,
}: SessionTimeoutModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Session expiring soon</DialogTitle>
          <DialogDescription>
            You&apos;ll be logged out in {SESSION_TIMEOUT_WARNING_MINUTES} minutes due to inactivity.
            Stay logged in to continue working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onLogOutNow}>
            Log Out Now
          </Button>
          <Button onClick={onStayLoggedIn}>Stay Logged In</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
