import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOrgStore } from './useOrgStore';
import { LAST_ACTIVITY_STORAGE_KEY } from '@/constants/sessionTimeout';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';

export interface AuthUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (payload: { token: string; user: AuthUser; refreshToken?: string | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: ({ token, user, refreshToken }) =>
        set((state) => ({
          token,
          refreshToken: refreshToken === undefined ? state.refreshToken : refreshToken,
          user,
        })),
      logout: () => {
        useOrgStore.getState().setOrg(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        }
        set({
          token: null,
          refreshToken: null,
          user: null,
        });
      },
    }),
    {
      name: 'veraha-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
