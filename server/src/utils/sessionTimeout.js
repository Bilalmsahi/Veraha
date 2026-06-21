export const DEFAULT_SESSION_TIMEOUT_MINUTES = 1440;

export const ALLOWED_SESSION_TIMEOUT_MINUTES = [30, 60, 240, 480, 1440, 2880, 4320, 10080];

export const resolveSessionTimeoutMinutes = (value) => {
    return ALLOWED_SESSION_TIMEOUT_MINUTES.includes(value)
        ? value
        : DEFAULT_SESSION_TIMEOUT_MINUTES;
};

export const getSessionTimeoutMinutes = (subject) => {
    return resolveSessionTimeoutMinutes(subject?.settings?.sessionTimeoutMinutes);
};

export const getLastActivityTimestamp = (user) => {
    if (user?.lastActivityAt) {
        return user.lastActivityAt.getTime();
    }
    if (user?.lastLoginAt) {
        return user.lastLoginAt.getTime();
    }
    return null;
};

export const isSessionExpired = (user, now = Date.now(), timeoutMinutes = getSessionTimeoutMinutes(user)) => {
    const lastActivity = getLastActivityTimestamp(user);
    if (lastActivity == null) {
        return false;
    }

    const timeoutMs = resolveSessionTimeoutMinutes(timeoutMinutes) * 60 * 1000;
    return now - lastActivity > timeoutMs;
};
