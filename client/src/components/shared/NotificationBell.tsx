import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '@/api/axios';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

type NotificationItem = {
  _id: string;
  title: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  resourceType?: string;
  resourceId?: string;
  auditId?: string;
  resourceAuditId?: string;
};

type NotificationBellProps = {
  pollInterval?: number;
};

function truncate(value: string | undefined, maxLength = 60) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatTimestamp(value: string | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function unwrapApiResponse<T>(response: { data: { success?: boolean; error?: string; data?: T } }, fallback: string): T {
  const payload = response.data;
  if (!payload?.success) throw new Error(payload?.error || fallback);
  return payload.data as T;
}

function getResourceUrl(notification: NotificationItem, role?: string) {
  const auditId = notification.auditId || notification.resourceAuditId;

  if (notification.resourceType === 'AuditEvidenceRequest') {
    if (auditId) {
      return role === 'AUDITOR' ? `/auditor/audits/${auditId}` : `/audits/${auditId}`;
    }
    return role === 'AUDITOR' ? '/auditor' : '/audits';
  }

  if (notification.resourceType === 'Audit') {
    return role === 'AUDITOR'
      ? `/auditor/audits/${notification.resourceId}`
      : `/audits/${notification.resourceId}`;
  }

  return role === 'AUDITOR' ? '/auditor' : '/dashboard';
}

export default function NotificationBell({ pollInterval = 30000 }: NotificationBellProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadNotifications({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications', {
        params: { unreadOnly: true, limit: 10 },
      });
      const data = unwrapApiResponse<{ notifications?: NotificationItem[]; unreadCount?: number }>(
        response,
        'Unable to load notifications.'
      );
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load notifications.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications({ silent: true });
    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, pollInterval);

    return () => window.clearInterval(intervalId);
  }, [pollInterval]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  async function handleNotificationClick(notification: NotificationItem) {
    try {
      if (!notification.read) {
        await api.patch(`/notifications/${notification._id}/read`);
        setUnreadCount((count) => Math.max(count - 1, 0));
        setNotifications((items) =>
          items.map((item) => (item._id === notification._id ? { ...item, read: true } : item))
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to update notification.'));
      return;
    }

    setOpen(false);
    navigate(getResourceUrl(notification, user?.role));
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to mark notifications read.'));
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-accent"
        aria-label="Notifications"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) loadNotifications();
        }}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-md border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={unreadCount === 0}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          </div>

          {error && (
            <div className="border-b bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No unread notifications.
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  className="flex w-full gap-3 border-b px-3 py-3 text-left text-sm last:border-b-0 hover:bg-muted/60"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                      notification.read ? 'bg-transparent' : 'bg-primary'
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{notification.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {truncate(notification.body)}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatTimestamp(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
