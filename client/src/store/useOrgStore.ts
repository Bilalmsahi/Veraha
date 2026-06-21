import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization } from '@/types/models';

interface OrgState {
  org: Organization | null;
  setupComplete: boolean;
  enabledFrameworks: string[];
  setOrg: (org: Organization | null) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      org: null,
      setupComplete: false,
      enabledFrameworks: [],
      setOrg: (org) =>
        set({
          org,
          setupComplete: org?.setupComplete ?? false,
          enabledFrameworks: (org?.settings?.enabledFrameworks as string[]) ?? [],
        }),
    }),
    {
      name: 'veraha-org',
      partialize: (state) => ({
        org: state.org,
        setupComplete: state.setupComplete,
        enabledFrameworks: state.enabledFrameworks,
      }),
    }
  )
);
