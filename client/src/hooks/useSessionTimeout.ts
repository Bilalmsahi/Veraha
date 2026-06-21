import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  LAST_ACTIVITY_STORAGE_KEY,
  SESSION_TIMEOUT_WARNING_MINUTES,
} from '@/constants/sessionTimeout';
import { logoutFn, touchActivityFn } from '@/api/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { getSessionTimeoutSchedule } from '@/utils/sessionTimeoutTimer';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;
const ACTIVITY_DEBOUNCE_MS = 1000;

function readLastActivity(): number {
  const stored = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  if (!stored) {
    return Date.now();
  }

  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function writeLastActivity(timestamp = Date.now()) {
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
}

function clearLastActivity() {
  localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
}

type UseSessionTimeoutOptions = {
  enabled?: boolean;
  timeoutMinutes?: number;
  onWarningChange?: (showWarning: boolean) => void;
};

export function useSessionTimeout({
  enabled = true,
  timeoutMinutes = DEFAULT_SESSION_TIMEOUT_MINUTES,
  onWarningChange,
}: UseSessionTimeoutOptions = {}) {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const [showWarning, setShowWarning] = useState(false);

  const warningTimeoutRef = useRef<number | null>(null);
  const logoutTimeoutRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const isLoggingOutRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (warningTimeoutRef.current != null) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current != null) {
      window.clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, []);

  const setWarningVisible = useCallback(
    (visible: boolean) => {
      setShowWarning(visible);
      onWarningChange?.(visible);
    },
    [onWarningChange],
  );

  const performLogout = useCallback(
    async (reason: 'timeout' | 'manual' = 'timeout') => {
      if (isLoggingOutRef.current) {
        return;
      }

      isLoggingOutRef.current = true;
      clearTimers();
      setWarningVisible(false);
      clearLastActivity();

      try {
        await logoutFn();
      } catch {
        // Continue with local logout even if the server call fails.
      }

      logout();

      if (typeof window !== 'undefined') {
        const loginUrl = reason === 'timeout' ? '/login?reason=timeout' : '/login';
        if (window.location.pathname !== '/login') {
          window.location.href = loginUrl;
        }
      }
    },
    [clearTimers, logout, setWarningVisible],
  );

  const scheduleTimers = useCallback(() => {
    clearTimers();

    if (!enabled || !token || document.hidden) {
      return;
    }

    const lastActivity = readLastActivity();
    const elapsedMs = Date.now() - lastActivity;
    const schedule = getSessionTimeoutSchedule(elapsedMs, timeoutMinutes);

    if (schedule.kind === 'logout') {
      void performLogout('timeout');
      return;
    }

    if (schedule.kind === 'warning') {
      setWarningVisible(true);
      logoutTimeoutRef.current = window.setTimeout(() => {
        void performLogout('timeout');
      }, schedule.logoutInMs);
      return;
    }

    setWarningVisible(false);

    warningTimeoutRef.current = window.setTimeout(() => {
      setWarningVisible(true);
      logoutTimeoutRef.current = window.setTimeout(() => {
        void performLogout('timeout');
      }, SESSION_TIMEOUT_WARNING_MINUTES * 60 * 1000);
    }, schedule.warningInMs);
  }, [clearTimers, enabled, performLogout, setWarningVisible, timeoutMinutes, token]);

  const recordActivity = useCallback(() => {
    if (!enabled || !token) {
      return;
    }

    writeLastActivity();
    setWarningVisible(false);
    scheduleTimers();
  }, [enabled, scheduleTimers, setWarningVisible, token]);

  const handleDebouncedActivity = useCallback(() => {
    if (debounceTimeoutRef.current != null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      recordActivity();
    }, ACTIVITY_DEBOUNCE_MS);
  }, [recordActivity]);

  const stayLoggedIn = useCallback(async () => {
    writeLastActivity();
    setWarningVisible(false);
    scheduleTimers();

    try {
      await touchActivityFn();
    } catch {
      // Client-side timer reset still applies if the server call fails.
    }
  }, [scheduleTimers, setWarningVisible]);

  const logOutNow = useCallback(() => {
    void performLogout('manual');
  }, [performLogout]);

  useEffect(() => {
    if (!enabled || !token) {
      clearTimers();
      setWarningVisible(false);
      return;
    }

    if (!localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
      writeLastActivity();
    }

    scheduleTimers();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleDebouncedActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimers();
        return;
      }
      scheduleTimers();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_STORAGE_KEY) {
        return;
      }

      setWarningVisible(false);
      scheduleTimers();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearTimers();
      if (debounceTimeoutRef.current != null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }

      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleDebouncedActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [
    clearTimers,
    enabled,
    handleDebouncedActivity,
    scheduleTimers,
    setWarningVisible,
    token,
  ]);

  useEffect(() => {
    if (enabled && token) {
      scheduleTimers();
    }
  }, [enabled, scheduleTimers, timeoutMinutes, token]);

  return {
    showWarning,
    stayLoggedIn,
    logOutNow,
  };
}
