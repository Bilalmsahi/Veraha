import axios from 'axios';

/** Axios generic error message we never want to show to users */
const AXIOS_GENERIC_PATTERN = /^Request failed with status code \d+$/;

/** Server messages that are too generic for 4xx - use status-based message instead */
const GENERIC_SERVER_MESSAGES = [
  'an internal server error occurred',
  'internal server error',
  'something went wrong',
];

/**
 * Extract a user-friendly error message from API/axios errors.
 * Server returns { success: false, error: "message" } for API errors.
 * Never surfaces raw Axios messages like "Request failed with status code 401".
 */
export function getApiErrorMessage(error: unknown, fallback = 'The request could not be completed. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const status = error.response?.status;
    const serverMessage =
      (typeof data?.error === 'string' && data.error.trim() ? data.error : null) ??
      (typeof data?.message === 'string' && data.message.trim() ? data.message : null);

    const isGeneric =
      serverMessage &&
      status != null &&
      status >= 400 &&
      status < 500 &&
      GENERIC_SERVER_MESSAGES.some((g) => serverMessage.toLowerCase().includes(g));

    if (serverMessage && !isGeneric) return serverMessage.trim();

    if (status === 400) return 'Invalid request. Please check your input and try again.';
    if (status === 401) {
      const isLoginPage =
        typeof window !== 'undefined' && window.location.pathname === '/login';
      return isLoginPage
        ? 'Invalid email or password. Please check your credentials and try again.'
        : 'Session expired. Please log in again.';
    }
    if (status === 403) return "You don't have permission to perform this action.";
    if (status === 404) return 'The requested resource was not found.';
    if (status === 409) return 'This update conflicts with current data. Refreshing may show that it already exists.';
    if (status === 422) return 'The request could not be processed. Please check your input.';
    if (status != null && status >= 500) return 'The server is temporarily unavailable. Please try again later.';
    if (error.code === 'ERR_NETWORK') return 'Unable to connect. Please check your internet connection.';
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (AXIOS_GENERIC_PATTERN.test(error.message)) return fallback;
  }
  if (error instanceof Error && error.message && !AXIOS_GENERIC_PATTERN.test(error.message)) {
    return error.message;
  }
  return fallback;
}
