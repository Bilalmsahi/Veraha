import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { isSessionTimeoutResponse } from '@/utils/isSessionTimeoutResponse';

const apiBaseURL = (import.meta.env.VITE_API_URL || '').replace(
  'http://localhost:5000',
  'http://127.0.0.1:5000'
);

export const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // FormData: let Axios auto-set Content-Type with boundary (required for multipart uploads)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const originalRequest = error?.config;
    const responseData = error?.response?.data;
    const sessionTimedOut = isSessionTimeoutResponse(responseData);

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !sessionTimedOut &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const { refreshToken, user, setAuth } = useAuthStore.getState();
      originalRequest._retry = true;

      if (user) {
        try {
          const { data } = await refreshClient.post('/auth/refresh', refreshToken ? { refreshToken } : undefined);
          const accessToken = data?.data?.accessToken || data?.data?.token;
          const nextRefreshToken = data?.data?.refreshToken;

          if (accessToken) {
            setAuth({ token: accessToken, refreshToken: nextRefreshToken ?? refreshToken ?? null, user });
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
          }
        } catch {
          // Fall through to the logout path below.
        }
      }
    }

    if (status === 401) {
      const { logout } = useAuthStore.getState();

      logout();

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = sessionTimedOut ? '/login?reason=timeout' : '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
